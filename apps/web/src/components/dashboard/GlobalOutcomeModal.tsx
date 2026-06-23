import React, { useEffect, useState, useCallback, useMemo } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useGlobalContext } from "@/context/GlobalContext";
import { useAuth } from "@/context/AuthContext";
import outcomeService from "@/services/outcome";
import type { Outcome } from "@/types/outcome";
import type { VariableDefinition } from "@/types/variableDefinition";
import type { VariableDefinitionWithValue } from "@/types/decision";
import { getErrorMessage } from "@/utils";
import VariablesForm from "@/components/VariablesForm";

interface GlobalOutcomeModalProps {
  visible: boolean;
  activeScenarioId: string | null;
  onHide: () => void;
  onSuccess?: () => void;
}

const GlobalOutcomeModal: React.FC<GlobalOutcomeModalProps> = ({
  visible,
  activeScenarioId,
  onHide,
  onSuccess,
}) => {
  const global = useGlobalContext();
  const { activeClassroom } = useAuth();

  const outcomeDefs = useMemo<VariableDefinition[]>(
    () =>
      (activeClassroom?.variableDefinitions?.outcome as
        | VariableDefinition[]
        | undefined) ?? [],
    [activeClassroom?.variableDefinitions]
  );

  const outcomeForm = useForm<{ outcomeVariables: Record<string, unknown> }>({
    defaultValues: { outcomeVariables: {} },
  });

  const [outcomeDraft, setOutcomeDraft] = useState<{
    notes: string;
    hiddenNotes: string;
    randomEventChancePercent: number;
    autoGenerateSubmissionsOnOutcome:
      | "USE_AI"
      | "FORWARD_PREVIOUS"
      | "USE_DEFAULTS"
      | "SKIP"
      | null;
    punishAbsentStudents: "high" | "medium" | "low" | "none" | null;
  }>({
    notes: "",
    hiddenNotes: "",
    randomEventChancePercent: 0,
    autoGenerateSubmissionsOnOutcome: null,
    punishAbsentStudents: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  const fetchScenarioOutcome = useCallback(async () => {
    if (!activeScenarioId) {
      setOutcomeDraft({
        notes: "",
        hiddenNotes: "",
        randomEventChancePercent: 0,
        autoGenerateSubmissionsOnOutcome: null,
        punishAbsentStudents: null,
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await outcomeService.getOutcome(
        activeScenarioId
      );
      const outcome = (response?.data ??
        response.data ??
        null) as Outcome | null;

      if (outcome) {
        setOutcomeDraft({
          notes: outcome.notes || "",
          hiddenNotes: outcome.hiddenNotes || "",
          randomEventChancePercent: outcome.randomEventChancePercent ?? 0,
          autoGenerateSubmissionsOnOutcome:
            outcome.autoGenerateSubmissionsOnOutcome ?? null,
          punishAbsentStudents: outcome.punishAbsentStudents ?? null,
        });
        const vars =
          (outcome as Outcome & { variables?: Record<string, unknown> })
            .variables ?? {};
        outcomeForm.reset({ outcomeVariables: vars });
      } else {
        setOutcomeDraft({
          notes: "",
          hiddenNotes: "",
          randomEventChancePercent: 0,
          autoGenerateSubmissionsOnOutcome: null,
          punishAbsentStudents: null,
        });
      }
    } catch {
      setOutcomeDraft({
        notes: "",
        hiddenNotes: "",
        randomEventChancePercent: 0,
        autoGenerateSubmissionsOnOutcome: null,
        punishAbsentStudents: null,
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeScenarioId]);

  useEffect(() => {
    if (visible && activeScenarioId) {
      void fetchScenarioOutcome();
    }
  }, [visible, activeScenarioId, fetchScenarioOutcome]);

  const handleSaveOutcome = async () => {
    if (!activeScenarioId) return;
    try {
      global?.showToast("Saving outcome…", "loading");
      await outcomeService.setOutcome(activeScenarioId, {
        notes: outcomeDraft.notes.trim() || undefined,
        hiddenNotes: outcomeDraft.hiddenNotes.trim() || undefined,
        randomEventChancePercent:
          outcomeDraft.randomEventChancePercent > 0
            ? outcomeDraft.randomEventChancePercent
            : undefined,
        autoGenerateSubmissionsOnOutcome:
          outcomeDraft.autoGenerateSubmissionsOnOutcome || undefined,
        punishAbsentStudents: outcomeDraft.punishAbsentStudents || undefined,
      });
      const vars = outcomeForm.getValues("outcomeVariables") ?? {};
      if (Object.keys(vars).length > 0) {
        await outcomeService.updateVariables(activeScenarioId, vars);
      }
      global?.showToast("Outcome saved", "success");
      onHide();
      onSuccess?.();
    } catch (err) {
      console.error("Set outcome failed:", err);
      const errorMessage = getErrorMessage(err);
      global?.showToast(errorMessage, "error");
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-2xl w-full">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="heading-lg">Global outcome</h2>
            <p className="text-text-muted mt-1">
              This is what actually happened this week (applies to everyone).
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onHide}>
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <div>
            <label className="label" htmlFor="outcome-notes">
              Notes
            </label>
            <textarea
              id="outcome-notes"
              className="input"
              rows={4}
              value={outcomeDraft.notes}
              onChange={(e) =>
                setOutcomeDraft((p) => ({
                  ...p,
                  notes: e.target.value,
                }))
              }
              placeholder="Anything students should know about what happened…"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="label" htmlFor="outcome-hidden-notes">
              Hidden Notes (Admin Only)
            </label>
            <textarea
              id="outcome-hidden-notes"
              className="input"
              rows={3}
              value={outcomeDraft.hiddenNotes}
              onChange={(e) =>
                setOutcomeDraft((p) => ({
                  ...p,
                  hiddenNotes: e.target.value,
                }))
              }
              placeholder="Internal notes (not visible to students)…"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="label" htmlFor="outcome-random-chance">
              Random Event Chance (%)
            </label>
            <input
              id="outcome-random-chance"
              type="number"
              min="0"
              max="100"
              className="input"
              value={outcomeDraft.randomEventChancePercent}
              onChange={(e) =>
                setOutcomeDraft((p) => ({
                  ...p,
                  randomEventChancePercent: Number(e.target.value) || 0,
                }))
              }
              placeholder="0"
              disabled={isLoading}
            />
            <div className="text-xs text-text-muted mt-1">
              Percentage chance (0-100) of random events occurring
            </div>
          </div>

          <div>
            <label className="label" htmlFor="outcome-auto-generate">
              Auto-generate decisions on outcome
            </label>
            <select
              id="outcome-auto-generate"
              className="input"
              value={outcomeDraft.autoGenerateSubmissionsOnOutcome || ""}
              onChange={(e) => {
                const nextVal = e.target.value === ""
                  ? null
                  : (e.target.value as
                      | "USE_AI"
                      | "FORWARD_PREVIOUS"
                      | "USE_DEFAULTS");
                setOutcomeDraft((p) => ({
                  ...p,
                  autoGenerateSubmissionsOnOutcome: nextVal,
                  ...(nextVal === null ? { punishAbsentStudents: null } : {}),
                }));
              }}
              disabled={isLoading}
            >
              <option value="">None</option>
              <option value="USE_DEFAULTS">Use Defaults</option>
              <option value="FORWARD_PREVIOUS">Forward Previous</option>
            </select>
          </div>

          {outcomeDraft.autoGenerateSubmissionsOnOutcome && (
            <div>
              <label className="label" htmlFor="outcome-punish-absent">
                Punish Absent Students
              </label>
              <select
                id="outcome-punish-absent"
                className="input"
                value={outcomeDraft.punishAbsentStudents || ""}
                onChange={(e) =>
                  setOutcomeDraft((p) => ({
                    ...p,
                    punishAbsentStudents:
                      e.target.value === ""
                        ? null
                        : (e.target.value as "high" | "medium" | "low" | "none"),
                  }))
                }
                disabled={isLoading}
              >
                <option value="">None</option>
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          )}

          {outcomeDefs.length > 0 && (
            <div className="border-t pt-4">
              <FormProvider {...outcomeForm}>
                <VariablesForm
                  title="Outcome variables"
                  description="Realized values that drive the simulation for this challenge."
                  namePrefix="outcomeVariables"
                  defaultAppliesTo="outcome"
                  showAddButton
                  variables={outcomeDefs.map<VariableDefinitionWithValue>(
                    (def) => ({
                      ...def,
                      value:
                        (outcomeForm.getValues(
                          `outcomeVariables.${def.key}` as
                            | "outcomeVariables"
                            | `outcomeVariables.${string}`
                        ) as string | number | boolean | object) ??
                        (def.defaultValue as
                          | string
                          | number
                          | boolean
                          | object) ??
                        (def.dataType === "number" ? 0 : ""),
                    })
                  )}
                />
              </FormProvider>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            className="btn-outline"
            onClick={onHide}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-teal"
            onClick={() => void handleSaveOutcome()}
            disabled={isLoading}
          >
            Save outcome
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalOutcomeModal;
