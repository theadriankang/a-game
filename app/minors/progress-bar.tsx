// Completed MC in the solid colour, planned MC in the lighter one, against what the programme asks for.
export function ProgressBar({ completed, planned, required }: { completed: number; planned: number; required: number }) {
  const completedPct = required > 0 ? Math.min(100, (completed / required) * 100) : 0;
  const plannedPct = required > 0 ? Math.min(100 - completedPct, (planned / required) * 100) : 0;
  return (
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-seg-bg">
      <div className="flex h-full">
        <div className="h-full bg-accent transition-all duration-300" style={{ width: `${completedPct}%` }} />
        <div className="h-full bg-accent/40 transition-all duration-300" style={{ width: `${plannedPct}%` }} />
      </div>
    </div>
  );
}
