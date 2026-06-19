import React, { useEffect, useMemo, useState } from "react";
import { Dialog } from "primereact/dialog";
import classroomService from "../services/classroom";
import licensingService from "../services/licensing";
import { copyTextToClipboard } from "@/utils/classroomJoinLink";
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
  const [summary, setSummary] = useState<ClassroomLicensingSummary | null>(
    null,
  );
  const [sentJoinLink, setSentJoinLink] = useState<string | null>(null);
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const isValid = email.trim().length > 0 && email.includes("@");
  const isSuccess = sentJoinLink !== null;

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
    return "Students need an organization seat or individual payment before enrolling in this classroom.";
  }, []);

  const reset = () => {
    setEmail("");
    setError(null);
    setIsSubmitting(false);
    setSentJoinLink(null);
    setSentEmail(null);
    setCopyError(null);
  };

  const handleHide = () => {
    if (isSubmitting) return;
    const wasSuccess = isSuccess;
    reset();
    onHide();
    if (wasSuccess) {
      onSuccess?.();
    }
  };

  const handleSubmit = async () => {
    if (!isValid || isSubmitting || !classroomId) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await classroomService.inviteStudent(
        classroomId,
        email.trim(),
      );
      setSentEmail(email.trim());
      setSentJoinLink(response?.data?.joinLink ?? null);
      setEmail("");
    } catch (e) {
      console.error("Failed to invite student:", e);
      const errorMessage =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      setError(errorMessage || "Failed to invite student. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!sentJoinLink) return;
    setCopyError(null);
    try {
      await copyTextToClipboard(sentJoinLink);
    } catch (e) {
      console.error("Failed to copy join link:", e);
      setCopyError("Failed to copy link.");
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
          {isSuccess ? (
            <button className="btn-teal" onClick={handleHide}>
              Done
            </button>
          ) : (
            <>
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
            </>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {isSuccess ? (
          <>
            <p className="text-brand-teal text-sm">
              Invitation sent to {sentEmail}.
            </p>
            {sentJoinLink ? (
              <div className="space-y-2">
                <label className="label" htmlFor="invite-join-link">
                  Join link
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="invite-join-link"
                    type="text"
                    className="input flex-1 font-mono text-sm"
                    value={sentJoinLink}
                    readOnly
                  />
                  <button
                    type="button"
                    className="btn-outline shrink-0"
                    onClick={() => void handleCopyLink()}
                  >
                    Copy link
                  </button>
                </div>
                {copyError && (
                  <p className="text-red-400 text-sm">{copyError}</p>
                )}
              </div>
            ) : null}
          </>
        ) : (
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
              An invitation will be sent to this email address with the join
              link.
            </p>
            <p className="text-text-muted text-sm mt-2">{billingMessage}</p>
            {summary && (
              <p className="text-text-muted text-xs mt-1">
                Seats claimed: {summary.claimedSeats}. Roster reserved:{" "}
                {summary.roster.reserved}. Roster claimed:{" "}
                {summary.roster.claimed}.
              </p>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default InviteStudentDialog;
