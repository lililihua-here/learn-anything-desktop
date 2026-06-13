import { useSettingsStore } from "../stores/settingsStore";

export default function ConceptsPage() {
  const locale = useSettingsStore((s) => s.locale);
  const copy =
    locale === "zh-CN"
      ? {
          title: "已学概念",
          emptyTitle: "还没有已学概念",
          emptyHint: "学过的概念会显示在这里",
        }
      : {
          title: "Learned Concepts",
          emptyTitle: "No concepts learned yet",
          emptyHint: "Concepts appear here after you learn them",
        };

  return (
    <div className="h-full overflow-y-auto p-4">
      <h2 className="mb-4 text-lg font-semibold">{copy.title}</h2>
      <div className="py-12 text-center text-gray-400">
        <p className="text-lg">{copy.emptyTitle}</p>
        <p className="mt-1 text-xs">{copy.emptyHint}</p>
      </div>
    </div>
  );
}
