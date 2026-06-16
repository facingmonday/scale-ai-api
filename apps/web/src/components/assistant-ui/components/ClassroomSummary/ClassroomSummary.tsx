import React from "react";
import { TrendingUp, AlertTriangle } from "lucide-react";
import { formatCurrency } from "../../utils";

export const ClassroomSummary: React.FC<{ success: boolean; summary?: any[]; error?: string }> = ({
  success,
  summary,
  error
}) => {
  if (!success || error) {
    return (
      <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" />
        <span>Failed to load summary: {error || "Unknown error"}</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-5 shadow-lg max-w-md w-full">
      <div className="flex items-center gap-3 border-b pb-3 mb-4">
        <div className="p-2 rounded-lg bg-teal-500/10 text-teal-500">
          <TrendingUp className="size-5" />
        </div>
        <div>
          <h4 className="font-semibold text-foreground text-sm tracking-tight">Classroom Performance Summary</h4>
          <p className="text-xs text-muted-foreground">Aggregated weekly statistics</p>
        </div>
      </div>
      
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {summary && summary.length > 0 ? (
          summary.map((stat, idx) => (
            <div key={idx} className="p-3.5 bg-muted/40 rounded-xl border border-border/20 space-y-2">
              <p className="text-xs font-bold text-foreground">{stat.scenarioTitle}</p>
              <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                <div className="p-1.5 bg-background/50 rounded-lg border border-border/10 text-center">
                  <span className="block text-[8px] uppercase tracking-wider font-semibold mb-0.5 text-muted-foreground/60">Avg Profit</span>
                  <span className="text-foreground font-bold font-mono">{formatCurrency(stat.avgProfit)}</span>
                </div>
                <div className="p-1.5 bg-background/50 rounded-lg border border-border/10 text-center">
                  <span className="block text-[8px] uppercase tracking-wider font-semibold mb-0.5 text-rose-500/60">Min Profit</span>
                  <span className="text-rose-600 font-bold font-mono">{formatCurrency(stat.minProfit)}</span>
                </div>
                <div className="p-1.5 bg-background/50 rounded-lg border border-border/10 text-center">
                  <span className="block text-[8px] uppercase tracking-wider font-semibold mb-0.5 text-emerald-500/60">Max Profit</span>
                  <span className="text-emerald-600 font-bold font-mono">{formatCurrency(stat.maxProfit)}</span>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground text-right font-medium pr-1">
                Submissions: {stat.totalStudents} Student(s)
              </p>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">No aggregated stats available yet.</p>
        )}
      </div>
    </div>
  );
};
