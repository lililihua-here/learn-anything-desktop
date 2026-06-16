import { useEffect, useRef } from "react";
import { useChatStore } from "../../stores/chatStore";
import { useLocale } from "../../i18n/useLocale";
import MessageBubble from "./MessageBubble";

export default function ChatArea() {
  const messages = useChatStore((s) => s.messages);
  const conceptName = useChatStore((s) => s.conceptName);
  const bottomRef = useRef<HTMLDivElement>(null);
  const L = useLocale();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <p className="mb-2 text-2xl">📕</p>
          <p>{conceptName ? `${L.chat.welcome}: ${conceptName}` : L.chat.welcome}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
