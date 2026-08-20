import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import { useAuth } from "../../../context/AuthContext";
import challengeService from "../../../services/challenge";
import { useGlobalContext } from "../../../context/GlobalContext";
import { getErrorMessage } from "../../../utils";
import ChallengeForm, { type ScenarioFormValues } from "../../../components/ChallengeForm";

const ChallengeCreate: React.FC = () => {
  const { activeClassroom } = useAuth();
  const navigate = useNavigate();
  const globalContext = useGlobalContext();

  const [values, setValues] = useState<ScenarioFormValues>({
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
    lateSubmissionPolicy: { penaltyPercentPerDay: 0 },
    automationMode: "FULL",
    missingSubmissionPolicy: "SKIP",
    punishAbsentStudents: "none",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = useMemo(() => values.title.trim().length > 0, [values.title]);

  const handleSubmit = async () => {
    if (!activeClassroom?._id) return;
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    globalContext?.showToast?.("Creating challenge...", "loading");

    try {
      const payload = await challengeService.create({
        classroomId: activeClassroom._id,
        title: values.title.trim(),
        description: values.description.trim() || undefined,
        imageUrl: values.imageUrl?.trim() || undefined,
        publishAt: values.publishAt || null,
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

      globalContext?.showToast?.("Challenge created successfully", "success");
      navigate(`/challenges/${challengeId}`);
    } catch (e) {
      console.error("Failed to create challenge:", e);
      const message = getErrorMessage(e);
      setError(message);
      globalContext?.showToast?.(message, "error");
      setIsSubmitting(false);
    }
  };

  return (
    <BasicLayout>
      <div className="page">
        <div className="container">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="heading-xl">Create Challenge</h1>
              <p className="text-text-muted mt-1">
                Configure parameters, schedule timelines, and set up automation rules for this challenge.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-outline"
                onClick={() => navigate("/challenges")}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-teal"
                onClick={() => void handleSubmit()}
                disabled={!isValid || isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Create Challenge"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
              <i className="pi pi-exclamation-circle" />
              <span>{error}</span>
            </div>
          )}

          <ChallengeForm
            values={values}
            onChange={(field, value) =>
              setValues((current) => ({ ...current, [field]: value }))
            }
            disabled={isSubmitting}
          />
        </div>
      </div>
    </BasicLayout>
  );
};

export default ChallengeCreate;
