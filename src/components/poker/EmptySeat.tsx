/** Silla vacía mostrada en los asientos disponibles de la mesa. */
export function EmptySeat({ label = "Libre" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 opacity-60">
      <div className="flex items-center gap-2 rounded-full border border-dashed border-brass-soft/40 bg-felt-deep/60 py-1 pl-1 pr-3 backdrop-blur">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-dashed border-brass-soft/40 bg-felt/40">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-4 w-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M7 4v7M17 4v7M5 11h14v3a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5v-3ZM8 19v2M16 19v2" />
          </svg>
        </span>
        <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}
