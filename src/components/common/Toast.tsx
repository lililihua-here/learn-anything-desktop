import { useEffect, useState } from "react";
interface ToastData { message: string; type: "info" | "error" | "success"; duration?: number; }
let emitter: ((d: ToastData) => void) | null = null;
export function showToast(data: ToastData) { emitter?.(data); }

export function ToastContainer() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => { emitter = (data) => { setToast(data); setVisible(true); }; return () => { emitter = null; }; }, []);
  useEffect(() => {
    if (visible && toast) { const t = setTimeout(() => setVisible(false), toast.duration || 3000); return () => clearTimeout(t); }
  }, [visible, toast]);
  if (!toast) return null;
  const bg = toast.type === "error" ? "bg-red-500" : toast.type === "success" ? "bg-green-500" : "bg-gray-800";
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
      <div className={`${bg} text-white px-6 py-3 rounded-2xl shadow-lg text-sm`}>{toast.message}</div>
    </div>
  );
}
