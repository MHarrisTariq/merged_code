"use client";

export function SkeletonCard() {
  return <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
      <p className="font-medium">Something went wrong</p>
      <p className="text-sm">{message}</p>
    </div>
  );
}
