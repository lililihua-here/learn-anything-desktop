use bytes::Bytes;
use futures::stream::{BoxStream, StreamExt};
use std::time::Duration;

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const REQUEST_TIMEOUT_SECS: u64 = 30;
const CONNECT_TIMEOUT_SECS: u64 = 10;
const MAX_RETRIES: u32 = 3;

pub async fn start_stream(
    api_key: &str,
    model: &str,
    system_prompt: &str,
    messages: &[serde_json::Value],
    tools: &[serde_json::Value],
) -> Result<BoxStream<'static, Result<Bytes, reqwest::Error>>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .connect_timeout(Duration::from_secs(CONNECT_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let body = serde_json::json!({
        "model": model,
        "max_tokens": 4096,
        "system": system_prompt,
        "messages": messages,
        "tools": tools,
        "stream": true
    });

    let mut last_error = String::new();
    for attempt in 0..=MAX_RETRIES {
        if attempt > 0 {
            tokio::time::sleep(Duration::from_secs(2u64.pow(attempt - 1))).await;
        }

        let response = match client
            .post(ANTHROPIC_API_URL)
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                last_error = format!("Transport error: {}", e);
                if is_retryable(&e) && attempt < MAX_RETRIES { continue; }
                return Err(last_error);
            }
        };

        if response.status().is_success() {
            return Ok(response.bytes_stream().boxed());
        }

        let status = response.status();
        let msg = response.text().await.unwrap_or_default();
        last_error = format!("API {}: {}", status, msg);

        if status.is_server_error() && attempt < MAX_RETRIES { continue; }
        return Err(last_error);
    }

    Err(last_error)
}

fn is_retryable(e: &reqwest::Error) -> bool {
    e.is_timeout() || e.is_connect() || e.is_request()
}
