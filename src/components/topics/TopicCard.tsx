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
      onClick={() =>
        navigate(`/topics/${encodeURIComponent(slug)}`, {
          state: { topicName: name },
        })
      }
      className="w-full rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition-colors hover:border-indigo-300"
    >
      <h3 className="text-base font-semibold text-gray-800">{name}</h3>
      <p className="mt-1 text-sm leading-relaxed text-gray-500">{description}</p>
      <div className="mt-3 flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600">
          {domainCount} 个知识域
        </span>
      </div>
    </button>
  );
}
