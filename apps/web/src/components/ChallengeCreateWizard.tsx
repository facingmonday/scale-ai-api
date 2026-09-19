import ChallengePointsField from "./ChallengePointsField";
import { useEffect, useReducer, useRef, useState } from "react";
import { Dialog } from "primereact/dialog";
import slugify from "slugify";
import challengeService from "../services/challenge";
import { getErrorMessage } from "../utils";
import {
  initialWizardState,
  variableError,
  wizardReducer,
} from "../utils/challengeWizard";
import type {
  WizardChallenge,
  WizardOutcome,
  WizardScheduleProposal,
  WizardStep,
  WizardVariable,
} from "../types/challengeWizard";
import SuggestionControls from "./challengeWizard/SuggestionControls";
import VariableEditor, {
  VariablePreview,
} from "./challengeWizard/VariableEditor";
import ScheduleEditor from "./challengeWizard/ScheduleEditor";

const steps = ["Challenge", "Variables", "Outcome", "Review & schedule"];
const generationSteps: WizardStep[] = ["challenge", "variable", "outcome"];
const labelKey = (label: string) =>
  slugify(label, { lower: true, strict: true });
function textError(error: unknown) {
  const value = error as { response?: { data?: { error?: string } } };
  return value.response?.data?.error || getErrorMessage(error);
}

