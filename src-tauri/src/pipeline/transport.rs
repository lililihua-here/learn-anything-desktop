use bytes::Bytes;
use futures::stream::{BoxStream, StreamExt};
use std::time::Duration;

use crate::providers::traits::{ProviderAdapter, ToolDef};

const REQUEST_TIMEOUT_SECS: u64 = 30;
const CONNECT_TIMEOUT_SECS: u64 = 10;
const MAX_RETRIES: u32 = 3;

pub async fn start_stream(
    api_key: &str,
    adapter: &dyn ProviderAdapter,
    model: &str,
    system_prompt: &str,
    messages: &[serde_json::Value],
    tools: &[ToolDef],
) -> Result<BoxStream<'static, Result<Bytes, reqwest::Error>>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .connect_timeout(Duration::from_secs(CONNECT_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let payload = adapter.build_chat_request(model, system_prompt, messages, tools);
    let (auth_name, auth_value) = adapter.auth_header(api_key);

    let mut last_error = String::new();
    for attempt in 0..=MAX_RETRIES {
        if attempt > 0 {
            tokio::time::sleep(Duration::from_secs(2u64.pow(attempt - 1))).await;
        }

        let mut request = client
            .post(&payload.endpoint)
            .header(&auth_name, &auth_value)
            .json(&payload.body);

        for (header_name, header_value) in &payload.headers {
            request = request.header(header_name, header_value);
        }

        let response = match request.send().await {
            Ok(r) => r,
            Err(e) => {
                last_error = format!("Transport error: {}", e);
                if is_retryable(&e) && attempt < MAX_RETRIES {
                    continue;
                }
                return Err(last_error);
            }
        };

        if response.status().is_success() {
            return Ok(response.bytes_stream().boxed());
        }

        let status = response.status();
        let msg = response.text().await.unwrap_or_default();
        last_error = format!("API {}: {}", status, msg);

        if status.is_server_error() && attempt < MAX_RETRIES {
            continue;
        }
        return Err(last_error);
    }

    Err(last_error)
}

fn is_retryable(e: &reqwest::Error) -> bool {
    e.is_timeout() || e.is_connect() || e.is_request()
}
