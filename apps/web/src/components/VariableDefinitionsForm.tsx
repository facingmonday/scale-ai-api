import React, { useEffect, useMemo } from "react";
import { useFormContext, FormProvider, useForm } from "react-hook-form";
import VariableDefinition from "./VariableDefinition";
import { VariableDefinitionFormProvider } from "./VariableDefinitionFormProvider";
import type { VariableDefinition as VariableDefinitionModel } from "../types/variableDefinition";
import { Checkbox } from "primereact/checkbox";

export type VariableDefinitionsFormValues = {
  label: string;
  description?: string;
  appliesTo: "profile" | "profileType" | "challenge" | "decision" | "outcome";
  dataType: "number" | "string" | "boolean";
  inputType:
    | "text"
    | "number"
    | "slider"
    | "dropdown"
    | "checkbox"
    | "knob"
    | "switch"
    | "selectbutton"
    | "multiple-choice";
  optionsText?: string;
  defaultValueText?: string;
  min?: string;
  max?: string;
  required: boolean;
  isActive: boolean;
};

function inputTypeNeedsOptions(
  inputType: VariableDefinitionsFormValues["inputType"]
) {
  return (
    inputType === "dropdown" ||
    inputType === "selectbutton" ||
    inputType === "multiple-choice"
  );
}

// Helper to transform form values to VariableDefinition
function transformToVariableDefinition(
  values: VariableDefinitionsFormValues
): Partial<VariableDefinitionModel> {
  const options =
    values.optionsText
      ?.split("\n")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

  let defaultValue: string | number | boolean | null = null;
  if (values.defaultValueText) {
    if (values.dataType === "number") {
      const num = Number(values.defaultValueText);
      defaultValue = Number.isFinite(num) ? num : null;
    } else if (values.dataType === "boolean") {
      defaultValue = values.defaultValueText.toLowerCase() === "true";
    } else {
      defaultValue = values.defaultValueText;
    }
  }

  const min =
    values.min && values.dataType === "number" ? Number(values.min) : null;
  const max =
    values.max && values.dataType === "number" ? Number(values.max) : null;

  return {
    key: "preview", // Temporary key for preview
    label: values.label || "Preview",
    description: values.description || "",
    appliesTo: values.appliesTo,
    dataType: values.dataType,
    inputType: values.inputType,
    options: inputTypeNeedsOptions(values.inputType) ? options : [],
    defaultValue: defaultValue,
    min: min && Number.isFinite(min) ? min : null,
    max: max && Number.isFinite(max) ? max : null,
    required: values.required,
    isActive: values.isActive,
    classroomId: "", // Not needed for preview
  } as Partial<VariableDefinitionModel>;
}

