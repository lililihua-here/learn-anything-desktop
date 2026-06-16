import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ChatArea from "../components/chat/ChatArea";
import CardQueue from "../components/cards/CardQueue";
import QuizPanel from "../components/quiz/QuizPanel";
import Breadcrumb from "../components/layout/Breadcrumb";
import { useChatStore } from "../stores/chatStore";
import { useCardStore } from "../stores/cardStore";
import { useQuizStore } from "../stores/quizStore";
import { useSessionStore } from "../stores/sessionStore";
import {
  completeSession, isOnline, listenChatStream, onOnlineChange,
  startChatStream, stopChatStream,
  type ChatMessage,
} from "../lib/tauri";
import { generateSlug } from "../utils/slug";
import { useSettingsStore } from "../stores/settingsStore";
import { useGamificationStore } from "../stores/gamificationStore";
import { useLocale } from "../i18n/useLocale";

const L0_WINDOW_SIZE = 20;

export default function ChatPage() {
  const { concept } = useParams<{ concept: string }>();
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");
  const [online, setOnline] = useState(isOnline());
  const sessionIdRef = useRef<string>("");
  const breadcrumbPath = concept ? [concept] : [];
  const L = useLocale();

  const setName = useChatStore((s) => s.setConcept);
  const addMsg = useChatStore((s) => s.addMessage);
  const appendMsg = useChatStore((s) => s.appendToLastMessage);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const setError = useChatStore((s) => s.setError);
  const clearError = useChatStore((s) => s.clearError);
  const resetConversation = useChatStore((s) => s.resetConversation);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const startSession = useSessionStore((s) => s.startSession);
  const completeLocalSession = useSessionStore((s) => s.completeSession);
  const interruptLocalSession = useSessionStore((s) => s.interruptSession);
  const setCardSessionId = useCardStore((s) => s.setSessionId);
  const queueLength = useCardStore((s) => s.queue.length);
  const flushQueue = useCardStore((s) => s.flushQueue);
  const resetQueue = useCardStore((s) => s.resetQueue);
  const resetQuiz = useQuizStore((s) => s.resetQuiz);
  const isQuizSubmitted = useQuizStore((s) => s.isSubmitted);
  const provider = useSettingsStore((s) => s.provider);
  const model = useSettingsStore((s) => s.model);

  const l0Buffer = useRef<ChatMessage[]>([]);
  const assistantBuffer = useRef("");
  const autoCompletedSessionRef = useRef<string | null>(null);
  const canCompleteSession = isQuizSubmitted && queueLength === 0;

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

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listenChatStream((payload) => {
      if (!sessionIdRef.current) {
        sessionIdRef.current = payload.session_id;
      }

      if (payload.session_id !== sessionIdRef.current) {
        return;
      }

      switch (payload.event_type) {
        case "text_delta":
          assistantBuffer.current += payload.content;
          appendMsg(payload.content);
          break;
        case "tool_use":
          if (payload.tool_name === "present_card" && payload.tool_input) {
            const input = payload.tool_input as { name: string; slug: string; summary: string };
            useCardStore.getState().addCard({
              id: `${payload.session_id}:${input.slug}`,
              name: input.name,
              slug: input.slug,
              summary: input.summary,
            });
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
          // Record activity for gamification
          void useGamificationStore.getState().recordActivity();
          break;
        case "error":
          setError(payload.content);
          break;
      }
    }).then((off) => {
      unlisten = off;
    });

    return () => {
      unlisten?.();
    };
  }, [appendMsg, setError, setStreaming]);

  useEffect(() => {
    if (!concept) return;

    if (sessionIdRef.current) {
      void stopChatStream(sessionIdRef.current);
    }

    resetConversation();
    resetQueue();
    resetQuiz();
    clearError();

    assistantBuffer.current = "";
    autoCompletedSessionRef.current = null;
    sessionIdRef.current = "";
    const slug = generateSlug(concept);
    setName(concept, slug);

    const initialMsg: ChatMessage = {
      role: "user",
      content: `I want to learn about "${concept}".`,
    };
    l0Buffer.current = [initialMsg];

    addMsg({ id: crypto.randomUUID(), role: "user", content: initialMsg.content });
    addMsg({ id: crypto.randomUUID(), role: "assistant", content: "", isStreaming: true });
    setStreaming(true);

    startChatStream(provider, model, slug, concept, l0Buffer.current, buildL1Context())
      .then((sid) => {
        sessionIdRef.current = sid;
        setCardSessionId(sid);
        startSession(sid, concept, slug);
      })
      .catch((error) => {
        setStreaming(false);
        setError(String(error));
      });
  }, [
    addMsg,
    clearError,
    concept,
    resetConversation,
    resetQueue,
    resetQuiz,
    setCardSessionId,
    setError,
    setName,
    setStreaming,
    startSession,
  ]);

  useEffect(() => onOnlineChange(setOnline), []);

  const handleSend = () => {
    if (!online || !inputValue.trim() || isStreaming || !concept) return;
    const userMsg = inputValue.trim();
    setInputValue("");

    l0Buffer.current.push({ role: "user", content: userMsg });
    l0Buffer.current = slideL0Window(l0Buffer.current);

    addMsg({ id: crypto.randomUUID(), role: "user", content: userMsg });
    addMsg({ id: crypto.randomUUID(), role: "assistant", content: "", isStreaming: true });
    setStreaming(true);

    startChatStream(
      provider,
      model,
      useChatStore.getState().conceptSlug,
      concept,
      l0Buffer.current,
      buildL1Context(),
      sessionIdRef.current || undefined,
    )
      .then((sid) => {
        sessionIdRef.current = sid;
        setCardSessionId(sid);
      })
      .catch((error) => {
        setStreaming(false);
        setError(String(error));
      });
  };

  const handleStop = () => {
    if (!sessionIdRef.current) return;
    stopChatStream(sessionIdRef.current);
    setStreaming(false);
  };

  useEffect(() => {
    if (!sessionIdRef.current || !canCompleteSession) return;
    if (autoCompletedSessionRef.current === sessionIdRef.current) return;

    const sessionId = sessionIdRef.current;
    autoCompletedSessionRef.current = sessionId;

    void (async () => {
      try {
        await flushQueue();
        await completeSession(sessionId, "completed");
        completeLocalSession();
        sessionIdRef.current = "";
        navigate("/");
      } catch (error) {
        autoCompletedSessionRef.current = null;
        setError(String(error));
      }
    })();
  }, [canCompleteSession, completeLocalSession, flushQueue, navigate, setError]);

  const handleEndSession = async () => {
    if (!sessionIdRef.current) return;

    const finalStatus = canCompleteSession ? "completed" : "interrupted";

    try {
      if (isStreaming) {
        await stopChatStream(sessionIdRef.current);
      }

      await flushQueue();
      await completeSession(sessionIdRef.current, finalStatus);

      if (finalStatus === "completed") {
        completeLocalSession();
      } else {
        interruptLocalSession();
      }

      sessionIdRef.current = "";
      navigate("/");
    } catch (error) {
      setError(String(error));
    }
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <Breadcrumb path={breadcrumbPath} />
        <ChatArea />
        <QuizPanel />
        <div className="h-16 border-t bg-white px-4 flex items-center gap-3 shrink-0">
          {online ? (
            <>
              <button
                onClick={handleEndSession}
                className="h-10 px-4 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                {L.chat.endSession}
              </button>
              <input type="text" value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={isStreaming ? L.chat.streaming : L.chat.inputPlaceholder}
                disabled={isStreaming}
                className="flex-1 h-10 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-indigo-400 disabled:bg-gray-50 disabled:text-gray-400" />
              {isStreaming ? (
                <button onClick={handleStop} className="h-10 px-4 bg-red-100 text-red-500 rounded-xl text-sm hover:bg-red-200">{L.chat.stop}</button>
              ) : (
                <button onClick={handleSend} disabled={!inputValue.trim()}
                  className="h-10 px-4 bg-indigo-500 text-white rounded-xl text-sm hover:bg-indigo-600 disabled:opacity-40 transition-all">{L.chat.send}</button>
              )}
            </>
          ) : (
            <span className="flex-1 text-sm text-amber-600 text-center">
              {L.offline.chatUnavailable}
            </span>
          )}
        </div>
      </div>
      <div className="w-[30%] min-w-[280px] border-l hidden lg:block">
        <CardQueue />
      </div>
    </div>
  );
}
