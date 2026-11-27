// Shared with app/usage (whose own StatPill is kept local there, unchanged,
// to avoid touching a working page for this). Every /admin page uses this
// one so the tile styling stays identical across the dashboard.
export function StatPill({
  label,
  children,
  sub,
}: {
  label: string;
  children: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-[12px] text-text3">{label}</div>
      <div className="mt-1 text-[22px] font-semibold text-text0">{children}</div>
      {sub && <div className="mt-0.5 text-[11px] text-text3">{sub}</div>}
    </div>
  );
}
