import React from "react";
import { useFormContext } from "react-hook-form";

export type MetricDefinitionsFormValues = {
  label: string;
  description?: string;
  dataType: "number" | "string" | "boolean";
  format: "currency" | "count" | "units" | "percent" | "text";
  aiPromptRule?: string;
  aggregation: "sum" | "avg" | "last" | "max" | "min" | "none";
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
  const { register } = useFormContext<MetricDefinitionsFormValues>();

  return (
    <div className="flex flex-col gap-4">
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

      <div>
        <label className="label" htmlFor="md-description">
          Description
        </label>
        <textarea
          id="md-description"
          rows={2}
          className="input"
          disabled={disabled}
          {...register("description")}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
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

        <div className="flex-1">
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

        <div className="flex-1">
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

      <div>
        <label className="label" htmlFor="md-aiPromptRule">
          AI calculation rule
        </label>
        <textarea
          id="md-aiPromptRule"
          rows={3}
          className="input"
          placeholder="e.g. revenue = sales * realizedUnitPrice"
          disabled={disabled}
          {...register("aiPromptRule")}
        />
        <p className="text-text-muted text-xs mt-1">
          Instruction sent to the AI when computing this metric. Be specific
          about constraints and dependencies.
        </p>
      </div>

      <div>
        <span className="label">Display in</span>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-1">
          {(
            ["table", "kpi", "chart", "leaderboard", "detail"] as const
          ).map((slot) => (
            <label
              key={slot}
              className="flex items-center gap-2 text-sm capitalize"
            >
              <input
                type="checkbox"
                disabled={disabled}
                {...register(`displayIn.${slot}` as const)}
              />
              {slot}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
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

        <div className="flex-1">
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

        <div className="flex flex-col justify-end">
          <label className="label" htmlFor="md-isActive">
            Active
          </label>
          <input
            id="md-isActive"
            type="checkbox"
            disabled={disabled}
            {...register("isActive")}
          />
        </div>
      </div>
    </div>
  );
};

export default MetricDefinitionsForm;
