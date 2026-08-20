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
import { FormProvider, useForm } from "react-hook-form";
import type { ScenarioWithVariables } from "@/types/challenge";
import type { VariableDefinitionWithValue } from "@/types/decision";
import { useGlobalContext } from "@/context/GlobalContext";
import { getErrorMessage } from "@/utils";
import {
  getChallengeLifecycleStatus,
  getChallengePresentationBadgeClass,
  getChallengePresentationStatus,
} from "@/utils/challengeStatus";
import MetricCard from "@/components/dashboard/MetricCard";
import profileTypeService from "../../../services/profileType";
import type { ProfileType as StoreTypeModel } from "../../../types/profileType";
import LoadingOverlay from "../../../components/LoadingOverlay";
import ChallengeForm, {
  type ScenarioFormValues,
} from "../../../components/ChallengeForm";
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

  const form = useForm<ScenarioFormValues & {
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

        // Challenge-scoped definitions disappear immediately when removed.
        // Keep inactive classroom-wide definitions only when an older challenge
        // still has a stored value, so historical records remain understandable.
        const scenarioDefsForForm = scenarioDefs.filter(
          (def) =>
            def.isActive ||
            (!def.challengeId &&
              Object.prototype.hasOwnProperty.call(
                scenarioVariables,
                def.key,
              )),
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

  useEffect(() => {
    const automationStatus = String(
      challenge?.automationStatus || "",
    ).toLowerCase();
    if (!["queuedforprocessing", "processing"].includes(automationStatus)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchScenario(true);
      }
    }, 15_000);
    return () => window.clearInterval(intervalId);
  }, [challenge?.automationStatus, fetchScenario]);

  // Watch variables to ensure they're tracked by the form
  const watchedFormValues = form.watch();
  const watchedVariables = watchedFormValues.variables;
  const lifecycleStatus = getChallengeLifecycleStatus(challenge);

  const handleFormFieldChange = <K extends keyof ScenarioFormValues>(
    field: K,
    value: ScenarioFormValues[K],
  ) => {
    form.setValue(field, value as never, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

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
                  {(() => {
                    const status = getChallengePresentationStatus(challenge, {
                      audience: "teacher",
                    });
                    return (
                      <span
                        className={`badge ml-4 align-middle ${getChallengePresentationBadgeClass(status)}`}
                      >
                        {status}
                      </span>
                    );
                  })()}
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
                  {!isEditing &&
                  !challenge.isClosed &&
                  lifecycleStatus !== "Scheduled" ? (
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

              <ChallengeForm
                values={watchedFormValues}
                onChange={handleFormFieldChange}
                disabled={!isEditing || isPublishing}
                automationError={challenge.automationError}
              />

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
              lifecycleStatus !== "Scheduled" &&
              activeClassroom?._id &&
              id &&
              !challenge.isClosed && (
                <div className="mb-4">
                  <ScenarioSubmissionsList challengeId={id} />
                </div>
              )}

            {challenge.isPublished &&
              lifecycleStatus !== "Scheduled" &&
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
