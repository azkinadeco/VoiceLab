'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { TOAST_EVENT, ToastPayload } from '@/lib/toast';

export default function Toaster() {
  const [items, setItems] = useState<ToastPayload[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const t = (e as CustomEvent<ToastPayload>).detail;
      setItems((prev) => [...prev.slice(-2), t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 2600);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4"
      style={{ top: 'calc(var(--sat) + 10px)' }}
      aria-live="polite"
    >
      {items.map((t) => {
        const Icon = t.kind === 'error' ? AlertCircle : t.kind === 'info' ? Info : CheckCircle2;
        const color =
          t.kind === 'error' ? 'text-rose-400' : t.kind === 'info' ? 'text-sky-400' : 'text-emerald-400';
        return (
          <div
            key={t.id}
            className="toast-in flex max-w-sm items-center gap-2 rounded-full bg-dark-850/95 backdrop-blur-xl border border-white/15 px-4 py-2.5 text-[13px] font-medium text-white shadow-2xl"
          >
            <Icon className={`h-4 w-4 shrink-0 ${color}`} />
            <span className="truncate">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
