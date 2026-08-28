import { cn } from "@/lib/utils";

/** Silla vacía mostrada en los asientos disponibles de la mesa. */
export function EmptySeat({
  label = "Libre",
  onClick,
}: {
  label?: string;
  onClick?: (() => void) | undefined;
}) {
  const interactive = Boolean(onClick);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      title={interactive ? "Sentarme aquí" : label}
      className={cn(
        "group flex flex-col items-center gap-1 transition-all",
        interactive ? "opacity-70 hover:opacity-100" : "cursor-default opacity-60",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-full border border-dashed border-brass-soft/40 bg-felt-deep/60 py-1 pl-1 pr-3 backdrop-blur transition-all",
          interactive &&
            "group-hover:border-brass group-hover:bg-felt-deep/90 group-hover:shadow-[0_0_0_2px_var(--brass)]",
        )}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-dashed border-brass-soft/40 bg-felt/40 transition-colors group-hover:border-brass">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={cn(
              "h-4 w-4 text-muted-foreground transition-colors",
              interactive && "group-hover:text-primary",
            )}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M7 4v7M17 4v7M5 11h14v3a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5v-3ZM8 19v2M16 19v2" />
          </svg>
        </span>
        <span
          className={cn(
            "text-[0.65rem] uppercase tracking-widest text-muted-foreground transition-colors",
            interactive && "group-hover:text-primary",
          )}
        >
          {interactive ? <span className="hidden group-hover:inline">Sentarme</span> : null}
          <span className={interactive ? "group-hover:hidden" : undefined}>{label}</span>
        </span>
      </div>
    </button>
  );
}
