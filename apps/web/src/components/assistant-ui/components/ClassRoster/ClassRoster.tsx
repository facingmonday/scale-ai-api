import React from "react";
import { Users, AlertTriangle } from "lucide-react";

export const ClassRoster: React.FC<{ success: boolean; roster?: any[]; error?: string }> = ({
  success,
  roster,
  error
}) => {
  if (!success || error) {
    return (
      <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" />
        <span>Failed to load roster: {error || "Unknown error"}</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-5 shadow-lg max-w-md w-full">
      <div className="flex items-center gap-3 border-b pb-3 mb-3">
        <div className="p-2 rounded-lg bg-teal-500/10 text-teal-500">
          <Users className="size-5" />
        </div>
        <div>
          <h4 className="font-semibold text-foreground text-sm tracking-tight">Classroom Roster</h4>
          <p className="text-xs text-muted-foreground">{roster?.length || 0} active students</p>
        </div>
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {roster && roster.length > 0 ? (
          roster.map((student, idx) => (
            <div 
              key={student.userId || idx} 
              className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 transition-all border border-border/30"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">
                  {student.firstName} {student.lastName}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">{student.email}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-medium bg-teal-500/15 text-teal-600 border border-teal-500/20">
                  {student.shopName}
                </span>
                <p className="text-[9px] text-muted-foreground mt-0.5 font-mono">ID: {student.studentId || "N/A"}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">No students enrolled yet.</p>
        )}
      </div>
    </div>
  );
};
