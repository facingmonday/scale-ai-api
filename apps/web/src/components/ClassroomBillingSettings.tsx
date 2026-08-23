import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ClipboardList,
  Link2,
  ListChecks,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import classroomService from "@/services/classroom";
import licensingService from "@/services/licensing";
import ClassroomInviteStudentButton from "@/components/ClassroomInviteStudentButton";
import { useAuth } from "@/context/AuthContext";
import { useGlobalContext } from "@/context/GlobalContext";
import {
  buildClassroomJoinUrl,
  copyTextToClipboard,
} from "@/utils/classroomJoinLink";
import type { ClassroomWithVirtuals } from "@/types/classroom";
import type { ClassroomLicensingSummary, JoinPolicy } from "@/types/licensing";

interface ClassroomBillingSettingsProps {
  classroom: ClassroomWithVirtuals;
  onClassroomUpdated?: (classroom: ClassroomWithVirtuals) => void;
  onSeatGranted?: () => void;
  onStudentInvited?: () => void;
}

type AccessMode =
  | "invite_anyone"
  | "invite_roster"
  | "organization_anyone"
  | "organization_roster"
  | "roster_only";

const ACCESS_MODES: Array<{
  value: AccessMode;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
    {
      value: "invite_anyone",
      label: "Anyone with link",
      description: "Students can enroll when you share the private join link.",
      icon: Link2,
    },
    {
      value: "invite_roster",
      label: "Roster + link",
      description:
        "Students need both the private join link and a matching roster entry.",
      icon: ListChecks,
    },
    {
      value: "organization_anyone",
      label: "Organization members",
      description:
        "Organization members can find this class and enroll without a roster entry.",
      icon: Building2,
    },
    {
      value: "organization_roster",
      label: "Organization roster",
      description:
        "Only organization members with a matching roster entry can enroll.",
      icon: UsersRound,
    },
    {
      value: "roster_only",
      label: "Imported roster",
      description:
        "Only students with a matching imported roster entry can enroll.",
      icon: ClipboardList,
    },
  ];

function getAccessMode(
  joinPolicy: JoinPolicy | undefined,
  allowAnonymousJoin: boolean | undefined,
): AccessMode {
  if (joinPolicy === "open") {
    return allowAnonymousJoin === false
      ? "organization_roster"
      : "organization_anyone";
  }
  if (joinPolicy === "roster_only") return "roster_only";
  return allowAnonymousJoin === false ? "invite_roster" : "invite_anyone";
}

function getAccessSettings(mode: AccessMode): {
  joinPolicy: Exclude<JoinPolicy, "closed">;
  allowAnonymousJoin: boolean;
} {
  switch (mode) {
    case "invite_roster":
      return { joinPolicy: "invite_link", allowAnonymousJoin: false };
    case "organization_anyone":
      return { joinPolicy: "open", allowAnonymousJoin: true };
    case "organization_roster":
      return { joinPolicy: "open", allowAnonymousJoin: false };
    case "roster_only":
      return { joinPolicy: "roster_only", allowAnonymousJoin: false };
    default:
      return { joinPolicy: "invite_link", allowAnonymousJoin: true };
  }
}

