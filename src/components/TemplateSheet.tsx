'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, Check, Clock } from 'lucide-react';
import {
  SCRIPT_TEMPLATES,
  TEMPLATE_CATEGORIES,
  TEMPLATE_FIELDS,
  ScriptTemplate,
  fillTemplate,
  loadTemplateValues,
  saveTemplateValues,
  templateUsesField,
  estimateSeconds,
} from '@/lib/script-templates';
import { haptic } from '@/lib/haptics';

interface TemplateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (text: string, template: ScriptTemplate) => void;
}

/**
 * Seller script builder: pick a template, fill product details once (they're
 * remembered on this device), preview, and drop it into the composer.
 * Bottom sheet on phones, centered dialog on desktop.
 */
export default function TemplateSheet({ isOpen, onClose, onApply }: TemplateSheetProps) {
  const [category, setCategory] = useState(TEMPLATE_CATEGORIES[0].id);
  const [selectedId, setSelectedId] = useState<string>(SCRIPT_TEMPLATES[0].id);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) setValues(loadTemplateValues());
  }, [isOpen]);

  const list = useMemo(() => SCRIPT_TEMPLATES.filter((t) => t.category === category), [category]);
  const selected = SCRIPT_TEMPLATES.find((t) => t.id === selectedId) || list[0];
  const usedFields = selected ? TEMPLATE_FIELDS.filter((f) => templateUsesField(selected.text, f.key)) : [];
  const preview = selected ? fillTemplate(selected.text, values) : '';

  if (!isOpen) return null;

  return (
    <div
      className="m-sheet-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Template naskah"
        onClick={(e) => e.stopPropagation()}
        className="m-sheet flex w-full max-w-lg max-h-[85vh] flex-col overflow-hidden rounded-3xl border border-white/10 bg-dark-900 shadow-2xl"
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
          <div>
            <h2 className="text-[17px] font-bold text-white">Template Naskah Jualan</h2>
            <p className="text-[12px] text-dark-400">Isi detail produk sekali, dipakai di semua template</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-dark-200"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Category chips */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar fade-x px-4 pb-2 shrink-0">
          {TEMPLATE_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setCategory(c.id);
                const first = SCRIPT_TEMPLATES.find((t) => t.category === c.id);
                if (first) setSelectedId(first.id);
              }}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all ${
                category === c.id ? 'bg-white text-black' : 'bg-white/[0.06] text-dark-300'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 space-y-4">
          {/* Template list */}
          <div className="space-y-1.5">
            {list.map((t) => {
              const active = selected?.id === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    haptic(6);
                    setSelectedId(t.id);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all ${
                    active ? 'border-brand-400/70 bg-brand-500/10' : 'border-white/[0.07] bg-white/[0.03]'
                  }`}
                >
                  <span className="text-[14px] font-semibold text-white">{t.title}</span>
                  <span className="flex shrink-0 items-center gap-1 text-[12px] text-dark-400">
                    <Clock className="h-3.5 w-3.5" />
                    {t.targetSec}s
                    {active && <Check className="ml-1 h-4 w-4 text-brand-300" />}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Fields used by this template */}
          {usedFields.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {usedFields.map((f) => (
                <label key={f.key} className={f.key === 'manfaat' ? 'col-span-2' : ''}>
                  <span className="mb-1 block text-[12px] font-medium text-dark-300">{f.label}</span>
                  <input
                    type="text"
                    value={values[f.key] || ''}
                    placeholder={f.placeholder}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-white/10 bg-dark-950/80 px-3 text-sm text-white placeholder-dark-500 focus:border-brand-500 focus:outline-none"
                  />
                </label>
              ))}
            </div>
          )}

          {/* Preview */}
          <div className="rounded-2xl border border-white/[0.07] bg-dark-950/60 p-3.5">
            <div className="mb-1.5 flex items-center justify-between text-[12px] text-dark-400">
              <span className="font-semibold uppercase tracking-wider">Pratinjau</span>
              <span>~{estimateSeconds(preview)} detik</span>
            </div>
            <p className="text-[14px] leading-relaxed text-dark-100">{preview}</p>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/[0.06] p-4">
          <button
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              haptic(12);
              saveTemplateValues(values);
              onApply(preview, selected);
              onClose();
            }}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-white text-[15px] font-bold text-black active:scale-[0.99] disabled:opacity-40"
          >
            Pakai Naskah Ini
          </button>
        </div>
      </div>
    </div>
  );
}
