'use client';

import React from 'react';

interface PageHeaderProps {
  title: string;
  /** Short title shown on phones (falls back to `title`). */
  mobileTitle?: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  /** Small inline element after the title (badge, help icon). */
  titleAddon?: React.ReactNode;
  /** Buttons on the right (desktop) / full-width row below (phones). */
  actions?: React.ReactNode;
}

/**
 * Consistent screen header. On phones the title is short and large (iOS
 * "large title" feel) and actions drop to their own row so nothing wraps
 * awkwardly next to the title.
 */
export default function PageHeader({
  title,
  mobileTitle,
  subtitle,
  icon,
  titleAddon,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08] text-white">
              {icon}
            </div>
          )}
          <h1 className="min-w-0 text-[22px] sm:text-lg font-bold tracking-tight text-white leading-tight">
            <span className="sm:hidden">{mobileTitle || title}</span>
            <span className="hidden sm:inline">{title}</span>
          </h1>
          {titleAddon && <div className="shrink-0">{titleAddon}</div>}
        </div>
        {subtitle && (
          <p className="mt-1 text-[13px] sm:text-xs text-dark-400 leading-snug">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
