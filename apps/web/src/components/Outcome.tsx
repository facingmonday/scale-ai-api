import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import outcomeService from "@/services/outcome";
import challengeService from "@/services/challenge";
import classroomService from "@/services/classroom";
import type { Outcome as ScenarioOutcomeModel } from "@/types/outcome";
import { useAuth } from "@/context/AuthContext";
import { useGlobalContext } from "@/context/GlobalContext";
import { getErrorMessage } from "@/utils";
import AITextField from "./AIComponents/AITextField";
import type { Challenge } from "@/types/challenge";
import type {
  ChallengePreviewResponse,
  ChallengePreviewTarget,
} from "@/types/challenge";
import type { VariableDefinition } from "@/types/variableDefinition";
import type { VariableDefinitionWithValue } from "@/types/decision";
import type { ClassroomReadiness } from "@/types/readiness";
import { InputTextarea } from "primereact/inputtextarea";
import VariablesForm from "./VariablesForm";
import ChallengePreviewDialog from "./ChallengePreviewDialog";
import { getChallengeResultState } from "@/utils/challengeStatus";

export type ScenarioOutcomeProps = {
  challengeId: string | null | undefined;
  /**
   * Optional override. If omitted, derives from active classroom role.
   */
  role?: "admin" | "member";
  className?: string;
  title?: string;
  onChange?: (outcome: ScenarioOutcomeModel | null) => void;
  challenge?: Challenge;
  onExtendDeadline?: () => void;
  onChallengeUpdated?: () => void | Promise<void>;
  onBeforePreview?: () => void | Promise<void>;
};

const getErrorResponseData = (error: unknown): Record<string, unknown> | null => {
  if (!error || typeof error !== "object" || !("response" in error)) return null;
  const response = (error as { response?: { data?: unknown } }).response;
  return response?.data && typeof response.data === "object"
    ? (response.data as Record<string, unknown>)
    : null;
};

const mergePreviewResult = (
  current: ChallengePreviewResponse | null,
  incoming: ChallengePreviewResponse,
): ChallengePreviewResponse => {
  if (!current) return incoming;
  const mergedProfileTypes = [...current.profileTypes];

  for (const nextProfileType of incoming.profileTypes) {
    const profileIndex = mergedProfileTypes.findIndex(
      (item) => item.profileType.id === nextProfileType.profileType.id,
    );
    if (profileIndex < 0) {
      mergedProfileTypes.push(nextProfileType);
      continue;
    }
    const cases = [...mergedProfileTypes[profileIndex].cases];
    for (const nextCase of nextProfileType.cases) {
      const caseIndex = cases.findIndex((item) => item.case === nextCase.case);
      if (caseIndex < 0) cases.push(nextCase);
      else cases[caseIndex] = nextCase;
    }
    mergedProfileTypes[profileIndex] = {
      ...nextProfileType,
      cases,
    };
  }

  const allCases = mergedProfileTypes.flatMap((item) => item.cases);
  const completedCases = allCases.filter(
    (item) => item.status === "completed",
  ).length;
  const failedCases = allCases.length - completedCases;
  return {
    ...current,
    ...incoming,
    status: failedCases > 0 ? "partial" : "completed",
    profileTypes: mergedProfileTypes,
    completedCases,
    failedCases,
  };
};

