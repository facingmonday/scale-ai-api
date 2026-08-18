import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import {
  CurrentChallengeCard,
  PerformanceChart,
  PastChallenges,
  StudentDashboardInsights,
  StudentLearningResources,
} from "../../../components/dashboard";
import { useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useGlobalContext } from "../../../context/GlobalContext";
import { useUser } from "@clerk/clerk-react";
import challengeService from "../../../services/challenge";
import enrollmentService from "../../../services/enrollment";
import classroomService from "../../../services/classroom";
import licensingService from "../../../services/licensing";
import profileService from "../../../services/profile";
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
import type { StudentDashboardResponse } from "../../../types/dashboard";
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
  const [studentDashboard, setStudentDashboard] =
    useState<StudentDashboardResponse | null>(null);

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
        const [scenarioResult, dashboardResult] = await Promise.allSettled([
          challengeService.getCurrent(classroomId),
          classroomService.getStudentDashboard(classroomId),
        ]);
        if (cancelledRef.current) return;
        const data =
          scenarioResult.status === "fulfilled"
            ? (unwrap(scenarioResult.value) as {
                challenge?: ScenarioWithVariables;
                submissionStatus?: {
                  submitted: boolean;
                  submittedAt: string | null;
                };
              } | null)
            : null;

        if (scenarioResult.status === "rejected") {
          console.error(
            "Failed to fetch current challenge:",
            scenarioResult.reason
          );
        }
        if (dashboardResult.status === "fulfilled") {
          setStudentDashboard(dashboardResult.value);
        } else {
          console.error(
            "Failed to fetch student dashboard:",
            dashboardResult.reason
          );
          setStudentDashboard(null);
        }

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
        setStudentDashboard(null);
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
        setStudentDashboard(null);
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
  const [leavingClassroomId, setLeavingClassroomId] = useState<string | null>(
    null
  );
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
            const scenarioData = unwrap(scenarioRes) as {
              challenge?: ScenarioWithVariables;
              submissionStatus?: {
                submitted: boolean;
                submittedAt: string | null;
              };
            } | null;
            scenariosMap[cid] = scenarioData
              ? {
                  challenge: scenarioData.challenge ?? null,
                  submissionStatus: scenarioData.submissionStatus ?? null,
                }
              : null;
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

  const handleLeaveClassroom = async (
    classroom: ClassroomWithVirtuals
  ) => {
    const cid =
      classroom._id ||
      (classroom as ClassroomWithVirtuals & { id?: string }).id;
    if (!cid || leavingClassroomId) return;

    const confirmed = window.confirm(
      `Leave ${classroom.name}? You can rejoin later if you still have an available seat.`
    );
    if (!confirmed) return;

    setLeavingClassroomId(cid);
    try {
      const response = await enrollmentService.leaveClass(cid);
      const action = response?.data?.seatRelease?.action;
      const message =
        action === "released_to_org"
          ? "You've left this class. Your organization seat is available for another student."
          : action === "held"
            ? "You've left this class. Your paid seat can be used for another class in this organization."
            : "You've left this class.";
      globalContext?.showToast?.(message, "success");
      await fetchClassrooms();
    } catch (err) {
      console.error("Failed to leave classroom:", err);
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response
              ?.data?.error
          : undefined;
      globalContext?.showToast?.(
        message || "Failed to leave classroom.",
        "error"
      );
    } finally {
      setLeavingClassroomId(null);
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
                  <>
                    <button
                      className="btn-teal mt-4"
                      disabled={isStartingCheckout}
                      onClick={() => void startCheckout()}
                    >
                      {isStartingCheckout
                        ? "Starting checkout..."
                        : "Buy Class Access"}
                    </button>
                    <p className="text-text-muted text-xs mt-3">
                      For refund requests, please contact support.
                    </p>
                  </>
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
                            <button
                              onClick={() => void handleLeaveClassroom(cls)}
                              disabled={leavingClassroomId === cid}
                              className="btn-outline py-1.5 px-4 text-sm font-medium whitespace-nowrap"
                            >
                              {leavingClassroomId === cid ? "Leaving..." : "Leave Class"}
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

          {studentDashboard ? (
            <StudentDashboardInsights
              dashboard={studentDashboard}
              currentChallengeDeadline={scenarioDeadline}
            />
          ) : (
            <div className="card">
              <p className="text-sm text-text-muted">
                Dashboard details are temporarily unavailable.
              </p>
            </div>
          )}

          {currentScenarioData?.challenge && (
            <CurrentChallengeCard
              challenge={currentScenarioData.challenge}
              submissionStatus={currentScenarioData.submissionStatus}
            />
          )}

          <PerformanceChart
            results={studentDashboard?.recentResults}
            definitions={studentDashboard?.metricDefinitions}
          />
          <PastChallenges
            currentScenarioId={currentScenarioData?.challengeId ?? null}
            variant="student"
            results={studentDashboard?.recentResults}
            metricDefinitions={studentDashboard?.metricDefinitions}
            hasProfile={Boolean(studentDashboard?.profile)}
          />
          <StudentLearningResources />

          <div className="flex items-start gap-3 rounded-xl border border-brand-teal/20 bg-brand-teal/10 px-4 py-3 text-xs leading-5 text-text-secondary">
            <GraduationCap
              className="mt-0.5 size-4 shrink-0 text-brand-blue"
              aria-hidden
            />
            <p>
              Deadlines and rules are set by your instructor. If you miss a
              week, you’ll still continue — the goal is learning through
              iteration.
            </p>
          </div>
        </div>
      </div>
    </BasicLayout>
  );
};

export default Dashboard;
