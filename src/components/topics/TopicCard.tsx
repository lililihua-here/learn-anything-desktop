import { useNavigate } from "react-router-dom";

interface Props {
  name: string;
  slug: string;
  description: string;
  domainCount: number;
}

export default function TopicCard({ name, slug, description, domainCount }: Props) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/topics/${encodeURIComponent(slug)}`)}
      className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 text-left transition-colors hover:border-indigo-300 w-full"
    >
      <h3 className="text-base font-semibold text-gray-800">{name}</h3>
      <p className="mt-1 text-sm text-gray-500 leading-relaxed">{description}</p>
      <div className="mt-3 flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600">
          {domainCount} 个知识域
        </span>
      </div>
    </button>
  );
}