const ClassroomBillingSettings: React.FC<ClassroomBillingSettingsProps> = ({
  classroom,
  onClassroomUpdated,
  onSeatGranted,
  onStudentInvited,
}) => {
  const classroomId = classroom._id;
  const { organization } = useAuth();
  const globalContext = useGlobalContext();
  const initialMode = getAccessMode(
    classroom.joinPolicy,
    classroom.allowAnonymousJoin,
  );
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy>(
    classroom.joinPolicy || "invite_link",
  );
  const [savedAllowAnonymousJoin, setSavedAllowAnonymousJoin] = useState(
    classroom.allowAnonymousJoin !== false,
  );
  const [accessMode, setAccessMode] = useState<AccessMode>(initialMode);
  const [lastOpenAccessMode, setLastOpenAccessMode] =
    useState<AccessMode>(initialMode);
  const [summary, setSummary] = useState<ClassroomLicensingSummary | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgSeatsAvailable, setOrgSeatsAvailable] = useState<number | null>(
    null,
  );
  const [grantEmail, setGrantEmail] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [isGranting, setIsGranting] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantSuccess, setGrantSuccess] = useState<string | null>(null);

  const joinUrl = useMemo(() => {
    const orgId = organization?.id;
    if (!orgId || !classroomId) return "";
    return buildClassroomJoinUrl(orgId, classroomId);
  }, [organization?.id, classroomId]);

  const load = async () => {
    if (!classroomId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [summaryData, billingSummary] = await Promise.all([
        licensingService.getClassroomSummary(classroomId),
        licensingService.getSummary(),
      ]);
      setSummary(summaryData);
      const available =
        billingSummary.orgSeatSummary?.floatingAvailable ??
        billingSummary.orgSeatSummary?.remainingSeats ??
        null;
      setOrgSeatsAvailable(typeof available === "number" ? available : null);
    } catch (e) {
      console.error("Failed to load classroom licensing:", e);
      setError("Failed to load classroom access settings.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // This fetch only updates state after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classroomId]);

  const saveSettings = async ({
    mode = accessMode,
    closed = false,
  }: {
    mode?: AccessMode;
    closed?: boolean;
  } = {}) => {
    const settings = getAccessSettings(mode);
    const nextJoinPolicy: JoinPolicy = closed ? "closed" : settings.joinPolicy;

    setIsSaving(true);
    setError(null);
    try {
      const response = await classroomService.update(classroomId, {
        joinPolicy: nextJoinPolicy,
        allowAnonymousJoin: settings.allowAnonymousJoin,
      });
      const updated = response?.data || {
        ...classroom,
        joinPolicy: nextJoinPolicy,
        allowAnonymousJoin: settings.allowAnonymousJoin,
      };
      setJoinPolicy(nextJoinPolicy);
      setSavedAllowAnonymousJoin(settings.allowAnonymousJoin);
      setAccessMode(mode);
      if (!closed) setLastOpenAccessMode(mode);
      onClassroomUpdated?.(updated);
      await load();
    } catch (e) {
      console.error("Failed to save classroom access settings:", e);
      setError("Failed to save access settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const isClosed = joinPolicy === "closed";
  const allowsComplimentaryManualEnrollment =
    !isClosed &&
    joinPolicy === "invite_link" &&
    savedAllowAnonymousJoin;
  const selectedAccessMode = ACCESS_MODES.find(
    (mode) => mode.value === accessMode,
  );

  const handleEnrollmentToggle = (closed: boolean) => {
    if (closed) {
      if (!isClosed) setLastOpenAccessMode(accessMode);
      void saveSettings({ mode: accessMode, closed: true });
      return;
    }
    void saveSettings({ mode: lastOpenAccessMode });
  };

  const handleCopyJoinLink = async () => {
    if (!joinUrl) {
      globalContext?.showToast?.("Unable to generate join link", "error");
      return;
    }
    try {
      await copyTextToClipboard(joinUrl);
      globalContext?.showToast?.("Join link copied", "success");
    } catch (e) {
      console.error("Failed to copy join link:", e);
      globalContext?.showToast?.("Failed to copy join link", "error");
    }
  };

  const handleGrantSeat = async () => {
    if (!classroomId || isGranting) return;
    const email = grantEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setGrantError("Enter a valid student email address.");
      return;
    }

    setIsGranting(true);
    setGrantError(null);
    setGrantSuccess(null);
    try {
      await licensingService.grantSeat({
        email,
        classroomId,
        source: "manual_comp",
        reason: grantReason.trim() || undefined,
      });
      setGrantSuccess(
        allowsComplimentaryManualEnrollment
          ? `${email} enrolled without using a paid seat.`
          : `Seat granted to ${email} and student enrolled.`,
      );
      setGrantEmail("");
      setGrantReason("");
      onSeatGranted?.();
      await load();
    } catch (e) {
      console.error("Failed to grant seat:", e);
      const message =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data
            ?.error
          : undefined;
      setGrantError(message || "Failed to grant seat.");
    } finally {
      setIsGranting(false);
    }
  };

  return (
    <div className="card space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="heading-md">Enrollment Controls</h2>
          <p className="text-text-muted">
            Control who can enroll in this class. Students joining themselves
            still need an organization seat or individual payment.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-outline"
            onClick={() => void handleCopyJoinLink()}
            disabled={!joinUrl}
          >
            Copy join link
          </button>
          <ClassroomInviteStudentButton
            classroomId={classroomId}
            disabled={isLoading}
            onSuccess={onStudentInvited}
          />
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="label mb-0">Enrollment</span>
        <div
          className="inline-flex rounded-lg border border-ui-border p-1 bg-ui-bg-hover"
          role="group"
          aria-label="Enrollment status"
        >
          <button
            type="button"
            className={`min-w-[5.5rem] px-4 py-2 rounded-md text-sm font-medium transition-all ${!isClosed
              ? "bg-brand-teal text-white shadow-sm"
              : "text-text-muted hover:text-text-primary"
              }`}
            disabled={isSaving || !isClosed}
            aria-pressed={!isClosed}
            onClick={() => handleEnrollmentToggle(false)}
          >
            Open
          </button>
          <button
            type="button"
            className={`min-w-[5.5rem] px-4 py-2 rounded-md text-sm font-medium transition-all ${isClosed
              ? "bg-ui-muted text-text-primary shadow-sm"
              : "text-text-muted hover:text-text-primary"
              }`}
            disabled={isSaving || isClosed}
            aria-pressed={isClosed}
            onClick={() => handleEnrollmentToggle(true)}
          >
            Closed
          </button>
        </div>
        {isSaving && <span className="text-text-muted text-sm">Saving...</span>}
      </div>

      <fieldset
        disabled={isSaving || isClosed}
        className="m-0 min-w-0 space-y-3 border-0 p-0"
      >
        <legend className="label">Who can enroll?</legend>
        <div
          className={`grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5 ml-10 pl-2 pt-2 ${isClosed ? "opacity-60" : ""
            }`}
          role="radiogroup"
          aria-label="Who can enroll"
        >
          {ACCESS_MODES.map((mode) => {
            const selected = accessMode === mode.value;
            const Icon = mode.icon;
            return (
              <button
                type="button"
                key={mode.value}
                role="radio"
                aria-checked={selected}
                onClick={() => setAccessMode(mode.value)}
                className={`group flex min-h-[5.5rem] flex-col justify-between rounded-lg border px-3 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/60 ${selected
                  ? "border-brand-teal bg-brand-teal/10 shadow-sm"
                  : "border-ui-border bg-ui-bg hover:border-brand-teal/50 hover:bg-ui-bg-hover"
                  }`}
              >
                <span className="flex w-full justify-center">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-md ${selected
                      ? "bg-brand-teal text-white"
                      : "bg-ui-bg-hover text-text-muted group-hover:text-brand-teal"
                      }`}
                  >
                    <Icon aria-hidden="true" size={17} strokeWidth={2} />
                  </span>
                </span>
                <span className="mt-3 text-sm font-medium">{mode.label}</span>
              </button>
            );
          })}
        </div>
        {isClosed ? (
          <p className="text-text-muted text-xs">
            Set enrollment to Open to change who can enroll.
          </p>
        ) : (
          selectedAccessMode && (
            <div className="rounded-md bg-ui-bg-hover py-2.5 text-sm">
              <p>
                <span className="font-medium">{selectedAccessMode.label}:</span>{" "}
                <span className="text-text-muted">
                  {selectedAccessMode.description}
                </span>
              </p>
            </div>
          )
        )}
      </fieldset>

      <div className="flex justify-end">
        <button
          className="btn-teal"
          disabled={isSaving || isClosed}
          onClick={() => void saveSettings()}
        >
          {isSaving ? "Saving..." : "Save Access Settings"}
        </button>
      </div>

      <div className="border-t border-ui-border pt-6 space-y-4">
        <div>
          <h3 className="heading-sm mb-1">
            {allowsComplimentaryManualEnrollment
              ? "Enroll a Student"
              : "Enroll with an Organization Seat"}
          </h3>
          <p className="text-text-muted text-sm">
            {allowsComplimentaryManualEnrollment ? (
              <>
                Enroll an existing organization member without checkout.
                Students enrolled here by a teacher do not use an organization
                seat.
              </>
            ) : (
              <>
                Enroll an existing organization member without checkout. This
                uses one organization seat
                {orgSeatsAvailable !== null
                  ? ` (${orgSeatsAvailable} available).`
                  : "."}{" "}
                {summary
                  ? `This class currently has ${summary.claimedSeats} claimed seat${summary.claimedSeats === 1 ? "" : "s"}.`
                  : null}
              </>
            )}
          </p>
        </div>

        {grantError && <p className="text-red-400 text-sm">{grantError}</p>}
        {grantSuccess && (
          <p className="text-green-400 text-sm">{grantSuccess}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 pl-2">
          <label className="flex flex-col gap-1">
            <span className="label">Student email</span>
            <input
              type="email"
              className="input"
              value={grantEmail}
              onChange={(e) => setGrantEmail(e.target.value)}
              placeholder="student@example.edu"
              disabled={isGranting}
            />
            <span className="text-text-muted text-xs">
              The student must already be a member of this organization.
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Reason (optional)</span>
            <input
              className="input"
              value={grantReason}
              onChange={(e) => setGrantReason(e.target.value)}
              placeholder="e.g. TA access, makeup enrollment"
              disabled={isGranting}
            />
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="btn-teal"
            disabled={
              isGranting ||
              isLoading ||
              !grantEmail.trim().includes("@") ||
              (!allowsComplimentaryManualEnrollment &&
                orgSeatsAvailable !== null &&
                orgSeatsAvailable <= 0)
            }
            onClick={() => void handleGrantSeat()}
          >
            {isGranting
              ? "Enrolling..."
              : allowsComplimentaryManualEnrollment
                ? "Enroll Student"
                : "Grant Seat and Enroll"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClassroomBillingSettings;
