import React, { useEffect, useMemo, useState } from "react";
import { Dialog } from "primereact/dialog";
import classroomService from "../services/classroom";
import licensingService from "../services/licensing";
import type { ClassroomLicensingSummary } from "../types/licensing";

interface InviteStudentDialogProps {
  visible: boolean;
  onHide: () => void;
  classroomId: string;
  onSuccess?: () => void;
}

const InviteStudentDialog: React.FC<InviteStudentDialogProps> = ({
  visible,
  onHide,
  classroomId,
  onSuccess,
}) => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ClassroomLicensingSummary | null>(null);

  const isValid = email.trim().length > 0 && email.includes("@");

  useEffect(() => {
    if (!visible || !classroomId) return;
    void licensingService
      .getClassroomSummary(classroomId)
      .then(setSummary)
      .catch((e) => {
        console.warn("Unable to load classroom billing summary:", e);
      });
  }, [classroomId, visible]);

  const billingMessage = useMemo(() => {
    const mode = summary?.classroom?.billingMode;
    if (mode === "student_paid") {
      return "Students will be asked to pay for access before joining this classroom.";
    }
    if (mode === "teacher_paid_open") {
      return "This invite can consume one teacher-paid seat when the student joins.";
    }
    if (mode === "teacher_paid_roster" || mode === "roster_only") {
      return "Only imported roster students can claim a seat for this classroom.";
    }
    if (mode === "hybrid") {
      return "Teacher-paid seats are used first. Students can pay if no teacher seats remain.";
    }
    return "Billing rules are checked when the student accepts the invite.";
  }, [summary]);

  const reset = () => {
    setEmail("");
    setError(null);
    setIsSubmitting(false);
  };

  const handleHide = () => {
    if (isSubmitting) return;
    reset();
    onHide();
  };

  const handleSubmit = async () => {
    if (!isValid || isSubmitting || !classroomId) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await classroomService.inviteStudent(classroomId, email.trim());
      reset();
      onHide();
      onSuccess?.();
    } catch (e) {
      console.error("Failed to invite student:", e);
      const errorMessage =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      setError(errorMessage || "Failed to invite student. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      header="Invite Student"
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
            {isSubmitting ? "Sending..." : "Send Invitation"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div>
          <label className="label" htmlFor="student-email">
            Email Address
          </label>
          <input
            id="student-email"
            type="email"
            className="input"
            placeholder="student@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isValid && !isSubmitting) {
                void handleSubmit();
              }
            }}
          />
          <p className="text-text-muted text-sm mt-1">
            An invitation will be sent to this email address. The student will be
            added to both the organization and this classroom.
          </p>
          <p className="text-text-muted text-sm mt-2">{billingMessage}</p>
          {summary && (
            <p className="text-text-muted text-xs mt-1">
              Seats claimed: {summary.claimedSeats}. Roster reserved:{" "}
              {summary.roster.reserved}. Roster claimed: {summary.roster.claimed}.
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
};

export default InviteStudentDialog;

