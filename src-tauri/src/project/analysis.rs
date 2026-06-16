use super::scanner::{ProjectFile, ScanResult};
use serde::{Deserialize, Serialize};
use serde_json::Value;

const REQUEST_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(30);
const PER_FILE_CHAR_LIMIT: usize = 5000;
const ROUND1_CHAR_BUDGET: usize = 30_000;
const ROUND2_CHAR_BUDGET: usize = 90_000;
const ROUND3_CHAR_BUDGET: usize = 90_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoundConcept {
    pub name: String,
    pub category: String,
    pub files: Vec<String>,
    pub line_refs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeUnderstandingMap {
    pub project_name: String,
    pub tech_stack: Vec<String>,
    pub concepts_found: Vec<FoundConcept>,
}

fn read_file_content(path: &str) -> Result<(String, bool), String> {
    let full =
        std::fs::read_to_string(path).map_err(|e| format!("Failed to read {}: {}", path, e))?;
    if full.chars().count() > PER_FILE_CHAR_LIMIT {
        let truncated: String = full.chars().take(PER_FILE_CHAR_LIMIT).collect();
        Ok((truncated, true))
    } else {
        Ok((full, false))
    }
}

fn build_file_summary(files: &[&ProjectFile], char_budget: usize) -> String {
    let mut buf = String::with_capacity(char_budget);
    for pf in files {
        let header = format!(
            "\n--- FILE: {} ({}) size={} ---\n",
            pf.relative_path, pf.extension, pf.size
        );
        if buf.len() + header.len() > char_budget {
            break;
        }
        buf.push_str(&header);

        match read_file_content(&pf.path) {
            Ok((content, truncated)) => {
                let remaining = char_budget.saturating_sub(buf.len());
                let snippet: String = content.chars().take(remaining).collect();
                buf.push_str(&snippet);
                if truncated {
                    buf.push_str("\n... [truncated]");
                }
            }
            Err(e) => buf.push_str(&format!("[read error: {}]", e)),
        }

        if buf.len() >= char_budget {
            buf.push_str("\n... [budget exhausted]");
            break;
        }
    }
    buf
}

async fn call_llm(
    prompt: &str,
    api_key: &str,
    provider: &str,
    model: &str,
) -> Result<String, String> {
    let adapter = crate::providers::create_provider_adapter(provider)?;
    let client = reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .connect_timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let payload = adapter.build_non_streaming_request(
        model,
        "You are a code analysis expert. Always respond with valid JSON only. No markdown, no explanation.",
        prompt,
    );
    let (auth_name, auth_value) = adapter.auth_header(api_key);

    let mut request = client
        .post(&payload.endpoint)
        .header(auth_name, auth_value)
        .json(&payload.body);

    for (header_name, header_value) in &payload.headers {
        request = request.header(header_name, header_value);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("API error {}: {}", status, text));
    }

    let resp_body: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API response: {}", e))?;

    let text_content = adapter
        .parse_text_response(&resp_body)
        .ok_or_else(|| "No text content in API response".to_string())?;

    Ok(text_content)
}

fn extract_json(raw: &str) -> String {
    let text = raw.trim();
    if let Some(inner) = text.strip_prefix("```json") {
        if let Some(end) = inner.rfind("```") {
            inner[..end].trim().to_string()
        } else {
            inner.trim().to_string()
        }
    } else if let Some(inner) = text.strip_prefix("```") {
        if let Some(end) = inner.rfind("```") {
            inner[..end].trim().to_string()
        } else {
            inner.trim().to_string()
        }
    } else {
        text.to_string()
    }
}

