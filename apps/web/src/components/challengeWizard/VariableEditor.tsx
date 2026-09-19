import { FormProvider, useForm } from "react-hook-form";
import VariableDefinition from "../VariableDefinition";
import { VariableDefinitionFormProvider } from "../VariableDefinitionFormProvider";
import type { VariableDefinition as VariableDefinitionModel } from "../../types/variableDefinition";
import type { WizardVariable } from "../../types/challengeWizard";
import { variableError } from "../../utils/challengeWizard";

export function VariablePreview({ value }: { value: WizardVariable }) {
  const form = useForm({
    defaultValues: { variables: { preview: value.defaultValue } },
  });
  const definition = {
    ...value,
    key: "preview",
    appliesTo: "challenge",
    isActive: true,
    classroomId: "",
  } as VariableDefinitionModel;
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        Student input preview
      </p>
      <FormProvider {...form}>
        <VariableDefinitionFormProvider>
          <VariableDefinition definition={definition} />
        </VariableDefinitionFormProvider>
      </FormProvider>
      <p className="text-xs text-text-muted">
        {value.inputType} · Default: {String(value.defaultValue)}
        {value.min !== null || value.max !== null
          ? ` · Range: ${value.min ?? "unbounded"}–${value.max ?? "unbounded"}`
          : ""}
        {value.required ? " · Required" : " · Optional"}
      </p>
    </div>
  );
}

export default function VariableEditor({
  value,
  onChange,
}: {
  value: WizardVariable;
  onChange: (value: WizardVariable) => void;
}) {
  const set = <K extends keyof WizardVariable>(
    key: K,
    next: WizardVariable[K],
  ) => onChange({ ...value, [key]: next });
  const inputTypes = {
    number: ["number", "slider", "knob"],
    string: ["text", "dropdown", "selectbutton", "multiple-choice"],
    boolean: ["checkbox", "switch"],
  };
  const error = variableError(value);
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="label">Question</span>
        <input
          className="input mt-1 w-full"
          value={value.label}
          maxLength={500}
          onChange={(e) => set("label", e.target.value)}
        />
      </label>
      <label className="block">
        <span className="label">Explanation and tradeoffs</span>
        <textarea
          className="input mt-1 w-full"
          rows={3}
          value={value.description}
          maxLength={3000}
          onChange={(e) => set("description", e.target.value)}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">Data type</span>
          <select
            className="input mt-1 w-full"
            value={value.dataType}
            onChange={(e) => {
              const dataType = e.target.value as WizardVariable["dataType"];
              onChange({
                ...value,
                dataType,
                inputType: inputTypes[
                  dataType
                ][0] as WizardVariable["inputType"],
                defaultValue:
                  dataType === "number"
                    ? 0
                    : dataType === "boolean"
                      ? false
                      : "",
                options: [],
                min: null,
                max: null,
              });
            }}
          >
            <option value="number">Number</option>
            <option value="string">Text / choice</option>
            <option value="boolean">Yes / no</option>
          </select>
        </label>
        <label>
          <span className="label">Input control</span>
          <select
            className="input mt-1 w-full"
            value={value.inputType}
            onChange={(e) =>
              set("inputType", e.target.value as WizardVariable["inputType"])
            }
          >
            {inputTypes[value.dataType].map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        {value.dataType === "number" &&
          (["min", "max"] as const).map((field) => (
            <label key={field}>
              <span className="label">
                {field === "min" ? "Minimum" : "Maximum"}
              </span>
              <input
                className="input mt-1 w-full"
                type="number"
                value={value[field] ?? ""}
                onChange={(e) =>
                  set(
                    field,
                    e.target.value === "" ? null : e.target.valueAsNumber,
                  )
                }
              />
            </label>
          ))}
      </div>
      {["dropdown", "selectbutton", "multiple-choice"].includes(
        value.inputType,
      ) && (
        <label className="block">
          <span className="label">Options (one per line)</span>
          <textarea
            className="input mt-1 w-full"
            rows={4}
            value={value.options.join("\n")}
            onChange={(e) => set("options", e.target.value.split("\n"))}
            onBlur={() =>
              set("options", value.options.map((v) => v.trim()).filter(Boolean))
            }
          />
        </label>
      )}
      <label className="block">
        <span className="label">Default value</span>
        {value.dataType === "boolean" ? (
          <select
            className="input mt-1 w-full"
            value={String(value.defaultValue)}
            onChange={(e) => set("defaultValue", e.target.value === "true")}
          >
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        ) : (
          <input
            className="input mt-1 w-full"
            type={value.dataType === "number" ? "number" : "text"}
            value={
              typeof value.defaultValue === "number" &&
              !Number.isFinite(value.defaultValue)
                ? ""
                : String(value.defaultValue)
            }
            onChange={(e) =>
              set(
                "defaultValue",
                value.dataType === "number"
                  ? e.target.valueAsNumber
                  : e.target.value,
              )
            }
          />
        )}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.required}
          onChange={(e) => set("required", e.target.checked)}
        />
        Required decision
      </label>
      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
