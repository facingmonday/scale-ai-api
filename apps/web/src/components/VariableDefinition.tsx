import React, { useMemo } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { InputText } from "primereact/inputtext";
import { InputNumber } from "primereact/inputnumber";
import { Dropdown } from "primereact/dropdown";
import { Checkbox } from "primereact/checkbox";
import { Slider } from "primereact/slider";
import { Knob } from "primereact/knob";
import { InputSwitch } from "primereact/inputswitch";
import { SelectButton } from "primereact/selectbutton";
import { RadioButton } from "primereact/radiobutton";
import type { VariableDefinition as VariableDefinitionModel } from "../types/variableDefinition";
import { useVariableDefinitionFormContext } from "./VariableDefinitionFormContext";

type Props = {
  definition: VariableDefinitionModel;
  readOnly?: boolean;
  actions?: React.ReactNode;
};

function coerceInitial(
  dataType: VariableDefinitionModel["dataType"],
  value: unknown
) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  switch (dataType) {
    case "number": {
      if (typeof value === "number") return value;
      const n = Number(value);
      return Number.isFinite(n) ? n : undefined;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      if (value === "true") return true;
      if (value === "false") return false;
      return undefined;
    }
    case "string":
    default:
      return String(value);
  }
}

/**
 * Rounds a number to a specific number of decimal places to avoid floating-point precision issues
 */
function roundToPrecision(value: number, decimalPlaces: number): number {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(value * factor) / factor;
}

/**
 * Determines the number of decimal places needed based on step size
 */
function getDecimalPlaces(step: number): number {
  if (step >= 1) return 0;
  if (step >= 0.1) return 1;
  if (step >= 0.01) return 2;
  if (step >= 0.001) return 3;
  return 4; // Default to 4 for very small steps
}

