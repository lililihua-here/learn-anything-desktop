import { useLocale } from "../i18n/useLocale";

export default function ConceptsPage() {
  const L = useLocale();

  return (
    <div className="h-full overflow-y-auto p-4">
      <h2 className="mb-4 text-lg font-semibold">{L.concepts.title}</h2>
      <div className="py-12 text-center text-gray-400">
        <p className="text-lg">{L.concepts.empty}</p>
        <p className="mt-1 text-xs">{L.concepts.emptyHint}</p>
      </div>
    </div>
  );
}
