'use client';

import { useEffect, useState } from 'react';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  emoji?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export default function Toast({ toasts, removeToast }: ToastProps) {
  return (
    <div className="fixed bottom-6 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const showTimer = setTimeout(() => setVisible(true), 10);
    // Auto dismiss after 3s
    const hideTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(toast.id), 300);
    }, 3000);
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
  }, [toast.id, onRemove]);

  const bgColor = toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-purple-700';

  return (
    <div
      className={`${bgColor} text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 pointer-events-auto max-w-xs transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      {toast.emoji && <span className="text-xl">{toast.emoji}</span>}
      <span className="text-sm font-bold flex-1">{toast.message}</span>
      <button onClick={() => { setVisible(false); setTimeout(() => onRemove(toast.id), 300); }} className="text-white/70 hover:text-white text-lg leading-none">×</button>
    </div>
  );
}