export default function ChallengeCreateWizard({
  visible,
  classroomId,
  onHide,
  onSuccess,
}: {
  visible: boolean;
  classroomId: string;
  onHide: () => void;
  onSuccess: (id: string) => void;
}) {
  const [state, dispatch] = useReducer(
    wizardReducer,
    undefined,
    initialWizardState,
  );
  const { draft, step, confirmed } = state;
  const [directions, setDirections] = useState(["", "", ""]);
  const [variableSuggestion, setVariableSuggestion] = useState<{
    key: string;
    value: WizardVariable;
  } | null>(null);
  const variableContext = JSON.stringify({
    challenge: draft.challenge,
    variables: draft.variables,
  });
  const currentVariable =
    variableSuggestion?.key === variableContext
      ? variableSuggestion.value
      : null;
  const [editing, setEditing] = useState(false);
  const [editingVariable, setEditingVariable] = useState<number | null>(null);
  const [pointsPossible, setPointsPossible] = useState<number | undefined>();
  const [proposal, setProposal] = useState<WizardScheduleProposal | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleAttempt, setScheduleAttempt] = useState(0);
  const [createError, setCreateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [generation, setGeneration] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (visible) heading.current?.focus();
  }, [step, visible]);
  useEffect(() => {
    if (!visible || proposal) return;
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setScheduleLoading(true);
      setScheduleError(null);
      try {
        const result = await challengeService.wizardSchedule(
          classroomId,
          controller.signal,
        );
        if (!controller.signal.aborted) setProposal(result);
      } catch (error) {
        if (!controller.signal.aborted) setScheduleError(textError(error));
      } finally {
        if (!controller.signal.aborted) setScheduleLoading(false);
      }
    });
    return () => controller.abort();
  }, [visible, classroomId, proposal, scheduleAttempt]);

  const reset = () => {
    dispatch({ type: "reset" });
    setVariableSuggestion(null);
    setDirections(["", "", ""]);
    setProposal(null);
    setPointsPossible(undefined);
    setScheduleError(null);
    setCreateError(null);
    setEditing(false);
    setEditingVariable(null);
    setGeneration((n) => n + 1);
    setScheduleAttempt((n) => n + 1);
  };
  const go = (value: number) => {
    setEditing(false);
    setEditingVariable(null);
    dispatch({ type: "step", value });
  };
  const confirm = (value: 0 | 1 | 2) => {
    setEditing(false);
    setEditingVariable(null);
    dispatch({ type: "confirm", step: value });
  };
  const setVariables = (variables: WizardVariable[]) =>
    dispatch({ type: "variables", value: variables });
  const duplicateKeptVariables =
    new Set(draft.variables.map((v) => labelKey(v.label))).size !==
    draft.variables.length;
  const variablesValid =
    draft.variables.every((v) => !variableError(v)) &&
    !duplicateKeptVariables;
  const duplicate =
    !!currentVariable &&
    draft.variables.some(
      (v) => labelKey(v.label) === labelKey(currentVariable.label),
    );
  const canKeep =
    !!currentVariable &&
    !variableError(currentVariable) &&
    !duplicate &&
    !duplicateKeptVariables &&
    draft.variables.length < 30;
  const keep = (continueToOutcome: boolean) => {
    if (!currentVariable || !canKeep) return;
    setVariables([...draft.variables, currentVariable]);
    setVariableSuggestion(null);
    setEditing(false);
    if (continueToOutcome) confirm(1);
  };
  const canCreate =
    confirmed.every(Boolean) &&
    !!draft.challenge?.title.trim() &&
    !!draft.challenge?.description.trim() &&
    variablesValid &&
    !!draft.outcome?.notes.trim() &&
    !!proposal;
  const create = async () => {
    if (savingRef.current || !canCreate || !proposal) return;
    savingRef.current = true;
    setSaving(true);
    setCreateError(null);
    try {
      const result = await challengeService.createWithWizard(
        classroomId,
        draft,
        proposal.schedule,
        pointsPossible,
      );
      if (!result._id) throw new Error("Creation returned no challenge id.");
      reset();
      onHide();
      onSuccess(result._id);
    } catch (error) {
      const data = (
        error as {
          response?: {
            data?: { code?: string; proposal?: WizardScheduleProposal };
          };
        }
      ).response?.data;
      if (data?.code === "WIZARD_SCHEDULE_STALE" && data.proposal) {
        const fresh = data.proposal;
        setProposal({
          ...fresh,
          schedule: {
            ...proposal.schedule,
            publishAt: fresh.schedule.publishAt,
            submissionDeadlineAt: fresh.schedule.submissionDeadlineAt,
            closeSubmissionsAt: fresh.schedule.closeSubmissionsAt,
            processAt: fresh.schedule.processAt,
            feedbackReleaseAt: fresh.schedule.feedbackReleaseAt,
          },
        });
      }
      setCreateError(textError(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        className="btn-outline"
        disabled={saving}
        onClick={onHide}
      >
        Close
      </button>
      <div className="flex flex-wrap gap-2">
        {step > 0 && (
          <button
            type="button"
            className="btn-outline"
            disabled={saving}
            onClick={() => go(step - 1)}
          >
            Back
          </button>
        )}
        {step === 0 && (
          <button
            type="button"
            className="btn-teal"
            disabled={
              !draft.challenge?.title.trim() ||
              !draft.challenge?.description.trim()
            }
            onClick={() => confirm(0)}
          >
            Continue to variables
          </button>
        )}
        {step === 1 && (
          <>
            <button
              type="button"
              className="btn-outline"
              disabled={!variablesValid}
              onClick={() => confirm(1)}
            >
              {draft.variables.length > 0
                ? "Continue with kept variables"
                : "Skip variables"}
            </button>
            <button
              type="button"
              className="btn-outline"
              disabled={!canKeep}
              onClick={() => keep(false)}
            >
              Keep & add another
            </button>
            <button
              type="button"
              className="btn-teal"
              disabled={
                !canKeep || draft.variables.some((v) => !!variableError(v))
              }
              onClick={() => keep(true)}
            >
              Keep & continue to outcome
            </button>
          </>
        )}
        {step === 2 && (
          <button
            type="button"
            className="btn-teal"
            disabled={!draft.outcome?.notes.trim()}
            onClick={() => confirm(2)}
          >
            Review & schedule
          </button>
        )}
        {step === 3 && (
          <button
            type="button"
            className="btn-teal"
            disabled={!canCreate || saving}
            onClick={() => void create()}
          >
            {saving ? "Creating challenge…" : "Create challenge"}
          </button>
        )}
      </div>
    </div>
  );
  return (
    <Dialog
      header="Create with wizard"
      visible={visible}
      onHide={() => {
        if (!savingRef.current) onHide();
      }}
      modal
      closable={!saving}
      dismissableMask={false}
      closeOnEscape={!saving}
      className="modal w-full max-w-4xl"
      maskClassName="modal-mask"
      headerClassName="modal-header"
      contentClassName="modal-content"
      pt={{
        headerTitle: { className: "modal-title" },
        footer: { className: "modal-footer" },
      }}
      footer={footer}
    >
      <fieldset disabled={saving} className="min-w-0 space-y-5 border-0 p-0">
        <div className="flex items-start justify-between gap-3">
          <ol className="flex flex-wrap gap-2" aria-label="Creation progress">
            {steps.map((name, i) => (
              <li key={name}>
                <button
                  type="button"
                  className={`rounded-full border px-3 py-2 text-xs font-medium ${i === step ? "border-brand-teal bg-brand-teal/10 text-text-primary" : "border-ui-border text-text-secondary"}`}
                  aria-current={i === step ? "step" : undefined}
                  disabled={
                    (i > 0 && !draft.challenge) ||
                    (i > 1 && !draft.variables.length && !confirmed[1]) ||
                    (i > 2 && !draft.outcome)
                  }
                  onClick={() => go(i)}
                >
                  {i + 1}. {name}
                  {i < 3 && confirmed[i] ? " ✓" : ""}
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="shrink-0 text-xs text-text-muted underline"
            onClick={reset}
          >
            Start over
          </button>
        </div>
        <div>
          <h2
            ref={heading}
            tabIndex={-1}
            className="text-xl font-semibold outline-none"
          >
            {steps[step]}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {
              [
                "Choose an idea inspired by this classroom. Regenerate until one fits.",
                "Keep the extra decisions you want, or skip to use only the classroom's decision fields.",
                "Choose what happened and how it should affect the simulation.",
                "Review your choices and schedule. Everything is saved together when you create.",
              ][step]
            }
          </p>
        </div>
        {step > 0 &&
          step < 3 &&
          !confirmed[step] &&
          (step === 1 ? draft.variables.length > 0 : !!draft.outcome) && (
            <p className="rounded-lg border border-brand-blue/20 bg-brand-blue/10 p-3 text-sm">
              Review this step against your current selections, then continue to
              confirm it.
            </p>
          )}
        {step === 0 &&
          (draft.challenge ? (
            <div className="space-y-3 rounded-xl border border-ui-border p-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-sm text-text-brand underline"
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? "Done editing" : "Edit"}
                </button>
              </div>
              {editing ? (
                <>
                  <label className="block">
                    <span className="label">Title</span>
                    <input
                      className="input mt-1 w-full"
                      maxLength={300}
                      value={draft.challenge.title}
                      onChange={(e) =>
                        dispatch({
                          type: "challenge",
                          value: { ...draft.challenge!, title: e.target.value },
                        })
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="label">Scenario</span>
                    <textarea
                      className="input mt-1 w-full"
                      rows={7}
                      maxLength={12000}
                      value={draft.challenge.description}
                      onChange={(e) =>
                        dispatch({
                          type: "challenge",
                          value: {
                            ...draft.challenge!,
                            description: e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold">
                    {draft.challenge.title}
                  </h3>
                  <p className="whitespace-pre-wrap leading-relaxed text-text-secondary">
                    {draft.challenge.description}
                  </p>
                </>
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-text-muted" role="status">
              Finding your next challenge…
            </p>
          ))}
        {step === 1 && (
          <div className="space-y-4">
            {duplicateKeptVariables && (
              <p className="text-sm text-red-500" role="alert">
                Two kept variables have the same question. Edit or remove a
                duplicate before continuing.
              </p>
            )}
            {draft.variables.length > 0 && (
              <section className="space-y-2">
                <h3 className="font-semibold">
                  Kept variables ({draft.variables.length})
                </h3>
                {draft.variables.map((v, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-ui-border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-medium">
                        {i + 1}. {v.label}
                      </span>
                      <span className="flex shrink-0 gap-3">
                        <button
                          type="button"
                          className="text-xs text-text-brand underline"
                          aria-label={`Edit variable ${i + 1}`}
                          onClick={() =>
                            setEditingVariable(editingVariable === i ? null : i)
                          }
                        >
                          {editingVariable === i ? "Done" : "Edit"}
                        </button>
                        <button
                          type="button"
                          className="text-xs text-red-500 underline"
                          aria-label={`Remove variable ${i + 1}`}
                          onClick={() => {
                            setVariables(
                              draft.variables.filter((_, index) => index !== i),
                            );
                            setEditingVariable(null);
                          }}
                        >
                          Remove
                        </button>
                      </span>
                    </div>
                    {editingVariable === i && (
                      <div className="mt-3">
                        <VariableEditor
                          value={v}
                          onChange={(next) =>
                            setVariables(
                              draft.variables.map((item, index) =>
                                index === i ? next : item,
                              ),
                            )
                          }
                        />
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )}
            {currentVariable ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Suggested next variable</h3>
                  <button
                    type="button"
                    className="text-sm text-text-brand underline"
                    onClick={() => setEditing(!editing)}
                  >
                    {editing ? "Done editing" : "Edit"}
                  </button>
                </div>
                {editing ? (
                  <VariableEditor
                    value={currentVariable}
                    onChange={(value) =>
                      setVariableSuggestion({ key: variableContext, value })
                    }
                  />
                ) : (
                  <VariablePreview
                    key={JSON.stringify(currentVariable)}
                    value={currentVariable}
                  />
                )}
                {duplicate && (
                  <p className="text-sm text-red-500" role="alert">
                    This question is already in your kept variables.
                  </p>
                )}
              </section>
            ) : (
              <p className="py-6 text-center text-text-muted" role="status">
                Finding a complementary decision…
              </p>
            )}
            {draft.variables.length >= 30 && (
              <p className="text-sm text-text-muted">
                You have reached 30 variables. Continue with your kept
                variables.
              </p>
            )}
          </div>
        )}
        {step === 2 &&
          (draft.outcome ? (
            <div className="space-y-4">
              {(["notes", "hiddenNotes"] as const).map((field) => (
                <label
                  key={field}
                  className="block rounded-xl border border-ui-border p-4"
                >
                  <span className="font-semibold">
                    {field === "notes"
                      ? "Public outcome"
                      : "Hidden guidance (optional)"}
                  </span>
                  <p className="my-2 text-xs text-text-muted">
                    {field === "notes"
                      ? "Students can see this when results are released."
                      : "Optional direction for how the event affects the available profile types. Classroom settings handle the calculations. Never shown directly to students."}
                  </p>
                  <textarea
                    className="input w-full"
                    rows={field === "notes" ? 5 : 3}
                    maxLength={12000}
                    placeholder={
                      field === "hiddenNotes"
                        ? "For example, rain may reduce demand at outdoor venues and increase it at indoor stores. Leave blank if no additional guidance is needed."
                        : undefined
                    }
                    value={draft.outcome![field]}
                    onChange={(e) =>
                      dispatch({
                        type: "outcome",
                        value: { ...draft.outcome!, [field]: e.target.value },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-text-muted" role="status">
              Preparing an outcome and optional guidance…
            </p>
          ))}
        {generationSteps.map((generationStep, i) => (
          <SuggestionControls
            key={`${generation}:${generationStep}`}
            active={
              visible && step === i && (i !== 1 || editingVariable === null)
            }
            request={{
              classroomId,
              step: generationStep,
              draft:
                i === 0
                  ? {}
                  : { challenge: draft.challenge, variables: draft.variables },
            }}
            hasSelection={
              i === 0
                ? !!draft.challenge
                : i === 1
                  ? !!currentVariable
                  : !!draft.outcome
            }
            direction={directions[i]}
            onDirection={(value) =>
              setDirections(
                directions.map((d, index) => (index === i ? value : d)),
              )
            }
            onSelect={(value) => {
              setEditing(false);
              if (i === 0)
                dispatch({
                  type: "challenge",
                  value: value as WizardChallenge,
                });
              else if (i === 1)
                setVariableSuggestion({
                  key: variableContext,
                  value: value as WizardVariable,
                });
              else dispatch({ type: "outcome", value: value as WizardOutcome });
            }}
          />
        ))}
        {step === 3 && (
          <div className="space-y-4">
            {!confirmed.every(Boolean) && (
              <p
                className="rounded-lg bg-brand-blue/10 p-3 text-sm"
                role="status"
              >
                Earlier choices changed. Revisit and confirm each section marked
                “Needs review” before creating.
              </p>
            )}
            {steps.slice(0, 3).map((name, i) => (
              <section
                key={name}
                className="rounded-xl border border-ui-border p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="font-semibold">
                    {name}
                    {!confirmed[i] && (
                      <span className="ml-2 text-xs text-text-muted">
                        Needs review
                      </span>
                    )}
                  </h3>
                  <button
                    type="button"
                    className="text-sm text-text-brand underline"
                    onClick={() => go(i)}
                  >
                    Review {name.toLowerCase()}
                  </button>
                </div>
                {i === 0 && (
                  <>
                    <h4 className="font-medium">{draft.challenge?.title}</h4>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">
                      {draft.challenge?.description}
                    </p>
                  </>
                )}
                {i === 1 && (draft.variables.length > 0 ? (
                  <ol className="list-decimal space-y-3 pl-5">
                    {draft.variables.map((v, index) => (
                      <li key={index} className="text-sm">
                        <p className="font-medium">{v.label}</p>
                        <p className="text-text-secondary">{v.description}</p>
                        <p className="text-xs text-text-muted">
                          {v.inputType} · Default: {String(v.defaultValue)}
                          {v.min !== null || v.max !== null
                            ? ` · Range: ${v.min ?? "unbounded"}–${v.max ?? "unbounded"}`
                            : ""}
                          {v.options.length
                            ? ` · Options: ${v.options.join(", ")}`
                            : ""}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-text-secondary">
                    No challenge-specific variables. Classroom decision fields still apply.
                  </p>
                ))}
                {i === 2 && (
                  <>
                    <p className="text-xs font-semibold text-text-muted">
                      PUBLIC OUTCOME · Visible when results are released
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {draft.outcome?.notes}
                    </p>
                    <p className="mt-4 text-xs font-semibold text-text-muted">
                      HIDDEN GUIDANCE · Optional · Instructor only
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {draft.outcome?.hiddenNotes.trim() ||
                        "No additional guidance. Classroom calculation settings apply."}
                    </p>
                  </>
                )}
              </section>
            ))}
            <ChallengePointsField key={classroomId} classroomId={classroomId} value={pointsPossible} onChange={setPointsPossible} disabled={saving} />
            {proposal ? (
              <ScheduleEditor
                proposal={proposal}
                onChange={(schedule) => setProposal({ ...proposal, schedule })}
              />
            ) : (
              <p role="status">
                {scheduleLoading
                  ? "Preparing schedule…"
                  : "Schedule unavailable."}
              </p>
            )}
            {scheduleError && (
              <p role="alert" className="text-sm text-red-500">
                {scheduleError}{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => setScheduleAttempt((n) => n + 1)}
                >
                  Retry schedule
                </button>
              </p>
            )}
            {createError && (
              <p
                role="alert"
                className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500"
              >
                {createError}
              </p>
            )}
          </div>
        )}
      </fieldset>
    </Dialog>
  );
}
