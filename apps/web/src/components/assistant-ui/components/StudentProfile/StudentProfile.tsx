import React from "react";
import { User, Flame, Activity, CloudSun, Truck, AlertTriangle } from "lucide-react";
import { formatCurrency } from "../../utils";

export const StudentProfile: React.FC<{ success: boolean; profile?: any; error?: string }> = ({
  success,
  profile,
  error
}) => {
  if (!success || error || !profile) {
    return (
      <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" />
        <span>Failed to load profile: {error || "Unknown error"}</span>
      </div>
    );
  }

  const sensitivityLabels: Record<string, string> = {
    LOW: "Low Sensitivity",
    MEDIUM: "Moderate",
    HIGH: "Highly Sensitive"
  };

  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-5 shadow-lg max-w-sm w-full">
      <div className="flex items-center gap-3 border-b pb-3 mb-4">
        <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
          <User className="size-5" />
        </div>
        <div>
          <h4 className="font-semibold text-foreground text-sm tracking-tight">{profile.shopName || "Pizza Store"}</h4>
          <p className="text-xs text-muted-foreground">Store Profile Setup</p>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-muted/40 rounded-xl border border-border/20">
            <span className="block text-[8px] uppercase tracking-wider text-muted-foreground/60 font-semibold mb-0.5">Ovens</span>
            <div className="flex items-center gap-1">
              <Flame className="size-3.5 text-orange-500" />
              <span className="text-xs font-bold text-foreground">{profile.ovenCount || 1} Oven(s)</span>
            </div>
          </div>
          <div className="p-3 bg-muted/40 rounded-xl border border-border/20">
            <span className="block text-[8px] uppercase tracking-wider text-muted-foreground/60 font-semibold mb-0.5">Capacity</span>
            <div className="flex items-center gap-1">
              <Activity className="size-3.5 text-teal-500" />
              <span className="text-xs font-bold text-foreground">{profile.maxDailyCapacity || 100} / day</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-muted/40 rounded-xl border border-border/20">
            <span className="block text-[8px] uppercase tracking-wider text-muted-foreground/60 font-semibold mb-0.5">Location Type</span>
            <div className="text-xs font-bold text-foreground capitalize">
              {profile.storeType || profile.locationType || "Indoor"}
            </div>
          </div>
          <div className="p-3 bg-muted/40 rounded-xl border border-border/20">
            <span className="block text-[8px] uppercase tracking-wider text-muted-foreground/60 font-semibold mb-0.5">Weather Sensitivity</span>
            <div className="flex items-center gap-1">
              <CloudSun className="size-3.5 text-sky-500" />
              <span className="text-xs font-bold text-foreground">
                {sensitivityLabels[profile.weatherSensitivity] || profile.weatherSensitivity || "Medium"}
              </span>
            </div>
          </div>
        </div>

        <div className="p-3 bg-muted/40 rounded-xl border border-border/20 flex justify-between items-center">
          <div>
            <span className="block text-[8px] uppercase tracking-wider text-muted-foreground/60 font-semibold mb-0.5">Delivery Enabled</span>
            <div className="flex items-center gap-1 text-xs font-bold text-foreground">
              <Truck className="size-3.5 text-indigo-500" />
              <span>{profile.deliveryEnabled ? "Yes" : "No"}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="block text-[8px] uppercase tracking-wider text-muted-foreground/60 font-semibold mb-0.5">Starting Cash</span>
            <span className="text-xs font-bold text-foreground font-mono">{formatCurrency(profile.startingCash ?? 1000)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