const VariableDefinition: React.FC<Props> = ({
  definition,
  readOnly,
  actions,
}) => {
  const { control } = useFormContext();
  const ctx = useVariableDefinitionFormContext();
  const isReadOnly = readOnly ?? ctx.readOnly;

  const fieldName = `${ctx.namePrefix}.${definition.key}`;
  const label = definition.label || definition.key;
  const helper = definition.description?.trim() || "";

  // Be defensive: older definitions may still have dataType === "select".
  const rawDataType = (
    definition as unknown as {
      dataType?: VariableDefinitionModel["dataType"] | "select";
    }
  ).dataType;
  const dataType: VariableDefinitionModel["dataType"] =
    rawDataType === "select" ? "string" : rawDataType ?? "string";

  const presentation =
    definition.inputType ??
    (dataType === "boolean"
      ? ("checkbox" as const)
      : dataType === "number"
      ? ("number" as const)
      : ("text" as const));

  const dropdownOptions = useMemo(() => {
    const opts = Array.isArray(definition.options) ? definition.options : [];
    return opts.map((o) => ({ label: o, value: o }));
  }, [definition.options]);

  return (
    <div className="card relative w-full h-full flex flex-column justify-between">
      {actions && (
        <div className="absolute right-3 top-3 z-10">
          {actions}
        </div>
      )}
      <div className="flex items-start justify-center gap-4">
        <div className="flex-1 text-center">
          <div className="flex items-center justify-center gap-2">
            <h3 className="heading-md" style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>{label}</h3>
            {definition.required && (
              <span className="text-red-400 text-sm" aria-hidden="true">
                *
              </span>
            )}
          </div>
          {helper && <p className="text-text-muted text-sm mt-1" style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>{helper}</p>}
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center">
        <Controller
          control={control}
          name={fieldName}
          rules={{
            required: definition.required ? "This field is required" : false,
          }}
          render={({ field, fieldState }) => {
            const value = coerceInitial(definition.dataType, field.value);
            const invalid = !!fieldState.error;

            // PrimeReact inputs generally prefer `disabled` for read-only mode.
            if (
              presentation === "checkbox" &&
              definition.dataType === "boolean"
            ) {
              return (
                <div className="flex flex-col gap-2 items-center">
                  <label className="inline-flex items-center gap-2">
                    <Checkbox
                      checked={!!value}
                      disabled={isReadOnly}
                      onChange={(e) => field.onChange(!!e.checked)}
                    />
                    <span className="text-sm text-text-secondary">{label}</span>
                  </label>
                  {invalid && (
                    <p className="text-red-400 text-sm text-center">
                      {String(fieldState.error?.message)}
                    </p>
                  )}
                </div>
              );
            }

            if (
              presentation === "switch" &&
              definition.dataType === "boolean"
            ) {
              return (
                <div className="flex flex-col gap-2 items-center">
                  <label className="inline-flex items-center gap-2">
                    <InputSwitch
                      checked={!!value}
                      disabled={isReadOnly}
                      onChange={(e) => field.onChange(!!e.value)}
                    />
                    <span className="text-sm text-text-secondary">{label}</span>
                  </label>
                  {invalid && (
                    <p className="text-red-400 text-sm text-center">
                      {String(fieldState.error?.message)}
                    </p>
                  )}
                </div>
              );
            }

            if (presentation === "dropdown" && dataType === "string") {
              return (
                <div className="flex flex-col gap-2 mb-2 items-center w-full">
                  <Dropdown
                    value={value ?? null}
                    options={dropdownOptions}
                    disabled={isReadOnly}
                    className={`w-full ${invalid ? "p-invalid" : ""}`}
                    placeholder="Select..."
                    onChange={(e) => field.onChange(e.value)}
                  />
                  {invalid && (
                    <p className="text-red-400 text-sm text-center">
                      {String(fieldState.error?.message)}
                    </p>
                  )}
                </div>
              );
            }

            if (presentation === "selectbutton" && dataType === "string") {
              return (
                <div className="flex flex-col gap-2 items-center">
                  <SelectButton
                    value={value ?? null}
                    options={dropdownOptions}
                    disabled={isReadOnly}
                    onChange={(e) => field.onChange(e.value)}
                  />
                  {invalid && (
                    <p className="text-red-400 text-sm text-center">
                      {String(fieldState.error?.message)}
                    </p>
                  )}
                </div>
              );
            }

            if (presentation === "multiple-choice" && dataType === "string") {
              const opts = Array.isArray(definition.options)
                ? definition.options
                : [];
              const currentValue = typeof value === "string" ? value : null;
              return (
                <div className="flex flex-col gap-2 items-start w-full">
                  {opts.length ? (
                    <div className="flex flex-col gap-2 w-full">
                      {opts.map((opt) => (
                        <label
                          key={opt}
                          className="inline-flex items-center gap-2"
                        >
                          <RadioButton
                            value={opt}
                            checked={currentValue === opt}
                            disabled={isReadOnly}
                            onChange={(e) => field.onChange(e.value)}
                          />
                          <span className="text-sm text-text-secondary">
                            {opt}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-text-muted text-sm">
                      No options configured.
                    </p>
                  )}
                  {invalid && (
                    <p className="text-red-400 text-sm text-center w-full">
                      {String(fieldState.error?.message)}
                    </p>
                  )}
                </div>
              );
            }

            if (presentation === "slider" && dataType === "number") {
              const min = definition.min ?? 0;
              const max = definition.max ?? 100;
              const numericValue: number =
                typeof value === "number"
                  ? value
                  : typeof definition.defaultValue === "number"
                  ? definition.defaultValue
                  : min;

              // Determine if we're dealing with decimals or integers
              // Check if min, max, or defaultValue have decimal parts
              const hasDecimals =
                min % 1 !== 0 ||
                max % 1 !== 0 ||
                (typeof definition.defaultValue === "number" &&
                  definition.defaultValue % 1 !== 0) ||
                (typeof value === "number" && value % 1 !== 0);

              // Calculate appropriate step size
              // For decimals: calculate step to provide reasonable granularity (20-100 steps)
              // For integers: use step of 1
              const range = max - min;
              let step: number;
              if (hasDecimals) {
                // For decimal ranges, aim for 50-100 steps for good control
                // Calculate step that gives us approximately 50-100 steps
                const targetSteps = 50;
                const calculatedStep = range / targetSteps;

                // Round to a reasonable precision (0.01, 0.05, 0.1, etc.)
                if (calculatedStep <= 0.01) {
                  step = 0.01; // Fine-grained for very small ranges
                } else if (calculatedStep <= 0.05) {
                  step = 0.05; // Medium step
                } else if (calculatedStep <= 0.1) {
                  step = 0.1; // Coarser step
                } else {
                  // For larger ranges, round to nearest 0.5 or 1
                  step = Math.max(0.5, Math.round(calculatedStep * 2) / 2);
                }
              } else {
                step = 1; // Integer step
              }

              // Calculate decimal places for display and rounding
              const decimalPlaces = getDecimalPlaces(step);
              // Round the displayed value to avoid floating-point precision issues
              const roundedValue = roundToPrecision(
                numericValue,
                decimalPlaces
              );

              return (
                <div className="flex flex-col gap-2 items-center w-full">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-text-muted text-sm">
                      {min} – {max}
                    </span>
                    <span className="tabular-nums">
                      {roundedValue.toFixed(decimalPlaces)}
                    </span>
                  </div>
                  <Slider
                    value={roundedValue}
                    min={min}
                    max={max}
                    step={step}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      // Round the value when it changes to prevent floating-point errors
                      // Slider onChange can return number or [number, number] for range sliders
                      const sliderValue = Array.isArray(e.value)
                        ? e.value[0]
                        : e.value;
                      const rounded = roundToPrecision(
                        sliderValue,
                        decimalPlaces
                      );
                      field.onChange(rounded);
                    }}
                    className="p-slider-horizontal"
                  />
                  {invalid && (
                    <p className="text-red-400 text-sm text-center">
                      {String(fieldState.error?.message)}
                    </p>
                  )}
                </div>
              );
            }

            if (presentation === "knob" && dataType === "number") {
              const min = definition.min ?? 0;
              const max = definition.max ?? 100;
              const numericValue: number =
                typeof value === "number"
                  ? value
                  : typeof definition.defaultValue === "number"
                  ? definition.defaultValue
                  : min;

              // Determine if we're dealing with decimals or integers
              // Check if min, max, or defaultValue have decimal parts
              const hasDecimals =
                min % 1 !== 0 ||
                max % 1 !== 0 ||
                (typeof definition.defaultValue === "number" &&
                  definition.defaultValue % 1 !== 0) ||
                (typeof value === "number" && value % 1 !== 0);

              // Calculate appropriate step size
              // For decimals: calculate step to provide reasonable granularity (20-100 steps)
              // For integers: use step of 1
              const range = max - min;
              let step: number;
              if (hasDecimals) {
                // For decimal ranges, aim for 50-100 steps for good control
                // Calculate step that gives us approximately 50-100 steps
                const targetSteps = 50;
                const calculatedStep = range / targetSteps;

                // Round to a reasonable precision (0.01, 0.05, 0.1, etc.)
                if (calculatedStep <= 0.01) {
                  step = 0.01; // Fine-grained for very small ranges
                } else if (calculatedStep <= 0.05) {
                  step = 0.05; // Medium step
                } else if (calculatedStep <= 0.1) {
                  step = 0.1; // Coarser step
                } else {
                  // For larger ranges, round to nearest 0.5 or 1
                  step = Math.max(0.5, Math.round(calculatedStep * 2) / 2);
                }
              } else {
                step = 1; // Integer step
              }

              // Calculate decimal places for display and rounding
              const decimalPlaces = getDecimalPlaces(step);
              // Round the displayed value to avoid floating-point precision issues
              const roundedValue = roundToPrecision(
                numericValue,
                decimalPlaces
              );

              return (
                <div className="flex flex-col gap-2 items-center">
                  <Knob
                    value={roundedValue}
                    min={min}
                    max={max}
                    step={step}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      // Round the value when it changes to prevent floating-point errors
                      const rounded = roundToPrecision(e.value, decimalPlaces);
                      field.onChange(rounded);
                    }}
                  />
                  <span className="tabular-nums text-sm">
                    {roundedValue.toFixed(decimalPlaces)}
                  </span>
                  {invalid && (
                    <p className="text-red-400 text-sm text-center">
                      {String(fieldState.error?.message)}
                    </p>
                  )}
                </div>
              );
            }

            if (definition.dataType === "number" || presentation === "number") {
              return (
                <div className="flex flex-col gap-2 items-center w-full">
                  <InputNumber
                    value={typeof value === "number" ? value : null}
                    disabled={isReadOnly}
                    className={`w-full ${invalid ? "p-invalid" : ""}`}
                    min={definition.min ?? undefined}
                    max={definition.max ?? undefined}
                    onValueChange={(e) => field.onChange(e.value)}
                  />
                  {invalid && (
                    <p className="text-red-400 text-sm text-center">
                      {String(fieldState.error?.message)}
                    </p>
                  )}
                </div>
              );
            }

            // default text
            return (
              <div className="flex flex-col gap-2 items-center w-full">
                <InputText
                  value={
                    typeof value === "string"
                      ? value
                      : value
                      ? String(value)
                      : ""
                  }
                  disabled={isReadOnly}
                  className={`w-full ${invalid ? "p-invalid" : ""}`}
                  onChange={(e) => field.onChange(e.target.value)}
                />
                {invalid && (
                  <p className="text-red-400 text-sm text-center">
                    {String(fieldState.error?.message)}
                  </p>
                )}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
};

export default VariableDefinition;
