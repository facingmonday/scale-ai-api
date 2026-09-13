import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { useClerk } from "@clerk/clerk-react";
import axios from "axios";
import { AuthenticationRequiredError } from "@/services/authenticatedRequest";
import { readChallengeDraft, writeChallengeDraft, clearChallengeDraft, persistChallengeDraft } from "@/utils/challengeDraft";
import { useParams, useNavigate } from "react-router-dom";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { Tooltip } from "primereact/tooltip";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import challengeService from "../../../services/challenge";
import decisionService from "../../../services/decision";
import profileService from "../../../services/profile";
import variableDefinitionsService from "../../../services/variableDefinition";
import type { VariableDefinition } from "../../../types/variableDefinition";
import Outcome from "@/components/Outcome";
import VariablesForm from "@/components/VariablesForm";
import { useAuth } from "@/context/AuthContext";
import { useGlobalContext } from "@/context/GlobalContext";
import { FormProvider, useForm } from "react-hook-form";
import type { Challenge } from "@/types/challenge";
import type { Decision } from "@/types/decision";
import type { Profile } from "@/types/profile";
import { getErrorMessage } from "@/utils";
import {
  getChallengePresentationBadgeClass,
  getChallengePresentationStatus,
  isChallengeLockedForStudents,
} from "@/utils/challengeStatus";
import type { VariableDefinitionWithValue } from "@/types/decision";
import {
  getDecisionGenerationMethodLabel,
  getDecisionGenerationMethodBadgeClass,
} from "@/constants";
import LedgerVisualization from "@/components/LedgerVisualization";
import LoadingOverlay from "../../../components/LoadingOverlay";
import PreviousScenarioResults from "@/components/PreviousChallengeResults";
import Alert from "@/components/Alert";
import StoreSummary from "@/components/ProfileSummary";
import SubmissionDeadlineCard from "@/components/SubmissionDeadlineCard";

const ScenarioPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeClassroom, refetchMe, user } = useAuth();
  const clerk = useClerk();
  const globalContext = useGlobalContext();
  const [challenge, setScenario] = useState<Challenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setStore] = useState<Profile | null>(null);
  const [isLoadingStore, setIsLoadingStore] = useState(true);
  const [decisionVariableDefinitions, setDecisionVariableDefinitions] =
    useState<VariableDefinitionWithValue[]>([]);
  const [challengeVariableDefinitions, setChallengeVariableDefinitions] = useState<
    VariableDefinitionWithValue[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  const operationInProgress = useRef(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const draftKey = user?.id && activeClassroom?._id && id
    ? `challenge-draft:${user.id}:${activeClassroom._id}:${id}` : null;
  const restoredDraftKey = useRef<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const form = useForm<{
    variables: Record<string, unknown>;
    challengeVariableAnswers: Record<string, unknown>;
  }>({
    defaultValues: { variables: {}, challengeVariableAnswers: {} },
    mode: "onChange",
  });

  // Persist edits before a session change can unmount the page. Drafts are
  // scoped to the student, classroom and challenge in this browser tab.
  useEffect(() => {
    return persistChallengeDraft(form, draftKey);
  }, [draftKey, form]);

  const activeClassroomRef = useRef(activeClassroom);
  useEffect(() => {
    activeClassroomRef.current = activeClassroom;
  }, [activeClassroom]);

  const fetchScenario = useCallback(
    async (
      classroomOverride?: typeof activeClassroom,
      silent = false,
      preserveUnsavedValues = false,
    ) => {
      if (!id) return;

      const classroom = classroomOverride ?? activeClassroomRef.current;
      if (!classroom?._id) {
        if (!classroomOverride) setIsLoading(false);
        return;
      }

      if (!silent) setIsLoading(true);
      if (!silent) setError(null);
      try {
        // Fetch challenge
        const scenarioResp = await challengeService.getById(id, "student");
        const scenarioData = (scenarioResp.data || scenarioResp) as Challenge;

        // Get variable definitions from API
        const varDefsResponse = await variableDefinitionsService.getAll(
          classroom._id,
          undefined,
          id
        );
        const allDefs = ((varDefsResponse?.data ?? varDefsResponse ?? []) as VariableDefinition[]);
        const scenarioDefs = allDefs.filter((def) => def.appliesTo === "challenge");
        const submissionDefs = allDefs.filter((def) => def.appliesTo === "decision");

        // If decision exists but variables are not populated, fetch decision separately
        if (
          scenarioData.decision &&
          (!scenarioData.decision.variables ||
            Object.keys(scenarioData.decision.variables).length === 0)
        ) {
          try {
            const submissionResponse =
              await decisionService.getStudentSubmissions({
                classroomId: classroom._id,
                challengeId: id,
              });
            const submissionsList = (submissionResponse?.data ??
              submissionResponse ??
              []) as Decision[];
            const latestSubmission =
              Array.isArray(submissionsList) && submissionsList.length > 0
                ? submissionsList[0]
                : null;

            // Merge the fully populated decision into the challenge response.
            if (latestSubmission) {
              scenarioData.decision = {
                ...scenarioData.decision,
                ...latestSubmission,
              };
            }
          } catch (submissionErr) {
            console.warn(
              "Failed to fetch decision variables separately:",
              submissionErr
            );
            // Continue with challenge data even if decision fetch fails
          }
        }

        setScenario(scenarioData);



        // Get challenge variables from the challenge data
        const scenarioVariables =
          (scenarioData.variables as Record<string, unknown> | undefined) ?? {};
        const submittedChallengeVariableAnswers =
          (scenarioData.decision?.challengeVariableAnswers as
            | Record<string, unknown>
            | undefined) ?? {};

        // Challenge-scoped definitions are student questions for this challenge.
        // Prefer this student's saved answers, then use the teacher-configured
        // challenge value/default for a new submission.
        const scenarioDefsForDisplay = scenarioDefs.filter(
          (def) =>
            def.isActive ||
            Object.prototype.hasOwnProperty.call(
              submittedChallengeVariableAnswers,
              def.key
            ) ||
            Object.prototype.hasOwnProperty.call(scenarioVariables, def.key)
        );
        const scenarioVariablesWithValues: VariableDefinitionWithValue[] =
          scenarioDefsForDisplay.map((def) => ({
            ...def,
            value:
              submittedChallengeVariableAnswers[def.key] ??
              scenarioVariables[def.key] ??
              def.defaultValue ??
              (def.dataType === "number" ? 0 : ""),
          }));

        setChallengeVariableDefinitions(scenarioVariablesWithValues);

        // Merge variable definitions with existing decision values
        const submissionVariables =
          (scenarioData.decision?.variables as
            | Record<string, unknown>
            | undefined) ?? {};

        // Filter decision defs by context:
        // - New/editable decision: only isActive variables (don't include inactive in new decisions)
        // - Old/read-only decision: only variables that were part of that decision (show historical vars even if now inactive)
        const isReadOnlyView =
          !scenarioData?.isPublished ||
          !!scenarioData?.isClosed ||
          !!scenarioData?.isLockedForStudents;
        const hasExistingSubmission = !!scenarioData?.decision;
        const submissionDefsForForm = submissionDefs.filter((def) =>
          isReadOnlyView && hasExistingSubmission
            ? Object.prototype.hasOwnProperty.call(submissionVariables, def.key)
            : def.isActive
        );
        const variablesWithValues: VariableDefinitionWithValue[] =
          submissionDefsForForm.map((def) => ({
            ...def,
            value:
              submissionVariables[def.key] ??
              def.defaultValue ??
              (def.dataType === "number" ? 0 : ""),
          }));

        setDecisionVariableDefinitions(variablesWithValues);

        // Hydrate form with all variable values
        const variablesRecord = variablesWithValues.reduce((acc, variable) => {
          acc[variable.key] = variable.value;
          return acc;
        }, {} as Record<string, unknown>);
        const challengeVariableAnswersRecord =
          scenarioVariablesWithValues.reduce((acc, variable) => {
            acc[variable.key] = variable.value;
            return acc;
          }, {} as Record<string, unknown>);
        // Background refreshes should update challenge status and definitions
        // without replacing a student's in-progress answers. If the challenge
        // became read-only while the page was blurred, the server remains
        // authoritative and the form should show the submitted/default values.
        if (!preserveUnsavedValues || !form.formState.isDirty || isReadOnlyView) {
          // Use reset (not setValue) so defaultValues are updated and isDirty clears
          form.reset({
            variables: variablesRecord,
            challengeVariableAnswers: challengeVariableAnswersRecord,
          });
          if (draftKey && restoredDraftKey.current !== draftKey && !isReadOnlyView) {
            restoredDraftKey.current = draftKey;
            const draft = readChallengeDraft(draftKey);
            if (draft) {
              for (const key of Object.keys(variablesRecord)) {
                if (Object.prototype.hasOwnProperty.call(draft.variables, key)) {
                  form.setValue(`variables.${key}`, draft.variables[key], { shouldDirty: true });
                }
              }
              for (const key of Object.keys(challengeVariableAnswersRecord)) {
                if (Object.prototype.hasOwnProperty.call(draft.challengeVariableAnswers, key)) {
                  form.setValue(`challengeVariableAnswers.${key}`, draft.challengeVariableAnswers[key], { shouldDirty: true });
                }
              }
              setSubmissionError("Your unsent answers were restored. Review them and submit to save your changes.");
            }
          }
          // Explicitly trigger validation to update isValid state
          await form.trigger();
        }
      } catch (err) {
        console.error("Failed to fetch challenge:", err);
        if (silent) throw err;
        setError("Failed to load challenge");
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [id, form, draftKey]
  );

  const fetchStore = useCallback(async () => {
    if (!activeClassroom?._id) {
      setIsLoadingStore(false);
      return;
    }

    setIsLoadingStore(true);
    try {
      const response = await profileService.getStudentStore(activeClassroom._id);
      if (response.data) {
        setStore(response.data);
      } else {
        setStore(null);
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      setStore(null);
    } finally {
      setIsLoadingStore(false);
    }
  }, [activeClassroom?._id]);

  useEffect(() => {
    if (id) {
      void fetchScenario();
    }
  }, [id, fetchScenario]);

  useEffect(() => {
    void fetchStore();
  }, [fetchStore]);

  const handleSubmit = () => form.handleSubmit(async (values) => {
    if (!id || operationInProgress.current || !challenge || !profile) {
      if (!profile) {
        globalContext?.showToast?.(
          "You must create a profile before submitting",
          "error"
        );
      }
      return;
    }

    operationInProgress.current = true;
    setIsSubmitting(true);
    setSubmissionError(null);
    writeChallengeDraft(draftKey, values);
    try {
      const decision = challenge.decision as Decision | undefined;
      const isUpdate = decision?._id;

      globalContext?.showToast?.(
        isUpdate ? "Updating decision..." : "Submitting challenge...",
        "loading"
      );

      let savedResponse;
      if (isUpdate && decision._id) {
        savedResponse = await decisionService.update(decision._id, {
          challengeId: id,
          variables: values.variables ?? {},
          challengeVariableAnswers: values.challengeVariableAnswers ?? {},
        });
        globalContext?.showToast?.(
          "Decision updated successfully",
          "success"
        );
      } else {
        savedResponse = await decisionService.submit({
          challengeId: id,
          variables: values.variables ?? {},
          challengeVariableAnswers: values.challengeVariableAnswers ?? {},
        });
        globalContext?.showToast?.(
          "Challenge submitted successfully",
          "success"
        );
      }
      const savedDecision = (savedResponse.data ?? savedResponse) as Decision;
      setScenario((current) => current ? { ...current, decision: savedDecision } : current);
      clearChallengeDraft(draftKey);
      form.reset(values);
      setShowSuccessDialog(true);
      // A failed follow-up read must not misreport a confirmed save as failure
      // or leave a first-time submission looking like it still needs creating.
      await fetchScenario(undefined, true).catch(() => {
        setSubmissionError("Your decision was saved, but we could not refresh the challenge. Please refresh when your connection is available.");
      });
    } catch (e) {
      console.error("Failed to submit challenge:", e);
      const errorMessage = getErrorMessage(e);
      setSubmissionError(`Your changes have not been confirmed as submitted. ${errorMessage}`);
      globalContext?.showToast?.(errorMessage, "error");
      if (e instanceof AuthenticationRequiredError) {
        // SignedOut displays sign-in at the current URL, whose sign-in button
        // returns here. The draft will be restored after authentication.
        await clerk.signOut().catch(() => {
          setSubmissionError("Your changes have not been submitted. Please sign in again and retry.");
        });
      }
    } finally {
      operationInProgress.current = false;
      setIsSubmitting(false);
    }
  })();

  useEffect(() => {
    const handleFocus = async () => {
      if (!id || document.visibilityState === "hidden" || operationInProgress.current) return;
      operationInProgress.current = true;
      setIsCheckingSession(true);
      if (form.formState.isDirty) writeChallengeDraft(draftKey, form.getValues());
      try {
        const auth = await refetchMe();
        if (!auth) {
          setSubmissionError("We could not verify your session. Check your connection or sign in again before submitting changes.");
          return;
        }
        if (auth.activeClassroom?._id !== activeClassroomRef.current?._id) return;
        await fetchScenario(auth.activeClassroom, true, true);
      } catch (error) {
        setSubmissionError("We could not refresh this challenge. Please check your connection and retry before submitting changes.");
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          await clerk.signOut().catch(() => undefined);
        }
      } finally {
        operationInProgress.current = false;
        setIsCheckingSession(false);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);
    window.addEventListener("pageshow", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("pageshow", handleFocus);
    };
  }, [id, fetchScenario, refetchMe, form, draftKey, clerk]);

  const decision = challenge?.decision as Decision | undefined;
  const hasAutomaticAnswers =
    !!decision?.generation?.method && decision.generation.method !== "MANUAL";

  const hasSubmission = !!decision;
  const challengeLocked = isChallengeLockedForStudents(challenge);
  const isReadOnly =
    !challenge?.isPublished ||
    challengeLocked;
  const hasStore = !!profile;
  const canSubmit =
    !!challenge?.isPublished &&
    !challengeLocked &&
    hasStore;
  const showSubmissionVariables = !(challengeLocked && !hasSubmission);
  const showUnsavedBanner =
    form.formState.isDirty && !isReadOnly && showSubmissionVariables;

  const submissionVariablesDisplayTitle = useMemo(() => {
    if (decision?.generation?.method) {
      return `Decision Variables (${getDecisionGenerationMethodLabel(decision.generation.method)})`;
    }
    return "Decision Variables";
  }, [decision]);

  const scenarioStatus = React.useMemo(() => {
    if (!challenge) return null;
    const status = getChallengePresentationStatus(challenge, {
      audience: "student",
      decisionProcessingStatus: decision?.processingStatus,
      hasLedger: !!challenge.ledgerEntry,
    });
    return {
      label: status,
      badgeClass: getChallengePresentationBadgeClass(status),
    };
  }, [challenge, decision?.processingStatus]);

  const isCalculatingResults =
    scenarioStatus?.label === "Calculating Results";
  const studentResultsReady = scenarioStatus?.label === "Results Ready";

  useEffect(() => {
    if (!isCalculatingResults) return;

    const refresh = () => {
      if (document.visibilityState === "visible" && !operationInProgress.current) {
        void fetchScenario(undefined, true).catch(() => {
          setSubmissionError("We could not refresh challenge results. Please check your connection and retry.");
        });
      }
    };
    const intervalId = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(intervalId);
  }, [fetchScenario, isCalculatingResults]);

  const submissionDeadline = useMemo(() => {
    if (!challenge?.submissionDeadlineAt) return null;
    const date = new Date(challenge.submissionDeadlineAt);
    return Number.isNaN(date.getTime()) ? null : date;
  }, [challenge?.submissionDeadlineAt]);

  if (error) {
    return (
      <BasicLayout>
        <div className="page">
          <div className="container">
            <div className="card text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button onClick={() => void fetchScenario()} className="btn-teal">
                Try Again
              </button>
            </div>
          </div>
        </div>
      </BasicLayout>
    );
  }

  return (
    <BasicLayout>
      <LoadingOverlay loading={isLoading || isLoadingStore} />
      {!challenge ? (
        <div className="page">
          <div className="container">
            <div className="card text-center py-12">
              <h2 className="heading-lg mb-2">Challenge Not Found</h2>
              <p className="text-text-muted">
                The challenge you're looking for doesn't exist.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <FormProvider {...form}>
          <fieldset disabled={isSubmitting || isCheckingSession} className="m-0 min-w-0 border-0 p-0">
          <div className={`page ${showUnsavedBanner ? "pb-16" : ""}`}>
            <div className="container">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h1 className="heading-xl">
                    {challenge.title ||
                      (challenge as Challenge & { name?: string }).name}
                  </h1>
                  {scenarioStatus && (
                    <span className={`badge ${scenarioStatus.badgeClass}`}>
                      {scenarioStatus.label}
                    </span>
                  )}
                  {hasSubmission && decision && (
                    <>
                      {decision.submittedAt && (
                        <Tooltip
                          target=".decision-badge"
                          position="bottom"
                          content={new Date(
                            decision.submittedAt
                          ).toLocaleString()}
                        />
                      )}
                      <span
                        className={`decision-badge badge ${getDecisionGenerationMethodBadgeClass(decision.generation?.method)}`}
                      >
                        {getDecisionGenerationMethodLabel(
                          decision.generation?.method
                        )}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3 sm:justify-end">
                  {canSubmit && (
                    <button
                      className={`btn-teal w-full sm:w-auto ${isSubmitting || isCheckingSession || !form.formState.isValid
                        ? "btn-disabled"
                        : ""
                        }`}
                      onClick={() => void handleSubmit()}
                      disabled={isSubmitting || isCheckingSession || !form.formState.isValid}
                      type="button"
                    >
                      {isCheckingSession
                        ? "Checking session..."
                        : isSubmitting
                        ? hasSubmission
                          ? "Updating..."
                          : "Submitting..."
                        : hasSubmission
                          ? "Update Decision"
                          : "Submit Challenge"}
                    </button>
                  )}
                </div>
              </div>

              {submissionError && (
                <div role="alert" className="mb-6">
                  <Alert variant="warning" title="Submission status" message={submissionError} />
                </div>
              )}

              {submissionDeadline && !challengeLocked && (
                <SubmissionDeadlineCard deadline={submissionDeadline} />
              )}

              {!isLoadingStore && !hasStore && (
                <div className="mb-6">
                  <Alert
                    variant="warning"
                    title="Profile Required"
                    message="You must create a profile before you can submit a challenge."
                    actions={[
                      {
                        label: "Create Profile",
                        onClick: () => navigate("/profile"),
                        variant: "primary",
                      },
                    ]}
                  />
                </div>
              )}

              <div className="flex flex-row gap-4 w-full mb-6">
                {challenge.imageUrl && (
                  <div className="w-1/4 h-full object-cover rounded-lg overflow-hidden">
                    <img src={challenge.imageUrl} alt={challenge.title} />
                  </div>
                )}
                {challenge.description && (
                  <div
                    className={`card ${challenge.imageUrl ? "w-3/4" : "w-full"}`}
                  >
                    <h2 className="heading-md mb-2">Challenge</h2>
                    <p className="text-text-muted">{challenge.description}</p>
                  </div>
                )}
              </div>

              {profile && (
                <div className="mb-6">
                  <StoreSummary profile={profile} />
                </div>
              )}

              {challengeVariableDefinitions.length > 0 && (
                <div className="card mb-6">
                  <VariablesForm
                    variables={challengeVariableDefinitions}
                    namePrefix="challengeVariableAnswers"
                    readOnly={isReadOnly || isSubmitting || isCheckingSession}
                    title="Challenge Variables"
                    description={
                      isReadOnly
                        ? hasAutomaticAnswers
                          ? "View the automatically populated answers for this challenge."
                          : "View your submitted answers for this challenge."
                        : "Answer the questions for this challenge."
                    }
                  />
                </div>
              )}

              {challengeLocked && !hasSubmission && (
                <div className="mb-6">
                  <Alert
                    variant="info"
                    title="No Decision"
                    message="You did not make a decision for this challenge."
                  />
                </div>
              )}

              {showSubmissionVariables &&
                decisionVariableDefinitions.length > 0 && (
                  <div className="card mb-6">
                    <VariablesForm
                      variables={decisionVariableDefinitions}
                      readOnly={isReadOnly || isSubmitting || isCheckingSession}
                      title={submissionVariablesDisplayTitle}
                      description={
                        isReadOnly
                          ? hasAutomaticAnswers
                            ? "View the automatically populated values for this challenge."
                            : "View your submitted values for this challenge."
                          : "Configure your decisions for this challenge."
                      }
                    />
                  </div>
                )}

              {hasSubmission && isCalculatingResults && (
                  <div className="mb-6">
                    <Alert
                      variant="info"
                      title="Calculating Results"
                      message="Your decision was submitted successfully. We’re calculating your results now; this page will update automatically when they’re ready."
                    />
                  </div>
                )}
              {!challenge?.isClosed && (
                <PreviousScenarioResults challengeId={id} />
              )}

              {studentResultsReady && (
                <>
                  <div className="mb-4">
                    {isLoading ? (
                      <p>Loading...</p>
                    ) : (
                      <Outcome challengeId={id} challenge={challenge} />
                    )}
                  </div>

                  <div className="mb-6">
                    {challenge?.ledgerEntry && (
                      <LedgerVisualization ledger={challenge.ledgerEntry} />
                    )}
                  </div>
                </>
              )}

              <div className="card">
                <p className="text-text-muted text-sm">Challenge ID: {id}</p>
              </div>
            </div>
          </div>

          {showUnsavedBanner && (
            <div className="unsaved-changes-banner" role="status">
              <span className="unsaved-changes-banner-text">
                You have unsaved changes. Don&apos;t forget to submit your
                challenge.
              </span>
            </div>
          )}
          </fieldset>
        </FormProvider>
      )}

      <Dialog
        header="Strategy Saved"
        visible={showSuccessDialog}
        onHide={() => setShowSuccessDialog(false)}
        style={{ width: "32rem" }}
        className="modal p-2"
        pt={{
          headerTitle: { className: "modal-title" },
          content: { className: "modal-content" },
          footer: { className: "modal-footer" },
        }}
        footer={
          <div className="flex gap-2 justify-between">
            <Button
              label="Return to Dashboard"
              icon="pi pi-arrow-left"
              onClick={() => {
                setShowSuccessDialog(false);
                navigate("/");
              }}
              className="btn-teal"
            />
            <Button
              label="Stay on Challenge"
              icon="pi pi-arrow-down"
              severity="secondary"
              onClick={() => setShowSuccessDialog(false)}
              text
            />
          </div>
        }
      >
        <p className="text-text-muted">
          Your strategy has been saved successfully.
        </p>
      </Dialog>
    </BasicLayout>
  );
};

export default ScenarioPage;
