"use client";

export function TooltipExplain({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex cursor-help">
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
        i
      </span>
      <span className="pointer-events-none absolute left-1/2 top-6 z-20 hidden w-56 -translate-x-1/2 rounded-md bg-slate-900 p-2 text-xs text-white group-hover:block">
        {text}
      </span>
    </span>
  );
}
