import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import { useAuth } from "../../../context/AuthContext";
import challengeService from "../../../services/challenge";
import { useGlobalContext } from "../../../context/GlobalContext";
import ChallengeForm, { type ScenarioFormValues } from "../../../components/ChallengeForm";

const ChallengeCreate: React.FC = () => {
  const { activeClassroom } = useAuth();
  const navigate = useNavigate();
  const globalContext = useGlobalContext();

  const [values, setValues] = useState<ScenarioFormValues>({
    title: "",
    description: "",
    publishAt: "",
    submissionDeadlineAt: "",
    automationMode: "MANUAL",
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
        publishAt: values.publishAt || null,
        submissionDeadlineAt: values.submissionDeadlineAt || null,
        automationMode: values.automationMode || "MANUAL",
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
      setError("Failed to create challenge. Please try again.");
      globalContext?.showToast?.("Failed to create challenge", "error");
      setIsSubmitting(false);
    }
  };

  return (
    <BasicLayout>
      <div className="page">
        <div className="container">
          {/* Header section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="heading-xl">Create Challenge</h1>
              <p className="text-text-muted mt-1">
                Configure parameters, schedule timelines, and set up automation rules for this challenge.
              </p>
            </div>
            <button
              onClick={() => navigate("/challenges")}
              className="btn-outline flex items-center gap-2 max-w-fit self-start md:self-auto"
            >
              <i className="pi pi-arrow-left text-xs" />
              <span>Back to Challenges</span>
            </button>
          </div>

          <div className="card shadow-lg bg-ui-surface border border-ui-border p-6 rounded-xl flex flex-col gap-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg text-sm flex items-center gap-2">
                <i className="pi pi-exclamation-circle" />
                <span>{error}</span>
              </div>
            )}

            <ChallengeForm
              values={values}
              onChange={setValues}
              disabled={isSubmitting}
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-ui-border mt-4">
              <button
                type="button"
                className="btn-outline px-6 py-2.5"
                onClick={() => navigate("/challenges")}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-teal px-6 py-2.5 font-semibold"
                onClick={() => void handleSubmit()}
                disabled={!isValid || isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Create Challenge"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </BasicLayout>
  );
};

export default ChallengeCreate;
