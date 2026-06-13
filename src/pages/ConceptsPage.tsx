export default function ConceptsPage() {
  // In production, this queries Rust backend via IPC for learned concepts
  return (
    <div className="p-4">
      <h2 className="font-semibold text-lg mb-4">📋 Learned Concepts</h2>
      <div className="text-center text-gray-400 py-12">
        <p className="text-3xl mb-2">📖</p>
        <p>No concepts learned yet</p>
        <p className="text-xs mt-1">Concepts appear here after you learn them</p>
      </div>
    </div>
  );
}
