import { useLocale } from "../../i18n/useLocale";
import type { Message } from "../../types/chat";
import StreamingText from "./StreamingText";

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const L = useLocale();

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[80%]">
        {!isUser && (
          <div className="mb-1 ml-1 text-xs text-gray-400 dark:text-gray-500">
            🤖 {L.chat.assistantLabel}
          </div>
        )}
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "rounded-br-md bg-indigo-500 text-white"
              : message.isError
                ? "border border-red-200 bg-red-50 text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
                : "rounded-bl-md border border-gray-100 bg-white text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          }`}
        >
          {message.isStreaming ? <StreamingText text={message.content} /> : message.content}
        </div>
      </div>
    </div>
  );
}
