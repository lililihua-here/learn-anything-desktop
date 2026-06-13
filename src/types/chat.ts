export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
  isError?: boolean;
}

export interface CardData {
  name: string;
  slug: string;
  summary: string;
}

export interface SuggestOption {
  name: string;
  slug: string;
  reason: string;
}
