import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useGlobalContext } from "@/context/GlobalContext";
import classroomService from "@/services/classroom";
import classroomTemplatesService from "@/services/classroomTemplates";
import type { ClassroomTemplate } from "@/types/classroomTemplate";
import type { BillingMode } from "@/types/licensing";
import { getErrorMessage } from "@/utils/error";
import BasicLayout from "@/components/Layouts/BasicLayout";

const STEPS = [
  { id: 1, name: "Choose Template", desc: "Select a game mode pre-configuration" },
  { id: 2, name: "Classroom Info", desc: "Set class name, description, and details" },
  { id: 3, name: "Access & Billing", desc: "Choose enrollment and billing policies" },
  { id: 4, name: "Review & Create", desc: "Verify details and launch classroom" },
];

const ClassroomCreate: React.FC = () => {
  const { setNewActiveClassroom } = useAuth();
  const navigate = useNavigate();
  const globalContext = useGlobalContext();

  const [currentStep, setCurrentStep] = useState(1);
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
  const [error, setError] = useState<string | null>(null);

  // Fetch templates on mount
  useEffect(() => {
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
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedTemplate = useMemo(() => {
    return classroomTemplates.find((t) => t._id === selectedTemplateId) || null;
  }, [classroomTemplates, selectedTemplateId]);

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep((prev) => prev + 1);
      setError(null);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      setError(null);
    }
  };

  const isStepValid = useMemo(() => {
    if (currentStep === 1) return true; // Templates are optional
    if (currentStep === 2) return newClassroomName.trim().length > 0;
    if (currentStep === 3) return true; // Defaults are valid
    return true;
  }, [currentStep, newClassroomName]);

  const handleCreateClassroom = async () => {
    if (!newClassroomName.trim()) {
      setError("Classroom name is required");
      return;
    }

    setIsCreating(true);
    setError(null);
    globalContext?.setIsLoading(true);

    try {
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
      navigate("/dashboard");
    } catch (err) {
      console.error("Failed to create classroom:", err);
      const errorMessage = getErrorMessage(err);
      setError(errorMessage || "Failed to create classroom");
      globalContext?.showToast?.(
        errorMessage || "Failed to create classroom",
        "error"
      );
    } finally {
      setIsCreating(false);
      globalContext?.setIsLoading(false);
    }
  };

  return (
    <BasicLayout>
      <div className="page min-h-screen bg-ui-surface-hover/20">
        <div className="container py-10">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="heading-xl text-3xl font-extrabold text-text-primary tracking-tight">
                Create a Classroom
              </h1>
              <p className="text-text-muted mt-1 text-sm">
                Set up a new cohort, configure template defaults, and determine how students join the simulation.
              </p>
            </div>
            <button
              onClick={() => navigate("/classrooms")}
              className="btn-outline flex items-center gap-2 max-w-fit self-start md:self-auto"
            >
              <i className="pi pi-arrow-left text-xs" />
              <span>Back to Classrooms</span>
            </button>
          </div>

          {/* Stepper Progress Indicator */}
          <div className="mb-10 relative">
            {/* Background connector line */}
            <div className="absolute top-[18px] left-[12.5%] right-[12.5%] h-0.5 bg-ui-border z-0 hidden md:block">
              <div
                className="h-full bg-brand-teal transition-all duration-300"
                style={{
                  width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%`
                }}
              />
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4 relative z-10">
              {STEPS.map((step) => {
                const isActive = step.id === currentStep;
                const isCompleted = step.id < currentStep;

                return (
                  <div
                    key={step.id}
                    onClick={() => {
                      if (step.id < currentStep || (step.id <= 3 && isStepValid)) {
                        setCurrentStep(step.id);
                      }
                    }}
                    className={`flex flex-col items-center text-center cursor-pointer select-none transition-all duration-200 flex-1 ${
                      isActive
                        ? "opacity-100"
                        : isCompleted
                        ? "opacity-80 hover:opacity-100"
                        : "opacity-40 pointer-events-none"
                    }`}
                  >
                    {/* Circle badge */}
                    <div
                      className={`w-[36px] h-[36px] flex-shrink-0 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-200 mb-2 ${
                        isActive
                          ? "bg-brand-teal border-brand-teal text-white shadow-md shadow-brand-teal/20"
                          : isCompleted
                          ? "bg-brand-teal/10 border-brand-teal text-brand-teal"
                          : "bg-ui-surface border-ui-border text-text-muted"
                      }`}
                    >
                      {isCompleted ? <i className="pi pi-check text-xs font-bold" /> : step.id}
                    </div>

                    {/* Step Labels */}
                    <div className="flex flex-col items-center">
                      <span
                        className={`text-sm font-semibold leading-none ${
                          isActive ? "text-brand-teal" : "text-text-primary"
                        }`}
                      >
                        {step.name}
                      </span>
                      <span className="text-[11px] text-text-muted mt-1 max-w-[150px] hidden md:block">
                        {step.desc}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main Content Card */}
          <div className="card shadow-xl border border-ui-border bg-ui-surface rounded-2xl p-8 relative overflow-hidden">
            {error && (
              <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm flex items-start gap-3">
                <i className="pi pi-exclamation-circle text-base mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold block mb-0.5">Setup Error</span>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* STEP 1: CHOOSE TEMPLATE */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-text-primary flex items-center gap-2 mb-2">
                    <i className="pi pi-book text-brand-teal" />
                    Select a Template (Optional)
                  </h2>
                  <p className="text-sm text-text-muted leading-relaxed">
                    Classroom templates pre-configure game rules, starting budgets, weather behavior, and weekly scenarios. Prefilling these ensures balanced settings right out of the gate, though you can fully customize them later.
                  </p>
                </div>

                {isLoadingTemplates ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <i className="pi pi-spin pi-spinner text-brand-teal text-3xl" />
                    <span className="text-text-muted text-sm font-medium">Loading templates...</span>
                  </div>
                ) : (
                  <div className="!grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {/* No Template Card */}
                    <div
                      onClick={() => setSelectedTemplateId("")}
                      className={`border rounded-xl p-5 cursor-pointer transition-all duration-200 flex flex-col justify-between h-40 ${
                        selectedTemplateId === ""
                          ? "bg-brand-teal/5 border-brand-teal shadow-md"
                          : "border-ui-border hover:border-text-muted bg-ui-surface"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-text-primary text-base">Standard Setup (No Template)</span>
                          {selectedTemplateId === "" && (
                            <i className="pi pi-check-circle text-brand-teal text-lg" />
                          )}
                        </div>
                        <p className="text-xs text-text-muted leading-relaxed">
                          Start with an empty classroom canvas. You will manually define variables, starting cash, and weekly game challenges.
                        </p>
                      </div>
                      <span className="text-[11px] text-brand-teal font-semibold">Custom Rules</span>
                    </div>

                    {/* Template Cards */}
                    {classroomTemplates.map((t) => {
                      const isSelected = selectedTemplateId === t._id;
                      return (
                        <div
                          key={t._id}
                          onClick={() => setSelectedTemplateId(t._id)}
                          className={`border rounded-xl p-5 cursor-pointer transition-all duration-200 flex flex-col justify-between h-40 ${
                            isSelected
                              ? "bg-brand-teal/5 border-brand-teal shadow-md"
                              : "border-ui-border hover:border-text-muted bg-ui-surface"
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-text-primary text-base truncate pr-2">
                                {t.label}
                              </span>
                              {isSelected && (
                                <i className="pi pi-check-circle text-brand-teal text-lg" />
                              )}
                            </div>
                            <p className="text-xs text-text-muted leading-relaxed line-clamp-3">
                              {t.description || "Pre-configured settings with defined variables and simulation parameters."}
                            </p>
                          </div>
                          <span className="text-[11px] text-brand-blue font-semibold">
                            {t.variablesCount ? `${t.variablesCount} Variables` : "Pre-Configured Game"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: CLASSROOM INFORMATION */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-text-primary flex items-center gap-2 mb-2">
                    <i className="pi pi-info-circle text-brand-teal" />
                    Classroom Details
                  </h2>
                  <p className="text-sm text-text-muted leading-relaxed">
                    Provide a name and overview for your classroom. Students will see this when signing up or viewing their roster.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="name" className="label text-sm font-semibold block text-text-primary">
                      Classroom Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={newClassroomName}
                      onChange={(e) => setNewClassroomName(e.target.value)}
                      className="input w-full border border-ui-border rounded-xl px-4 py-3 bg-ui-surface text-text-primary focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition-all text-base outline-none"
                      placeholder="e.g. Supply Chain 101 - Fall 2026"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="description" className="label text-sm font-semibold block text-text-primary">
                      Description
                    </label>
                    <textarea
                      id="description"
                      value={newClassroomDescription}
                      onChange={(e) => setNewClassroomDescription(e.target.value)}
                      className="input w-full border border-ui-border rounded-xl px-4 py-3 bg-ui-surface text-text-primary min-h-[140px] resize-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition-all text-base outline-none"
                      placeholder="Give a brief summary of the class, simulation dates, or syllabus context (optional)"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: ACCESS & BILLING MODE */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-text-primary flex items-center gap-2 mb-2">
                    <i className="pi pi-credit-card text-brand-teal" />
                    Access Mode & Student Entry
                  </h2>
                  <p className="text-sm text-text-muted leading-relaxed">
                    Decide how seats are funded and how students join. You can modify billing and invitation methods later in classroom settings.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Student Paid Card */}
                  <div
                    onClick={() => {
                      setNewClassroomBillingMode("student_paid");
                    }}
                    className={`border rounded-xl p-6 cursor-pointer transition-all duration-200 flex flex-col justify-between h-48 ${
                      newClassroomBillingMode === "student_paid"
                        ? "bg-brand-teal/5 border-brand-teal shadow-md"
                        : "border-ui-border hover:border-text-muted bg-ui-surface"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-text-primary text-base flex items-center gap-2">
                          <i className="pi pi-user text-brand-teal" />
                          Individual Student Paid
                        </span>
                        {newClassroomBillingMode === "student_paid" && (
                          <i className="pi pi-check-circle text-brand-teal text-lg" />
                        )}
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed">
                        Students purchase access cards or pay individually online to access the simulator. Ideal for course integrations where students buy materials directly.
                      </p>
                    </div>
                    <span className="text-[11px] text-brand-teal font-semibold">Join via Invite Link</span>
                  </div>

                  {/* Teacher Paid Roster Card */}
                  <div
                    onClick={() => {
                      setNewClassroomBillingMode("teacher_paid_roster");
                    }}
                    className={`border rounded-xl p-6 cursor-pointer transition-all duration-200 flex flex-col justify-between h-48 ${
                      newClassroomBillingMode === "teacher_paid_roster"
                        ? "bg-brand-teal/5 border-brand-teal shadow-md"
                        : "border-ui-border hover:border-text-muted bg-ui-surface"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-text-primary text-base flex items-center gap-2">
                          <i className="pi pi-users text-brand-blue" />
                          Teacher-Paid Seats
                        </span>
                        {newClassroomBillingMode === "teacher_paid_roster" && (
                          <i className="pi pi-check-circle text-brand-teal text-lg" />
                        )}
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed">
                        Seats are pre-funded by your institution or department account. Students do not pay. You will add students to the class roster manually or via CSV.
                      </p>
                    </div>
                    <span className="text-[11px] text-brand-blue font-semibold">Roster-only Verification</span>
                  </div>
                </div>

                {newClassroomBillingMode === "student_paid" && (
                  <div className="flex items-start gap-3 p-4 bg-ui-surface-hover/30 border border-ui-border rounded-xl mt-4">
                    <input
                      id="newAllowAnonymousJoin"
                      type="checkbox"
                      checked={newAllowAnonymousJoin}
                      onChange={(e) => setNewAllowAnonymousJoin(e.target.checked)}
                      className="w-5 h-5 rounded border-ui-border text-brand-teal focus:ring-brand-teal mt-0.5 cursor-pointer"
                    />
                    <div className="flex flex-col cursor-pointer" onClick={() => setNewAllowAnonymousJoin(!newAllowAnonymousJoin)}>
                      <label
                        htmlFor="newAllowAnonymousJoin"
                        className="text-sm font-semibold text-text-primary select-none cursor-pointer"
                      >
                        Allow instant join with link
                      </label>
                      <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                        Students can enroll instantly using the class URL. If disabled, students must register and be approved by the classroom admin.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: REVIEW & CONFIRM */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-text-primary flex items-center gap-2 mb-2">
                    <i className="pi pi-check-circle text-brand-teal" />
                    Review Configurations
                  </h2>
                  <p className="text-sm text-text-muted leading-relaxed">
                    Double-check your classroom settings below. You can go back to make any edits before finalizing.
                  </p>
                </div>

                <div className="border border-ui-border rounded-xl overflow-hidden bg-ui-surface">
                  <div className="divide-y divide-ui-border">
                    {/* Template Row */}
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs text-text-muted uppercase tracking-wider font-semibold block">Template</span>
                        <span className="font-bold text-text-primary">
                          {selectedTemplate ? selectedTemplate.label : "Standard Setup (Blank)"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="text-xs text-brand-teal font-semibold hover:underline self-start sm:self-auto"
                      >
                        Change
                      </button>
                    </div>

                    {/* Classroom Name Row */}
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs text-text-muted uppercase tracking-wider font-semibold block">Classroom Name</span>
                        <span className="font-semibold text-text-primary">{newClassroomName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="text-xs text-brand-teal font-semibold hover:underline self-start sm:self-auto"
                      >
                        Edit
                      </button>
                    </div>

                    {/* Description Row */}
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs text-text-muted uppercase tracking-wider font-semibold block">Description</span>
                        <span className="text-text-secondary text-sm">
                          {newClassroomDescription.trim() ? newClassroomDescription : "—"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="text-xs text-brand-teal font-semibold hover:underline self-start sm:self-auto"
                      >
                        Edit
                      </button>
                    </div>

                    {/* Billing Mode Row */}
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs text-text-muted uppercase tracking-wider font-semibold block">Access & Billing</span>
                        <span className="font-semibold text-text-primary">
                          {newClassroomBillingMode === "student_paid"
                            ? "Student-Paid Access Link"
                            : "Teacher-Paid Seats"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(3)}
                        className="text-xs text-brand-teal font-semibold hover:underline self-start sm:self-auto"
                      >
                        Change
                      </button>
                    </div>

                    {/* Join Policy Details */}
                    {newClassroomBillingMode === "student_paid" && (
                      <div className="p-4">
                        <span className="text-xs text-text-muted uppercase tracking-wider font-semibold block">Anonymous Join</span>
                        <span className="text-sm text-text-secondary">
                          {newAllowAnonymousJoin ? "Allowed (anyone with invite link)" : "Restricted (requires admin verification)"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-brand-blue/5 border border-brand-blue/15 rounded-xl p-4 text-xs text-text-muted leading-relaxed">
                  <strong>Note:</strong> Starting balances, default capacity limits, and scenarios are auto-loaded if a template was chosen. You can customize them anytime in the Classroom Settings and Challenges dashboard.
                </div>
              </div>
            )}

            {/* Stepper Footer Controls */}
            <div className="flex items-center justify-between gap-4 mt-8 pt-6 border-t border-ui-border">
              <button
                type="button"
                onClick={currentStep === 1 ? () => navigate("/classrooms") : handleBack}
                className="btn-outline px-6 py-2.5 flex items-center gap-2"
                disabled={isCreating}
              >
                {currentStep === 1 ? (
                  <>Cancel</>
                ) : (
                  <>
                    <i className="pi pi-chevron-left text-xs" />
                    <span>Back</span>
                  </>
                )}
              </button>

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="btn-teal px-6 py-2.5 flex items-center gap-2 text-white bg-brand-teal rounded-xl"
                  disabled={!isStepValid}
                >
                  <span>Continue</span>
                  <i className="pi pi-chevron-right text-xs" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleCreateClassroom()}
                  className="btn-teal px-8 py-2.5 font-bold text-white bg-brand-teal rounded-xl hover:opacity-95 shadow-md shadow-brand-teal/20"
                  disabled={isCreating}
                >
                  {isCreating ? "Creating Classroom..." : "Create & Launch Classroom"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </BasicLayout>
  );
};

export default ClassroomCreate;
