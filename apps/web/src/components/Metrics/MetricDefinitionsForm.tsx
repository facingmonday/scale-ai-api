import React from "react";
import { useFormContext, useWatch } from "react-hook-form";

export type MetricDefinitionsFormValues = {
  label: string;
  description?: string;
  dataType: "number" | "string" | "boolean";
  format: "currency" | "count" | "units" | "percent" | "text";
  aiPromptRule?: string;
  aggregation: "sum" | "avg" | "last" | "max" | "min" | "none";
  leaderboardSortDirection: "asc" | "desc";
  isPrimaryLeaderboardMetric: boolean;
  displayIn: {
    table: boolean;
    kpi: boolean;
    chart: boolean;
    leaderboard: boolean;
    detail: boolean;
  };
  defaultInitialValueText?: string;
  sortOrder?: number;
  isActive: boolean;
};

type Props = {
  disabled?: boolean;
};

const MetricDefinitionsForm: React.FC<Props> = ({ disabled }) => {
  const { register, control } = useFormContext<MetricDefinitionsFormValues>();
  const dataType = useWatch({ control, name: "dataType" });
  const showOnLeaderboard = useWatch({
    control,
    name: "displayIn.leaderboard",
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="label" htmlFor="md-label">
          Label *
        </label>
        <input
          id="md-label"
          className="input"
          disabled={disabled}
          {...register("label", { required: true })}
        />
      </div>

      <div className="!grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="label" htmlFor="md-dataType">
            Data type *
          </label>
          <select
            id="md-dataType"
            className="input"
            disabled={disabled}
            {...register("dataType", { required: true })}
          >
            <option value="number">Number</option>
            <option value="string">String</option>
            <option value="boolean">Boolean</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="md-format">
            Format *
          </label>
          <select
            id="md-format"
            className="input"
            disabled={disabled}
            {...register("format", { required: true })}
          >
            <option value="count">Count</option>
            <option value="units">Units</option>
            <option value="currency">Currency</option>
            <option value="percent">Percent</option>
            <option value="text">Text</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="md-aggregation">
            Aggregation *
          </label>
          <select
            id="md-aggregation"
            className="input"
            disabled={disabled}
            {...register("aggregation", { required: true })}
          >
            <option value="sum">Sum</option>
            <option value="avg">Average</option>
            <option value="last">Last</option>
            <option value="max">Max</option>
            <option value="min">Min</option>
            <option value="none">None</option>
          </select>
        </div>
      </div>

      <div className="!grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <label className="label" htmlFor="md-description">
            Description
          </label>
          <textarea
            id="md-description"
            rows={3}
            className="input h-full max-h-28 min-h-24"
            disabled={disabled}
            {...register("description")}
          />
        </div>
        <div>
          <label className="label" htmlFor="md-aiPromptRule">
            AI calculation rule
          </label>
          <textarea
            id="md-aiPromptRule"
            rows={3}
            className="input max-h-28 min-h-24"
            placeholder="e.g. revenue = sales * realizedUnitPrice"
            disabled={disabled}
            {...register("aiPromptRule")}
          />
          <p className="mt-1 text-xs text-text-muted">
            Sent to the AI when computing this metric.
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-ui-border bg-ui-surface-muted p-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Visibility</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            Choose where this metric appears for instructors and students.
          </p>
        </div>
        <div className="!grid grid-cols-2 gap-2 pt-3 sm:grid-cols-4">
          {(["table", "kpi", "chart", "detail"] as const).map((slot) => (
            <label
              key={slot}
              className="flex items-center gap-2 rounded-md border border-ui-border bg-ui-surface px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                disabled={disabled}
                {...register(`displayIn.${slot}` as const)}
              />
              {slot === "kpi" ? "KPI" : `${slot[0].toUpperCase()}${slot.slice(1)}`}
            </label>
          ))}
        </div>

        <div className="my-4 border-t border-ui-border" />

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Leaderboard
              </h3>
              <p className="mt-0.5 text-xs text-text-muted">
                Rank cumulative results using this metric&apos;s aggregation.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                disabled={disabled || dataType !== "number"}
                {...register("displayIn.leaderboard")}
              />
              Show on leaderboard
            </label>
          </div>

          <div className="!grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="md-leaderboard-direction">
                Ranking
              </label>
              <select
                id="md-leaderboard-direction"
                className="input"
                disabled={
                  disabled || !showOnLeaderboard || dataType !== "number"
                }
                {...register("leaderboardSortDirection")}
              >
                <option value="desc">Highest value wins</option>
                <option value="asc">Lowest value wins</option>
              </select>
            </div>
            <label
              className={`flex items-start gap-3 rounded-md border border-ui-border bg-ui-surface px-3 py-2.5 ${
                !showOnLeaderboard || dataType !== "number" ? "opacity-60" : ""
              }`}
            >
              <input
                className="mt-1"
                type="checkbox"
                disabled={
                  disabled || !showOnLeaderboard || dataType !== "number"
                }
                {...register("isPrimaryLeaderboardMetric")}
              />
              <span>
                <span className="block text-sm font-medium text-text-primary">
                  Primary metric
                </span>
                <span className="block text-xs text-text-muted">
                  Used for overall student rank and debriefs.
                </span>
              </span>
            </label>
          </div>
        </div>
      </section>

      <div className="!grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div>
          <label className="label" htmlFor="md-default">
            Initial value (optional)
          </label>
          <input
            id="md-default"
            className="input"
            placeholder="e.g. 0 or 1000"
            disabled={disabled}
            {...register("defaultInitialValueText")}
          />
        </div>

        <div>
          <label className="label" htmlFor="md-sortOrder">
            Sort order
          </label>
          <input
            id="md-sortOrder"
            type="number"
            className="input"
            disabled={disabled}
            {...register("sortOrder", { valueAsNumber: true })}
          />
        </div>

        <div>
          <span className="label">Status</span>
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-ui-border bg-ui-surface px-4 py-2.5 text-sm font-medium">
            <input
              id="md-isActive"
              type="checkbox"
              disabled={disabled}
              {...register("isActive")}
            />
            Active
          </label>
        </div>
      </div>
    </div>
  );
};

export default MetricDefinitionsForm;
