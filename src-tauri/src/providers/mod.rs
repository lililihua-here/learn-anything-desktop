pub mod anthropic;
pub mod deepseek;
pub mod openai;
pub mod qwen;
pub mod traits;

use std::collections::HashMap;
use traits::ProviderAdapter;

/// Registry of provider adapters keyed by provider name (e.g. "anthropic", "openai").
///
/// Adapters stored here are immutable definition/factory objects.
/// Each streaming request creates a fresh adapter instance so that mutable
/// parse state (for multi-chunk tool-call accumulation) does not leak across
/// concurrent requests.
pub struct ProviderRegistry {
    adapters: HashMap<String, Box<dyn ProviderAdapter>>,
}

impl ProviderRegistry {
    /// Create an empty registry.
    pub fn new() -> Self {
        Self {
            adapters: HashMap::new(),
        }
    }

    /// Look up an adapter by provider name. Returns `None` if not registered.
    pub fn get(&self, name: &str) -> Option<&dyn ProviderAdapter> {
        self.adapters.get(name).map(|a| a.as_ref())
    }

    /// Register an adapter. The adapter's `provider_name()` value is used as
    /// the lookup key, replacing any existing registration with the same name.
    pub fn register(&mut self, adapter: Box<dyn ProviderAdapter>) {
        self.adapters
            .insert(adapter.provider_name().to_string(), adapter);
    }

    /// Create a registry pre-populated with the built-in adapters
    /// (Anthropic, OpenAI, DeepSeek, and Qwen).
    pub fn default() -> Self {
        let mut registry = Self::new();
        registry.register(create_provider_adapter("anthropic").expect("anthropic adapter"));
        registry.register(create_provider_adapter("openai").expect("openai adapter"));
        registry.register(create_provider_adapter("deepseek").expect("deepseek adapter"));
        registry.register(create_provider_adapter("qwen").expect("qwen adapter"));
        registry
    }
}

pub fn create_provider_adapter(name: &str) -> Result<Box<dyn ProviderAdapter>, String> {
    match name {
        "anthropic" => Ok(Box::new(anthropic::AnthropicAdapter::new())),
        "openai" => Ok(Box::new(openai::OpenAIAdapter::new())),
        "deepseek" => Ok(Box::new(deepseek::DeepSeekAdapter::new())),
        "qwen" => Ok(Box::new(qwen::QwenAdapter::new())),
        _ => Err(format!("Unsupported provider: {}", name)),
    }
}
