import React from "react";
import { Calendar, AlertTriangle } from "lucide-react";

export const ScenarioDetails: React.FC<{ success: boolean; scenario?: any; error?: string }> = ({
  success,
  scenario,
  error
}) => {
  if (!success || error || !scenario) {
    return (
      <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" />
        <span>Failed to load scenario details: {error || "Unknown error"}</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-5 shadow-lg max-w-sm w-full">
      <div className="flex items-center gap-3 border-b pb-3 mb-3">
        <div className="p-2 rounded-lg bg-sky-500/10 text-sky-500">
          <Calendar className="size-5" />
        </div>
        <div>
          <h4 className="font-semibold text-foreground text-sm tracking-tight">{scenario.title}</h4>
          <p className="text-xs text-muted-foreground">Scenario Context & Information</p>
        </div>
      </div>
      
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {scenario.description || "No description provided for this challenge."}
        </p>

        <div className="p-3 bg-muted/40 rounded-xl border border-border/20 space-y-2">
          <span className="block text-[8px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Expected Variables</span>
          
          <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
            <div>
              <span className="block text-[8px] uppercase tracking-wider font-semibold">Forecast Weather</span>
              <span className="text-foreground font-bold">{scenario.forecastWeather || "Sunny"}</span>
            </div>
            <div>
              <span className="block text-[8px] uppercase tracking-wider font-semibold">Expected Demand</span>
              <span className="text-foreground font-bold">{scenario.expectedDemand || "Medium"}</span>
            </div>
            {scenario.specialEvents && (
              <div className="col-span-2 border-t border-border/10 pt-1.5 mt-0.5">
                <span className="block text-[8px] uppercase tracking-wider font-semibold">Special Event</span>
                <span className="text-foreground font-bold">{scenario.specialEvents}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
