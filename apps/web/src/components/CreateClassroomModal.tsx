import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useGlobalContext } from "@/context/GlobalContext";
import classroomService from "@/services/classroom";
import classroomTemplatesService from "@/services/classroomTemplates";
import type { ClassroomWithVirtuals } from "@/types/classroom";
import type { ClassroomTemplate } from "@/types/classroomTemplate";
import type { BillingMode } from "@/types/licensing";
import { getErrorMessage } from "@/utils/error";

interface CreateClassroomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newClassroom: ClassroomWithVirtuals) => void;
}

const CreateClassroomModal: React.FC<CreateClassroomModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { setNewActiveClassroom } = useAuth();
  const globalContext = useGlobalContext();

  const [newClassroomName, setNewClassroomName] = useState("");
  const [newClassroomDescription, setNewClassroomDescription] = useState("");
  const [newClassroomBillingMode, setNewClassroomBillingMode] =
    useState<BillingMode>("student_paid");
  const [newAllowAnonymousJoin, setNewAllowAnonymousJoin] = useState(true);
  const [classroomTemplates, setClassroomTemplates] = useState<
    ClassroomTemplate[]
  >([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    const fetchTemplates = async () => {
      setIsLoadingTemplates(true);
      try {
        const templates = await classroomTemplatesService.getAll();
        if (isMounted) {
          setClassroomTemplates(Array.isArray(templates) ? templates : []);
        }
      } catch (err) {
        console.error("Failed to fetch classroom templates:", err);
        if (isMounted) {
          setClassroomTemplates([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingTemplates(false);
        }
      }
    };

    void fetchTemplates();
    setSelectedTemplateId("");
    setNewClassroomBillingMode("student_paid");
    setNewClassroomName("");
    setNewClassroomDescription("");
    setNewAllowAnonymousJoin(true);

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassroomName.trim()) return;

    setIsCreating(true);
    try {
      globalContext?.setIsLoading(true);

      const response = await classroomService.create({
        name: newClassroomName.trim(),
        description: newClassroomDescription.trim() || undefined,
        templateId: selectedTemplateId || undefined,
        billingMode: newClassroomBillingMode,
        joinPolicy:
          newClassroomBillingMode === "teacher_paid_roster"
            ? "roster_only"
            : "invite_link",
        studentPaysAllowed: newClassroomBillingMode === "student_paid",
        allowAnonymousJoin: newAllowAnonymousJoin,
      });
      const newClassroom = response.data;
      if (!newClassroom || !newClassroom._id) {
        throw new Error("Failed to create classroom: Invalid response");
      }

      globalContext?.showToast?.("Classroom created successfully", "success");
      await setNewActiveClassroom(newClassroom);
      onSuccess?.(newClassroom);
      onClose();
    } catch (err) {
      console.error("Failed to create classroom:", err);
      const errorMessage = getErrorMessage(err);
      globalContext?.showToast?.(
        errorMessage || "Failed to create classroom",
        "error"
      );
    } finally {
      setIsCreating(false);
      globalContext?.setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-md w-full bg-ui-surface border border-ui-border rounded-xl p-6">
        <h2 className="heading-lg mb-4 text-xl font-bold">
          Create New Classroom
        </h2>
        <form onSubmit={handleCreateClassroom}>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="templateId"
                className="label text-sm font-semibold mb-1 block"
              >
                Template (optional)
              </label>
              <select
                id="templateId"
                className="input w-full border border-ui-border rounded-lg px-3 py-2 bg-ui-surface text-text-primary"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                disabled={isCreating || isLoadingTemplates}
              >
                <option value="">
                  {isLoadingTemplates
                    ? "Loading templates..."
                    : "No template"}
                </option>
                {classroomTemplates.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <p className="text-text-muted text-xs mt-1">
                Templates prefill default settings and variables.
              </p>
            </div>
            <div>
              <label
                htmlFor="name"
                className="label text-sm font-semibold mb-1 block"
              >
                Classroom Name *
              </label>
              <input
                id="name"
                type="text"
                value={newClassroomName}
                onChange={(e) => setNewClassroomName(e.target.value)}
                className="input w-full border border-ui-border rounded-lg px-3 py-2 bg-ui-surface text-text-primary"
                placeholder="Enter classroom name"
                required
                autoFocus
              />
            </div>
            <div>
              <label
                htmlFor="description"
                className="label text-sm font-semibold mb-1 block"
              >
                Description
              </label>
              <textarea
                id="description"
                value={newClassroomDescription}
                onChange={(e) => setNewClassroomDescription(e.target.value)}
                className="input w-full border border-ui-border rounded-lg px-3 py-2 bg-ui-surface text-text-primary min-h-[100px] resize-none"
                placeholder="Enter classroom description (optional)"
              />
            </div>
            <div>
              <p className="text-text-muted text-xs mt-1">
                Starting balances and startup costs are now configured on
                profile types.
              </p>
            </div>
            <div>
              <label
                htmlFor="billingMode"
                className="label text-sm font-semibold mb-1 block"
              >
                How should students get access?
              </label>
              <select
                id="billingMode"
                className="input w-full border border-ui-border rounded-lg px-3 py-2 bg-ui-surface text-text-primary"
                value={newClassroomBillingMode}
                onChange={(e) =>
                  setNewClassroomBillingMode(e.target.value as BillingMode)
                }
                disabled={isCreating}
              >
                <option value="student_paid">Students pay individually</option>
                <option value="teacher_paid_roster">
                  Teacher-paid roster seats
                </option>
              </select>
              <p className="text-text-muted text-xs mt-1">
                You can change this later from the classroom billing settings.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="newAllowAnonymousJoin"
                type="checkbox"
                checked={newAllowAnonymousJoin}
                onChange={(e) => setNewAllowAnonymousJoin(e.target.checked)}
                className="w-4 h-4 rounded border-ui-border text-brand-teal focus:ring-brand-teal"
              />
              <label
                htmlFor="newAllowAnonymousJoin"
                className="text-sm font-medium text-text-primary"
              >
                Allow anonymous students to join (anyone with the link)
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="btn-outline flex-1 border border-ui-border rounded-lg py-2"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-teal flex-1 bg-brand-teal text-white rounded-lg py-2"
              disabled={isCreating || !newClassroomName.trim()}
            >
              {isCreating ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateClassroomModal;
