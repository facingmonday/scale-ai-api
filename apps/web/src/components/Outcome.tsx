import React, { useCallback, useEffect, useMemo, useState } from "react";
import outcomeService from "@/services/outcome";
import challengeService from "@/services/challenge";
import type { Outcome as ScenarioOutcomeModel } from "@/types/outcome";
import { useAuth } from "@/context/AuthContext";
import { useGlobalContext } from "@/context/GlobalContext";
import { getErrorMessage } from "@/utils";
import AITextField from "./AIComponents/AITextField";
import type { Challenge } from "@/types/challenge";
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
  const [locallyReleasedChallengeId, setLocallyReleasedChallengeId] = useState<
    string | null
  >(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [hiddenNotesDraft, setHiddenNotesDraft] = useState("");

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
      } else {
        setNotesDraft("");
        setHiddenNotesDraft("");
      }
    } catch (err) {
      // Common: 404 when no outcome exists (or not yet approved for students)
      setOutcome(null);
      onChange?.(null);
      setNotesDraft("");
      setHiddenNotesDraft("");

      // Only log error if it's an admin view (students commonly "don't have it yet")
      if (isAdmin) {
        console.error("Failed to fetch challenge outcome:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [challengeId, isAdmin, onChange]);

  useEffect(() => {
    void fetchOutcome();
  }, [fetchOutcome]);

  const buildPayload = useCallback(
    () => ({
      notes: notesDraft.trim() || undefined,
      hiddenNotes: hiddenNotesDraft.trim() || undefined,
    }),
    [notesDraft, hiddenNotesDraft],
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
      locallyReleasedChallengeId !== challengeId &&
      challenge.automationStatus === "processed"
    );
  }, [isAdmin, challenge, locallyReleasedChallengeId, challengeId]);

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

          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                setIsEditing(false);
                setNotesDraft(outcome?.notes || "");
                setHiddenNotesDraft(outcome?.hiddenNotes || "");
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
