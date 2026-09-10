import { useState } from "react";
import { MessageCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CALL_OUTCOMES, type Lead, type CallOutcome } from "@/lib/crm";
import { TemplateSuggester } from "./lead-dialogs";

export function QuickMessageMenu({ lead }: { lead: Lead }) {
  const [selectedScenario, setSelectedScenario] = useState<CallOutcome | null>(null);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
        >
          <MessageCircle className="size-3.5" /> Quick MSG
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2">
        <p className="px-2 py-1 text-xs font-semibold text-muted-foreground mb-1">Select Scenario</p>
        <div className="grid grid-cols-2 gap-1 mb-2">
          {CALL_OUTCOMES.map((o) => (
            <DropdownMenuItem
              key={o.value}
              onSelect={(e) => {
                e.preventDefault();
                setSelectedScenario(o.value);
              }}
              className={`flex items-center justify-center rounded-sm px-2 py-1.5 text-[11px] font-medium transition-colors ${selectedScenario === o.value ? "bg-accent text-accent-foreground" : "hover:bg-secondary"}`}
            >
              {o.label}
            </DropdownMenuItem>
          ))}
        </div>
        {selectedScenario && (
          <div className="pt-2 border-t border-border">
            <TemplateSuggester lead={lead} status={lead.status} scenario={selectedScenario} />
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
