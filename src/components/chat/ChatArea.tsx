import { useEffect, useRef } from "react";
import { useChatStore } from "../../stores/chatStore";
import MessageBubble from "./MessageBubble";

export default function ChatArea() {
  const messages = useChatStore((s) => s.messages);
  const conceptName = useChatStore((s) => s.conceptName);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="text-2xl mb-2">💡</p>
          <p>Start learning「{conceptName}」</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
