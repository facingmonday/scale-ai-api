import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import challengeService from "../../../services/challenge";
import variableDefinitionsService from "../../../services/variableDefinition";
import type { VariableDefinition } from "../../../types/variableDefinition";
import Outcome from "@/components/Outcome";
import { useAuth } from "@/context/AuthContext";
import VariablesForm from "@/components/VariablesForm";
import ScenarioSubmissionsList from "@/components/ChallengeDecisionsList";
import { Controller, FormProvider, useForm } from "react-hook-form";
import type { ScenarioWithVariables } from "@/types/challenge";
import type { VariableDefinitionWithValue } from "@/types/decision";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { useGlobalContext } from "@/context/GlobalContext";
import { getErrorMessage } from "@/utils";
import MetricCard from "@/components/dashboard/MetricCard";
import profileTypeService from "../../../services/profileType";
import type { ProfileType as StoreTypeModel } from "../../../types/profileType";
import Image from "../../../components/AIComponents/Image/Image";
import LoadingOverlay from "../../../components/LoadingOverlay";
import ScenarioDeleteAction from "@/components/ChallengeDeleteAction";
import ScenarioResetSubmissionsAction from "@/components/ChallengeResetDecisionsAction";
import ScenarioCancelBatchAndReRun from "@/components/ChallengeCancelBatchAndReRun";
import ScenarioRemoveOutcomeAction from "@/components/ChallengeRemoveOutcomeAction";
import ScenarioStoreTypeSummary from "@/components/ChallengeProfileTypeSummary";
import MissingScenarioSubmissionsList from "@/components/MissingChallengeDecisionsList";

