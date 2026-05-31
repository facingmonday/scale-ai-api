import React, { useEffect, useMemo, useState } from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { FormProvider, useForm } from "react-hook-form";
import slugify from "slugify";
import variableDefinitionsService from "../services/variableDefinition";
import type { VariableDefinition } from "../types/variableDefinition";
import VariableDefinitionsForm, {
  type VariableDefinitionsFormValues,
} from "./VariableDefinitionsForm";

type Props = {
  classroomId: string;
  variant: "create" | "edit";
  variableDefinition?: VariableDefinition;
  defaultAppliesTo?: VariableDefinition["appliesTo"];
  onSaved?: () => void;
};

function parseNumberOrUndefined(value?: string) {
  const v = (value ?? "").trim();
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function parseDefaultValue(
  dataType: VariableDefinitionsFormValues["dataType"],
  value?: string
) {
  const raw = (value ?? "").trim();
  if (!raw) return undefined;

  if (dataType === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }

  if (dataType === "boolean") {
    if (raw.toLowerCase() === "true") return true;
    if (raw.toLowerCase() === "false") return false;
    return undefined;
  }

  // string
  return raw;
}

function inputTypeNeedsOptions(
  inputType?: VariableDefinitionsFormValues["inputType"]
) {
  return (
    inputType === "dropdown" ||
    inputType === "selectbutton" ||
    inputType === "multiple-choice"
  );
}

function toDefaults(
  def?: VariableDefinition,
  defaultAppliesTo?: VariableDefinition["appliesTo"]
): VariableDefinitionsFormValues {
  // Be defensive: older definitions may still have dataType === "select".
  const rawDataType =
    (def &&
      "dataType" in def &&
      (def as unknown as { dataType?: unknown }).dataType) ??
    undefined;
  const rawDataTypeString =
    typeof rawDataType === "string" ? rawDataType : undefined;
  const dataType: VariableDefinitionsFormValues["dataType"] =
    rawDataTypeString === "select"
      ? "string"
      : rawDataTypeString === "number" ||
        rawDataTypeString === "string" ||
        rawDataTypeString === "boolean"
      ? rawDataTypeString
      : "number";

  let defaultInputType: VariableDefinitionsFormValues["inputType"] = "number";

  if (def?.inputType) {
    defaultInputType = def.inputType;
  } else {
    switch (dataType) {
      case "boolean":
        defaultInputType = "checkbox";
        break;
      case "string":
        defaultInputType = "text";
        break;
      case "number":
      default:
        defaultInputType = "number";
        break;
    }
  }

  return {
    label: def?.label ?? "",
    description: def?.description ?? "",
    appliesTo: def?.appliesTo ?? defaultAppliesTo ?? "challenge",
    dataType: dataType,
    inputType: defaultInputType,
    optionsText: Array.isArray(def?.options) ? def!.options.join("\n") : "",
    defaultValueText:
      def?.defaultValue === null || def?.defaultValue === undefined
        ? ""
        : String(def.defaultValue),
    min: def?.min === null || def?.min === undefined ? "" : String(def.min),
    max: def?.max === null || def?.max === undefined ? "" : String(def.max),
    required: def?.required ?? false,
    isActive: def?.isActive ?? true,
  };
}

const VariableDefinitionsAddButton: React.FC<Props> = ({
  classroomId,
  variant,
  variableDefinition,
  defaultAppliesTo,
  onSaved,
}) => {
  const [visible, setVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = variant === "edit";

  const defaults = useMemo(
    () => toDefaults(isEdit ? variableDefinition : undefined, defaultAppliesTo),
    [isEdit, variableDefinition, defaultAppliesTo]
  );

  const form = useForm<VariableDefinitionsFormValues>({
    defaultValues: defaults,
    mode: "onChange",
  });

  const labelValue = form.watch("label");
  const dataTypeValue = form.watch("dataType");
  const inputTypeValue = form.watch("inputType");
  const optionsTextValue = form.watch("optionsText");
  const defaultValueTextValue = form.watch("defaultValueText");

  const isValidCreateKey = useMemo(() => {
    const slug = slugify(labelValue || "", { lower: true, strict: true });
    return slug.length > 0;
  }, [labelValue]);

  const resetState = () => {
    setError(null);
    setIsSubmitting(false);
    form.reset(defaults);
  };

  useEffect(() => {
    if (!visible) return;
    // Ensure we rehydrate form values each time it opens (and when switching edit target)
    form.reset(defaults);
    setError(null);
  }, [visible, defaults, form]);

  const handleHide = () => {
    if (isSubmitting) return;
    setVisible(false);
    resetState();
  };

  const submit = form.handleSubmit(async (values) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const options = inputTypeNeedsOptions(values.inputType)
        ? (values.optionsText ?? "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

      const payloadCommon = {
        label: values.label.trim(),
        description: values.description?.trim() || undefined,
        appliesTo: values.appliesTo,
        dataType: values.dataType,
        inputType: values.inputType,
        options,
        defaultValue: parseDefaultValue(
          values.dataType,
          values.defaultValueText
        ),
        min:
          values.dataType === "number"
            ? parseNumberOrUndefined(values.min)
            : undefined,
        max:
          values.dataType === "number"
            ? parseNumberOrUndefined(values.max)
            : undefined,
        required: !!values.required,
        isActive: values.isActive ?? true,
      };

      if (isEdit) {
        if (!variableDefinition?.key) {
          throw new Error("Missing key for edit");
        }

        await variableDefinitionsService.update(
          variableDefinition.key,
          classroomId,
          payloadCommon
        );
      } else {
        const key = slugify(values.label || "", { lower: true, strict: true });
        if (!key) {
          setError("Label is required");
          setIsSubmitting(false);
          return;
        }

        await variableDefinitionsService.create({
          classroomId,
          key,
          ...payloadCommon,
        });
      }

      setVisible(false);
      resetState();
      onSaved?.();
    } catch (e) {
      console.error("Failed to save variable definition:", e);
      setError("Failed to save. Please try again.");
      setIsSubmitting(false);
    }
  });

  const title = isEdit
    ? "Edit Variable Definition"
    : "Create Variable Definition";

  const canSubmit =
    !isSubmitting &&
    form.formState.isValid &&
    (isEdit || isValidCreateKey) &&
    (!inputTypeNeedsOptions(inputTypeValue) ||
      (optionsTextValue ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean).length > 0);

  const defaultValueHint =
    dataTypeValue === "boolean" && defaultValueTextValue
      ? ["true", "false"].includes(defaultValueTextValue.trim().toLowerCase())
        ? null
        : "For booleans, default must be true or false"
      : null;

  return (
    <>
      {variant === "create" ? (
        <button className="btn-teal" onClick={() => setVisible(true)}>
          + Create
        </button>
      ) : (
        <Button
          icon="pi pi-pencil"
          className="p-button-rounded p-button-text"
          onClick={() => setVisible(true)}
        />
      )}

      <Dialog
        header={title}
        visible={visible}
        onHide={handleHide}
        modal
        closable={!isSubmitting}
        dismissableMask={!isSubmitting}
        className="modal w-full max-w-3xl"
        maskClassName="modal-mask"
        headerClassName="modal-header"
        contentClassName="modal-content"
        pt={{
          headerTitle: { className: "modal-title" },
          footer: { className: "modal-footer" },
        }}
        footer={
          <div className="flex gap-2 justify-end">
            <button
              className="btn-outline"
              onClick={handleHide}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              className="btn-teal"
              onClick={() => void submit()}
              disabled={!canSubmit}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {defaultValueHint && (
            <p className="text-text-muted text-sm">{defaultValueHint}</p>
          )}

          <FormProvider {...form}>
            {/* key is intentionally not displayed; on create it is slugified from label */}
            <VariableDefinitionsForm disabled={isSubmitting} />
          </FormProvider>
        </div>
      </Dialog>
    </>
  );
};

export default VariableDefinitionsAddButton;
