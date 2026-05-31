import React, { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import classroomTemplatesService from "@/services/classroomTemplates";
import type { ClassroomTemplate } from "@/types/classroomTemplate";
import { useGlobalContext } from "@/context/GlobalContext";

type Props = {
  classroomId: string;
  disabled?: boolean;
};

const ClassroomSaveAsTemplateAction: React.FC<Props> = ({
  classroomId,
  disabled = false,
}) => {
  const globalContext = useGlobalContext();

  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templates, setTemplates] = useState<ClassroomTemplate[]>([]);

  const [includeInactive, setIncludeInactive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"overwrite" | "create">("overwrite");

  const [overwriteTemplateKey, setOverwriteTemplateKey] = useState<string>(
    "default_supply_chain_101"
  );

  const [newTemplateLabel, setNewTemplateLabel] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;

    const fetchTemplates = async () => {
      setIsLoadingTemplates(true);
      setError(null);
      try {
        const list = await classroomTemplatesService.getAll();
        if (!mounted) return;
        setTemplates(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error("Failed to load classroom templates:", e);
        if (!mounted) return;
        setTemplates([]);
        setError("Failed to load templates.");
      } finally {
        if (mounted) setIsLoadingTemplates(false);
      }
    };

    setMode("overwrite");
    setOverwriteTemplateKey("default_supply_chain_101");
    setNewTemplateLabel("");
    setNewTemplateDescription("");
    setIncludeInactive(false);
    void fetchTemplates();

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      if (mode === "overwrite") {
        await classroomTemplatesService.overwriteFromClassroom({
          classroomId,
          key: overwriteTemplateKey || undefined,
          includeInactive,
        });
      } else {
        const label = newTemplateLabel.trim();
        await classroomTemplatesService.createFromClassroom(
          { classroomId, includeInactive },
          {
            label: label || undefined,
            description: newTemplateDescription.trim() || undefined,
            isActive: true,
          }
        );
      }

      globalContext?.showToast?.("Template saved from classroom", "success");
      setIsOpen(false);
    } catch (e) {
      console.error("Failed to save classroom to template:", e);
      const errorMessage =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      setError(errorMessage || "Failed to save template. Please try again.");
      globalContext?.showToast?.(
        errorMessage || "Failed to save template",
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="danger-zone-row">
        <div>
          <h3 className="font-semibold mb-1">Save classroom as template</h3>
          <p className="text-text-muted text-sm">
            Snapshot this classroom's profile types and variable definitions into
            a classroom template.
          </p>
        </div>
        <Button
          label="Save to Template"
          icon="pi pi-save"
          onClick={() => setIsOpen(true)}
          severity="secondary"
          outlined
          className="[&_.p-button-icon]:mr-3"
          disabled={disabled}
        />
      </div>

      <Dialog
        header="Save classroom to template"
        visible={isOpen}
        onHide={() => !isSaving && setIsOpen(false)}
        modal
        closable={!isSaving}
        dismissableMask={!isSaving}
        className="modal w-full max-w-2xl"
        maskClassName="modal-mask"
        headerClassName="modal-header"
        contentClassName="modal-content"
        pt={{
          headerTitle: { className: "modal-title" },
          footer: { className: "modal-footer" },
        }}
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              label="Cancel"
              icon="pi pi-times"
              onClick={() => setIsOpen(false)}
              text
              disabled={isSaving}
            />
            <Button
              label={mode === "overwrite" ? "Overwrite Template" : "Create & Save"}
              icon="pi pi-check"
              onClick={handleSave}
              severity="danger"
              loading={isSaving}
              disabled={
                isLoadingTemplates || (mode === "create" && !newTemplateLabel.trim())
              }
            />
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {error ? <p className="text-danger font-medium">{error}</p> : null}
          <p className="text-text-muted">
            Choose whether to overwrite an existing template or create a new one
            from this classroom.
          </p>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="save-template-mode"
                checked={mode === "overwrite"}
                onChange={() => setMode("overwrite")}
                disabled={isSaving}
              />
              <span className="text-text-muted">Overwrite existing template</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="save-template-mode"
                checked={mode === "create"}
                onChange={() => setMode("create")}
                disabled={isSaving}
              />
              <span className="text-text-muted">Create new template</span>
            </label>
          </div>

          <div>
            {mode === "overwrite" ? (
              <>
                <label className="label" htmlFor="save-template-template-key">
                  Template key to overwrite (optional)
                </label>
                <select
                  id="save-template-template-key"
                  className="input"
                  value={overwriteTemplateKey}
                  onChange={(e) => setOverwriteTemplateKey(e.target.value)}
                  disabled={isSaving || isLoadingTemplates}
                >
                  <option value="default_supply_chain_101">
                    default_supply_chain_101 (default)
                  </option>
                  {templates
                    .filter((t) => !!t.key)
                    .map((t) => (
                      <option key={t._id} value={t.key as string}>
                        {t.key} — {t.label}
                      </option>
                    ))}
                </select>
                <p className="text-text-muted text-xs mt-1">
                  Backend will create/copy the default template if it doesn't exist,
                  then overwrite it.
                </p>
              </>
            ) : (
              <>
                <label className="label" htmlFor="save-template-new-name">
                  New template name
                </label>
                <input
                  id="save-template-new-name"
                  className="input"
                  value={newTemplateLabel}
                  onChange={(e) => setNewTemplateLabel(e.target.value)}
                  disabled={isSaving}
                  placeholder="e.g. Supply Chain 101 (Jan 2026)"
                />
                <label className="label" htmlFor="save-template-new-desc">
                  Description (optional)
                </label>
                <textarea
                  id="save-template-new-desc"
                  className="input resize-none min-h-[100px]"
                  value={newTemplateDescription}
                  onChange={(e) => setNewTemplateDescription(e.target.value)}
                  disabled={isSaving}
                />
              </>
            )}
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              disabled={isSaving}
            />
            <span className="text-text-muted">
              Include inactive profile types / variables
            </span>
          </label>
        </div>
      </Dialog>
    </>
  );
};

export default ClassroomSaveAsTemplateAction;


