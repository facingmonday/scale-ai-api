import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import {
  ProfileHeader,
  StudentActionBanner,
  PerformanceChart,
  PastChallenges,
} from "../../../components/dashboard";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useGlobalContext } from "../../../context/GlobalContext";
import { useUser } from "@clerk/clerk-react";
import challengeService from "../../../services/challenge";
import enrollmentService from "../../../services/enrollment";
import classroomService from "../../../services/classroom";
import licensingService from "../../../services/licensing";
import ClassroomCard from "../../../components/ClassroomCard";
import type { ClassroomWithVirtuals } from "../../../types/classroom";
import {
  canSelfJoinFromClassList,
  getClassListJoinHint,
} from "../../../utils/classroomJoin";
import {
  unwrap,
  normalizeScenarioId,
  formatCurrency,
} from "../../../components/dashboard/utils";
import type { ScenarioWithVariables } from "../../../types/challenge";
import type { Profile } from "../../../types/profile";
import Alert from "../../../components/Alert";
import LoadingOverlay from "../../../components/LoadingOverlay";

const Dashboard: React.FC = () => {
  const { activeClassroom, setNewActiveClassroom, organization } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const [currentScenarioData, setCurrentScenarioData] = useState<{
    challenge: ScenarioWithVariables | null;
    submissionStatus: {
      submitted: boolean;
      submittedAt: string | null;
    } | null;
    challengeId: string | null;
  } | null>(null);
  const [dismissedScenarioId, setDismissedScenarioId] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);

  const classroomId = activeClassroom?._id ?? null;

  // Determine if alert should be shown
  const shouldShowAlert = useMemo(() => {
    return Boolean(
      currentScenarioData?.challenge &&
      currentScenarioData?.challengeId &&
      !currentScenarioData?.submissionStatus?.submitted &&
      !currentScenarioData?.challenge?.isClosed
    );
  }, [currentScenarioData]);

  const showAlert =
    shouldShowAlert && currentScenarioData?.challengeId !== dismissedScenarioId;

  const scenarioDeadline = currentScenarioData?.challenge?.submissionDeadlineAt
    ? new Date(currentScenarioData.challenge.submissionDeadlineAt)
    : null;

  const cancelledRef = useRef(false);

  const fetchCurrentScenario = useCallback(
    async (silent = false) => {
      if (!classroomId) {
        setIsLoading(false);
        return;
      }

      cancelledRef.current = false;

      if (!silent) {
        setIsLoading(true);
      }

      try {
        const scenarioRes = await challengeService.getCurrent(classroomId);
        if (cancelledRef.current) return;
        const data = unwrap(scenarioRes) as {
          challenge?: ScenarioWithVariables;
          submissionStatus?: {
            submitted: boolean;
            submittedAt: string | null;
          };
        } | null;

        const challenge = (data?.challenge ??
          null) as ScenarioWithVariables | null;
        const challengeId = challenge
          ? normalizeScenarioId(challenge as unknown as Record<string, unknown>)
          : null;

        if (cancelledRef.current) return;
        setCurrentScenarioData({
          challenge,
          submissionStatus: data?.submissionStatus ?? null,
          challengeId,
        });
      } catch (err) {
        if (cancelledRef.current) return;
        console.error("Failed to fetch current challenge:", err);
        setCurrentScenarioData(null);
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [classroomId]
  );

  useEffect(() => {
    if (!classroomId) {
      const timeoutId = setTimeout(() => {
        setCurrentScenarioData(null);
        setIsLoading(false);
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    cancelledRef.current = false;
    // Fire and forget async function for data fetching
    (async () => {
      await fetchCurrentScenario(false);
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [classroomId, fetchCurrentScenario]);

  useEffect(() => {
    const handleFocus = () => {
      if (classroomId) {
        void fetchCurrentScenario(); // Silent refresh on focus
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [classroomId, fetchCurrentScenario]);

  // Classroom Selector States for Student (when activeClassroom is null)
  const [classrooms, setClassrooms] = useState<ClassroomWithVirtuals[]>([]);
  const [orgClassrooms, setOrgClassrooms] = useState<ClassroomWithVirtuals[]>(
    []
  );
  const [enrolledClassroomIds, setEnrolledClassroomIds] = useState<Set<string>>(
    new Set()
  );
  const [studentProfiles, setStudentProfiles] = useState<Record<string, Profile | null>>({});
  const [studentScenarios, setStudentScenarios] = useState<Record<string, {
    challenge: ScenarioWithVariables | null;
    submissionStatus: {
      submitted: boolean;
      submittedAt: string | null;
    } | null;
  } | null>>({});
  const [isFetchingClassrooms, setIsFetchingClassrooms] = useState(false);
  const [classroomsError, setClassroomsError] = useState<string | null>(null);
  const [joiningClassroomId, setJoiningClassroomId] = useState<string | null>(
    null
  );
  const [checkoutClassroomId, setCheckoutClassroomId] = useState<string | null>(
    null
  );
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const globalContext = useGlobalContext();

  const fetchClassrooms = useCallback(async () => {
    setIsFetchingClassrooms(true);
    setClassroomsError(null);
    try {
      const myClassesData = await enrollmentService.getMyClasses();
      const enrolledClassrooms = myClassesData.data || [];
      setClassrooms(enrolledClassrooms);

      const orgClassroomsData = await classroomService.getAll();
      const allOrgClassrooms = orgClassroomsData.data || orgClassroomsData || [];

      const enrolledIds = enrolledClassrooms.map(
        (c: ClassroomWithVirtuals) =>
          c._id || (c as ClassroomWithVirtuals & { id?: string }).id
      );
      setEnrolledClassroomIds(new Set(enrolledIds.filter(Boolean) as string[]));

      setOrgClassrooms(allOrgClassrooms);

      // Fetch stats for each enrolled classroom in parallel
      const profilesMap: Record<string, Profile | null> = {};
      const scenariosMap: Record<string, {
        challenge: ScenarioWithVariables | null;
        submissionStatus: {
          submitted: boolean;
          submittedAt: string | null;
        } | null;
      } | null> = {};

      await Promise.all(
        enrolledClassrooms.map(async (cls: ClassroomWithVirtuals) => {
          const cid = cls._id || (cls as ClassroomWithVirtuals & { id?: string }).id;
          if (!cid) return;
          try {
            const [profileRes, scenarioRes] = await Promise.all([
              profileService.getStudentStore(cid),
              challengeService.getCurrent(cid),
            ]);
            profilesMap[cid] = profileRes.data || null;
            scenariosMap[cid] = (unwrap(scenarioRes) as {
              challenge?: ScenarioWithVariables;
              submissionStatus?: {
                submitted: boolean;
                submittedAt: string | null;
              };
            } | null) || null;
          } catch (e) {
            console.error(`Failed to fetch stats for classroom ${cid}:`, e);
          }
        })
      );

      setStudentProfiles(profilesMap);
      setStudentScenarios(scenariosMap);
    } catch (err) {
      console.error("Failed to fetch classrooms:", err);
      const errorMessage =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
            ?.data?.message
          : undefined;
      setClassroomsError(errorMessage || "Failed to load classrooms");
    } finally {
      setIsFetchingClassrooms(false);
    }
  }, []);

  useEffect(() => {
    if (!activeClassroom) {
      void fetchClassrooms();
    }
  }, [activeClassroom, fetchClassrooms]);

  const handleJoinClassroom = async (classroom: ClassroomWithVirtuals) => {
    const classroomId =
      classroom._id ||
      (classroom as ClassroomWithVirtuals & { id?: string }).id;
    if (!classroomId) return;

    setJoiningClassroomId(classroomId);
    try {
      globalContext?.setIsLoading(true);
      await enrollmentService.joinClass(classroomId);
      await setNewActiveClassroom(classroom);
      globalContext?.setIsLoading(false);
    } catch (err) {
      console.error("Failed to join classroom:", err);
      const response =
        err && typeof err === "object" && "response" in err
          ? (err as {
            response?: {
              data?: { message?: string; error?: string; code?: string };
            };
          }).response
          : undefined;
      const errorCode = response?.data?.code;
      const errorMessage =
        response?.data?.error ||
        response?.data?.message ||
        "Failed to join classroom. Please try again.";

      if (errorCode === "PAYMENT_REQUIRED" && classroomId) {
        setCheckoutClassroomId(classroomId);
        setClassroomsError(errorMessage);
      } else {
        setClassroomsError(errorMessage);
      }
      globalContext?.setIsLoading(false);
      setJoiningClassroomId(null);
    }
  };

  const startCheckout = async () => {
    if (!checkoutClassroomId || isStartingCheckout) return;
    setIsStartingCheckout(true);
    try {
      const checkout = await licensingService.createStudentCheckout(
        checkoutClassroomId
      );
      window.location.href = checkout.checkoutUrl;
    } catch (checkoutErr) {
      console.error("Unable to start checkout:", checkoutErr);
      const message =
        checkoutErr &&
          typeof checkoutErr === "object" &&
          "response" in checkoutErr
          ? (checkoutErr as { response?: { data?: { error?: string } } })
            .response?.data?.error
          : undefined;
      setClassroomsError(message || "Checkout is not available yet.");
      setIsStartingCheckout(false);
    }
  };

  const otherClassrooms = useMemo(() => {
    return orgClassrooms.filter((classroom) => {
      const classroomId =
        classroom._id ||
        (classroom as ClassroomWithVirtuals & { id?: string }).id;
      return !classroomId || !enrolledClassroomIds.has(classroomId);
    });
  }, [orgClassrooms, enrolledClassroomIds]);

  // If no active classroom, show the classroom selection list on the dashboard
  if (!activeClassroom) {
    return (
      <BasicLayout>
        <LoadingOverlay loading={isFetchingClassrooms} />
        <div className="page">
          <div className="container">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
              <div>
                <h1 className="heading-xl text-3xl font-extrabold tracking-tight">Student Workspace</h1>
                <p className="text-text-muted mt-1 text-sm">
                  Welcome to SCALE! Choose a classroom to start your pizza shop simulation.
                </p>
              </div>
            </div>

            {classroomsError && (
              <div className="card mb-6 border border-red-500/30 bg-red-500/5">
                <p className="text-red-400 text-sm">{classroomsError}</p>
                {checkoutClassroomId && (
                  <button
                    className="btn-teal mt-4"
                    disabled={isStartingCheckout}
                    onClick={() => void startCheckout()}
                  >
                    {isStartingCheckout
                      ? "Starting checkout..."
                      : "Buy Class Access"}
                  </button>
                )}
              </div>
            )}

            <div className="space-y-6 w-full">
              {/* My Classrooms (Enrolled) */}
              {classrooms.length > 0 && (
                <div className="card">
                  <div className="flex items-center justify-between border-b border-ui-border pb-4 mb-4">
                    <h2 className="heading-lg font-bold">My Classes</h2>
                    <span className="badge bg-brand-teal/10 text-brand-teal px-2.5 py-0.5 text-xs font-semibold rounded-full font-mono">
                      {classrooms.length} Enrolled
                    </span>
                  </div>

                  <div className="space-y-4">
                    {classrooms.map((cls) => {
                      const cid = cls._id || (cls as ClassroomWithVirtuals & { id?: string }).id;
                      if (!cid) return null;
                      const profileData = studentProfiles[cid];
                      const scenarioData = studentScenarios[cid];

                      const shopName = profileData?.shopName || "Not Set Up Yet";
                      const hasActiveScenario = Boolean(scenarioData?.challenge);
                      const activeScenarioTitle = scenarioData?.challenge?.title || "No Active Challenge";
                      const isSubmitted = Boolean(scenarioData?.submissionStatus?.submitted);
                      const cashBalance = profileData?.currentDetails?.cashBalance;

                      return (
                        <div
                          key={cid}
                          className="group border border-ui-border rounded-xl p-5 hover:border-brand-teal/50 hover:shadow-md transition-all duration-200 bg-ui-surface flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                        >
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-3">
                              <h3 className="text-lg font-bold text-text-primary group-hover:text-brand-teal transition-colors">
                                {cls.name}
                              </h3>
                              {cls.isActive ? (
                                <span className="badge badge-success px-2 py-0.5 text-xs rounded-full">Active</span>
                              ) : (
                                <span className="badge bg-ui-muted text-text-secondary px-2 py-0.5 text-xs rounded-full">Inactive</span>
                              )}
                            </div>
                            {cls.description && (
                              <p className="text-sm text-text-muted line-clamp-1">{cls.description}</p>
                            )}

                            {/* Stats Row */}
                            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 pt-1 text-xs text-text-muted">
                              <span className="flex items-center gap-1.5 bg-ui-surface-hover px-2.5 py-1 rounded-md">
                                <i className="pi pi-shopping-bag text-brand-teal" />
                                Shop: <strong className="text-text-primary">{shopName}</strong>
                              </span>

                              {cashBalance !== undefined && cashBalance !== null && (
                                <span className="flex items-center gap-1.5 bg-ui-surface-hover px-2.5 py-1 rounded-md font-mono font-semibold">
                                  <i className="pi pi-wallet text-emerald-500" />
                                  {formatCurrency(cashBalance)}
                                </span>
                              )}

                              <span className="flex items-center gap-1.5 bg-ui-surface-hover px-2.5 py-1 rounded-md">
                                <i className="pi pi-play text-brand-blue" />
                                Active Challenge: <strong className="text-text-primary">{activeScenarioTitle}</strong>
                              </span>

                              {hasActiveScenario && (
                                isSubmitted ? (
                                  <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2.5 py-1 rounded-md font-medium">
                                    <i className="pi pi-check-circle" />
                                    Submitted
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-md font-medium font-semibold">
                                    <i className="pi pi-exclamation-triangle" />
                                    Pending Decision
                                  </span>
                                )
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end md:self-center">
                            <button
                              onClick={() => void handleJoinClassroom(cls)}
                              disabled={joiningClassroomId === cid}
                              className="btn-teal py-1.5 px-4 text-sm font-medium whitespace-nowrap"
                            >
                              {joiningClassroomId === cid ? "Entering..." : "Enter Class"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Organization Classrooms Section */}
              {otherClassrooms.length > 0 && (
                <div className="card">
                  <div className="flex items-center justify-between border-b border-ui-border pb-4 mb-4">
                    <h2 className="heading-lg font-bold">
                      Other Classes in {organization?.name || "Organization"}
                    </h2>
                    <span className="text-xs text-text-muted font-mono">{otherClassrooms.length} Available</span>
                  </div>
                  <div className="space-y-3">
                    {otherClassrooms.map((classroom) => {
                      const classroomId =
                        classroom._id ||
                        (classroom as ClassroomWithVirtuals & { id?: string }).id;
                      if (!classroomId) return null;
                      const showJoinButton = canSelfJoinFromClassList(classroom);
                      const joinHint = getClassListJoinHint(classroom, false);

                      return (
                        <div
                          key={classroomId}
                          className="border border-ui-border/60 rounded-xl p-4 bg-ui-surface/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-brand-teal/30 hover:bg-ui-surface transition-all duration-200"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-text-primary">{classroom.name}</h3>
                              {classroom.isActive ? (
                                <span className="badge badge-success px-2 py-0.5 text-xs rounded-full">Active</span>
                              ) : (
                                <span className="badge bg-ui-muted text-text-secondary px-2 py-0.5 text-xs rounded-full">Inactive</span>
                              )}
                            </div>
                            {classroom.description && (
                              <p className="text-xs text-text-muted line-clamp-2">{classroom.description}</p>
                            )}
                            {joinHint && (
                              <p className="text-xs text-brand-blue font-medium mt-1">
                                <i className="pi pi-info-circle mr-1" />
                                {joinHint}
                              </p>
                            )}
                          </div>

                          {showJoinButton && (
                            <div className="self-end sm:self-center">
                              <button
                                onClick={() => void handleJoinClassroom(classroom)}
                                disabled={joiningClassroomId === classroomId}
                                className="btn-outline py-1.5 px-4 text-xs font-medium whitespace-nowrap"
                              >
                                {joiningClassroomId === classroomId
                                  ? "Joining..."
                                  : "Join Class"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {classrooms.length === 0 && otherClassrooms.length === 0 && (
                <div className="card text-center py-12">
                  <p className="text-text-muted mb-4">No classrooms found</p>
                </div>
              )}

              {/* Logged in User Profile Card */}
              {user && (
                <div className="card">
                  <div className="flex items-center justify-between border-b border-ui-border pb-4 mb-4">
                    <h2 className="heading-lg font-bold">Profile Info</h2>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {user.imageUrl ? (
                        <div
                          className="rounded-full overflow-hidden border border-ui-border shrink-0 bg-ui-muted"
                          style={{
                            width: "48px",
                            height: "48px",
                            minWidth: "48px",
                            minHeight: "48px",
                            borderRadius: "50%",
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src={user.imageUrl}
                            alt={user.fullName || "User Avatar"}
                            className="w-full h-full object-cover"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          className="rounded-full bg-brand-teal/10 text-brand-teal flex items-center justify-center font-bold text-lg border border-brand-teal/20 shrink-0"
                          style={{
                            width: "48px",
                            height: "48px",
                            minWidth: "48px",
                            minHeight: "48px",
                            borderRadius: "50%",
                            flexShrink: 0,
                          }}
                        >
                          {user.firstName?.[0] || user.lastName?.[0] || "?"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-text-primary text-base">
                          {user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Student"}
                        </p>
                        <p className="text-xs text-text-muted font-mono">
                          {user.primaryEmailAddress?.emailAddress}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1.5 bg-ui-surface-hover px-2.5 py-1 rounded-md">
                        Role: <strong className="text-brand-teal">Student</strong>
                      </span>
                      <span className="flex items-center gap-1.5 bg-ui-surface-hover px-2.5 py-1 rounded-md">
                        Last Active: <strong className="text-text-primary font-mono">{new Date().toLocaleDateString()}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Organization Details Card */}
              {organization && (
                <div className="card">
                  <div className="flex items-center justify-between border-b border-ui-border pb-4 mb-4">
                    <h2 className="heading-lg font-bold">Organization</h2>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">Current Workspace</p>
                    <h3 className="text-lg font-bold text-brand-teal mt-0.5">{organization.name}</h3>
                    <p className="text-xs text-text-muted mt-2 leading-relaxed">
                      You are participating in this organization as a student member. Enrolled classrooms will appear in your workspace.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </BasicLayout>
    );
  }

  return (
    <BasicLayout>
      <LoadingOverlay loading={isLoading} />
      <div className="page">
        <div className="container space-y-4">
          {/* Alert Message for Missing Decision */}
          {showAlert &&
            currentScenarioData?.challenge &&
            currentScenarioData?.challengeId && (
              <Alert
                icon="pi pi-exclamation-triangle"
                title="Decision Required"
                message={
                  <>
                    You have an active challenge that requires your decision.{" "}
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/challenges/${currentScenarioData.challengeId}`)
                      }
                      className="underline font-medium hover:text-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal rounded"
                    >
                      Submit your decisions for "
                      {currentScenarioData.challenge.title || "challenge"}"
                    </button>
                  </>
                }
                variant="warning"
                closable
                onClose={() =>
                  setDismissedScenarioId(
                    currentScenarioData?.challengeId ?? null
                  )
                }
                actions={[
                  {
                    label: "Submit Now",
                    onClick: () =>
                      navigate(`/challenges/${currentScenarioData.challengeId}`),
                  },
                ]}
              />
            )}

          {currentScenarioData?.challenge && scenarioDeadline && (
            <div className="card">
              <h2 className="heading-sm">Current Challenge Deadline</h2>
              <p className="text-sm text-text-muted mt-1">
                Submit decisions by{" "}
                <strong className="text-text-primary">
                  {scenarioDeadline.toLocaleString()}
                </strong>
                .
              </p>
            </div>
          )}

          {/* 1) Profile Header (Always Visible) */}
          <ProfileHeader />

          {/* 3) Action Required Banner */}
          <StudentActionBanner />

          {/* 2) Current Week / Challenge Card (Primary Focus) */}
          {/* <CurrentScenarioCard
            challenge={currentScenarioData?.challenge ?? null}
            submissionStatus={currentScenarioData?.submissionStatus ?? null}
          /> */}

          {/* 4) Quick Decision Summary (After Decision) */}
          {/* <DecisionSummary
              challengeId={currentScenarioData?.challengeId ?? null}
            /> */}

          {/* 5) Latest Results Snapshot (After Approval) */}
          {/* <ResultsSnapshot
              challengeId={currentScenarioData?.challengeId ?? null}
            /> */}

          {/* 6) Performance Over Time (Mini Chart) */}
          <PerformanceChart />

          {/* 7) Leaderboard Snapshot */}
          {/* <LeaderboardSnapshot
              challengeId={currentScenarioData?.challengeId ?? null}
              variant="student"
            /> */}

          {/* 8) Achievements & Upgrades */}
          {/* <div className="card">
              <h2 className="heading-md mb-2">Achievements & upgrades</h2>
              <p className="text-text-muted text-sm">
                Your unlocks and upgrades will appear here as the game
                progresses.
              </p>
            </div> */}

          {/* 9) Class Averages & Insights */}

          {/* 10) Past Weeks (Collapsed by Default) */}
          <PastChallenges
            currentScenarioId={currentScenarioData?.challengeId ?? null}
            variant="student"
          />

          {/* 12) Help & Rules Reminder (Subtle) */}
          <div className="student-dashboard-footnote">
            Deadlines and rules are set by your instructor. If you miss a week,
            you'll still continue — the goal is learning through iteration.
          </div>
        </div>
      </div>
    </BasicLayout>
  );
};

export default Dashboard;
