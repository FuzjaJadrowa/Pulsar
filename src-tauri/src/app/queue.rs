use directories::BaseDirs;
use rusqlite::{params, types::Type, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;

const QUEUE_SCHEMA_VERSION: i64 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueItemState {
    pub id: String,
    #[serde(default = "default_item_type", alias = "item_type")]
    pub item_type: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub thumbnail: String,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub progress: f64,
    #[serde(default)]
    pub eta: String,
    #[serde(default, alias = "added_at")]
    pub added_at: u64,
    #[serde(default)]
    pub payload: Value,
    #[serde(default)]
    pub path: String,
    #[serde(default, alias = "skipped_by_stop")]
    pub skipped_by_stop: bool,
    #[serde(default, alias = "pending_start_reason")]
    pub pending_start_reason: Option<String>,
    #[serde(default)]
    pub source: String,
}

fn default_item_type() -> String {
    "download".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct QueueState {
    pub items: Vec<QueueItemState>,
    #[serde(default, alias = "priority_queue")]
    pub priority_queue: Vec<String>,
}

pub struct QueueManager {
    connection: Mutex<Connection>,
}

impl QueueManager {
    pub fn new() -> Result<Self, String> {
        let db_path = Self::get_queue_path();
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                format!(
                    "Failed to create queue database directory {}: {e}",
                    parent.display()
                )
            })?;
        }

        let mut connection = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open queue database {}: {e}", db_path.display()))?;
        connection
            .execute_batch(
                "PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON;",
            )
            .map_err(|e| format!("Failed to configure queue database: {e}"))?;
        Self::initialize_schema(&mut connection)?;

        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    fn get_queue_path() -> PathBuf {
        if let Some(base_dirs) = BaseDirs::new() {
            return base_dirs
                .data_local_dir()
                .join("Pulsar")
                .join("queue.sqlite3");
        }
        PathBuf::from("queue.sqlite3")
    }

    fn initialize_schema(connection: &mut Connection) -> Result<(), String> {
        let version: i64 = connection
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .map_err(|e| format!("Failed to read queue schema version: {e}"))?;
        if version > QUEUE_SCHEMA_VERSION {
            return Err(format!(
                "Queue database schema version {version} is newer than supported version {QUEUE_SCHEMA_VERSION}."
            ));
        }

        let has_queue_items = Self::table_exists(connection, "queue_items")?;
        if version == 0 && has_queue_items {
            return Err(
                "Unversioned queue database is not supported; a fresh queue database is required."
                    .to_string(),
            );
        } else {
            connection
                .execute_batch(
                    "BEGIN IMMEDIATE;
                     CREATE TABLE IF NOT EXISTS queue_items (
                         id TEXT PRIMARY KEY NOT NULL,
                         position INTEGER NOT NULL,
                         item_type TEXT NOT NULL,
                         title TEXT NOT NULL,
                         thumbnail TEXT NOT NULL,
                         status TEXT NOT NULL,
                         progress REAL NOT NULL,
                         eta TEXT NOT NULL,
                         added_at INTEGER NOT NULL,
                         payload TEXT NOT NULL,
                         path TEXT NOT NULL,
                         skipped_by_stop INTEGER NOT NULL,
                         pending_start_reason TEXT,
                         source TEXT NOT NULL
                     );
                     CREATE INDEX IF NOT EXISTS queue_items_status_position
                         ON queue_items(status, position);
                     CREATE TABLE IF NOT EXISTS queue_priority (
                         position INTEGER PRIMARY KEY NOT NULL,
                         item_id TEXT NOT NULL UNIQUE
                             REFERENCES queue_items(id) ON DELETE CASCADE
                     );
                     PRAGMA user_version = 1;
                     COMMIT;",
                )
                .map_err(|e| format!("Failed to create queue tables: {e}"))?;
        }
        Ok(())
    }

    fn table_exists(connection: &Connection, name: &str) -> Result<bool, String> {
        connection
            .query_row(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1",
                [name],
                |_| Ok(()),
            )
            .optional()
            .map(|found| found.is_some())
            .map_err(|e| format!("Failed to inspect queue database schema: {e}"))
    }

    pub fn load(&self) -> Result<QueueState, String> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| "Queue database lock is unavailable".to_string())?;
        let mut statement = connection
            .prepare(
                "SELECT id, item_type, title, thumbnail, status, progress, eta, added_at,
                        payload, path, skipped_by_stop, pending_start_reason, source
                 FROM queue_items ORDER BY position",
            )
            .map_err(|e| format!("Failed to read queue items: {e}"))?;
        let items = statement
            .query_map([], |row| {
                let payload: String = row.get(8)?;
                let payload = serde_json::from_str(&payload).map_err(|error| {
                    rusqlite::Error::FromSqlConversionFailure(8, Type::Text, Box::new(error))
                })?;
                let status: String = row.get(4)?;
                let interrupted = status == "downloading";
                let added_at: i64 = row.get(7)?;
                Ok(QueueItemState {
                    id: row.get(0)?,
                    item_type: row.get(1)?,
                    title: row.get(2)?,
                    thumbnail: row.get(3)?,
                    status: if interrupted {
                        "pending".to_string()
                    } else {
                        status
                    },
                    progress: if interrupted { 0.0 } else { row.get(5)? },
                    eta: if interrupted {
                        "--".to_string()
                    } else {
                        row.get(6)?
                    },
                    added_at: added_at.max(0) as u64,
                    payload,
                    path: row.get(9)?,
                    skipped_by_stop: row.get::<_, i64>(10)? != 0,
                    pending_start_reason: row.get(11)?,
                    source: row.get(12)?,
                })
            })
            .map_err(|e| format!("Failed to query queue items: {e}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to decode queue item: {e}"))?;

        let mut priority_statement = connection
            .prepare("SELECT item_id FROM queue_priority ORDER BY position")
            .map_err(|e| format!("Failed to read queue priority: {e}"))?;
        let priority_queue = priority_statement
            .query_map([], |row| row.get(0))
            .map_err(|e| format!("Failed to query queue priority: {e}"))?
            .collect::<Result<Vec<String>, _>>()
            .map_err(|e| format!("Failed to decode queue priority: {e}"))?;

        Ok(QueueState {
            items,
            priority_queue,
        })
    }

    pub fn save(&self, queue_state: &QueueState) -> Result<(), String> {
        let mut connection = self
            .connection
            .lock()
            .map_err(|_| "Queue database lock is unavailable".to_string())?;
        let transaction = connection
            .transaction()
            .map_err(|e| format!("Failed to begin queue transaction: {e}"))?;
        let item_ids = queue_state
            .items
            .iter()
            .map(|item| item.id.as_str())
            .collect::<HashSet<_>>();
        let mut unique_priorities = HashSet::new();
        let priorities = queue_state
            .priority_queue
            .iter()
            .filter(|id| item_ids.contains(id.as_str()) && unique_priorities.insert(id.as_str()))
            .collect::<Vec<_>>();
        let existing_priorities = {
            let mut statement = transaction
                .prepare("SELECT item_id FROM queue_priority ORDER BY position")
                .map_err(|e| format!("Failed to read current queue priorities: {e}"))?;
            let rows = statement
                .query_map([], |row| row.get::<_, String>(0))
                .map_err(|e| format!("Failed to query current queue priorities: {e}"))?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("Failed to decode current queue priorities: {e}"))?;
            rows
        };
        let priorities_changed = existing_priorities
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>()
            != priorities.iter().map(|id| id.as_str()).collect::<Vec<_>>();
        if priorities_changed {
            transaction
                .execute("DELETE FROM queue_priority", [])
                .map_err(|e| format!("Failed to update queue priorities: {e}"))?;
        }

        let existing_ids = {
            let mut statement = transaction
                .prepare("SELECT id FROM queue_items")
                .map_err(|e| format!("Failed to read current queue item IDs: {e}"))?;
            let rows = statement
                .query_map([], |row| row.get::<_, String>(0))
                .map_err(|e| format!("Failed to query current queue item IDs: {e}"))?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("Failed to decode current queue item IDs: {e}"))?;
            rows
        };
        for id in existing_ids {
            if !item_ids.contains(id.as_str()) {
                transaction
                    .execute("DELETE FROM queue_items WHERE id = ?1", [id])
                    .map_err(|e| format!("Failed to remove queue item: {e}"))?;
            }
        }

        {
            let mut upsert = transaction
                .prepare(
                    "INSERT INTO queue_items (
                         id, position, item_type, title, thumbnail, status, progress, eta,
                         added_at, payload, path, skipped_by_stop, pending_start_reason, source
                     ) VALUES (
                         ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14
                     )
                     ON CONFLICT(id) DO UPDATE SET
                         position = excluded.position,
                         item_type = excluded.item_type,
                         title = excluded.title,
                         thumbnail = excluded.thumbnail,
                         status = excluded.status,
                         progress = excluded.progress,
                         eta = excluded.eta,
                         added_at = excluded.added_at,
                         payload = excluded.payload,
                         path = excluded.path,
                         skipped_by_stop = excluded.skipped_by_stop,
                         pending_start_reason = excluded.pending_start_reason,
                         source = excluded.source
                     WHERE queue_items.position IS NOT excluded.position
                        OR queue_items.item_type IS NOT excluded.item_type
                        OR queue_items.title IS NOT excluded.title
                        OR queue_items.thumbnail IS NOT excluded.thumbnail
                        OR queue_items.status IS NOT excluded.status
                        OR queue_items.progress IS NOT excluded.progress
                        OR queue_items.eta IS NOT excluded.eta
                        OR queue_items.added_at IS NOT excluded.added_at
                        OR queue_items.payload IS NOT excluded.payload
                        OR queue_items.path IS NOT excluded.path
                        OR queue_items.skipped_by_stop IS NOT excluded.skipped_by_stop
                        OR queue_items.pending_start_reason IS NOT excluded.pending_start_reason
                        OR queue_items.source IS NOT excluded.source",
                )
                .map_err(|e| format!("Failed to prepare queue item update: {e}"))?;
            for (position, item) in queue_state.items.iter().enumerate() {
                let payload = serde_json::to_string(&item.payload)
                    .map_err(|e| format!("Failed to serialize queue item payload: {e}"))?;
                upsert
                    .execute(params![
                        item.id,
                        position as i64,
                        item.item_type,
                        item.title,
                        item.thumbnail,
                        item.status,
                        item.progress,
                        item.eta,
                        item.added_at.min(i64::MAX as u64) as i64,
                        payload,
                        item.path,
                        item.skipped_by_stop as i64,
                        item.pending_start_reason,
                        item.source,
                    ])
                    .map_err(|e| format!("Failed to save queue item '{}': {e}", item.id))?;
            }
        }

        if priorities_changed {
            let mut insert = transaction
                .prepare("INSERT INTO queue_priority (position, item_id) VALUES (?1, ?2)")
                .map_err(|e| format!("Failed to prepare queue priority update: {e}"))?;
            for (position, item_id) in priorities.iter().enumerate() {
                insert
                    .execute(params![position as i64, item_id])
                    .map_err(|e| format!("Failed to save queue priority: {e}"))?;
            }
        }

        transaction
            .commit()
            .map_err(|e| format!("Failed to commit queue transaction: {e}"))
    }
}