const toDateTimeLocalValue = (value?: string | Date | null) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const Challenge: React.FC = () => {
  const { activeClassroom } = useAuth();
  const globalContext = useGlobalContext();
  const { id } = useParams<{ id: string }>();
  const [challenge, setScenario] = useState<ScenarioWithVariables | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [scenarioVariableDefinitions, setScenarioVariableDefinitions] =
    useState<VariableDefinitionWithValue[]>([]);
  const [storeTypeLabelMap, setStoreTypeLabelMap] = useState<
    Record<string, string>
  >({});

  const form = useForm<{
    title: string;
    description: string;
    imageUrl?: string;
    publishAt?: string;
    submissionDeadlineAt?: string;
    closeSubmissionsAt?: string;
    processAt?: string;
    feedbackReleaseAt?: string;
    feedbackReleaseMode: "IMMEDIATE" | "DELAYED" | "MANUAL";
    allowLateSubmissions: boolean;
    lateSubmissionPolicy: {
      penaltyPercentPerDay: number;
    };
    automationMode: "MANUAL" | "FULL";
    missingSubmissionPolicy: "FORWARD_PREVIOUS" | "USE_DEFAULTS" | "SKIP";
    punishAbsentStudents: "high" | "medium" | "low" | "none";
    variables: Record<string, unknown>;
  }>({
    defaultValues: {
      title: "",
      description: "",
      imageUrl: "",
      publishAt: "",
      submissionDeadlineAt: "",
      closeSubmissionsAt: "",
      processAt: "",
      feedbackReleaseAt: "",
      feedbackReleaseMode: "IMMEDIATE",
      allowLateSubmissions: false,
      lateSubmissionPolicy: {
        penaltyPercentPerDay: 0,
      },
      automationMode: "MANUAL",
      missingSubmissionPolicy: "SKIP",
      punishAbsentStudents: "none",
      variables: {},
    },
    mode: "onChange",
  });

  const fetchScenario = useCallback(
    async (silent = false) => {
      if (!id) return;

      if (!silent) {
        setIsLoading(true);
        setError(null);
      }

      try {
        // Fetch challenge
        const response = await challengeService.getById(id, "admin");
        const next = (response.data || response) as ScenarioWithVariables;
        setScenario(next);

        // Get challenge variable definitions from API
        const varDefsResponse = await variableDefinitionsService.getAll(
          next.classroomId,
          "challenge",
          next._id,
        );
        const scenarioDefs = (
          (varDefsResponse?.data ??
            varDefsResponse ??
            []) as VariableDefinition[]
        ).filter((def) => def.appliesTo === "challenge");

        // Merge variable definitions with existing challenge values
        // This ensures all definitions are shown, even if challenge hasn't filled them out yet
        const scenarioVariables =
          (next.variables as Record<string, unknown> | undefined) ?? {};

        // Filter: active defs for creation; active OR key in challenge for historical display
        const scenarioDefsForForm = scenarioDefs.filter(
          (def) =>
            def.isActive ||
            Object.prototype.hasOwnProperty.call(scenarioVariables, def.key),
        );
        const variablesWithValues: VariableDefinitionWithValue[] =
          scenarioDefsForForm.map((def) => ({
            ...def,
            value:
              scenarioVariables[def.key] ??
              def.defaultValue ??
              (def.dataType === "number" ? 0 : ""),
          }));

        setScenarioVariableDefinitions(variablesWithValues);

        // Convert to Record format for form
        const variablesRecord = variablesWithValues.reduce(
          (acc, variable) => {
            acc[variable.key] = variable.value;
            return acc;
          },
          {} as Record<string, unknown>,
        );

        form.reset(
          {
            title: next.title || (next as { name?: string }).name || "",
            description: next.description || "",
            imageUrl: next.imageUrl || "",
            publishAt: toDateTimeLocalValue(next.publishAt),
            submissionDeadlineAt: toDateTimeLocalValue(
              next.submissionDeadlineAt,
            ),
            closeSubmissionsAt: toDateTimeLocalValue(next.closeSubmissionsAt),
            processAt: toDateTimeLocalValue(next.processAt),
            feedbackReleaseAt: toDateTimeLocalValue(next.feedbackReleaseAt),
            feedbackReleaseMode: next.feedbackReleaseMode || "IMMEDIATE",
            allowLateSubmissions: !!next.allowLateSubmissions,
            lateSubmissionPolicy: {
              penaltyPercentPerDay:
                next.lateSubmissionPolicy?.penaltyPercentPerDay ?? 0,
            },
            automationMode: next.automationMode || "MANUAL",
            missingSubmissionPolicy: next.missingSubmissionPolicy || "SKIP",
            punishAbsentStudents: next.punishAbsentStudents || "none",
            variables: variablesRecord,
          },
          { keepDirty: false },
        );

        // Auto-enable editing for newly created challenges (no variables set yet)
        // If the challenge has no variables from the API, it's a new challenge
        if (Object.keys(scenarioVariables).length === 0) {
          setIsEditing(true);
        }
      } catch (err) {
        console.error("Failed to fetch challenge:", err);
        if (!silent) {
          setError("Failed to load challenge");
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [form, id, activeClassroom],
  );

  const fetchStoreTypes = useCallback(async () => {
    const classroomId = activeClassroom?._id;
    if (!classroomId) return;
    try {
      const response = await profileTypeService.getAll("admin", {
        classroomId,
      });
      const raw = response?.data ?? response;
      const fetchedStoreTypes: StoreTypeModel[] = Array.isArray(raw)
        ? (raw as StoreTypeModel[])
        : [];

      // Create lookup map from profile type ID to label
      const labelMap: Record<string, string> = {};
      for (const profileType of fetchedStoreTypes) {
        if (profileType._id) {
          labelMap[profileType._id] = profileType.label;
        }
      }
      setStoreTypeLabelMap(labelMap);
    } catch (err) {
      console.error("Failed to fetch profile types:", err);
    }
  }, [activeClassroom?._id]);

  useEffect(() => {
    if (id) {
      void fetchScenario();
    }
  }, [id, fetchScenario]);

  useEffect(() => {
    if (activeClassroom?._id) {
      void fetchStoreTypes();
    }
  }, [fetchStoreTypes, activeClassroom?._id]);

  useEffect(() => {
    const handleFocus = () => {
      if (id) {
        void fetchScenario(true);
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [id, fetchScenario]);

  // Watch variables to ensure they're tracked by the form
  const watchedVariables = form.watch("variables");
  const watchedImageUrl = form.watch("imageUrl");
  const watchedDescription = form.watch("description");
  const watchedAllowLateSubmissions = form.watch("allowLateSubmissions");
  const watchedFeedbackReleaseMode = form.watch("feedbackReleaseMode");

  const onSave = form.handleSubmit(async (values) => {
    if (!id) return;
    try {
      // Get the current form values to ensure we have the latest variables
      // Use watched variables if available, otherwise fall back to form values
      const currentValues = form.getValues();
      const variablesToSave =
        watchedVariables ?? currentValues.variables ?? values.variables ?? {};

      await challengeService.update(id, {
        title: values.title.trim(),
        description: values.description.trim(),
        imageUrl: values.imageUrl?.trim() || undefined,
        publishAt: values.publishAt || null,
        submissionDeadlineAt: values.submissionDeadlineAt || null,
        closeSubmissionsAt: values.closeSubmissionsAt || null,
        processAt: values.processAt || null,
        feedbackReleaseAt: values.feedbackReleaseAt || null,
        feedbackReleaseMode: values.feedbackReleaseMode || "IMMEDIATE",
        allowLateSubmissions: values.allowLateSubmissions,
        lateSubmissionPolicy: {
          penaltyPercentPerDay: Number(
            values.lateSubmissionPolicy?.penaltyPercentPerDay ?? 0,
          ),
        },
        automationMode: values.automationMode || "MANUAL",
        missingSubmissionPolicy: values.missingSubmissionPolicy || "SKIP",
        punishAbsentStudents: values.punishAbsentStudents || "none",
        variables: variablesToSave,
      });
      globalContext?.showToast?.("Challenge saved", "success");
      setIsEditing(false);
      await fetchScenario();
    } catch (e) {
      console.error("Failed to save challenge:", e);
      const errorMessage = getErrorMessage(e);
      globalContext?.showToast?.(errorMessage, "error");
    }
  });

  const handlePublish = async () => {
    if (!id) return;
    if (isPublishing) return;

    setIsPublishing(true);
    try {
      // Check if form has unsaved changes
      const isDirty = form.formState.isDirty;

      if (isDirty) {
        // Save the form data first
        globalContext?.showToast?.("Saving changes...", "loading");

        const currentValues = form.getValues();
        const variablesToSave =
          watchedVariables ??
          currentValues.variables ??
          currentValues.variables ??
          {};

        await challengeService.update(id, {
          title: currentValues.title.trim(),
          description: currentValues.description.trim(),
          imageUrl: currentValues.imageUrl?.trim() || undefined,
          publishAt: currentValues.publishAt || null,
          submissionDeadlineAt: currentValues.submissionDeadlineAt || null,
          closeSubmissionsAt: currentValues.closeSubmissionsAt || null,
          processAt: currentValues.processAt || null,
          feedbackReleaseAt: currentValues.feedbackReleaseAt || null,
          feedbackReleaseMode: currentValues.feedbackReleaseMode || "IMMEDIATE",
          allowLateSubmissions: currentValues.allowLateSubmissions,
          lateSubmissionPolicy: {
            penaltyPercentPerDay: Number(
              currentValues.lateSubmissionPolicy?.penaltyPercentPerDay ?? 0,
            ),
          },
          automationMode: currentValues.automationMode || "MANUAL",
          missingSubmissionPolicy:
            currentValues.missingSubmissionPolicy || "SKIP",
          punishAbsentStudents: currentValues.punishAbsentStudents || "none",
          variables: variablesToSave,
        });
      }

      // Now publish
      globalContext?.showToast?.("Publishing challenge...", "loading");
      await challengeService.publish(id);
      globalContext?.showToast?.("Challenge published successfully", "success");

      // Reset editing state and refresh
      setIsEditing(false);
      await fetchScenario();
    } catch (e) {
      console.error("Failed to publish challenge:", e);
      const errorMessage = getErrorMessage(e);
      globalContext?.showToast?.(errorMessage, "error");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleExtendDeadline = useCallback(() => {
    setIsEditing(true);
    requestAnimationFrame(() => {
      document
        .getElementById("challenge-automation-schedule")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const handleUnpublish = async () => {
    if (!id) return;
    if (isPublishing) return;

    setIsPublishing(true);
    try {
      globalContext?.showToast?.("Unpublishing challenge...", "loading");
      await challengeService.unpublish(id);
      globalContext?.showToast?.(
        "Challenge unpublished successfully",
        "success",
      );
      await fetchScenario();
    } catch (e) {
      console.error("Failed to unpublish challenge:", e);
      const errorMessage = getErrorMessage(e);
      globalContext?.showToast?.(errorMessage, "error");
    } finally {
      setIsPublishing(false);
    }
  };

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
      <LoadingOverlay loading={isLoading} />
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
        <div className="page">
          <div className="container">
            <FormProvider {...form}>
              <div className="flex items-center justify-between mb-4">
                <h1 className="heading-xl">
                  {challenge.title || (challenge as { name?: string }).name}
                  {/* Status badge */}
                  {challenge.isClosed ? (
                    <span className="badge badge-danger ml-4 align-middle">
                      Closed
                    </span>
                  ) : challenge.isPublished ? (
                    <span className="badge badge-success ml-4 align-middle">
                      Published
                    </span>
                  ) : (
                    <span className="badge badge-muted ml-4 align-middle">
                      Unpublished
                    </span>
                  )}
                </h1>
                <div className="flex gap-2">
                  {!isEditing && !challenge.isClosed ? (
                    <button
                      className="btn-outline"
                      onClick={() => setIsEditing(true)}
                      type="button"
                    >
                      Edit
                    </button>
                  ) : null}
                  {isEditing ? (
                    <>
                      <button
                        className="btn-outline"
                        onClick={() => {
                          setIsEditing(false);
                          const variablesRecord =
                            scenarioVariableDefinitions.reduce(
                              (acc, variable) => {
                                acc[variable.key] = variable.value;
                                return acc;
                              },
                              {} as Record<string, unknown>,
                            );
                          form.reset({
                            title:
                              challenge.title ||
                              (challenge as { name?: string }).name ||
                              "",
                            description: challenge.description || "",
                            imageUrl: challenge.imageUrl || "",
                            publishAt: toDateTimeLocalValue(
                              challenge.publishAt,
                            ),
                            submissionDeadlineAt: toDateTimeLocalValue(
                              challenge.submissionDeadlineAt,
                            ),
                            closeSubmissionsAt: toDateTimeLocalValue(
                              challenge.closeSubmissionsAt,
                            ),
                            processAt: toDateTimeLocalValue(
                              challenge.processAt,
                            ),
                            feedbackReleaseAt: toDateTimeLocalValue(
                              challenge.feedbackReleaseAt,
                            ),
                            feedbackReleaseMode:
                              challenge.feedbackReleaseMode || "IMMEDIATE",
                            allowLateSubmissions:
                              !!challenge.allowLateSubmissions,
                            lateSubmissionPolicy: {
                              penaltyPercentPerDay:
                                challenge.lateSubmissionPolicy
                                  ?.penaltyPercentPerDay ?? 0,
                            },
                            automationMode:
                              challenge.automationMode || "MANUAL",
                            missingSubmissionPolicy:
                              challenge.missingSubmissionPolicy || "SKIP",
                            punishAbsentStudents:
                              challenge.punishAbsentStudents || "none",
                            variables: variablesRecord,
                          });
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        className={`btn-teal ${
                          !form.formState.isDirty ? "disabled:opacity-50" : ""
                        }`}
                        onClick={() => void onSave()}
                        type="button"
                        disabled={!form.formState.isDirty}
                      >
                        Save
                      </button>
                    </>
                  ) : null}
                  {!isEditing && !challenge.isClosed ? (
                    challenge.isPublished ? (
                      <button
                        className="btn-outline"
                        type="button"
                        onClick={handleUnpublish}
                        disabled={isPublishing}
                      >
                        {isPublishing ? "Unpublishing..." : "Unpublish"}
                      </button>
                    ) : (
                      <button
                        className="btn-teal"
                        type="button"
                        onClick={handlePublish}
                        disabled={isPublishing}
                      >
                        {isPublishing ? "Publishing..." : "Publish"}
                      </button>
                    )
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <div className="card mb-4 sm:w-1/4">
                  <Image
                    src={watchedImageUrl || challenge.imageUrl || ""}
                    context={watchedDescription || challenge.description || ""}
                    onAccept={(imageUrl) => {
                      form.setValue("imageUrl", imageUrl, {
                        shouldDirty: true,
                      });
                    }}
                    disabled={!isEditing || isPublishing}
                  />
                </div>

                {/* Title + Description are part of the same RHF form */}
                <div className="card mb-4 w-full">
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="label" htmlFor="challenge-title">
                        Title
                      </label>
                      <Controller
                        name="title"
                        control={form.control}
                        rules={{ required: true }}
                        render={({ field, fieldState }) => (
                          <InputText
                            id="challenge-title"
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value)}
                            disabled={!isEditing}
                            className={`input ${
                              fieldState.error ? "p-invalid" : ""
                            }`}
                          />
                        )}
                      />
                    </div>

                    <div>
                      <label className="label" htmlFor="challenge-description">
                        Description
                      </label>
                      <Controller
                        name="description"
                        control={form.control}
                        render={({ field }) => (
                          <InputTextarea
                            id="challenge-description"
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value)}
                            disabled={!isEditing}
                            autoResize
                            className="input"
                            rows={4}
                          />
                        )}
                      />
                    </div>

                    <div
                      id="challenge-automation-schedule"
                      className="rounded-lg border border-ui-border bg-ui-surface-muted p-4"
                    >
                      <div className="mb-3">
                        <h2 className="heading-sm">Automation</h2>
                        <p className="text-sm text-text-muted">
                          Configure start, deadline, and automated result
                          generation.
                        </p>
                      </div>

                      {challenge.automationError && (
                        <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                          {challenge.automationError}
                        </div>
                      )}

                      <div className="grid gap-4 md:grid-cols-2">
                        <Controller
                          name="publishAt"
                          control={form.control}
                          render={({ field }) => (
                            <label className="flex flex-col gap-2">
                              <span className="label">Start date</span>
                              <input
                                type="datetime-local"
                                className="input"
                                value={field.value || ""}
                                onChange={(event) =>
                                  field.onChange(event.target.value)
                                }
                                disabled={!isEditing}
                              />
                            </label>
                          )}
                        />

                        <Controller
                          name="submissionDeadlineAt"
                          control={form.control}
                          render={({ field }) => (
                            <label className="flex flex-col gap-2">
                              <span className="label">Submission deadline</span>
                              <input
                                type="datetime-local"
                                className="input"
                                value={field.value || ""}
                                onChange={(event) =>
                                  field.onChange(event.target.value)
                                }
                                disabled={!isEditing}
                              />
                            </label>
                          )}
                        />

                        <Controller
                          name="closeSubmissionsAt"
                          control={form.control}
                          render={({ field }) => (
                            <label className="flex flex-col gap-2">
                              <span className="label">
                                Submissions lock date
                              </span>
                              <input
                                type="datetime-local"
                                className="input"
                                value={field.value || ""}
                                onChange={(event) =>
                                  field.onChange(event.target.value)
                                }
                                disabled={!isEditing}
                              />
                            </label>
                          )}
                        />

                        <Controller
                          name="processAt"
                          control={form.control}
                          render={({ field }) => (
                            <label className="flex flex-col gap-2">
                              <span className="label">
                                Outcome calculation date
                              </span>
                              <input
                                type="datetime-local"
                                className="input"
                                value={field.value || ""}
                                onChange={(event) =>
                                  field.onChange(event.target.value)
                                }
                                disabled={!isEditing}
                              />
                            </label>
                          )}
                        />

                        <Controller
                          name="feedbackReleaseMode"
                          control={form.control}
                          render={({ field }) => (
                            <label className="flex flex-col gap-2">
                              <span className="label">
                                Feedback release mode
                              </span>
                              <select
                                className="input"
                                value={field.value || "IMMEDIATE"}
                                onChange={(event) =>
                                  field.onChange(event.target.value)
                                }
                                disabled={!isEditing}
                              >
                                <option value="IMMEDIATE">
                                  Immediate (on process)
                                </option>
                                <option value="DELAYED">
                                  Delayed (scheduled)
                                </option>
                                <option value="MANUAL">Manual release</option>
                              </select>
                            </label>
                          )}
                        />

                        {watchedFeedbackReleaseMode === "DELAYED" && (
                          <Controller
                            name="feedbackReleaseAt"
                            control={form.control}
                            render={({ field }) => (
                              <label className="flex flex-col gap-2">
                                <span className="label">
                                  Feedback release date
                                </span>
                                <input
                                  type="datetime-local"
                                  className="input"
                                  value={field.value || ""}
                                  onChange={(event) =>
                                    field.onChange(event.target.value)
                                  }
                                  disabled={!isEditing}
                                />
                              </label>
                            )}
                          />
                        )}

                        <Controller
                          name="allowLateSubmissions"
                          control={form.control}
                          render={({ field }) => (
                            <label className="flex flex-col gap-2">
                              <span className="label">
                                Allow late submissions
                              </span>
                              <select
                                className="input"
                                value={field.value ? "true" : "false"}
                                onChange={(event) =>
                                  field.onChange(event.target.value === "true")
                                }
                                disabled={!isEditing}
                              >
                                <option value="false">No</option>
                                <option value="true">Yes</option>
                              </select>
                            </label>
                          )}
                        />

                        {watchedAllowLateSubmissions && (
                          <Controller
                            name="lateSubmissionPolicy.penaltyPercentPerDay"
                            control={form.control}
                            render={({ field }) => (
                              <label className="flex flex-col gap-2">
                                <span className="label">Penalty % per day</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  className="input"
                                  value={field.value ?? 0}
                                  onChange={(event) =>
                                    field.onChange(Number(event.target.value))
                                  }
                                  disabled={!isEditing}
                                />
                              </label>
                            )}
                          />
                        )}

                        <Controller
                          name="automationMode"
                          control={form.control}
                          render={({ field }) => (
                            <label className="flex flex-col gap-2">
                              <span className="label">Automation mode</span>
                              <select
                                className="input"
                                value={field.value || "MANUAL"}
                                onChange={(event) =>
                                  field.onChange(event.target.value)
                                }
                                disabled={!isEditing}
                              >
                                <option value="MANUAL">Manual</option>
                                <option value="FULL">Full automation</option>
                              </select>
                            </label>
                          )}
                        />

                        <Controller
                          name="missingSubmissionPolicy"
                          control={form.control}
                          render={({ field }) => (
                            <label className="flex flex-col gap-2">
                              <span className="label">Missing decisions</span>
                              <select
                                className="input"
                                value={field.value || "SKIP"}
                                onChange={(event) =>
                                  field.onChange(event.target.value)
                                }
                                disabled={!isEditing}
                              >
                                <option value="SKIP">Skip week</option>
                                <option value="FORWARD_PREVIOUS">
                                  Forward previous
                                </option>
                                <option value="USE_DEFAULTS">
                                  Use defaults
                                </option>
                              </select>
                            </label>
                          )}
                        />

                        <Controller
                          name="punishAbsentStudents"
                          control={form.control}
                          render={({ field }) => (
                            <label className="flex flex-col gap-2 md:col-span-2">
                              <span className="label">
                                Punishment for forwarded decisions
                              </span>
                              <select
                                className="input"
                                value={field.value || "none"}
                                onChange={(event) =>
                                  field.onChange(event.target.value)
                                }
                                disabled={!isEditing}
                              >
                                <option value="none">None</option>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                              </select>
                            </label>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {(scenarioVariableDefinitions.length > 0 || isEditing) && (
                <div className="section mb-4">
                  <VariablesForm
                    variables={scenarioVariableDefinitions}
                    readOnly={!isEditing}
                    title="Challenge Variables"
                    description="Configure the variables used for this challenge."
                    showAddButton={isEditing}
                    defaultAppliesTo="challenge"
                    challengeId={id}
                    onSave={() => void fetchScenario()}
                  />
                </div>
              )}
            </FormProvider>

            {challenge.isPublished &&
              activeClassroom?._id &&
              id &&
              !challenge.isClosed && (
                <div className="mb-4">
                  <ScenarioSubmissionsList challengeId={id} />
                </div>
              )}

            {challenge.isPublished &&
              activeClassroom?._id &&
              id &&
              !challenge.isClosed && (
                <div className="mb-4">
                  <MissingScenarioSubmissionsList challengeId={id} />
                </div>
              )}

            <div className="mb-4">
              {isLoading ? (
                <p>Loading...</p>
              ) : (
                <Outcome
                  challengeId={id}
                  challenge={challenge}
                  onExtendDeadline={handleExtendDeadline}
                  onChallengeUpdated={() => fetchScenario(true)}
                />
              )}
            </div>

            {challenge.isPublished &&
              activeClassroom?._id &&
              id &&
              challenge.isClosed &&
              challenge.stats && (
                <div className="mb-4 space-y-6">
                  {/* Profile Type Stats */}
                  {challenge.stats.storeTypeStats &&
                    Object.keys(challenge.stats.storeTypeStats).length > 0 && (
                      <div className="">
                        <div className="flex justify-between gap-2 mb-4 ml-2">
                          <div className="flex items-center gap-2">
                            <i className="pi pi-chart-bar text-2xl text-brand-blue" />
                            <h2 className="heading-md">
                              Profile Type Statistics
                            </h2>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {Object.entries(challenge.stats.storeTypeStats).map(
                            ([profileType, stats]) => (
                              <ScenarioStoreTypeSummary
                                key={profileType}
                                profileType={profileType}
                                stats={stats}
                                storeTypeLabelMap={storeTypeLabelMap}
                                metricDefinitions={
                                  challenge.stats?.metricDefinitions ??
                                  activeClassroom?.metricDefinitions ??
                                  []
                                }
                              />
                            ),
                          )}
                        </div>
                      </div>
                    )}

                  {/* Decisions List */}
                  <div className="mb-4">
                    <div className="flex justify-between items-end gap-2 mb-4">
                      <h2 className="heading-md">Student Decisions</h2>
                      <div className="flex flex-row gap-4">
                        <MetricCard
                          label="Total Enrolled"
                          value={challenge.stats.totalEnrolled}
                          icon="pi-users"
                          iconColor="text-brand-blue"
                        />
                        <MetricCard
                          label="Submitted"
                          value={challenge.stats.submittedCount}
                          icon="pi-check-circle"
                          iconColor="text-green-500"
                        />
                        <MetricCard
                          label="Missing"
                          value={challenge.stats.missingCount}
                          icon="pi-exclamation-circle"
                          iconColor="text-red-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-6">
                      <ScenarioSubmissionsList challengeId={id} />
                      <MissingScenarioSubmissionsList challengeId={id} />
                    </div>
                  </div>
                </div>
              )}

            <div className="card">
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-text-muted text-xs font-medium mb-1">
                    Challenge ID
                  </p>
                  <p className="text-text-muted text-sm">{id}</p>
                </div>
                {challenge.createdDate && (
                  <div>
                    <p className="text-text-muted text-xs font-medium mb-1">
                      Created
                    </p>
                    <p className="text-text-muted text-sm">
                      {new Date(challenge.createdDate).toLocaleString()}
                    </p>
                  </div>
                )}
                {challenge.updatedDate && (
                  <div>
                    <p className="text-text-muted text-xs font-medium mb-1">
                      Last Updated
                    </p>
                    <p className="text-text-muted text-sm">
                      {new Date(challenge.updatedDate).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="card border-2 border-red-500/20 mt-6">
              <h2 className="heading-md text-red-400 mb-4">Danger Zone</h2>
              <p className="text-text-muted text-sm mb-4">
                These actions are irreversible. Please be certain before
                proceeding.
              </p>

              <div className="flex flex-col gap-4">
                {id && (
                  <>
                    <ScenarioResetSubmissionsAction
                      challengeId={id}
                      scenarioName={
                        challenge.title ||
                        (challenge as { name?: string }).name ||
                        undefined
                      }
                      onSuccess={() => void fetchScenario()}
                    />
                    <ScenarioCancelBatchAndReRun
                      challengeId={id}
                      scenarioName={
                        challenge.title ||
                        (challenge as { name?: string }).name ||
                        undefined
                      }
                      onSuccess={() => void fetchScenario()}
                    />
                    <ScenarioRemoveOutcomeAction
                      challengeId={id}
                      scenarioName={
                        challenge.title ||
                        (challenge as { name?: string }).name ||
                        undefined
                      }
                      onSuccess={() => void fetchScenario()}
                    />
                    <ScenarioDeleteAction
                      challengeId={id}
                      scenarioName={
                        challenge.title ||
                        (challenge as { name?: string }).name ||
                        undefined
                      }
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </BasicLayout>
  );
};

export default Challenge;
