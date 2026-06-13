import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import ChatArea from "../components/chat/ChatArea";
import CardQueue from "../components/cards/CardQueue";
import QuizPanel from "../components/quiz/QuizPanel";
import Breadcrumb from "../components/layout/Breadcrumb";
import { useChatStore } from "../stores/chatStore";
import { useCardStore } from "../stores/cardStore";
import { useQuizStore } from "../stores/quizStore";
import { useSessionStore } from "../stores/sessionStore";
import {
  startChatStream, stopChatStream, listenChatStream,
  type ChatMessage,
} from "../lib/tauri";
import { generateSlug } from "../utils/slug";

const L0_WINDOW_SIZE = 20;

export default function ChatPage() {
  const { concept } = useParams<{ concept: string }>();
  const [inputValue, setInputValue] = useState("");
  const [breadcrumbPath] = useState<string[]>([concept || ""]);
  const hasStarted = useRef(false);
  const sessionIdRef = useRef<string>("");

  const setName = useChatStore((s) => s.setConcept);
  const addMsg = useChatStore((s) => s.addMessage);
  const appendMsg = useChatStore((s) => s.appendToLastMessage);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const setError = useChatStore((s) => s.setError);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const startSession = useSessionStore((s) => s.startSession);
  const setCardSessionId = useCardStore((s) => s.setSessionId);

  const l0Buffer = useRef<ChatMessage[]>([]);
  const assistantBuffer = useRef("");

  function slideL0Window(messages: ChatMessage[]): ChatMessage[] {
    if (messages.length <= L0_WINDOW_SIZE) return messages;
    const first = messages[0];
    const recent = messages.slice(-(L0_WINDOW_SIZE - 1));
    return [first, ...recent];
  }

  function buildL1Context(): string {
    const cards = useCardStore.getState().queue;
    const parts: string[] = [];
    parts.push(`[Path] ${breadcrumbPath.join(" > ")}`);
    if (cards.length > 0) {
      const cardSummary = cards.slice(0, 5).map((c) => `${c.name}(${c.status})`).join(", ");
      parts.push(`[Card queue: ${cards.length} remaining] ${cardSummary}`);
    }
    return parts.join("\n");
  }

  const handleStreamResponse = useCallback(() => {
    assistantBuffer.current = "";
    return listenChatStream((payload) => {
      switch (payload.event_type) {
        case "text_delta":
          assistantBuffer.current += payload.content;
          appendMsg(payload.content);
          break;
        case "tool_use":
          if (payload.tool_name === "present_card" && payload.tool_input) {
            const input = payload.tool_input as { name: string; slug: string; summary: string };
            useChatStore.getState().addCard(input);
            useCardStore.getState().addCard(input);
          }
          if (payload.tool_name === "start_quiz" && payload.tool_input) {
            const input = payload.tool_input as { quiz_type: string; questions: unknown[] };
            useChatStore.getState().setQuizData(input);
            useQuizStore.getState().startQuiz(input.quiz_type, input.questions);
          }
          if (payload.tool_name === "suggest_next" && payload.tool_input) {
            const input = payload.tool_input as { options: { name: string; slug: string; reason: string }[] };
            useChatStore.getState().setSuggestions(input.options || []);
          }
          break;
        case "done":
          if (assistantBuffer.current.trim()) {
            l0Buffer.current.push({ role: "assistant", content: assistantBuffer.current });
            l0Buffer.current = slideL0Window(l0Buffer.current);
          }
          assistantBuffer.current = "";
          setStreaming(false);
          break;
        case "error":
          setError(payload.content);
          break;
      }
    });
  }, [appendMsg, setStreaming, setError]);

  useEffect(() => {
    if (!concept || hasStarted.current) return;
    hasStarted.current = true;

    const slug = generateSlug(concept);
    setName(concept, slug);

    const initialMsg: ChatMessage = { role: "user", content: `I want to learn about「${concept}」` };
    l0Buffer.current = [initialMsg];

    addMsg({ id: crypto.randomUUID(), role: "assistant", content: "", isStreaming: true });
    setStreaming(true);

    handleStreamResponse();
    startChatStream(slug, concept, l0Buffer.current, buildL1Context()).then((sid) => {
      sessionIdRef.current = sid;
      setCardSessionId(sid);
      startSession(sid, concept, slug);
    });
  }, [concept]);

  const handleSend = () => {
    if (!inputValue.trim() || isStreaming || !concept) return;
    const userMsg = inputValue.trim();
    setInputValue("");

    l0Buffer.current.push({ role: "user", content: userMsg });
    l0Buffer.current = slideL0Window(l0Buffer.current);

    addMsg({ id: crypto.randomUUID(), role: "user", content: userMsg });
    addMsg({ id: crypto.randomUUID(), role: "assistant", content: "", isStreaming: true });
    setStreaming(true);

    handleStreamResponse();
    startChatStream(
      useChatStore.getState().conceptSlug,
      concept,
      l0Buffer.current,
      buildL1Context(),
    ).then((sid) => {
      sessionIdRef.current = sid;
      setCardSessionId(sid);
    });
  };

  const handleStop = () => {
    stopChatStream(sessionIdRef.current);
    setStreaming(false);
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <Breadcrumb path={breadcrumbPath} />
        <ChatArea />
        <QuizPanel />
        <div className="h-16 border-t bg-white px-4 flex items-center gap-3 shrink-0">
          <input type="text" value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={isStreaming ? "AI is responding..." : "Type your reply..."}
            disabled={isStreaming}
            className="flex-1 h-10 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-indigo-400 disabled:bg-gray-50 disabled:text-gray-400" />
          {isStreaming ? (
            <button onClick={handleStop} className="h-10 px-4 bg-red-100 text-red-500 rounded-xl text-sm hover:bg-red-200">Stop</button>
          ) : (
            <button onClick={handleSend} disabled={!inputValue.trim()}
              className="h-10 px-4 bg-indigo-500 text-white rounded-xl text-sm hover:bg-indigo-600 disabled:opacity-40 transition-all">Send</button>
          )}
        </div>
      </div>
      <div className="w-[30%] min-w-[280px] border-l hidden lg:block">
        <CardQueue />
      </div>
    </div>
  );
}