async fn round1_tech_stack(
    project_name: &str,
    files: &[ProjectFile],
    api_key: &str,
    provider: &str,
    model: &str,
) -> Result<(Vec<String>, Vec<FoundConcept>), String> {
    let round1_files: Vec<&ProjectFile> = files.iter().take(20).collect();
    let file_summary = build_file_summary(&round1_files, ROUND1_CHAR_BUDGET);

    let prompt = format!(
        r#"Analyze the following project files and return a JSON object.

## Project Name: {project_name}

## Project Files
{file_summary}

## Instructions
Identify:
1. The tech stack (programming languages, frameworks, libraries, build tools)
2. Initial concepts found (design patterns, architecture patterns, key modules)

## Output Format (JSON only, no markdown):
{{
  "tech_stack": ["language/framework", ...],
  "concepts": [
    {{"name": "concept name", "category": "architecture|pattern|module|dependency", "files": ["relative/path"], "line_refs": []}}
  ]
}}
"#,
        project_name = project_name,
        file_summary = file_summary,
    );

    let resp_text = call_llm(&prompt, api_key, provider, model).await?;
    let json_str = extract_json(&resp_text);

    let parsed: Value = serde_json::from_str(&json_str).map_err(|e| {
        format!(
            "Round 1 JSON parse error: {} -- raw: {}",
            e,
            &json_str[..json_str.len().min(500)]
        )
    })?;

    let tech_stack: Vec<String> = parsed["tech_stack"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    let concepts: Vec<FoundConcept> = parsed["concepts"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|v| {
                    Some(FoundConcept {
                        name: v["name"].as_str()?.to_string(),
                        category: v["category"].as_str().unwrap_or("unknown").to_string(),
                        files: v["files"]
                            .as_array()
                            .map(|fa| {
                                fa.iter()
                                    .filter_map(|fv| fv.as_str().map(|s| s.to_string()))
                                    .collect()
                            })
                            .unwrap_or_default(),
                        line_refs: v["line_refs"]
                            .as_array()
                            .map(|la| {
                                la.iter()
                                    .filter_map(|lv| lv.as_str().map(|s| s.to_string()))
                                    .collect()
                            })
                            .unwrap_or_default(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Ok((tech_stack, concepts))
}

async fn round2_deep_dive(
    project_name: &str,
    files: &[ProjectFile],
    existing_concepts: &[FoundConcept],
    api_key: &str,
    provider: &str,
    model: &str,
) -> Result<Vec<FoundConcept>, String> {
    let round2_files: Vec<&ProjectFile> = files.iter().skip(10).take(40).collect();
    let file_summary = build_file_summary(&round2_files, ROUND2_CHAR_BUDGET);
    let existing_names: Vec<String> = existing_concepts.iter().map(|c| c.name.clone()).collect();

    let prompt = format!(
        r#"Deep-dive into the following source files and discover additional concepts.

## Project Name: {project_name}

## Already Identified Concepts
{existing_names:?}

## Source Files
{file_summary}

## Instructions
Find NEW concepts NOT already listed above. Focus on:
- Module responsibilities and boundaries
- Dependency injection / inversion patterns
- Error handling strategies
- State management approaches
- Communication patterns (events, pub/sub, channels)
- Serialization / data transformation
- Authentication / authorization
- Testing patterns

## Output Format (JSON only, no markdown):
{{
  "new_concepts": [
    {{"name": "concept name", "category": "architecture|pattern|module|dependency|error-handling|state|communication|data|auth|testing", "files": ["relative/path"], "line_refs": []}}
  ]
}}
"#,
        project_name = project_name,
        existing_names = existing_names,
        file_summary = file_summary,
    );

    let resp_text = call_llm(&prompt, api_key, provider, model).await?;
    let json_str = extract_json(&resp_text);

    let parsed: Value = serde_json::from_str(&json_str).map_err(|e| {
        format!(
            "Round 2 JSON parse error: {} -- raw: {}",
            e,
            &json_str[..json_str.len().min(500)]
        )
    })?;

    let new_concepts: Vec<FoundConcept> = parsed["new_concepts"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|v| {
                    Some(FoundConcept {
                        name: v["name"].as_str()?.to_string(),
                        category: v["category"].as_str().unwrap_or("unknown").to_string(),
                        files: v["files"]
                            .as_array()
                            .map(|fa| {
                                fa.iter()
                                    .filter_map(|fv| fv.as_str().map(|s| s.to_string()))
                                    .collect()
                            })
                            .unwrap_or_default(),
                        line_refs: v["line_refs"]
                            .as_array()
                            .map(|la| {
                                la.iter()
                                    .filter_map(|lv| lv.as_str().map(|s| s.to_string()))
                                    .collect()
                            })
                            .unwrap_or_default(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(new_concepts)
}

async fn round3_cross_reference(
    project_name: &str,
    files: &[ProjectFile],
    all_concepts: &[FoundConcept],
    api_key: &str,
    provider: &str,
    model: &str,
) -> Result<Vec<FoundConcept>, String> {
    let round3_files: Vec<&ProjectFile> = files.iter().skip(50).take(50).collect();
    let file_summary = build_file_summary(&round3_files, ROUND3_CHAR_BUDGET);
    let concepts_summary: Vec<String> = all_concepts
        .iter()
        .map(|c| format!("{} ({}): {:?}", c.name, c.category, c.files))
        .collect();

    let prompt = format!(
        r#"Cross-reference the remaining files and fill gaps in the existing analysis.

## Project Name: {project_name}

## Existing Analysis
{concepts_summary:?}

## Remaining Files
{file_summary}

## Instructions
- Identify any missing architecture layers, patterns, or components
- Find integration points between existing concepts
- Discover utility/helper modules and configuration patterns
- Note any gaps in test coverage visible from file structure

## Output Format (JSON only, no markdown):
{{
  "gap_concepts": [
    {{"name": "concept name", "category": "integration|utility|config|gap|test-coverage", "files": ["relative/path"], "line_refs": []}}
  ]
}}
"#,
        project_name = project_name,
        concepts_summary = concepts_summary,
        file_summary = file_summary,
    );

    let resp_text = call_llm(&prompt, api_key, provider, model).await?;
    let json_str = extract_json(&resp_text);

    let parsed: Value = serde_json::from_str(&json_str).map_err(|e| {
        format!(
            "Round 3 JSON parse error: {} -- raw: {}",
            e,
            &json_str[..json_str.len().min(500)]
        )
    })?;

    let gap_concepts: Vec<FoundConcept> = parsed["gap_concepts"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|v| {
                    Some(FoundConcept {
                        name: v["name"].as_str()?.to_string(),
                        category: v["category"].as_str().unwrap_or("unknown").to_string(),
                        files: v["files"]
                            .as_array()
                            .map(|fa| {
                                fa.iter()
                                    .filter_map(|fv| fv.as_str().map(|s| s.to_string()))
                                    .collect()
                            })
                            .unwrap_or_default(),
                        line_refs: v["line_refs"]
                            .as_array()
                            .map(|la| {
                                la.iter()
                                    .filter_map(|lv| lv.as_str().map(|s| s.to_string()))
                                    .collect()
                            })
                            .unwrap_or_default(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(gap_concepts)
}

pub async fn analyze_project(
    project_name: &str,
    scan: &ScanResult,
    provider: &str,
    model: &str,
) -> Result<CodeUnderstandingMap, String> {
    let api_key = crate::commands::settings::get_api_key_for_provider(provider)?;

    if scan.included_files.is_empty() {
        return Ok(CodeUnderstandingMap {
            project_name: project_name.to_string(),
            tech_stack: Vec::new(),
            concepts_found: Vec::new(),
        });
    }

    let inc_files = &scan.included_files;

    let (tech_stack, round1_concepts) =
        round1_tech_stack(project_name, inc_files, &api_key, provider, model).await?;

    let mut all_concepts = round1_concepts;

    if inc_files.len() > 10 {
        let round2_concepts = round2_deep_dive(
            project_name,
            inc_files,
            &all_concepts,
            &api_key,
            provider,
            model,
        )
        .await?;
        all_concepts.extend(round2_concepts);
    }

    if inc_files.len() > 50 {
        let round3_concepts = round3_cross_reference(
            project_name,
            inc_files,
            &all_concepts,
            &api_key,
            provider,
            model,
        )
        .await?;
        all_concepts.extend(round3_concepts);
    }

    let mut seen = std::collections::HashSet::new();
    all_concepts.retain(|c| seen.insert(c.name.clone()));

    Ok(CodeUnderstandingMap {
        project_name: project_name.to_string(),
        tech_stack,
        concepts_found: all_concepts,
    })
}
