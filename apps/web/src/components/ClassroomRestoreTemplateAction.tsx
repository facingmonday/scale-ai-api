import React, { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import classroomService from "@/services/classroom";
import classroomTemplatesService from "@/services/classroomTemplates";
import type { ClassroomTemplate } from "@/types/classroomTemplate";
import { useGlobalContext } from "@/context/GlobalContext";

type Props = {
  classroomId: string;
  disabled?: boolean;
};

const ClassroomRestoreTemplateAction: React.FC<Props> = ({
  classroomId,
  disabled = false,
}) => {
  const globalContext = useGlobalContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templates, setTemplates] = useState<ClassroomTemplate[]>([]);

  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [templateSelectValue, setTemplateSelectValue] =
    useState<string>("__default__");

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

    setTemplateSelectValue("__default__");
    void fetchTemplates();

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  const handleRestore = async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    setError(null);
    try {
      const body =
        templateSelectValue === "__default__"
          ? { templateKey: "default_supply_chain_101" }
          : { templateId: templateSelectValue };

      await classroomService.restoreTemplate(classroomId, body);
      globalContext?.showToast?.("Template restored into classroom", "success");
      setIsOpen(false);
    } catch (e) {
      console.error("Failed to restore template into classroom:", e);
      const errorMessage =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      setError(errorMessage || "Failed to restore template. Please try again.");
      globalContext?.showToast?.(
        errorMessage || "Failed to restore template",
        "error"
      );
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <>
      <div className="danger-zone-row">
        <div>
          <h3 className="font-semibold mb-1">
            Restore template into classroom
          </h3>
          <p className="text-text-muted text-sm">
            Clears all variables, then reapplies a classroom template and
            reseeds default values.
          </p>
        </div>
        <Button
          label="Restore Template"
          icon="pi pi-replay"
          onClick={() => setIsOpen(true)}
          severity="danger"
          outlined
          className="[&_.p-button-icon]:mr-3"
          disabled={disabled}
        />
      </div>

      <Dialog
        header="Restore template into classroom"
        visible={isOpen}
        onHide={() => !isRestoring && setIsOpen(false)}
        modal
        closable={!isRestoring}
        dismissableMask={!isRestoring}
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
              disabled={isRestoring}
            />
            <Button
              label="Restore Template"
              icon="pi pi-check"
              onClick={handleRestore}
              severity="danger"
              loading={isRestoring}
              disabled={isLoadingTemplates}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {error ? <p className="text-danger font-medium">{error}</p> : null}
          <p className="text-text-muted">
            This will delete all variable values + definitions for this
            classroom, then reapply the selected template and reseed default
            values.
          </p>
          <div>
            <label className="label" htmlFor="restore-template-select">
              Template to restore
            </label>
            <select
              id="restore-template-select"
              className="input"
              value={templateSelectValue}
              onChange={(e) => setTemplateSelectValue(e.target.value)}
              disabled={isRestoring || isLoadingTemplates}
            >
              <option value="__default__">
                Default template (key: default_supply_chain_101)
              </option>
              {templates.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.label}
                  {t.key ? ` (${t.key})` : ""}
                </option>
              ))}
            </select>
            <p className="text-text-muted text-xs mt-1">
              Choose a specific template, or use the default template key.
            </p>
          </div>
          <p className="text-danger font-semibold">
            This action cannot be undone.
          </p>
        </div>
      </Dialog>
    </>
  );
};

export default ClassroomRestoreTemplateAction;
