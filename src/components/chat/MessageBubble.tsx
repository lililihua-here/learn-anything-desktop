import type { Message } from "../../types/chat";
import StreamingText from "./StreamingText";

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%]`}>
        {!isUser && <div className="text-xs text-gray-400 mb-1 ml-1">🤖 AI</div>}
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser ? "bg-indigo-500 text-white rounded-br-md" :
          message.isError ? "bg-red-50 text-red-600 border border-red-200" :
          "bg-white text-gray-700 border border-gray-100 shadow-sm rounded-bl-md"
        }`}>
          {message.isStreaming ? <StreamingText text={message.content} /> : message.content}
        </div>
      </div>
    </div>
  );
}
