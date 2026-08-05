import React, { useEffect, useMemo, useState } from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { FormProvider, useForm } from "react-hook-form";
import slugify from "slugify";
import metricDefinitionsService from "../../services/metricDefinition";
import type { MetricDefinition } from "../../types/metric";
import MetricDefinitionsForm, {
  type MetricDefinitionsFormValues,
} from "./MetricDefinitionsForm";

type Props = {
  classroomId: string;
  variant: "create" | "edit";
  metricDefinition?: MetricDefinition;
  onSaved?: () => void;
};

function toDefaults(def?: MetricDefinition): MetricDefinitionsFormValues {
  return {
    label: def?.label ?? "",
    description: def?.description ?? "",
    dataType: def?.dataType ?? "number",
    format: def?.format ?? "count",
    aiPromptRule: def?.aiPromptRule ?? "",
    aggregation: def?.aggregation ?? "last",
    displayIn: {
      table: def?.displayIn?.table ?? true,
      kpi: def?.displayIn?.kpi ?? false,
      chart: def?.displayIn?.chart ?? false,
      leaderboard: def?.displayIn?.leaderboard ?? false,
      detail: def?.displayIn?.detail ?? true,
    },
    defaultInitialValueText:
      def?.defaultInitialValue === null || def?.defaultInitialValue === undefined
        ? ""
        : String(def.defaultInitialValue),
    sortOrder: def?.sortOrder ?? 0,
    isActive: def?.isActive ?? true,
  };
}

function parseInitialValue(
  dataType: MetricDefinitionsFormValues["dataType"],
  text?: string
) {
  const raw = (text ?? "").trim();
  if (!raw) return null;
  if (dataType === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (dataType === "boolean") {
    if (raw.toLowerCase() === "true") return true;
    if (raw.toLowerCase() === "false") return false;
    return null;
  }
  return raw;
}

const MetricDefinitionsAddButton: React.FC<Props> = ({
  classroomId,
  variant,
  metricDefinition,
  onSaved,
}) => {
  const [visible, setVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = variant === "edit";
  const defaults = useMemo(
    () => toDefaults(isEdit ? metricDefinition : undefined),
    [isEdit, metricDefinition]
  );

  const form = useForm<MetricDefinitionsFormValues>({
    defaultValues: defaults,
    mode: "onChange",
  });

  useEffect(() => {
    if (!visible) return;
    form.reset(defaults);
    setError(null);
  }, [visible, defaults, form]);

  const labelValue = form.watch("label");
  const isValidCreateKey = useMemo(() => {
    const slug = slugify(labelValue || "", { lower: true, strict: true });
    return slug.length > 0;
  }, [labelValue]);

  const resetState = () => {
    setError(null);
    setIsSubmitting(false);
    form.reset(defaults);
  };

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
      const payload = {
        label: values.label.trim(),
        description: values.description?.trim() || "",
        dataType: values.dataType,
        format: values.format,
        aiPromptRule: values.aiPromptRule?.trim() || "",
        aggregation: values.aggregation,
        displayIn: values.displayIn,
        defaultInitialValue: parseInitialValue(
          values.dataType,
          values.defaultInitialValueText
        ),
        sortOrder:
          typeof values.sortOrder === "number" ? values.sortOrder : 0,
        isActive: values.isActive ?? true,
      };

      if (isEdit) {
        if (!metricDefinition?.key) {
          throw new Error("Missing key for edit");
        }
        await metricDefinitionsService.update(
          metricDefinition.key,
          classroomId,
          payload
        );
      } else {
        const key = slugify(values.label || "", { lower: true, strict: true });
        if (!key) {
          setError("Label is required");
          setIsSubmitting(false);
          return;
        }
        await metricDefinitionsService.create(classroomId, {
          key,
          ...payload,
        });
      }

      setVisible(false);
      resetState();
      onSaved?.();
    } catch (e) {
      console.error("Failed to save metric definition:", e);
      setError("Failed to save. Please try again.");
      setIsSubmitting(false);
    }
  });

  const title = isEdit ? "Edit Metric" : "Create Metric";

  const canSubmit =
    !isSubmitting && form.formState.isValid && (isEdit || isValidCreateKey);

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
          <FormProvider {...form}>
            <MetricDefinitionsForm disabled={isSubmitting} />
          </FormProvider>
        </div>
      </Dialog>
    </>
  );
};

export default MetricDefinitionsAddButton;
