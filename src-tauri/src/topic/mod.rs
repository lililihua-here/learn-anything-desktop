use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KnowledgeMapOutput {
    pub topic_name: String,
    pub topic_slug: String,
    pub topic_type: String,
    pub depth: String,
    pub domains: Vec<DomainOutput>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DomainOutput {
    pub name: String,
    pub slug: String,
    pub concepts: Vec<ConceptOutput>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConceptOutput {
    pub name: String,
    pub slug: String,
    pub description: String,
    pub prerequisites: Vec<String>,
    pub difficulty: String,
    pub estimated_minutes: i64,
}

#[derive(Debug, Deserialize)]
pub(crate) struct KnowledgeMapRaw {
    pub domains: Vec<DomainOutput>,
}
