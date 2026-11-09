pub(super) fn clamp(value: f64, min: f64, max: f64) -> f64 {
    if !value.is_finite() {
        return min;
    }
    if value < min {
        return min;
    }
    if value > max {
        return max;
    }
    value
}

pub(super) fn qscale_from_percent(percent: f64) -> u32 {
    let clamped = clamp(percent, 1.0, 100.0);
    let q = 2.0 + (100.0 - clamped) / 100.0 * 29.0;
    clamp(q, 2.0, 31.0).round() as u32
}

pub(super) fn qscale_from_crf(crf: u32) -> u32 {
    let clamped = crf.min(51) as f64;
    let q = 2.0 + (clamped / 51.0) * 29.0;
    clamp(q, 2.0, 31.0).round() as u32
}
