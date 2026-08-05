import React from "react";
import { ClipboardList, CheckCircle2, AlertTriangle } from "lucide-react";
import { formatCurrency } from "../../utils";

export const StudentSubmissions: React.FC<{ success: boolean; submissions?: any[]; error?: string }> = ({
  success,
  submissions,
  error
}) => {
  if (!success || error) {
    return (
      <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" />
        <span>Failed to load submissions: {error || "Unknown error"}</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-5 shadow-lg max-w-md w-full">
      <div className="flex items-center gap-3 border-b pb-3 mb-4">
        <div className="p-2 rounded-lg bg-teal-500/10 text-teal-500">
          <ClipboardList className="size-5" />
        </div>
        <div>
          <h4 className="font-semibold text-foreground text-sm tracking-tight">Weekly Submissions</h4>
          <p className="text-xs text-muted-foreground">Historical decision records</p>
        </div>
      </div>
      
      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
        {submissions && submissions.length > 0 ? (
          submissions.map((sub, idx) => (
            <div key={idx} className="p-3 bg-muted/40 rounded-xl border border-border/20">
              <div className="flex justify-between items-center mb-2 border-b border-border/10 pb-1.5">
                <span className="text-xs font-bold text-foreground">{sub.week || `Decision ${idx + 1}`}</span>
                <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                  <CheckCircle2 className="size-3 text-emerald-500" /> Submitted
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
                <div>
                  <span className="block text-[8px] uppercase tracking-wider font-semibold">Planned Production</span>
                  <span className="text-foreground font-bold">{sub.plannedProduction ?? sub.productionLimit ?? 0} Pizzas</span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase tracking-wider font-semibold">Staffing level</span>
                  <span className="text-foreground font-bold">{sub.staffingLevel ?? 1} Staff</span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase tracking-wider font-semibold">Inventory Strategy</span>
                  <span className="text-foreground font-bold capitalize">{sub.inventoryStrategy || "Just-In-Time"}</span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase tracking-wider font-semibold">Marketing Spend</span>
                  <span className="text-foreground font-bold font-mono">{formatCurrency(sub.marketingSpend ?? 0)}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">No decisions submitted yet.</p>
        )}
      </div>
    </div>
  );
};
