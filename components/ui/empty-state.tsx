export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-ink-muted">
      {children}
    </p>
  );
}
