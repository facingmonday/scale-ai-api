import React, { useCallback, useEffect, useMemo, useState } from "react";
import outcomeService from "@/services/outcome";
import challengeService from "@/services/challenge";
import decisionService from "@/services/decision";
import type { Outcome as ScenarioOutcomeModel } from "@/types/outcome";
import { useAuth } from "@/context/AuthContext";
import { useGlobalContext } from "@/context/GlobalContext";
import { getErrorMessage } from "@/utils";
import AITextField from "./AIComponents/AITextField";
import type { Challenge } from "@/types/challenge";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";

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
};

const Outcome: React.FC<ScenarioOutcomeProps> = ({
  challengeId,
  challenge,
  className,
  title = "Challenge outcome",
  onChange,
  onExtendDeadline,
  onChallengeUpdated,
}) => {
  const { userRole } = useAuth();
  const global = useGlobalContext();

  const effectiveRole = userRole ?? "org:member";
  const isAdmin = effectiveRole === "org:admin";

  const [outcome, setOutcome] = useState<ScenarioOutcomeModel | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReleasingFeedback, setIsReleasingFeedback] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [hiddenNotesDraft, setHiddenNotesDraft] = useState("");
  const [randomEventChancePercent, setRandomEventChancePercent] = useState<
    number | null
  >(0);
  const [missingSubmissionCount, setMissingSubmissionCount] = useState<
    number | null
  >(null);
  const [
    autoGenerateSubmissionsOnOutcome,
    setAutoGenerateSubmissionsOnOutcome,
  ] = useState<"USE_AI" | "FORWARD_PREVIOUS" | "USE_DEFAULTS" | "SKIP" | null>(
    null,
  );
  const [punishAbsentStudents, setPunishAbsentStudents] = useState<
    "high" | "medium" | "low" | "none" | null
  >(null);

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
        setRandomEventChancePercent(next.randomEventChancePercent ?? 0);
        setAutoGenerateSubmissionsOnOutcome(
          next.autoGenerateSubmissionsOnOutcome || null,
        );
        setPunishAbsentStudents(next.punishAbsentStudents || null);
      } else {
        setNotesDraft("");
        setHiddenNotesDraft("");
        setRandomEventChancePercent(0);
        setAutoGenerateSubmissionsOnOutcome(null);
        setPunishAbsentStudents(null);
      }
    } catch (err) {
      // Common: 404 when no outcome exists (or not yet approved for students)
      setOutcome(null);
      onChange?.(null);
      setNotesDraft("");
      setHiddenNotesDraft("");
      setRandomEventChancePercent(0);

      // Only log error if it's an admin view (students commonly "don't have it yet")
      if (isAdmin) {
        console.error("Failed to fetch challenge outcome:", err);
      }
      setAutoGenerateSubmissionsOnOutcome(null);
      setPunishAbsentStudents(null);
    } finally {
      setIsLoading(false);
    }
  }, [challengeId, isAdmin, onChange]);

  useEffect(() => {
    void fetchOutcome();
  }, [fetchOutcome]);

  const fetchMissingSubmissions = useCallback(async () => {
    if (!challengeId || !isAdmin) return;

    try {
      const {
        data: { missingSubmissions },
      } = await decisionService.getMissingSubmissionsForScenario(challengeId);
      setMissingSubmissionCount(missingSubmissions?.length ?? 0);
    } catch (err) {
      console.error("Failed to fetch missing decisions:", err);
      setMissingSubmissionCount(null);
    }
  }, [challengeId, isAdmin]);

  useEffect(() => {
    if (isEditing && isAdmin) {
      void fetchMissingSubmissions();
    }
  }, [isEditing, isAdmin, fetchMissingSubmissions]);

  const buildPayload = useCallback(
    () => ({
      notes: notesDraft.trim() || undefined,
      hiddenNotes: hiddenNotesDraft.trim() || undefined,
      randomEventChancePercent:
        randomEventChancePercent !== null
          ? randomEventChancePercent
          : undefined,
      autoGenerateSubmissionsOnOutcome:
        autoGenerateSubmissionsOnOutcome || undefined,
      punishAbsentStudents: punishAbsentStudents || undefined,
    }),
    [
      notesDraft,
      hiddenNotesDraft,
      randomEventChancePercent,
      autoGenerateSubmissionsOnOutcome,
      punishAbsentStudents,
    ],
  );

  const handleSaveDraft = useCallback(async () => {
    if (!challengeId) return;
    if (!isAdmin) return;

    setIsSaving(true);
    try {
      global?.showToast("Saving outcome draft...", "loading");
      await outcomeService.saveOutcomeDraft(challengeId, buildPayload());
      global?.showToast("Outcome draft saved", "success");
      setIsEditing(false);
      await fetchOutcome();
    } catch (err) {
      console.error("Failed to save challenge outcome draft:", err);
      const errorMessage = getErrorMessage(err);
      global?.showToast(errorMessage, "error");
    } finally {
      setIsSaving(false);
    }
  }, [challengeId, isAdmin, buildPayload, fetchOutcome, global]);

  const handleProcessNow = useCallback(async () => {
    if (!challengeId) return;
    if (!isAdmin) return;

    setIsSaving(true);
    try {
      global?.showToast("Processing outcome...", "loading");
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
  }, [challengeId, isAdmin, buildPayload, fetchOutcome, global]);

  const addOutcomeDisabled = useMemo(() => {
    return !challenge;
  }, [challenge]);

  const showReleaseFeedback = useMemo(() => {
    if (!isAdmin || !challenge) return false;
    return (
      !!challenge.isClosed &&
      !challenge.isFeedbackReleased &&
      challenge.automationStatus === "processed"
    );
  }, [isAdmin, challenge]);

  const handleReleaseFeedback = useCallback(async () => {
    if (!challengeId) return;

    setIsReleasingFeedback(true);
    try {
      global?.showToast("Releasing feedback...", "loading");
      await challengeService.releaseFeedback(challengeId);
      global?.showToast("Feedback released and students notified", "success");
      await onChallengeUpdated?.();
    } catch (err) {
      console.error("Failed to release feedback:", err);
      const errorMessage = getErrorMessage(err);
      global?.showToast(errorMessage, "error");
    } finally {
      setIsReleasingFeedback(false);
    }
  }, [challengeId, global, onChallengeUpdated]);

  const headerAction = useMemo(() => {
    if (!isAdmin) return null;
    if (isLoading) return null;

    const outcomeAction = !outcome ? (
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
        {onExtendDeadline ? (
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
        {outcomeAction}
      </div>
    );
  }, [
    isAdmin,
    isLoading,
    outcome,
    canEdit,
    addOutcomeDisabled,
    onExtendDeadline,
    showReleaseFeedback,
    handleReleaseFeedback,
    isReleasingFeedback,
  ]);

  return (
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
              {outcome.randomEventChancePercent !== undefined &&
                outcome.randomEventChancePercent > 0 && (
                  <div className="mt-3">
                    <div className="text-sm text-text-secondary mb-1">
                      Random Event Chance
                    </div>
                    <div className="text-sm text-text-primary">
                      {outcome.randomEventChancePercent}%
                    </div>
                  </div>
                )}
            </>
          )}
        </div>
      )}

      {!isLoading && isEditing && (
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

            <div>
              <label
                className="label"
                htmlFor="challenge-outcome-random-event-chance"
              >
                Random Event Chance (%)
              </label>
              <InputNumber
                id="challenge-outcome-random-event-chance"
                value={randomEventChancePercent ?? 0}
                onValueChange={(e) => setRandomEventChancePercent(e.value ?? 0)}
                min={0}
                max={100}
                suffix="%"
                disabled={!isAdmin || isSaving}
                className="input w-full"
              />
              <p className="text-xs text-text-muted mt-1">
                Probability (0-100%) that a random event will occur for this
                challenge outcome. Set to 0 to disable random events.
              </p>
            </div>
          </div>

          {missingSubmissionCount !== null && missingSubmissionCount > 0 && (
            <div className="mt-2 rounded-md border border-ui-border bg-ui-muted px-4 py-4">
              <div className="mb-3">
                <p className="text-base font-medium text-text-primary">
                  {missingSubmissionCount}{" "}
                  {missingSubmissionCount === 1
                    ? "student has"
                    : "students have"}{" "}
                  not submitted for this challenge.
                </p>
                <p className="text-sm text-text-secondary mt-1">
                  What would you like to do with students who haven't filled out
                  a decision?
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 cursor-pointer w-full">
                  <input
                    type="radio"
                    name="auto-generate"
                    checked={
                      autoGenerateSubmissionsOnOutcome === "SKIP" ||
                      autoGenerateSubmissionsOnOutcome === null
                    }
                    onChange={() => {
                      setAutoGenerateSubmissionsOnOutcome("SKIP");
                      setPunishAbsentStudents("none");
                    }}
                    className="flex-shrink-0"
                    style={{ scale: 1.2 }}
                  />
                  <span className="text-sm text-text-primary">
                    Skip unsubmitted students
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer w-full">
                  <input
                    type="radio"
                    name="auto-generate"
                    value="USE_DEFAULTS"
                    checked={
                      autoGenerateSubmissionsOnOutcome === "USE_DEFAULTS"
                    }
                    onChange={() =>
                      setAutoGenerateSubmissionsOnOutcome("USE_DEFAULTS")
                    }
                    style={{ scale: 1.2 }}
                    className="flex-shrink-0"
                  />
                  <span className="text-sm text-text-primary">
                    Use default values
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer w-full">
                  <input
                    type="radio"
                    name="auto-generate"
                    value="FORWARD_PREVIOUS"
                    checked={
                      autoGenerateSubmissionsOnOutcome === "FORWARD_PREVIOUS"
                    }
                    onChange={() =>
                      setAutoGenerateSubmissionsOnOutcome("FORWARD_PREVIOUS")
                    }
                    className="flex-shrink-0"
                    style={{ scale: 1.2 }}
                  />
                  <div>
                    <span className="text-sm text-text-primary">
                      Use previous decision from the student
                    </span>
                    {autoGenerateSubmissionsOnOutcome ===
                      "FORWARD_PREVIOUS" && (
                        <p className="text-xs text-text-muted mt-1">
                          Students who have never made a decision will have one
                          created using AI.
                        </p>
                      )}
                  </div>
                </label>
              </div>
              {autoGenerateSubmissionsOnOutcome !== null &&
                autoGenerateSubmissionsOnOutcome !== "SKIP" && (
                  <div className="mt-4">
                    <label className="label">
                      Punishment level for absent students
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={
                          punishAbsentStudents === null
                            ? "btn-teal"
                            : "btn-outline"
                        }
                        onClick={() => setPunishAbsentStudents(null)}
                        disabled={!isAdmin || isSaving}
                      >
                        No punishment
                      </button>
                      <button
                        type="button"
                        className={
                          punishAbsentStudents === "low"
                            ? "btn-teal"
                            : "btn-outline"
                        }
                        onClick={() => setPunishAbsentStudents("low")}
                        disabled={!isAdmin || isSaving}
                      >
                        Low
                      </button>
                      <button
                        type="button"
                        className={
                          punishAbsentStudents === "medium"
                            ? "btn-teal"
                            : "btn-outline"
                        }
                        onClick={() => setPunishAbsentStudents("medium")}
                        disabled={!isAdmin || isSaving}
                      >
                        Medium
                      </button>
                      <button
                        type="button"
                        className={
                          punishAbsentStudents === "high"
                            ? "btn-teal"
                            : "btn-outline"
                        }
                        onClick={() => setPunishAbsentStudents("high")}
                        disabled={!isAdmin || isSaving}
                      >
                        High
                      </button>
                    </div>
                    {autoGenerateSubmissionsOnOutcome ===
                      "FORWARD_PREVIOUS" && (
                        <p className="text-xs text-text-muted mt-2">
                          Note: Will only apply to students who have never made a
                          decision.
                        </p>
                      )}
                  </div>
                )}
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                setIsEditing(false);
                setNotesDraft(outcome?.notes || "");
                setHiddenNotesDraft(outcome?.hiddenNotes || "");
                setRandomEventChancePercent(
                  outcome?.randomEventChancePercent ?? 0,
                );
                setAutoGenerateSubmissionsOnOutcome(
                  outcome?.autoGenerateSubmissionsOnOutcome || null,
                );
                setPunishAbsentStudents(outcome?.punishAbsentStudents || null);
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
  );
};

export default Outcome;
