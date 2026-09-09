import { useState } from "react";
import { SmilePlus } from "lucide-react";
import { toast } from "sonner";

import { TABLE_REACTIONS, type TableReactionKey } from "@/lib/poker/reactions";

export function ReactionPicker({
  disabled,
  sending,
  onReact,
}: {
  disabled?: boolean;
  sending: boolean;
  onReact: (reaction: TableReactionKey) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  const choose = async (reaction: TableReactionKey) => {
    setOpen(false);
    try {
      await onReact(reaction);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos enviar la reacción");
    }
  };

  return (
    <div className="relative flex justify-end">
      {open && !disabled && (
        <div
          role="menu"
          aria-label="Reacciones rápidas"
          className="absolute bottom-full right-0 z-50 mb-2 flex gap-1 rounded-2xl border border-brass-soft/60 bg-card/95 p-1.5 shadow-table backdrop-blur"
        >
          {TABLE_REACTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              title={item.label}
              aria-label={item.label}
              disabled={sending}
              onClick={() => void choose(item.key)}
              className="grid h-10 w-10 place-items-center rounded-xl text-2xl transition-transform hover:scale-125 hover:bg-primary/10 disabled:opacity-50"
            >
              {item.emoji}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled || sending}
        aria-expanded={open}
        aria-label="Abrir reacciones rápidas"
        className="flex items-center gap-1.5 rounded-full border border-brass-soft/60 bg-card/90 px-3 py-1.5 text-xs text-primary shadow-chip backdrop-blur transition-colors hover:bg-primary/10 disabled:opacity-45"
      >
        <SmilePlus className="h-4 w-4" aria-hidden="true" />
        Reaccionar
      </button>
    </div>
  );
}
