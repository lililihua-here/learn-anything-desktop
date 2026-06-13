import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface StreamPayload {
  event_type: "text_delta" | "tool_use" | "done" | "error";
  content: string;
  tool_name?: string;
  tool_input?: unknown;
  session_id: string;
  concept_slug: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CardQueueItem {
  card_id: string;
  position: number;
  status: string;
  defer_count: number;
}

export interface QuizSubmission {
  question_index: number;
  quiz_json: string;
  user_answer: string;
  result: string;
  score?: number;
}

export function startChatStream(
  provider: string,
  model: string,
  conceptSlug: string,
  conceptName: string,
  messages: ChatMessage[],
  l1Context: string,
  resumeSessionId?: string
): Promise<string> {
  return invoke("start_chat_stream", {
    provider,
    model,
    conceptSlug,
    conceptName,
    messages,
    l1Context,
    resumeSessionId,
  });
}

export function stopChatStream(sessionId: string): Promise<void> {
  return invoke("stop_chat_stream", { sessionId });
}

export function syncCardQueue(
  sessionId: string,
  cards: CardQueueItem[]
): Promise<void> {
  return invoke("sync_card_queue", { sessionId, cards });
}

export function submitQuizAnswers(
  sessionId: string,
  conceptSlug: string,
  submissions: QuizSubmission[]
): Promise<void> {
  return invoke("submit_quiz_answers", { sessionId, conceptSlug, submissions });
}

export function completeSession(
  sessionId: string,
  status: string
): Promise<void> {
  return invoke("complete_session", { sessionId, status });
}

export function listenChatStream(
  callback: (payload: StreamPayload) => void
): Promise<UnlistenFn> {
  return listen<StreamPayload>("chat-stream-event", (event) => {
    callback(event.payload);
  });
}

// ---- Knowledge Map ----

export interface KnowledgeMapOutput {
  topic_name: string;
  topic_slug: string;
  topic_type: string;
  depth: string;
  domains: Array<{
    name: string;
    slug: string;
    concepts: Array<{
      name: string;
      slug: string;
      description: string;
      prerequisites: string[];
      difficulty: string;
      estimated_minutes: number;
    }>;
  }>;
}

export interface TreeNode {
  name: string;
  slug: string;
  status: string;
  children: TreeNode[];
}

export function getConceptTree(topicSlug: string): Promise<TreeNode> {
  return invoke("get_concept_tree", { topicSlug });
}

export function generateKnowledgeMap(input: {
  provider: string;
  model: string;
  topicName: string;
  topicSlug: string;
  topicType: string;
  depth: string;
}): Promise<KnowledgeMapOutput> {
  return invoke("generate_knowledge_map", input);
}

// ---- Project Analysis ----

export interface ProjectFile {
  path: string;
  relative_path: string;
  size: number;
  extension: string;
  skipped: boolean;
  skip_reason: string | null;
}

export interface ScanResult {
  total_files: number;
  included_files: ProjectFile[];
  skipped_files: ProjectFile[];
  estimated_tokens: number;
}

export interface FoundConcept {
  name: string;
  category: string;
  files: string[];
  line_refs: string[];
}

export interface CodeUnderstandingMap {
  project_name: string;
  tech_stack: string[];
  concepts_found: FoundConcept[];
}

export function scanProjectFiles(path: string): Promise<ScanResult> {
  return invoke("scan_project_files", { path });
}

export function analyzeProject(path: string): Promise<CodeUnderstandingMap> {
  return invoke("analyze_project", { path });
}
