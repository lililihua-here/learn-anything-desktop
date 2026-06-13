interface Props { path: string[]; }
export default function Breadcrumb({ path }: Props) {
  if (path.length === 0) return null;
  return (
    <div className="px-4 py-2 text-xs text-gray-400 border-b bg-gray-50 truncate">
      {path.map((name, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1">&gt;</span>}
          <span className={i === path.length - 1 ? "text-indigo-500 font-medium" : ""}>
            {i === path.length - 1 ? `[Current: ${name}]` : name}
          </span>
        </span>
      ))}
    </div>
  );
}
