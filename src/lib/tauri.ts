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
  concept_id: string;
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
  conceptSlug: string,
  conceptName: string,
  messages: ChatMessage[],
  l1Context: string
): Promise<string> {
  return invoke("start_chat_stream", {
    conceptSlug,
    conceptName,
    messages,
    l1Context,
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
