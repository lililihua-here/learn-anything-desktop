export default function StreamingText({ text }: { text: string }) {
  return (
    <span>
      {text}
      <span className="inline-block w-1.5 h-4 bg-indigo-400 ml-0.5 animate-pulse" />
    </span>
  );
}
