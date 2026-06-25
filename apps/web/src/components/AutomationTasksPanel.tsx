import React, { useEffect, useState, useRef } from "react";
import { Dialog } from "primereact/dialog";
import type { AutomationTask } from "@/types/classroom";
import aiService from "@/services/ai";
import classroomService from "@/services/classroom";
import { ThreeDotMenu } from "@/components/ui/three-dot-menu";


interface AutomationTasksPanelProps {
  classroomId: string;
  createTrigger: number;
}

// Visual helpers for trigger enums
const TRIGGER_LABELS: Record<string, string> = {
  AFTER_CHALLENGE_CREATED: "After Challenge Created",
  AFTER_STUDENT_SUBMISSION: "After Student Submission",
  AFTER_CHALLENGE_CLOSED: "After Challenge Closed",
  AFTER_CHALLENGE_CLOSED_PER_STUDENT: "After Challenge Closed (Per Student)",
};

const ACTION_LABELS: Record<string, string> = {
  CUSTOM_PROMPT: "Custom Prompt",
  GENERATE_SLIDES: "Generate Slides Outline",
  GENERATE_REPORT: "Generate Classroom Report",
  SEND_NOTIFICATION: "Send Notification/Email",
};

export const AutomationTasksPanel: React.FC<AutomationTasksPanelProps> = ({
  classroomId,
  createTrigger,
}) => {
  const [tasks, setTasks] = useState<AutomationTask[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Copy modal state
  const [copyingTask, setCopyingTask] = useState<AutomationTask | null>(null);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copyStatus, setCopyStatus] = useState<Record<string, string>>({}); // targetClassroomId -> status

  // Track if initial load is done to avoid double-firing trigger
  const isInitialLoad = useRef(true);

  // Load automation tasks
  const loadTasks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await aiService.getAutomationTasks(classroomId);
      setTasks(res?.tasks || []);
    } catch (err: any) {
      console.error("Failed to load automation tasks:", err);
      setError(err.response?.data?.error || "Failed to load automation tasks.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (classroomId) {
      void loadTasks();
    }
  }, [classroomId]);

  // Load classrooms for copying
  useEffect(() => {
    const loadClassrooms = async () => {
      try {
        const res = await classroomService.getAll();
        const list = res?.data || res || [];
        setClassrooms(list);
      } catch (err) {
        console.error("Failed to load classrooms list:", err);
      }
    };
    void loadClassrooms();
  }, []);

  // Handle parent trigger to create a new task
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    if (createTrigger > 0) {
      void handleCreateTask();
    }
  }, [createTrigger]);

  const handleCreateTask = async () => {
    setError(null);
    try {
      const defaultTask = {
        name: "New Automation Task",
        trigger: "AFTER_CHALLENGE_CLOSED" as const,
        actionType: "CUSTOM_PROMPT" as const,
        promptTemplate: "Summarize the student pizza store performances this week.",
        isActive: true,
        config: {},
      };
      const res = await aiService.createAutomationTask(classroomId, defaultTask);
      if (res?.success && res.task) {
        setTasks((prev) => [...prev, res.task]);
        // Scroll to the bottom card or set immediate edit mode
        setTimeout(() => {
          const cards = document.querySelectorAll(".automation-task-card");
          if (cards.length > 0) {
            cards[cards.length - 1].scrollIntoView({ behavior: "smooth" });
          }
        }, 100);
      }
    } catch (err: any) {
      console.error("Failed to create automation task:", err);
      setError(err.response?.data?.error || "Failed to create automation task.");
    }
  };

  const handleUpdateTask = async (id: string, updatedFields: Partial<AutomationTask>) => {
    try {
      const res = await aiService.updateAutomationTask(classroomId, id, updatedFields);
      if (res?.success && res.task) {
        setTasks((prev) => prev.map((t) => (t._id === id ? res.task : t)));
      }
    } catch (err: any) {
      console.error("Failed to update automation task:", err);
      alert(err.response?.data?.error || "Failed to update automation task.");
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm("Are you sure you want to delete this automation task?")) return;
    try {
      const res = await aiService.deleteAutomationTask(classroomId, id);
      if (res?.success) {
        setTasks((prev) => prev.filter((t) => t._id !== id));
      }
    } catch (err: any) {
      console.error("Failed to delete automation task:", err);
      alert(err.response?.data?.error || "Failed to delete automation task.");
    }
  };

  const openCopyDialog = (task: AutomationTask) => {
    setCopyingTask(task);
    setSearchQuery("");
    setCopyStatus({});
    setIsCopyDialogOpen(true);
  };

  const handleCopyTaskToClassroom = async (targetClassroomId: string) => {
    if (!copyingTask) return;
    setCopyStatus((prev) => ({ ...prev, [targetClassroomId]: "copying" }));
    try {
      const { _id, classroomId: originalClassroomId, createdDate, updatedDate, __v, ...taskData } = copyingTask as any;
      const res = await aiService.createAutomationTask(targetClassroomId, taskData);
      if (res?.success) {
        setCopyStatus((prev) => ({ ...prev, [targetClassroomId]: "success" }));
        setTimeout(() => {
          setCopyStatus((prev) => {
            const next = { ...prev };
            delete next[targetClassroomId];
            return next;
          });
        }, 2000);
      }
    } catch (err: any) {
      console.error("Failed to copy automation task:", err);
      setCopyStatus((prev) => ({ ...prev, [targetClassroomId]: "error" }));
      alert(err.response?.data?.error || "Failed to copy automation task.");
    }
  };

  const filteredDestinations = classrooms.filter((c) => {
    const cid = c._id || c.id;
    if (cid === classroomId) return false; // exclude current
    if (!searchQuery) return true;
    return c.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="card mt-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="heading-md">Automation Tasks</h2>
          <p className="text-text-muted text-sm">
            Configure automated actions that execute during classroom lifecycles.
          </p>
        </div>
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      {isLoading ? (
        <div className="py-8 text-center text-text-muted text-sm">
          Loading automation tasks...
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-12 border-2 border-dashed border-ui-border rounded-lg text-center text-text-muted">
          <p className="text-sm mb-2">No automation tasks configured for this classroom.</p>
          <p className="text-xs">Click "Create Task" in the upper right to add one.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {tasks.map((task) => (
            <AutomationTaskCard
              key={task._id}
              task={task}
              onUpdate={handleUpdateTask}
              onDelete={handleDeleteTask}
              onCopy={openCopyDialog}
            />
          ))}
        </div>
      )}

      {/* Copy Classroom Modal */}
      <Dialog
        header="Copy Task to Classroom"
        visible={isCopyDialogOpen}
        onHide={() => setIsCopyDialogOpen(false)}
        modal
        className="modal w-full max-w-lg"
        maskClassName="modal-mask"
        headerClassName="modal-header"
        contentClassName="modal-content animate-in fade-in zoom-in-95 duration-150"
        pt={{
          headerTitle: { className: "modal-title font-semibold text-lg" },
          footer: { className: "modal-footer flex justify-end gap-2 border-t border-ui-border pt-4" },
        }}
      >
        <div className="space-y-4 pt-2">
          {copyingTask && (
            <div className="p-3 bg-ui-bg-hover rounded border border-ui-border mb-2">
              <span className="text-xs text-text-muted uppercase font-semibold">Copying Task</span>
              <p className="text-sm font-medium text-text-primary mt-1">{copyingTask.name}</p>
            </div>
          )}

          <div>
            <label className="label mb-1" htmlFor="copy-search">
              Search Target Classroom
            </label>
            <input
              id="copy-search"
              type="text"
              className="input w-full"
              placeholder="e.g. Pizza Shop 101"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {filteredDestinations.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">
                {classrooms.length <= 1
                  ? "No other classrooms found in this organization."
                  : "No matching classrooms found."}
              </p>
            ) : (
              filteredDestinations.map((c) => {
                const cid = c._id || c.id;
                const status = copyStatus[cid];
                const profName = c.ownership
                  ? `${c.ownership.firstName || ""} ${c.ownership.lastName || ""}`.trim()
                  : "";

                return (
                  <div
                    key={cid}
                    className="flex items-center justify-between p-3 rounded-lg border border-ui-border bg-ui-surface hover:bg-ui-bg-hover transition-colors"
                  >
                    <div className="min-w-0 pr-4">
                      <h4 className="font-semibold text-sm truncate text-text-primary">{c.name}</h4>
                      {profName && <p className="text-xs text-text-muted mt-0.5">Professor: {profName}</p>}
                    </div>
                    <button
                      type="button"
                      disabled={status === "copying"}
                      onClick={() => void handleCopyTaskToClassroom(cid)}
                      className={`btn-sm transition-all text-xs font-medium py-1 px-3 rounded ${status === "success"
                          ? "bg-green-600 hover:bg-green-600 text-white"
                          : status === "error"
                            ? "bg-red-600 hover:bg-red-600 text-white"
                            : "btn-teal"
                        }`}
                    >
                      {status === "copying" ? (
                        <span className="flex items-center gap-1">
                          <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Copying
                        </span>
                      ) : status === "success" ? (
                        "Copied ✓"
                      ) : status === "error" ? (
                        "Failed"
                      ) : (
                        "Copy Here"
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
};

// AutomationTaskCard child component for managing local card states
const AutomationTaskCard: React.FC<{
  task: AutomationTask;
  onUpdate: (id: string, data: Partial<AutomationTask>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCopy: (task: AutomationTask) => void;
}> = ({ task, onUpdate, onDelete, onCopy }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [name, setName] = useState(task.name);
  const [trigger, setTrigger] = useState(task.trigger);
  const [actionType, setActionType] = useState(task.actionType);
  const [promptTemplate, setPromptTemplate] = useState(task.promptTemplate);

  // Sync state if backend model updates externally
  useEffect(() => {
    setName(task.name);
    setTrigger(task.trigger);
    setActionType(task.actionType);
    setPromptTemplate(task.promptTemplate);
  }, [task]);

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Task name cannot be empty");
      return;
    }
    if (!promptTemplate.trim()) {
      alert("Prompt template cannot be empty");
      return;
    }
    setIsSaving(true);
    try {
      await onUpdate(task._id, {
        name: name.trim(),
        trigger,
        actionType,
        promptTemplate: promptTemplate.trim(),
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setName(task.name);
    setTrigger(task.trigger);
    setActionType(task.actionType);
    setPromptTemplate(task.promptTemplate);
    setIsEditing(false);
  };

  const toggleActive = () => {
    void onUpdate(task._id, { isActive: !task.isActive });
  };

  return (
    <div
      className={`automation-task-card rounded-lg border p-5 bg-ui-surface transition-all duration-200 relative ${task.isActive
          ? "border-ui-border shadow-sm hover:shadow-md"
          : "border-ui-border opacity-70 bg-ui-bg-hover"
        }`}
    >
      {isEditing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label text-xs">Task Name</label>
              <input
                type="text"
                className="input w-full text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">Trigger Lifecycle Event</label>
              <select
                className="input w-full text-sm"
                value={trigger}
                onChange={(e) => setTrigger(e.target.value as any)}
              >
                <option value="AFTER_CHALLENGE_CREATED">After Challenge Created</option>
                <option value="AFTER_STUDENT_SUBMISSION">After Student Submission</option>
                <option value="AFTER_CHALLENGE_CLOSED">After Challenge Closed</option>
                <option value="AFTER_CHALLENGE_CLOSED_PER_STUDENT">After Challenge Closed (Per Student)</option>
              </select>
            </div>
            <div>
              <label className="label text-xs">Action Type</label>
              <select
                className="input w-full text-sm"
                value={actionType}
                onChange={(e) => setActionType(e.target.value as any)}
              >
                <option value="CUSTOM_PROMPT">Custom Prompt Only</option>
                <option value="GENERATE_SLIDES">Generate Slides Outline</option>
                <option value="GENERATE_REPORT">Generate PDF/HTML Report</option>
                <option value="SEND_NOTIFICATION">Send Email Notification</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label text-xs">Prompt Template</label>
            <textarea
              className="textarea w-full text-sm font-mono min-h-[100px]"
              rows={4}
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              placeholder="e.g. Analyze student waste ratio..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={handleCancel}
              className="btn-outline text-xs px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSave()}
              className="btn-teal text-xs px-4 py-1.5"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Absolute Three-Dot Menu */}
          <div className="absolute top-5 right-5">
            <ThreeDotMenu
              size="xl"
              actions={[
                {
                  label: isEditing ? "Save" : "Edit Details",
                  onClick: () => setIsEditing(true),
                },
                {
                  label: task.isActive ? "Disable Task" : "Enable Task",
                  onClick: toggleActive,
                },
                {
                  label: "Copy to Classroom",
                  onClick: () => onCopy(task),
                },
                {
                  label: "Delete Task",
                  onClick: () => void onDelete(task._id),
                  className: "text-danger hover:bg-danger/10",
                },
              ]}
            />
          </div>

          {/* Main Info Row aligning Name, Trigger, Action */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center w-full pr-8">
            {/* Task Name & Status info */}
            <div className="col-span-12 md:col-span-6 min-w-0">
              <h3 className="font-semibold text-text-primary text-base truncate" title={task.name}>
                {task.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${task.isActive
                      ? "bg-brand-teal/15 text-brand-teal"
                      : "bg-text-muted/15 text-text-muted"
                    }`}
                >
                  {task.isActive ? "Active" : "Disabled"}
                </span>
                <span className="text-xs text-text-muted font-mono">• {task._id.slice(-6)}</span>
              </div>
            </div>

            {/* Trigger Lifecycle Event */}
            <div className="col-span-12 md:col-span-3 min-w-0 text-xs">
              <span className="text-text-muted block">Trigger Lifecycle Event</span>
              <span className="font-semibold text-text-primary mt-1 block truncate" title={TRIGGER_LABELS[task.trigger] || task.trigger}>
                {TRIGGER_LABELS[task.trigger] || task.trigger}
              </span>
            </div>

            {/* Action Type */}
            <div className="col-span-12 md:col-span-3 min-w-0 text-xs">
              <span className="text-text-muted block">Action Type</span>
              <span className="font-semibold text-text-primary mt-1 block truncate" title={ACTION_LABELS[task.actionType] || task.actionType}>
                {ACTION_LABELS[task.actionType] || task.actionType}
              </span>
            </div>
          </div>
          <div className="bg-ui-bg-hover rounded border border-ui-border/60 p-3">
            <span className="text-xxs text-text-muted font-bold block uppercase tracking-wider mb-1">
              Prompt Template
            </span>
            <div className="max-h-24 overflow-y-auto text-xs font-mono text-text-secondary whitespace-pre-wrap leading-relaxed">
              {task.promptTemplate}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