const Outcome: React.FC<ScenarioOutcomeProps> = ({
  challengeId,
  challenge,
  className,
  title = "Challenge outcome",
  onChange,
  onExtendDeadline,
  onChallengeUpdated,
  onBeforePreview,
}) => {
  const { userRole, activeClassroom } = useAuth();
  const global = useGlobalContext();

  const effectiveRole = userRole ?? "org:member";
  const isAdmin = effectiveRole === "org:admin";

  const [outcome, setOutcome] = useState<ScenarioOutcomeModel | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReleasingFeedback, setIsReleasingFeedback] = useState(false);
  const [locallyReleasedChallengeId, setLocallyReleasedChallengeId] = useState<
    string | null
  >(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [hiddenNotesDraft, setHiddenNotesDraft] = useState("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewResult, setPreviewResult] =
    useState<ChallengePreviewResponse | null>(null);
  const [previewReadiness, setPreviewReadiness] =
    useState<ClassroomReadiness | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const outcomeDefinitions = useMemo<VariableDefinition[]>(
    () =>
      ((activeClassroom?.variableDefinitions?.outcome as
        | VariableDefinition[]
        | undefined) ?? []).filter((definition) => definition.isActive),
    [activeClassroom?.variableDefinitions],
  );
  const defaultOutcomeVariables = useMemo(
    () =>
      outcomeDefinitions.reduce<Record<string, unknown>>(
        (values, definition) => {
          if (
            definition.defaultValue !== null &&
            definition.defaultValue !== undefined
          ) {
            values[definition.key] = definition.defaultValue;
          }
          return values;
        },
        {},
      ),
    [outcomeDefinitions],
  );
  const outcomeForm = useForm<{
    outcomeVariables: Record<string, unknown>;
  }>({
    defaultValues: { outcomeVariables: defaultOutcomeVariables },
  });
  const watchedOutcomeVariables =
    useWatch({
      control: outcomeForm.control,
      name: "outcomeVariables",
    }) ?? {};
  const outcomeVariablesForDisplay: VariableDefinitionWithValue[] =
    outcomeDefinitions.map((definition) => ({
      ...definition,
      value:
        watchedOutcomeVariables[definition.key] ??
        definition.defaultValue ??
        (definition.dataType === "number"
          ? 0
          : definition.dataType === "boolean"
            ? false
            : ""),
    }));

  const canEdit = useMemo(() => {
    if (!isAdmin) return false;
    // If backend disallows edits after approval, it will reject; we still allow
    // entering edit mode for view consistency.
    return true;
  }, [isAdmin]);

  const fetchOutcome = useCallback(async () => {
    if (!challengeId) {
      setOutcome(null);
      onChange?.(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = isAdmin
        ? await outcomeService.getOutcome(challengeId)
        : await outcomeService.getOutcomeForStudent(challengeId);
      // Backend may return { data: null } to indicate "no outcome".
      // Do NOT fall back to the full response object in that case.
      const next =
        response && typeof response === "object" && "data" in response
          ? (((response as { data?: ScenarioOutcomeModel | null }).data ??
            null) as ScenarioOutcomeModel | null)
          : ((response ?? null) as ScenarioOutcomeModel | null);
      setOutcome(next);
      onChange?.(next);

      if (next) {
        setNotesDraft(next.notes || "");
        setHiddenNotesDraft(next.hiddenNotes || "");
        outcomeForm.reset({
          outcomeVariables: {
            ...defaultOutcomeVariables,
            ...(next.variables ?? {}),
          },
        });
      } else {
        setNotesDraft("");
        setHiddenNotesDraft("");
        outcomeForm.reset({ outcomeVariables: defaultOutcomeVariables });
      }
    } catch (err) {
      // Common: 404 when no outcome exists (or not yet approved for students)
      setOutcome(null);
      onChange?.(null);
      setNotesDraft("");
      setHiddenNotesDraft("");
      outcomeForm.reset({ outcomeVariables: defaultOutcomeVariables });

      // Only log error if it's an admin view (students commonly "don't have it yet")
      if (isAdmin) {
        console.error("Failed to fetch challenge outcome:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    challengeId,
    defaultOutcomeVariables,
    isAdmin,
    onChange,
    outcomeForm,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchOutcome();
  }, [fetchOutcome]);

  const buildPayload = useCallback(
    () => ({
      notes: notesDraft.trim() || undefined,
      hiddenNotes: hiddenNotesDraft.trim() || undefined,
    }),
    [notesDraft, hiddenNotesDraft],
  );

  const persistOutcomeDraft = useCallback(
    async (refresh = true) => {
      if (!challengeId || !isAdmin) return;
      await outcomeService.saveOutcomeDraft(challengeId, buildPayload());
      if (outcomeDefinitions.length > 0) {
        await outcomeService.updateVariables(
          challengeId,
          outcomeForm.getValues("outcomeVariables") ?? {},
        );
      }
      if (refresh) await fetchOutcome();
    },
    [
      buildPayload,
      challengeId,
      fetchOutcome,
      isAdmin,
      outcomeDefinitions.length,
      outcomeForm,
    ],
  );

  const handleSaveDraft = useCallback(async () => {
    if (!challengeId) return;
    if (!isAdmin) return;

    setIsSaving(true);
    try {
      global?.showToast("Saving outcome draft...", "loading");
      await persistOutcomeDraft();
      global?.showToast("Outcome draft saved", "success");
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save challenge outcome draft:", err);
      const errorMessage = getErrorMessage(err);
      global?.showToast(errorMessage, "error");
    } finally {
      setIsSaving(false);
    }
  }, [challengeId, isAdmin, persistOutcomeDraft, global]);

  const handleProcessNow = useCallback(async () => {
    if (!challengeId) return;
    if (!isAdmin) return;

    setIsSaving(true);
    try {
      global?.showToast("Processing outcome...", "loading");
      await persistOutcomeDraft(false);
      await outcomeService.setOutcome(challengeId, buildPayload());
      global?.showToast("Outcome processing queued", "success");
      setIsEditing(false);
      await fetchOutcome();
    } catch (err) {
      console.error("Failed to process challenge outcome:", err);
      const errorMessage = getErrorMessage(err);
      global?.showToast(errorMessage, "error");
    } finally {
      setIsSaving(false);
    }
  }, [
    challengeId,
    isAdmin,
    persistOutcomeDraft,
    buildPayload,
    fetchOutcome,
    global,
  ]);

  const runPreview = async (targets?: ChallengePreviewTarget[]) => {
    if (!challengeId || !isAdmin || !activeClassroom?._id) return;
    const isRetry = !!targets;
    setIsPreviewOpen(true);
    setPreviewError(null);
    if (!isRetry) {
      setIsPreviewing(true);
      setPreviewResult(null);
      setPreviewReadiness(null);
    }

    try {
      if (!isRetry) {
        global?.showToast("Saving preview inputs...", "loading");
        await onBeforePreview?.();
        if (isEditing || !outcome) {
          await persistOutcomeDraft();
          setIsEditing(false);
        }
      }

      const readiness = await classroomService.getPreflight(
        activeClassroom._id,
        { challengeId, operation: "preview" },
      );
      setPreviewReadiness(readiness);
      if (readiness.status === "blocked") {
        const message = "Resolve the readiness checks before previewing.";
        setPreviewError(message);
        global?.showToast(message, "error");
        return;
      }

      if (!isRetry) {
        global?.showToast("Running preview...", "loading");
      }
      const nextResult = await challengeService.preview(challengeId, targets);
      setPreviewResult((current) =>
        isRetry ? mergePreviewResult(current, nextResult) : nextResult,
      );
      global?.showToast(
        nextResult.status === "partial"
          ? "Preview completed with some failed cases"
          : "Preview ready",
        "success",
      );
    } catch (err) {
      console.error("Challenge preview failed:", err);
      const responseData = getErrorResponseData(err);
      const readiness = responseData?.readiness;
      if (readiness && typeof readiness === "object") {
        setPreviewReadiness(readiness as ClassroomReadiness);
      }
      const failedPreview = responseData?.data;
      if (failedPreview && typeof failedPreview === "object") {
        setPreviewResult((current) =>
          isRetry
            ? mergePreviewResult(
                current,
                failedPreview as unknown as ChallengePreviewResponse,
              )
            : (failedPreview as unknown as ChallengePreviewResponse),
        );
      }
      const message = getErrorMessage(err);
      setPreviewError(message);
      global?.showToast(message, "error");
    } finally {
      if (!isRetry) setIsPreviewing(false);
    }
  };

  const addOutcomeDisabled = useMemo(() => {
    return !challenge;
  }, [challenge]);

  const resultState = getChallengeResultState(challenge);
  const resultIsFinal =
    resultState === "awaitingFeedback" || resultState === "released";
  const regularActionsHidden =
    resultState === "calculating" || resultIsFinal;

  const showReleaseFeedback = useMemo(() => {
    if (!isAdmin || !challenge) return false;
    return (
      resultState === "awaitingFeedback" &&
      locallyReleasedChallengeId !== challengeId
    );
  }, [
    isAdmin,
    challenge,
    resultState,
    locallyReleasedChallengeId,
    challengeId,
  ]);

  const handleReleaseFeedback = useCallback(async () => {
    if (!challengeId) return;

    setIsReleasingFeedback(true);
    try {
      global?.showToast("Releasing feedback...", "loading");
      await challengeService.releaseFeedback(challengeId);
      setLocallyReleasedChallengeId(challengeId);
      global?.showToast("Feedback released and students notified", "success");
      try {
        await onChallengeUpdated?.();
      } catch (refreshError) {
        console.error("Feedback released, but challenge refresh failed:", refreshError);
      }
    } catch (err) {
      console.error("Failed to release feedback:", err);
      const errorMessage = getErrorMessage(err);
      global?.showToast(errorMessage, "error");
    } finally {
      setIsReleasingFeedback(false);
    }
  }, [challengeId, global, onChallengeUpdated]);

  const headerAction = (() => {
    if (!isAdmin) return null;
    if (isLoading) return null;

    const outcomeAction = regularActionsHidden ? null : !outcome ? (
      <button
        type="button"
        className={`btn-teal ${addOutcomeDisabled ? "disabled:opacity-50" : ""
          }`}
        onClick={() => setIsEditing(true)}
        disabled={addOutcomeDisabled}
      >
        + Add outcome
      </button>
    ) : (
      <button
        type="button"
        className="btn-outline"
        onClick={() => setIsEditing(true)}
        disabled={!canEdit}
      >
        Edit outcome
      </button>
    );

    return (
      <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
        {onExtendDeadline && !regularActionsHidden ? (
          <button
            type="button"
            className="btn-outline"
            onClick={onExtendDeadline}
          >
            Extend Deadline
          </button>
        ) : null}
        {showReleaseFeedback ? (
          <button
            type="button"
            className="btn-teal"
            onClick={() => void handleReleaseFeedback()}
            disabled={isReleasingFeedback}
          >
            Release Feedback
          </button>
        ) : null}
        {outcome && !isEditing && !regularActionsHidden ? (
          <button
            type="button"
            className="btn-teal"
            onClick={() => void runPreview()}
            disabled={isPreviewing}
          >
            {isPreviewing ? "Previewing..." : "Preview results"}
          </button>
        ) : null}
        {outcomeAction}
      </div>
    );
  })();

  return (
    <>
      <div className={className ? `card ${className}` : "card"}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="heading-md">{title}</h2>
        </div>
        {headerAction}
      </div>

      {!isLoading && !isEditing && (
        <div className="mt-2">
          {!outcome ? (
            <p className="text-text-muted text-sm">
              {isAdmin
                ? "No outcome has been entered yet."
                : "Outcome not available yet."}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-text-secondary">Notes</div>
              </div>
              <div className="mt-2 rounded-md border border-ui-border bg-ui-surface px-3 py-3">
                <p className="text-sm whitespace-pre-wrap">
                  {outcome.notes?.trim() ? outcome.notes : "—"}
                </p>
              </div>
              {isAdmin && outcome.hiddenNotes?.trim() && (
                <div className="mt-3">
                  <div className="text-sm text-text-secondary mb-1">
                    Hidden notes
                  </div>
                  <div className="rounded-md border border-ui-border bg-ui-surface px-3 py-3">
                    <p className="text-sm whitespace-pre-wrap">
                      {outcome.hiddenNotes}
                    </p>
                  </div>
                </div>
              )}
              {outcomeVariablesForDisplay.length > 0 ? (
                <div className="mt-4 border-t border-card-border pt-4">
                  <FormProvider {...outcomeForm}>
                    <VariablesForm
                      title="Outcome variables"
                      description="Saved realized values used by the simulation."
                      namePrefix="outcomeVariables"
                      defaultAppliesTo="outcome"
                      variables={outcomeVariablesForDisplay}
                      readOnly
                    />
                  </FormProvider>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {!isLoading && isEditing && !regularActionsHidden && (
        <div className="mt-5">
          <div className="space-y-4">
            <div>
              <AITextField
                id="challenge-outcome-notes"
                label="Notes"
                value={notesDraft}
                onChange={(value: string) => setNotesDraft(value)}
                placeholder="What actually happened this week…"
                disabled={!isAdmin || isSaving}
                multiline
                rows={4}
                prompt={`Using the following challenge description: ${challenge?.description} as context, write a short challenge outcome describing what actually happened during the week. Indicate whether conditions matched expectations or differed, and explain why. Include how weather, local events, and foot traffic actually played out, and note any unexpected changes. The outcome should reflect real operational impact and help students understand how staffing levels, inventory, and preparedness were affected. Keep the description concise, around 5–7 sentences.`}
                promptMode="modal"
              />
            </div>

            <div>
              <label className="label" htmlFor="challenge-outcome-hidden-notes">
                Hidden Notes
              </label>
              <InputTextarea
                id="challenge-outcome-hidden-notes"
                value={hiddenNotesDraft}
                onChange={(e) => setHiddenNotesDraft(e.target.value)}
                placeholder="Internal notes (not visible to students)…"
                disabled={!isAdmin || isSaving}
                autoResize
                className="input"
                rows={3}
              />
              <p className="text-xs text-text-muted mt-1">
                These notes are only visible to instructors and will not be
                shown to students.
              </p>
            </div>

            <div className="border-t border-card-border pt-4">
              <FormProvider {...outcomeForm}>
                <VariablesForm
                  title="Outcome variables"
                  description="Realized values that drive this challenge simulation."
                  namePrefix="outcomeVariables"
                  defaultAppliesTo="outcome"
                  variables={outcomeVariablesForDisplay}
                  readOnly={!isAdmin || isSaving}
                  showAddButton={isAdmin && !isSaving}
                  onSave={() => void fetchOutcome()}
                />
              </FormProvider>
            </div>

          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                setIsEditing(false);
                setNotesDraft(outcome?.notes || "");
                setHiddenNotesDraft(outcome?.hiddenNotes || "");
                outcomeForm.reset({
                  outcomeVariables: {
                    ...defaultOutcomeVariables,
                    ...(outcome?.variables ?? {}),
                  },
                });
              }}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-teal"
              onClick={() => void handleSaveDraft()}
              disabled={!isAdmin || isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => void runPreview()}
              disabled={!isAdmin || isSaving || isPreviewing}
            >
              {isPreviewing ? "Previewing..." : "Save & preview"}
            </button>
            <button
              type="button"
              className="btn-teal"
              onClick={() => void handleProcessNow()}
              disabled={!isAdmin || isSaving}
            >
              {isSaving ? "Processing..." : "Process now"}
            </button>
          </div>
        </div>
      )}
      </div>
      <ChallengePreviewDialog
        visible={isPreviewOpen}
        loading={isPreviewing}
        result={previewResult}
        readiness={previewReadiness}
        error={previewError}
        onHide={() => setIsPreviewOpen(false)}
        onRetry={async (target) => {
          await runPreview([target]);
        }}
      />
    </>
  );
};

export default Outcome;
