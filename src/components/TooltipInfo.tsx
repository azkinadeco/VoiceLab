'use client';

import React, { useState } from 'react';
import { HelpCircle, Info } from 'lucide-react';

interface TooltipInfoProps {
  text: string;
  title?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export default function TooltipInfo({
  text,
  title,
  position = 'top',
}: TooltipInfoProps) {
  const [open, setOpen] = useState(false);

  const posClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[position];

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-dark-400 hover:text-brand-300 transition-colors focus:outline-none"
        aria-label="Info"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          className={`absolute z-50 w-60 rounded-xl bg-dark-950/95 backdrop-blur-xl border border-white/15 p-3 text-xs text-dark-200 shadow-2xl pointer-events-none animate-in fade-in zoom-in-95 duration-150 ${posClasses}`}
        >
          {title && <div className="font-bold text-white mb-1">{title}</div>}
          <p className="leading-relaxed text-[11px] text-dark-200 font-normal">{text}</p>
        </div>
      )}
    </span>
  );
}
