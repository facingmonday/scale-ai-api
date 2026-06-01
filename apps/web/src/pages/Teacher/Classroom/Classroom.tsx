import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import type { ClassroomPrompt, ClassroomWithVirtuals } from "@/types/classroom";
import type { StudentDisplay } from "@/types/components";
import { useAuth } from "@/context/AuthContext";
import BasicLayout from "@/components/Layouts/BasicLayout";
import StudentList from "@/components/StudentList";
import classroomService from "@/services/classroom";
import enrollmentService from "@/services/enrollment";
import Image from "@/components/AIComponents/Image/Image";
import ClassroomResetVariablesAction from "@/components/ClassroomResetVariablesAction";
import ClassroomRestoreTemplateAction from "@/components/ClassroomRestoreTemplateAction";
import ClassroomSaveAsTemplateAction from "@/components/ClassroomSaveAsTemplateAction";
import ClassroomDeleteAction from "@/components/ClassroomDeleteAction";
import ClassroomInviteStudentButton from "@/components/ClassroomInviteStudentButton";
import ClassroomBillingSettings from "@/components/ClassroomBillingSettings";
import RosterImportPanel from "@/components/RosterImportPanel";
import LoadingOverlay from "../../../components/LoadingOverlay";

const TeacherClassroom: React.FC = () => {
  const { userRole, isLoading } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const classroomId = id || "";

  const [classroom, setClassroom] = useState<ClassroomWithVirtuals | null>(
    null
  );
  const [isLoadingClassroom, setIsLoadingClassroom] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const didInitForm = useRef(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [prompts, setPrompts] = useState<ClassroomPrompt[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Automation Settings States
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [timezone, setTimezone] = useState("America/Chicago");
  const [defaultReleaseDay, setDefaultReleaseDay] = useState("Monday");
  const [defaultReleaseTime, setDefaultReleaseTime] = useState("08:00");
  const [defaultDueDay, setDefaultDueDay] = useState("Friday");
  const [defaultDueTime, setDefaultDueTime] = useState("23:59");
  const [defaultCloseDelayHours, setDefaultCloseDelayHours] = useState(0);
  const [defaultProcessDelayHours, setDefaultProcessDelayHours] = useState(0);
  const [defaultFeedbackReleaseMode, setDefaultFeedbackReleaseMode] = useState<"IMMEDIATE" | "DELAYED" | "MANUAL">("IMMEDIATE");
  const [missingSubmissionPolicy, setMissingSubmissionPolicy] = useState<"FORWARD_PREVIOUS" | "USE_DEFAULTS" | "SKIP">("USE_DEFAULTS");

  const [rosterRefreshKey, setRosterRefreshKey] = useState(0);
  const [selectedStudent, setSelectedStudent] = useState<StudentDisplay | null>(
    null
  );
  const [isRemoveStudentDialogOpen, setIsRemoveStudentDialogOpen] =
    useState(false);
  const [isRemovingStudent, setIsRemovingStudent] = useState(false);
  const [removeStudentError, setRemoveStudentError] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!classroomId) return;
    let mounted = true;
    const load = async () => {
      setIsLoadingClassroom(true);
      setLoadError(null);
      try {
        // We currently don't have a classroom getById service.
        // Fetch org classrooms and match client-side.
        const res = await classroomService.getAll();
        const list = (res?.data ?? res ?? []) as ClassroomWithVirtuals[];
        const match = Array.isArray(list)
          ? list.find((c) => {
              const cid =
                c._id || (c as ClassroomWithVirtuals & { id?: string }).id;
              return cid === classroomId;
            }) ?? null
          : null;

        if (!mounted) return;
        setClassroom(match);
        if (!match) {
          setLoadError("Classroom not found.");
        }
      } catch (e) {
        console.error("Failed to load classroom:", e);
        if (!mounted) return;
        setClassroom(null);
        const errorMessage =
          e && typeof e === "object" && "response" in e
            ? (e as { response?: { data?: { message?: string } } }).response
                ?.data?.message
            : undefined;
        setLoadError(errorMessage || "Failed to load classroom.");
      } finally {
        if (mounted) setIsLoadingClassroom(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [classroomId]);

  useEffect(() => {
    if (!classroom) return;
    if (didInitForm.current) return;
    didInitForm.current = true;
    setName(classroom.name || "");
    setDescription(classroom.description || "");
    setImageUrl((classroom as { imageUrl?: string }).imageUrl || "");
    setPrompts(
      Array.isArray((classroom as { prompts?: ClassroomPrompt[] }).prompts)
        ? (classroom as { prompts?: ClassroomPrompt[] }).prompts ?? []
        : []
    );
    const automation = (classroom as any).automationSettings || {};
    setAutomationEnabled(automation.enabled || false);
    setTimezone(automation.timezone || "America/Chicago");
    setDefaultReleaseDay(automation.defaultReleaseDay || "Monday");
    setDefaultReleaseTime(automation.defaultReleaseTime || "08:00");
    setDefaultDueDay(automation.defaultDueDay || "Friday");
    setDefaultDueTime(automation.defaultDueTime || "23:59");
    setDefaultCloseDelayHours(automation.defaultCloseDelayHours || 0);
    setDefaultProcessDelayHours(automation.defaultProcessDelayHours || 0);
    setDefaultFeedbackReleaseMode(automation.defaultFeedbackReleaseMode || "IMMEDIATE");
    setMissingSubmissionPolicy(automation.missingSubmissionPolicy || "USE_DEFAULTS");
  }, [classroom]);

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (!classroom) return true;
    const currentImageUrl = (classroom as { imageUrl?: string }).imageUrl || "";
    const currentPrompts = Array.isArray(
      (classroom as { prompts?: unknown }).prompts
    )
      ? (classroom as { prompts?: ClassroomPrompt[] }).prompts ?? []
      : [];
    const promptsChanged =
      JSON.stringify(prompts ?? []) !== JSON.stringify(currentPrompts);

    const currentAutomation = (classroom as any).automationSettings || {};
    const automationChanged =
      automationEnabled !== (currentAutomation.enabled || false) ||
      timezone !== (currentAutomation.timezone || "America/Chicago") ||
      defaultReleaseDay !== (currentAutomation.defaultReleaseDay || "Monday") ||
      defaultReleaseTime !== (currentAutomation.defaultReleaseTime || "08:00") ||
      defaultDueDay !== (currentAutomation.defaultDueDay || "Friday") ||
      defaultDueTime !== (currentAutomation.defaultDueTime || "23:59") ||
      Number(defaultCloseDelayHours) !== (currentAutomation.defaultCloseDelayHours || 0) ||
      Number(defaultProcessDelayHours) !== (currentAutomation.defaultProcessDelayHours || 0) ||
      defaultFeedbackReleaseMode !== (currentAutomation.defaultFeedbackReleaseMode || "IMMEDIATE") ||
      missingSubmissionPolicy !== (currentAutomation.missingSubmissionPolicy || "USE_DEFAULTS");

    return (
      name.trim() !== (classroom.name || "").trim() ||
      description.trim() !== (classroom.description || "").trim() ||
      imageUrl !== currentImageUrl ||
      promptsChanged ||
      automationChanged
    );
  }, [
    classroom,
    description,
    name,
    imageUrl,
    prompts,
    automationEnabled,
    timezone,
    defaultReleaseDay,
    defaultReleaseTime,
    defaultDueDay,
    defaultDueTime,
    defaultCloseDelayHours,
    defaultProcessDelayHours,
    defaultFeedbackReleaseMode,
    missingSubmissionPolicy,
  ]);

  // Teacher-only page
  if (isLoading) {
    return (
      <div className="page">
        <LoadingOverlay loading={true} />
      </div>
    );
  }

  if (!classroomId) {
    return <Navigate to="/classrooms" replace />;
  }

  if (userRole !== "org:admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSave = async () => {
    if (isSaving || !name.trim()) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await classroomService.update(classroomId, {
        name: name.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim() || undefined,
        prompts: (prompts ?? []).filter(
          (p) =>
            p && typeof p.content === "string" && p.content.trim().length > 0
        ),
        automationSettings: {
          enabled: automationEnabled,
          timezone,
          defaultReleaseDay,
          defaultReleaseTime,
          defaultDueDay,
          defaultDueTime,
          defaultCloseDelayHours: Number(defaultCloseDelayHours),
          defaultProcessDelayHours: Number(defaultProcessDelayHours),
          defaultFeedbackReleaseMode,
          missingSubmissionPolicy,
        },
      });
      setClassroom((prev) =>
        prev
          ? ({
              ...prev,
              name: name.trim(),
              description: description.trim(),
              imageUrl: imageUrl.trim() || undefined,
              prompts: (prompts ?? []).filter(
                (p) =>
                  p &&
                  typeof p.content === "string" &&
                  p.content.trim().length > 0
              ),
              automationSettings: {
                enabled: automationEnabled,
                timezone,
                defaultReleaseDay,
                defaultReleaseTime,
                defaultDueDay,
                defaultDueTime,
                defaultCloseDelayHours: Number(defaultCloseDelayHours),
                defaultProcessDelayHours: Number(defaultProcessDelayHours),
                defaultFeedbackReleaseMode,
                missingSubmissionPolicy,
              },
            } as ClassroomWithVirtuals & { imageUrl?: string })
          : prev
      );
    } catch (e) {
      console.error("Failed to update classroom:", e);
      const errorMessage =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      setSaveError(
        errorMessage || "Failed to update classroom. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const openRemoveStudentDialog = (student: StudentDisplay) => {
    setSelectedStudent(student);
    setRemoveStudentError(null);
    setIsRemoveStudentDialogOpen(true);
  };

  const handleRemoveStudent = async () => {
    if (!selectedStudent || isRemovingStudent) return;
    setIsRemovingStudent(true);
    setRemoveStudentError(null);
    try {
      await enrollmentService.removeStudent(classroomId, selectedStudent.id);
      setIsRemoveStudentDialogOpen(false);
      setSelectedStudent(null);
      setRosterRefreshKey((k) => k + 1);
    } catch (e) {
      console.error("Failed to remove student:", e);
      const errorMessage =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      setRemoveStudentError(
        errorMessage || "Failed to remove student. Please try again."
      );
    } finally {
      setIsRemovingStudent(false);
    }
  };

  // Teacher-only page
  if (isLoading) {
    return (
      <div className="page">
        <LoadingOverlay loading={isLoading} />
      </div>
    );
  }

  if (!classroomId) {
    return <Navigate to="/classrooms" replace />;
  }

  if (userRole !== "org:admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const updatePrompt = (idx: number, next: ClassroomPrompt) => {
    setPrompts((prev) => prev.map((p, i) => (i === idx ? next : p)));
  };

  const addPrompt = () => {
    setPrompts((prev) => [...prev, { role: "system", content: "" }]);
  };

  const removePrompt = (idx: number) => {
    setPrompts((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <BasicLayout>
      <div className="page">
        <div className="container">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="min-w-0">
              <h1 className="heading-xl truncate">
                {classroom?.name || "Classroom"}
              </h1>
              <p className="text-text-muted">
                Manage classroom details, students, and maintenance actions.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-outline"
                onClick={() => navigate("/classrooms")}
              >
                Back
              </button>
              <button
                type="button"
                className="btn-teal"
                onClick={() => void handleSave()}
                disabled={!canSave || isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {isLoadingClassroom ? (
            <div className="card">
              <LoadingOverlay loading={true} />
            </div>
          ) : loadError ? (
            <div className="card">
              <p className="text-danger font-medium">{loadError}</p>
              <div className="mt-4">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => navigate("/classrooms")}
                >
                  Back to classrooms
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <div className="card mb-4 sm:w-1/4">
              <Image
                src={
                  imageUrl ||
                  (classroom as { imageUrl?: string })?.imageUrl ||
                  ""
                }
                context={description || classroom?.description || ""}
                onAccept={(imageUrl) => {
                  setImageUrl(imageUrl);
                }}
              />
            </div>

            <div className="card mb-4 w-full">
              <h2 className="heading-md mb-4">Classroom details</h2>
              {saveError && (
                <p className="text-danger text-sm mb-3">{saveError}</p>
              )}
              <div className="space-y-4">
                <div>
                  <label className="label" htmlFor="classroom-name">
                    Name
                  </label>
                  <input
                    id="classroom-name"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isSaving || isLoadingClassroom || !!loadError}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="classroom-description">
                    Description
                  </label>
                  <textarea
                    id="classroom-description"
                    className="textarea-fixed"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isSaving || isLoadingClassroom || !!loadError}
                  />
                </div>
                <div>
                  <p className="text-text-muted text-xs">
                    Starting balances and startup costs are now configured on
                    profile types.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card mt-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="heading-md">Classroom Automation Settings</h2>
                <p className="text-text-muted text-sm">
                  Preconfigure schedules and policies to automatically run the entire semester.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-text cursor-pointer" htmlFor="automation-enabled-toggle">
                  Enable Automation
                </label>
                <input
                  id="automation-enabled-toggle"
                  type="checkbox"
                  className="rounded border-ui-border text-teal-600 focus:ring-teal-500 w-5 h-5 cursor-pointer"
                  checked={automationEnabled}
                  onChange={(e) => setAutomationEnabled(e.target.checked)}
                />
              </div>
            </div>

            {automationEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6 pt-4 border-t border-ui-border">
                {/* Timezone */}
                <div>
                  <label className="label" htmlFor="timezone-picker">
                    Course Timezone
                  </label>
                  <select
                    id="timezone-picker"
                    className="input"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    <option value="America/New_York">Eastern Time (US & Canada)</option>
                    <option value="America/Chicago">Central Time (US & Canada)</option>
                    <option value="America/Denver">Mountain Time (US & Canada)</option>
                    <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                    <option value="Europe/London">London / GMT</option>
                    <option value="UTC">UTC / Coordinated Universal Time</option>
                  </select>
                </div>

                {/* Release Schedule */}
                <div className="border border-ui-border rounded-lg p-4 bg-ui-bg-hover">
                  <h3 className="font-semibold text-sm mb-3 text-teal">Default Release Schedule</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="label text-xs" htmlFor="release-day">Day of Week</label>
                      <select
                        id="release-day"
                        className="input text-sm"
                        value={defaultReleaseDay}
                        onChange={(e) => setDefaultReleaseDay(e.target.value)}
                      >
                        {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label text-xs" htmlFor="release-time">Time (HH:MM)</label>
                      <input
                        id="release-time"
                        type="time"
                        className="input text-sm"
                        value={defaultReleaseTime}
                        onChange={(e) => setDefaultReleaseTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Due Schedule */}
                <div className="border border-ui-border rounded-lg p-4 bg-ui-bg-hover">
                  <h3 className="font-semibold text-sm mb-3 text-orange-500">Default Submission Due</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="label text-xs" htmlFor="due-day">Day of Week</label>
                      <select
                        id="due-day"
                        className="input text-sm"
                        value={defaultDueDay}
                        onChange={(e) => setDefaultDueDay(e.target.value)}
                      >
                        {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label text-xs" htmlFor="due-time">Time (HH:MM)</label>
                      <input
                        id="due-time"
                        type="time"
                        className="input text-sm"
                        value={defaultDueTime}
                        onChange={(e) => setDefaultDueTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Delay configurations */}
                <div>
                  <label className="label" htmlFor="close-delay">
                    Lock Grace Period (Hours)
                  </label>
                  <input
                    id="close-delay"
                    type="number"
                    min="0"
                    className="input"
                    value={defaultCloseDelayHours}
                    onChange={(e) => setDefaultCloseDelayHours(parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-text-muted mt-1">
                    Hours between the due date and locking student edits.
                  </p>
                </div>

                <div>
                  <label className="label" htmlFor="process-delay">
                    Outcome Calculation Delay (Hours)
                  </label>
                  <input
                    id="process-delay"
                    type="number"
                    min="0"
                    className="input"
                    value={defaultProcessDelayHours}
                    onChange={(e) => setDefaultProcessDelayHours(parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-text-muted mt-1">
                    Hours to wait after lock before background workers run calculations.
                  </p>
                </div>

                {/* Feedback Release Mode */}
                <div>
                  <label className="label" htmlFor="feedback-mode">
                    Feedback Release Mode
                  </label>
                  <select
                    id="feedback-mode"
                    className="input"
                    value={defaultFeedbackReleaseMode}
                    onChange={(e) => setDefaultFeedbackReleaseMode(e.target.value as any)}
                  >
                    <option value="IMMEDIATE">Immediate (upon calculation)</option>
                    <option value="DELAYED">Delayed (scheduled date/time)</option>
                    <option value="MANUAL">Manual (teacher triggers release)</option>
                  </select>
                </div>

                {/* Missing Submission Policy */}
                <div>
                  <label className="label" htmlFor="missing-policy">
                    Absent Student Policy
                  </label>
                  <select
                    id="missing-policy"
                    className="input"
                    value={missingSubmissionPolicy}
                    onChange={(e) => setMissingSubmissionPolicy(e.target.value as any)}
                  >
                    <option value="USE_DEFAULTS">Use Default Variables</option>
                    <option value="FORWARD_PREVIOUS">Repeat Previous Submission</option>
                    <option value="SKIP">Skip Scenario (No ledger entry)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="card mt-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h2 className="heading-md">Prompts</h2>
                <p className="text-text-muted text-sm">
                  Optional system messages used by the simulation engine for
                  this classroom.
                </p>
              </div>
              <button
                type="button"
                className="btn-outline"
                onClick={addPrompt}
                disabled={isSaving || isLoadingClassroom || !!loadError}
              >
                Add prompt
              </button>
            </div>

            {prompts.length === 0 ? (
              <p className="text-text-muted text-sm">
                No prompts yet. Add one if you want to provide extra system
                context.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {prompts.map((prompt, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-ui-border p-4"
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <span className="badge badge-muted">
                          Prompt {idx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <label
                            className="label mb-0"
                            htmlFor={`prompt-role-${idx}`}
                          >
                            Role
                          </label>
                          <select
                            id={`prompt-role-${idx}`}
                            className="input"
                            value={prompt.role}
                            onChange={(e) =>
                              updatePrompt(idx, {
                                ...prompt,
                                role: e.target.value as ClassroomPrompt["role"],
                              })
                            }
                            disabled={
                              isSaving || isLoadingClassroom || !!loadError
                            }
                          >
                            <option value="system">system</option>
                            <option value="user">user</option>
                            <option value="assistant">assistant</option>
                            <option value="developer">developer</option>
                          </select>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => removePrompt(idx)}
                        disabled={isSaving || isLoadingClassroom || !!loadError}
                      >
                        Remove
                      </button>
                    </div>

                    <div>
                      <label
                        className="label"
                        htmlFor={`prompt-content-${idx}`}
                      >
                        Content
                      </label>
                      <textarea
                        id={`prompt-content-${idx}`}
                        className="textarea"
                        value={prompt.content}
                        onChange={(e) =>
                          updatePrompt(idx, {
                            ...prompt,
                            content: e.target.value,
                          })
                        }
                        placeholder="Enter a prompt message..."
                        disabled={isSaving || isLoadingClassroom || !!loadError}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {classroom && (
            <div className="mt-6">
              <ClassroomBillingSettings
                classroom={classroom}
                onClassroomUpdated={(updated) => setClassroom(updated)}
              />
            </div>
          )}

          <div className="card mt-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="heading-md">Students</h2>
              <ClassroomInviteStudentButton
                classroomId={classroomId}
                disabled={isLoadingClassroom || !!loadError}
                onSuccess={() => setRosterRefreshKey((k) => k + 1)}
              />
            </div>

            <StudentList
              key={`${classroomId}:${rosterRefreshKey}`}
              classroomId={classroomId}
              onDelete={(student) => openRemoveStudentDialog(student)}
            />
          </div>

          <div className="mt-6">
            <RosterImportPanel
              classroomId={classroomId}
              onImported={() => setRosterRefreshKey((k) => k + 1)}
            />
          </div>

          <div className="danger-zone-card mt-6">
            <h2 className="danger-zone-title">Danger Zone</h2>
            <p className="text-text-muted text-sm mb-6">
              These actions are irreversible. Please be certain before
              proceeding.
            </p>
            <div className="flex flex-col gap-4">
              <ClassroomResetVariablesAction
                classroomId={classroomId}
                disabled={isLoadingClassroom || !!loadError}
              />
              <ClassroomRestoreTemplateAction
                classroomId={classroomId}
                disabled={isLoadingClassroom || !!loadError}
              />
              <ClassroomSaveAsTemplateAction
                classroomId={classroomId}
                disabled={isLoadingClassroom || !!loadError}
              />
              <ClassroomDeleteAction
                classroomId={classroomId}
                classroomName={classroom?.name || "Classroom"}
                disabled={isLoadingClassroom || !!loadError}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Remove Student Dialog */}
      <Dialog
        header="Remove Student"
        visible={isRemoveStudentDialogOpen}
        onHide={() => !isRemovingStudent && setIsRemoveStudentDialogOpen(false)}
        modal
        closable={!isRemovingStudent}
        dismissableMask={!isRemovingStudent}
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
              onClick={() => setIsRemoveStudentDialogOpen(false)}
              text
              disabled={isRemovingStudent}
            />
            <Button
              label="Remove student"
              icon="pi pi-check"
              onClick={handleRemoveStudent}
              severity="danger"
              loading={isRemovingStudent}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {removeStudentError ? (
            <p className="text-danger font-medium">{removeStudentError}</p>
          ) : null}
          <p className="text-text-muted">
            Remove{" "}
            <strong>
              {selectedStudent?.name ||
                selectedStudent?.email ||
                "this student"}
            </strong>{" "}
            from this classroom? This will revoke their access to this class.
          </p>
          <p className="text-danger font-semibold">
            This action cannot be undone.
          </p>
        </div>
      </Dialog>
    </BasicLayout>
  );
};

export default TeacherClassroom;
