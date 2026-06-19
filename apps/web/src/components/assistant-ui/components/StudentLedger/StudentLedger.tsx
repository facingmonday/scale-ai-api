import React from "react";
import { TrendingUp, AlertTriangle } from "lucide-react";
import { formatCurrency } from "../../utils";

export const StudentLedger: React.FC<{ success: boolean; ledgerEntries?: any[]; error?: string }> = ({
  success,
  ledgerEntries,
  error
}) => {
  if (!success || error) {
    return (
      <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" />
        <span>Failed to load ledger: {error || "Unknown error"}</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-5 shadow-lg max-w-md w-full">
      <div className="flex items-center gap-3 border-b pb-3 mb-4">
        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
          <TrendingUp className="size-5" />
        </div>
        <div>
          <h4 className="font-semibold text-foreground text-sm tracking-tight">Simulation Results Ledger</h4>
          <p className="text-xs text-muted-foreground">Historical week performance</p>
        </div>
      </div>
      <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
        {ledgerEntries && ledgerEntries.length > 0 ? (
          ledgerEntries.map((entry, idx) => {
            const profit = entry.metrics?.profit ?? 0;
            const balance = entry.metrics?.balance ?? 0;
            const isProfit = profit >= 0;

            return (
              <div key={idx} className="relative pl-4 border-l-2 border-border/70 last:pb-0 pb-1">
                <div className="absolute -left-[6px] top-1.5 size-2.5 rounded-full bg-border" />
                <div className="p-3 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border/20 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-foreground">{entry.week}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                      isProfit 
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                        : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                    }`}>
                      {formatCurrency(profit)}
                    </span>
                  </div>
                  
                  {entry.summary && (
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2 font-normal italic">
                      "{entry.summary}"
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground mt-1.5 pt-1.5 border-t border-border/10">
                    <div>
                      <span className="block text-[8px] uppercase tracking-wider text-muted-foreground/60 font-semibold">End Balance</span>
                      <span className="font-semibold text-foreground">{formatCurrency(balance)}</span>
                    </div>
                    {entry.randomEvent && (
                      <div className="col-span-2 mt-1 px-2 py-1 bg-amber-500/5 text-amber-600 border border-amber-500/10 rounded-lg text-[9px] flex items-center gap-1 font-medium">
                        <AlertTriangle className="size-3 shrink-0" />
                        <span>Event: {entry.randomEvent}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">No ledger history available.</p>
        )}
      </div>
    </div>
  );
};
