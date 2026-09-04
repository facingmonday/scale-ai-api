import React, { useMemo, useState } from "react";
import { Dialog } from "primereact/dialog";
import challengeService from "../services/challenge";
import ChallengeForm, { type ScenarioFormValues } from "./ChallengeForm";
import { getErrorMessage } from "../utils";

interface ScenarioCreateFormProps {
  visible: boolean;
  onHide: () => void;
  classroomId: string;
  onSuccess: (challengeId: string) => void;
}

const ScenarioCreateForm: React.FC<ScenarioCreateFormProps> = ({
  visible,
  onHide,
  classroomId,
  onSuccess,
}) => {
  const [values, setValues] = useState<ScenarioFormValues>({
    simulationMode: "direct",
    simulationConcurrency: 5,
    title: "",
    description: "",
    imageUrl: "",
    publishAt: "",
    publishMode: "MANUAL",
    submissionDeadlineAt: "",
    closeSubmissionsAt: "",
    processAt: "",
    feedbackReleaseAt: "",
    feedbackReleaseMode: "IMMEDIATE",
    allowLateSubmissions: false,
    lateSubmissionPolicy: { penaltyPercentPerDay: 0 },
    automationMode: "FULL",
    missingSubmissionPolicy: "SKIP",
    punishAbsentStudents: "none",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = useMemo(
    () =>
      values.title.trim().length > 0 &&
      Number.isInteger(values.simulationConcurrency) &&
      (values.simulationConcurrency ?? 0) >= 1 &&
      (values.simulationConcurrency ?? 0) <= 20,
    [values.title, values.simulationConcurrency],
  );

  const reset = () => {
    setValues({
      simulationMode: "direct",
      simulationConcurrency: 5,
      title: "",
      description: "",
      imageUrl: "",
      publishAt: "",
      publishMode: "MANUAL",
      submissionDeadlineAt: "",
      closeSubmissionsAt: "",
      processAt: "",
      feedbackReleaseAt: "",
      feedbackReleaseMode: "IMMEDIATE",
      allowLateSubmissions: false,
      lateSubmissionPolicy: { penaltyPercentPerDay: 0 },
      automationMode: "FULL",
      missingSubmissionPolicy: "SKIP",
      punishAbsentStudents: "none",
    });
    setError(null);
    setIsSubmitting(false);
  };

  const handleHide = () => {
    if (isSubmitting) return;
    reset();
    onHide();
  };

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const payload = await challengeService.create({
        classroomId,
        simulationMode: values.simulationMode || "direct",
        simulationConcurrency: values.simulationConcurrency ?? 5,
        title: values.title.trim(),
        description: values.description.trim() || undefined,
        imageUrl: values.imageUrl?.trim() || undefined,
        publishAt: values.publishAt || null,
        publishMode: values.publishMode || "MANUAL",
        submissionDeadlineAt: values.submissionDeadlineAt || null,
        closeSubmissionsAt: values.closeSubmissionsAt || null,
        processAt: values.processAt || null,
        feedbackReleaseAt: values.feedbackReleaseAt || null,
        feedbackReleaseMode: values.feedbackReleaseMode || "IMMEDIATE",
        allowLateSubmissions: values.allowLateSubmissions || false,
        lateSubmissionPolicy: {
          penaltyPercentPerDay: Number(
            values.lateSubmissionPolicy?.penaltyPercentPerDay ?? 0,
          ),
        },
        automationMode: values.automationMode || "FULL",
        missingSubmissionPolicy: values.missingSubmissionPolicy || "SKIP",
        punishAbsentStudents: values.punishAbsentStudents || "none",
      });

      const challenge = payload?.data ?? payload;
      const challengeId = challenge?._id ?? challenge?.id;

      if (!challengeId) {
        throw new Error("Create challenge succeeded but no id returned.");
      }

      reset();
      onHide();
      onSuccess(String(challengeId));
    } catch (e) {
      console.error("Failed to create challenge:", e);
      setError(getErrorMessage(e));
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      header="Create Challenge"
      visible={visible}
      onHide={handleHide}
      modal
      closable={!isSubmitting}
      dismissableMask={!isSubmitting}
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
          <button
            className="btn-outline"
            onClick={handleHide}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className="btn-teal"
            onClick={() => void handleSubmit()}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <ChallengeForm
          showProcessingSettings
          values={values}
          onChange={(field, value) =>
            setValues((current) => ({ ...current, [field]: value }))
          }
          disabled={isSubmitting}
        />
      </div>
    </Dialog>
  );
};

export default ScenarioCreateForm;
