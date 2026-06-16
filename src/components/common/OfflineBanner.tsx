import { useEffect, useState } from "react";
import { onOnlineChange } from "../../lib/tauri";
import { useLocale } from "../../i18n/useLocale";

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  const L = useLocale();

  useEffect(() => onOnlineChange(setOnline), []);

  if (online) return null;
  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-700 text-xs text-center py-1 px-4">
      {L.offline.banner}
    </div>
  );
}
