use super::*;
use crate::features::downloads::terminal_event_succeeded;

#[tauri::command]
pub fn start_batch_convert(
    app_handle: AppHandle,
    state: State<BridgeState>,
    config_mgr: State<ConfigManager>,
    options: BatchConvertOptions,
) -> Result<String, String> {
    let task_id = options.client_task_id.trim().to_string();
    if task_id.is_empty() {
        return Err("Task ID cannot be empty.".to_string());
    }
    if options.items.is_empty() {
        return Err("Batch items list cannot be empty.".to_string());
    }

    let items = options.items;
    let cancel_flag = state.register_batch_cancel(task_id.clone());

    let max_concurrent = {
        let config = config_mgr.config.lock().unwrap();
        (config.maximum_concurrent_processes as usize).max(1)
    };

    let app_handle_clone = app_handle.clone();
    let task_id_clone = task_id.clone();

    std::thread::spawn(move || {
        use std::sync::atomic::{AtomicBool, Ordering};
        let failed = std::sync::Arc::new(AtomicBool::new(false));
        let total = items.len();
        let category = items[0]
            .category
            .as_deref()
            .unwrap_or("image")
            .trim()
            .to_lowercase();

        let emit_event = |payload: serde_json::Value| {
            let _ = app_handle_clone.emit("download-event", payload);
        };

        if category == "video" || category == "audio" {
            for (idx, mut item_opts) in items.into_iter().enumerate() {
                if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
                    emit_event(serde_json::json!({ "type": "cancelled", "id": task_id_clone }));
                    let bridge_state = app_handle_clone.state::<BridgeState>();
                    bridge_state.unregister_batch_cancel(&task_id_clone);
                    return;
                }

                let sub_id = format!("{}_sub_{}", task_id_clone, idx);
                item_opts.client_task_id = Some(sub_id.clone());

                let bridge_state = app_handle_clone.state::<BridgeState>();
                let config_mgr_state = app_handle_clone.state::<ConfigManager>();
                let sub_rx = bridge_state.register_sub_listener(sub_id.clone());

                let result = start_convert(
                    app_handle_clone.clone(),
                    bridge_state.clone(),
                    config_mgr_state.clone(),
                    item_opts,
                );
                let mut item_succeeded = false;
                match result {
                    Ok(_) => {
                        while let Ok(msg) = sub_rx.recv() {
                            if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
                                let _ = cancel_download(
                                    app_handle_clone.clone(),
                                    bridge_state.clone(),
                                    sub_id.clone(),
                                );
                                break;
                            }

                            let sub_pct =
                                msg.get("percent").and_then(|v| v.as_f64()).unwrap_or(0.0);
                            let overall_pct = (((idx as f64) + (sub_pct / 100.0)) / (total as f64)
                                * 100.0)
                                .clamp(0.0, 100.0);
                            emit_event(serde_json::json!({
                                "type": "progress",
                                "id": task_id_clone,
                                "percent": overall_pct,
                                "item_index": idx + 1,
                                "item_count": total
                            }));

                            if is_terminal_event(&msg) {
                                item_succeeded = terminal_event_succeeded(&msg);
                                break;
                            }
                        }
                    }
                    Err(error) => emit_event(serde_json::json!({
                        "type": "item_error", "id": task_id_clone, "item_index": idx + 1, "error": error
                    })),
                }
                if !item_succeeded && !cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
                    failed.store(true, Ordering::SeqCst);
                }
                bridge_state.unregister_sub_listener(&sub_id);
            }
        } else {
            use std::sync::atomic::{AtomicUsize, Ordering};
            use std::sync::{Arc, Mutex};

            let completed = Arc::new(AtomicUsize::new(0));
            let items_queue = Arc::new(Mutex::new(
                items.into_iter().enumerate().collect::<Vec<_>>(),
            ));

            let mut threads = Vec::new();
            for _ in 0..max_concurrent {
                let queue = items_queue.clone();
                let completed_ref = completed.clone();
                let cancel_ref = cancel_flag.clone();
                let app = app_handle_clone.clone();
                let tid = task_id_clone.clone();
                let failed_ref = failed.clone();

                let handle = std::thread::spawn(move || loop {
                    if cancel_ref.load(Ordering::SeqCst) {
                        break;
                    }
                    let next_item = {
                        let mut q = queue.lock().unwrap();
                        if q.is_empty() {
                            None
                        } else {
                            Some(q.remove(0))
                        }
                    };

                    let (idx, mut item_opts) = match next_item {
                        Some(item) => item,
                        None => break,
                    };

                    let sub_id = format!("{}_sub_{}", tid, idx);
                    item_opts.client_task_id = Some(sub_id.clone());

                    let bridge_state = app.state::<BridgeState>();
                    let config_mgr_state = app.state::<ConfigManager>();
                    let sub_rx = bridge_state.register_sub_listener(sub_id.clone());

                    let result = start_convert(
                        app.clone(),
                        bridge_state.clone(),
                        config_mgr_state.clone(),
                        item_opts,
                    );
                    let mut item_succeeded = false;
                    match result {
                        Ok(_) => {
                            while let Ok(msg) = sub_rx.recv() {
                                if cancel_ref.load(Ordering::SeqCst) {
                                    let _ = cancel_download(
                                        app.clone(),
                                        bridge_state.clone(),
                                        sub_id.clone(),
                                    );
                                    break;
                                }
                                if is_terminal_event(&msg) {
                                    item_succeeded = terminal_event_succeeded(&msg);
                                    break;
                                }
                            }
                        }
                        Err(error) => {
                            failed_ref.store(true, Ordering::SeqCst);
                            let _ = app.emit("download-event", serde_json::json!({
                                    "type": "item_error", "id": tid, "item_index": idx + 1, "error": error
                                }));
                        }
                    }
                    if !item_succeeded && !cancel_ref.load(Ordering::SeqCst) {
                        failed_ref.store(true, Ordering::SeqCst);
                    }
                    bridge_state.unregister_sub_listener(&sub_id);

                    let count = completed_ref.fetch_add(1, Ordering::SeqCst) + 1;
                    let pct = ((count as f64) / (total as f64) * 100.0).clamp(0.0, 100.0);
                    let _ = app.emit(
                        "download-event",
                        serde_json::json!({
                            "type": "progress",
                            "id": tid,
                            "percent": pct,
                            "item_index": count,
                            "item_count": total
                        }),
                    );
                });
                threads.push(handle);
            }

            for t in threads {
                let _ = t.join();
            }
        }

        if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
            emit_event(serde_json::json!({ "type": "cancelled", "id": task_id_clone }));
        } else {
            emit_event(serde_json::json!({
                "type": "finished",
                "id": task_id_clone,
                "success": !failed.load(std::sync::atomic::Ordering::SeqCst)
            }));
        }

        let bridge_state = app_handle_clone.state::<BridgeState>();
        bridge_state.unregister_batch_cancel(&task_id_clone);
    });

    Ok(task_id)
}
