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
  // On mobile (< lg), the screen title already lives in the sticky Header — don't duplicate it!
  if (!actions) {
    return (
      <div className="hidden lg:flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {icon && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white">
                {icon}
              </div>
            )}
            <h1 className="min-w-0 text-lg font-bold tracking-tight text-white leading-tight">
              {title}
            </h1>
            {titleAddon && <div className="shrink-0">{titleAddon}</div>}
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-dark-400 leading-snug">{subtitle}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="hidden lg:block min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white">
              {icon}
            </div>
          )}
          <h1 className="min-w-0 text-lg font-bold tracking-tight text-white leading-tight">
            <span className="sm:hidden">{mobileTitle || title}</span>
            <span className="hidden sm:inline">{title}</span>
          </h1>
          {titleAddon && <div className="shrink-0">{titleAddon}</div>}
        </div>
        {subtitle && (
          <p className="mt-1 text-xs text-dark-400 leading-snug">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:shrink-0">
        {actions}
      </div>
    </div>
  );
}
