use rand::{distr::{Alphanumeric, SampleString}, rngs::ThreadRng};

pub fn generate_trade_id() -> String {
    let random_suffix = Alphanumeric
        .sample_string(&mut rand::rng(), 13)
        .to_ascii_lowercase();

    format!("trd_{}", random_suffix)
}

pub fn generate_candle_id() -> String {
    let random_suffix = Alphanumeric
    .sample_string(&mut rand::rng(), 13)
    .to_ascii_lowercase();

    format!("cd_{}", random_suffix)
}