const VariableDefinitionsForm: React.FC<{ disabled?: boolean }> = ({
  disabled,
}) => {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<VariableDefinitionsFormValues>();

  const dataType = watch("dataType");
  const inputType = watch("inputType");

  // Watch all form values for preview
  const formValues = watch();

  // Create preview definition
  const previewDefinition = useMemo(() => {
    return transformToVariableDefinition(formValues);
  }, [formValues]);

  // Extract defaultValue for stable reference
  const previewDefaultValue = previewDefinition.defaultValue ?? null;

  // Create a separate form for the preview
  const previewForm = useForm({
    defaultValues: {
      variables: {
        preview: previewDefaultValue,
      },
    },
  });

  // Update preview form when definition changes
  useEffect(() => {
    previewForm.setValue("variables.preview", previewDefaultValue);
  }, [previewDefaultValue, previewForm]);

  const inputTypeOptions = useMemo(() => {
    switch (dataType) {
      case "number":
        return [
          { value: "number", label: "Number input" },
          { value: "slider", label: "Slider" },
          { value: "knob", label: "Knob" },
        ] as const;
      case "string":
        return [
          { value: "text", label: "Text input" },
          { value: "dropdown", label: "Dropdown" },
          { value: "selectbutton", label: "Select Button" },
          { value: "multiple-choice", label: "Multiple choice" },
        ] as const;
      case "boolean":
        return [
          { value: "checkbox", label: "Checkbox" },
          { value: "switch", label: "Switch" },
        ] as const;
      default:
        return [{ value: "text", label: "Text input" }] as const;
    }
  }, [dataType]);

  // Keep inputType sensible when dataType changes
  useEffect(() => {
    const allowed = new Set(inputTypeOptions.map((o) => o.value));
    const current = watch("inputType");
    if (!allowed.has(current)) {
      setValue(
        "inputType",
        inputTypeOptions[0].value as VariableDefinitionsFormValues["inputType"],
        {
          shouldDirty: true,
          shouldValidate: true,
        }
      );
    }
  }, [inputTypeOptions, setValue, watch]);

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Form on the left */}
      <div className="flex flex-col gap-2 w-1/2">
        <div>
          <label className="label" htmlFor="vd-label">
            Label *
          </label>
          <input
            id="vd-label"
            className="input"
            placeholder="e.g. Max ovens"
            disabled={disabled}
            {...register("label", { required: "Label is required" })}
          />
          {errors.label?.message && (
            <p className="text-red-400 text-sm mt-1">
              {String(errors.label.message)}
            </p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="vd-description">
            Description
          </label>
          <textarea
            id="vd-description"
            className="input min-h-[96px] resize-none"
            placeholder="Optional"
            disabled={disabled}
            {...register("description")}
          />
        </div>

        <div>
          <label className="label" htmlFor="vd-appliesTo">
            Applies to*
          </label>
          <select
            id="vd-appliesTo"
            className="input"
            disabled={disabled}
            {...register("appliesTo", { required: true })}
          >
            <option value="profile">Profile</option>
            <option value="profileType">Profile Type</option>
            <option value="challenge">Challenge</option>
            <option value="decision">Decision</option>
            <option value="outcome">Outcome</option>
          </select>
        </div>

        <div className="flex flex-row gap-2">
          <div className="w-1/2">
            <label className="label" htmlFor="vd-dataType">
              Data type *
            </label>
            <select
              id="vd-dataType"
              className="input"
              disabled={disabled}
              {...register("dataType", { required: true })}
            >
              <option value="number">Number</option>
              <option value="string">String</option>
              <option value="boolean">Boolean</option>
            </select>
          </div>

          <div className="w-1/2">
            <label className="label" htmlFor="vd-inputType">
              Input type *
            </label>
            <select
              id="vd-inputType"
              className="input"
              disabled={disabled}
              {...register("inputType", { required: true })}
            >
              {inputTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {inputTypeNeedsOptions(inputType) && (
          <div className="md:col-span-2">
            <label className="label" htmlFor="vd-optionsText">
              Options (one per line) *
            </label>
            <textarea
              id="vd-optionsText"
              className="input min-h-[120px] resize-none"
              placeholder={"Small\nMedium\nLarge"}
              disabled={disabled}
              {...register("optionsText", {
                validate: (value) => {
                  if (!inputTypeNeedsOptions(inputType)) return true;
                  const items =
                    value
                      ?.split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean) ?? [];
                  return items.length > 0 || "At least one option is required";
                },
              })}
            />
            {errors.optionsText?.message && (
              <p className="text-red-400 text-sm mt-1">
                {String(errors.optionsText.message)}
              </p>
            )}
          </div>
        )}

        {dataType === "number" && (
          <div className="flex flex-row gap-2">
            <div className="w-1/2">
              <label className="label" htmlFor="vd-min">
                Min
              </label>
              <input
                id="vd-min"
                className="input"
                placeholder="Optional"
                disabled={disabled || dataType !== "number"}
                {...register("min")}
              />
            </div>

            <div className="w-1/2">
              <label className="label" htmlFor="vd-max">
                Max
              </label>
              <input
                id="vd-max"
                className="input"
                placeholder="Optional"
                disabled={disabled || dataType !== "number"}
                {...register("max")}
              />
            </div>
          </div>
        )}
        <div>
          <label className="label" htmlFor="vd-defaultValueText">
            Default value
          </label>
          <input
            id="vd-defaultValueText"
            className="input"
            placeholder={
              dataType === "boolean"
                ? "true or false"
                : dataType === "number"
                ? "e.g. 10"
                : "Optional"
            }
            disabled={disabled}
            {...register("defaultValueText")}
          />
        </div>

        <div className="flex flex-row gap-4 mt-2">
          <label className="inline-flex items-center gap-1">
            <Checkbox
              className="variable-def-form-checkbox"
              checked={watch("required")}
              disabled={disabled}
              onChange={(e) => setValue("required", !!e.checked)}
            />
            <span className="text-base text-text-secondary">Required</span>
          </label>
          <label className="inline-flex items-center gap-1">
            <Checkbox
              className="variable-def-form-checkbox"
              checked={watch("isActive")}
              disabled={disabled}
              onChange={(e) => setValue("isActive", !!e.checked)}
            />
            <span className="text-base text-text-secondary">Active</span>
          </label>
        </div>
      </div>

      {/* Preview on the right */}
      <div className="flex flex-col col-span-1">
        <div className="mb-2">
          <h3 className="text-sm font-medium text-text-secondary">Preview</h3>
        </div>
        {previewDefinition.label ? (
          <div className="w-full">
            <FormProvider {...previewForm}>
              <VariableDefinitionFormProvider
                namePrefix="variables"
                readOnly={false}
              >
                <VariableDefinition
                  definition={previewDefinition as VariableDefinitionModel}
                  readOnly={false}
                />
              </VariableDefinitionFormProvider>
            </FormProvider>
          </div>
        ) : (
          <div className="card p-6 text-center text-text-muted">
            <p className="text-sm">Fill in the form to see a preview</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VariableDefinitionsForm;
