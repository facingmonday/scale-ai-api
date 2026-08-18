import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import BasicLayout from "@/components/Layouts/BasicLayout.tsx";
import { useAuth } from "@/context/AuthContext";
import { useGlobalContext } from "@/context/GlobalContext";
import classroomService from "@/services/classroom";
import challengeService from "@/services/challenge";
import enrollmentService from "@/services/enrollment";
import type { ClassroomWithVirtuals } from "@/types/classroom";



import {
  TeacherCurrentChallengeCard,
  TeacherActionRequired,
  LeaderboardSnapshot,
  ClassroomHeader,
} from "@/components/dashboard";
import type { Challenge } from "@/types/challenge";
import type { StudentDisplay } from "@/types/components";
import type { ClassDashboard } from "@/types/dashboard";
import StudentList from "@/components/StudentList";
import { useNavigate } from "react-router-dom";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { getErrorMessage } from "@/utils/error";
import {
  getChallengeLifecycleBadgeClass,
  getChallengeLifecycleStatus,
} from "@/utils/challengeStatus";
import LoadingOverlay from "../../../components/LoadingOverlay";
import Alert from "../../../components/Alert";

const PLAN_LABELS: Record<string, string> = {
  org_seats: "Organization Seats",
  student_class_pass: "Student Seat",
};

const Dashboard: React.FC = () => {
  const { activeClassroom, userRole, billing, setNewActiveClassroom } = useAuth();
  const navigate = useNavigate();
  const globalContext = useGlobalContext();

  // Multi-classroom workspace states
  const [myClassrooms, setMyClassrooms] = useState<ClassroomWithVirtuals[]>([]);
  const [allOrgClassrooms, setAllOrgClassrooms] = useState<ClassroomWithVirtuals[]>([]);
  const [classDashboards, setClassDashboards] = useState<Record<string, ClassDashboard>>({});
  const [isFetchingMultiClass, setIsFetchingMultiClass] = useState(false);
  const [multiClassError, setMultiClassError] = useState<string | null>(null);




  const fetchMultiClassData = useCallback(async () => {
    setIsFetchingMultiClass(true);
    setMultiClassError(null);
    try {
      const myClassesData = await enrollmentService.getMyClasses();
      const myClasses = myClassesData.data || [];
      setMyClassrooms(myClasses);

      const orgClassroomsData = await classroomService.getAll();
      const allOrg = orgClassroomsData.data || orgClassroomsData || [];

      const enrolledIds = myClasses.map(
        (c: ClassroomWithVirtuals) => c._id
      );
      const availableClassrooms = allOrg.filter(
        (c: ClassroomWithVirtuals) => !enrolledIds.includes(c._id)
      );
      setAllOrgClassrooms(availableClassrooms);

      const dashboardsMap: Record<string, ClassDashboard> = {};
      await Promise.all(
        myClasses.map(async (cls: ClassroomWithVirtuals) => {
          try {
            const db = await classroomService.getAdminDashboard(cls._id);
            dashboardsMap[cls._id] = db;
          } catch (e) {
            console.error(`Failed to fetch dashboard for classroom ${cls._id}:`, e);
          }
        })
      );
      setClassDashboards(dashboardsMap);
    } catch (err) {
      console.error("Failed to load classrooms and dashboards:", err);
      setMultiClassError("Failed to load your classrooms.");
    } finally {
      setIsFetchingMultiClass(false);
    }
  }, []);

  useEffect(() => {
    if (!activeClassroom && userRole === "org:admin") {
      void fetchMultiClassData();
    }
  }, [activeClassroom, userRole, fetchMultiClassData]);



  const handleClassroomSelect = async (classroom: ClassroomWithVirtuals) => {
    try {
      globalContext?.setIsLoading(true);
      await setNewActiveClassroom(classroom);
      globalContext?.setIsLoading(false);
    } catch (err) {
      console.error("Failed to select classroom:", err);
      globalContext?.showToast?.("Failed to select classroom. Please try again.", "error");
      globalContext?.setIsLoading(false);
    }
  };

  const handleJoinClassroom = async (classroom: ClassroomWithVirtuals) => {
    try {
      globalContext?.setIsLoading(true);
      await enrollmentService.joinClass(classroom._id);
      await setNewActiveClassroom(classroom);
      globalContext?.setIsLoading(false);
    } catch (err) {
      console.error("Failed to join classroom:", err);
      globalContext?.showToast?.("Failed to join classroom. Please try again.", "error");
      globalContext?.setIsLoading(false);
    }
  };

  const classroomId = activeClassroom?._id || null;
  const [dashboard, setDashboard] = useState<ClassDashboard | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [challenges, setScenarios] = useState<Challenge[]>([]);
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(false);
  const [rosterRefreshKey, setRosterRefreshKey] = useState(0);

  const [selectedStudent, setSelectedStudent] = useState<StudentDisplay | null>(
    null
  );
  const [isRemoveStudentDialogOpen, setIsRemoveStudentDialogOpen] =
    useState(false);
  const [isRemovingStudent, setIsRemovingStudent] = useState(false);
  const [removeStudentError, setRemoveStudentError] = useState<string | null>(
    null
  );

  const cancelledRef = useRef(false);

  const activeScenarioId = useMemo(() => {
    const s = dashboard?.activeScenario as unknown as
      | { _id?: string; id?: string }
      | null
      | undefined;
    return (s?._id || s?.id || null) as string | null;
  }, [dashboard?.activeScenario]);

  const nextScheduledScenario = useMemo(() => {
    const now = Date.now();
    return [...challenges]
      .filter((challenge) => {
        if (challenge.isPublished || challenge.isClosed || !challenge.publishAt) {
          return false;
        }
        return new Date(challenge.publishAt).getTime() >= now;
      })
      .sort(
        (a, b) =>
          new Date(a.publishAt || 0).getTime() -
          new Date(b.publishAt || 0).getTime()
      )[0];
  }, [challenges]);

  const blockedAutomations = useMemo(
    () =>
      challenges.filter(
        (challenge) =>
          challenge.automationMode === "FULL" &&
          (challenge.automationStatus === "BLOCKED" ||
            challenge.automationStatus === "FAILED")
      ),
    [challenges]
  );

  // Fetch dashboard once; pass it to child components that need it.
  const fetchDashboard = useCallback(async (silent = false) => {
    if (!classroomId) {
      setDashboard(null);
      return;
    }

    cancelledRef.current = false;

    if (!silent) {
      setIsLoadingDashboard(true);
    }
    try {
      const data = await classroomService.getAdminDashboard(classroomId);
      if (cancelledRef.current) return;
      setDashboard(data);
    } catch (err) {
      if (cancelledRef.current) return;
      console.error("Failed to fetch dashboard:", err);
      setDashboard(null);
    } finally {
      if (!silent && !cancelledRef.current) {
        setIsLoadingDashboard(false);
      }
    }
  }, [classroomId]);

  useEffect(() => {
    if (!classroomId) {
      const timeoutId = setTimeout(() => {
        setDashboard(null);
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    cancelledRef.current = false;
    // Fire and forget async function for data fetching
    (async () => {
      await fetchDashboard();
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [classroomId, fetchDashboard]);

  const handleStudentClick = (student: StudentDisplay) => {
    const id = student.userId || student.id;
    if (!id) return;
    navigate(`/students/${id}`);
  };

  const openRemoveStudentDialog = (student: StudentDisplay) => {
    setSelectedStudent(student);
    setRemoveStudentError(null);
    setIsRemoveStudentDialogOpen(true);
  };

  const handleRemoveStudent = async () => {
    if (!classroomId || !selectedStudent || isRemovingStudent) return;

    setIsRemovingStudent(true);
    setRemoveStudentError(null);
    try {
      const id = selectedStudent.userId || selectedStudent.id;
      const response = await enrollmentService.removeStudent(classroomId, id);
      const seatAction = response?.data?.seatRelease?.action;
      const seatMessage =
        seatAction === "released_to_org"
          ? "Student removed. Organization seat returned to the pool."
          : seatAction === "held"
            ? "Student removed. Their paid seat is held for reuse in another class."
            : "Student removed from classroom";
      globalContext?.showToast?.(seatMessage, "success");
      setIsRemoveStudentDialogOpen(false);
      setSelectedStudent(null);
      setRosterRefreshKey((k) => k + 1);
    } catch (e) {
      const errorMessage = getErrorMessage(e);
      setRemoveStudentError(errorMessage);
      globalContext?.showToast?.(errorMessage, "error");
    } finally {
      setIsRemovingStudent(false);
    }
  };

  const fetchScenarios = useCallback(
    async (silent = false) => {
      if (!classroomId) return;

      cancelledRef.current = false;
      if (!silent) {
        setIsLoadingScenarios(true);
      }
      try {
        const response = await challengeService.getAll(classroomId, "admin");
        if (cancelledRef.current) return;
        setScenarios(response.data || response || []);
      } catch (err) {
        if (cancelledRef.current) return;
        console.error("Failed to fetch challenges:", err);
      } finally {
        if (!silent && !cancelledRef.current) {
          setIsLoadingScenarios(false);
        }
      }
    },
    [classroomId]
  );

  useEffect(() => {
    if (!classroomId) {
      setScenarios([]);
      return;
    }

    cancelledRef.current = false;
    // Fire and forget async function for data fetching
    (async () => {
      await fetchScenarios();
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [classroomId, fetchScenarios]);

  useEffect(() => {
    const handleFocus = () => {
      if (classroomId) {
        void fetchDashboard(true); // Refresh dashboard on focus (silent)
        void fetchScenarios(true); // Refresh challenges on focus (silent)
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [classroomId, fetchDashboard, fetchScenarios]);

  const handleScenarioClick = (challenge: Challenge) => {
    const id = challenge._id || (challenge as Challenge & { id?: string }).id;
    if (id) {
      navigate(`/challenges/${id}`);
    }
  };

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString();
  };

  const formatDateTime = (date: string | Date | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleString();
  };

  const statusBodyTemplate = (rowData: Challenge) => {
    const status = getChallengeLifecycleStatus(rowData);
    return (
      <span className={`badge ${getChallengeLifecycleBadgeClass(status)}`}>
        {status}
      </span>
    );
  };

  if (!activeClassroom) {
    const seatPools = billing?.seatPools || [];
    const totalSeats = seatPools.reduce(
      (sum, pool) => sum + (pool.totalSeats ?? 0),
      0
    );
    const usedSeats = seatPools.reduce((sum, pool) => sum + (pool.usedSeats || 0), 0);
    const remainingSeats = Math.max(totalSeats - usedSeats, 0);
    const hasOrgSeats = totalSeats > 0;

    return (
      <BasicLayout>
        <LoadingOverlay loading={isFetchingMultiClass} />
        <div className="page">
          <div className="container">
            {/* Workspace Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
              <div>
                <h1 className="heading-xl text-3xl font-extrabold tracking-tight">Teacher Workspace</h1>
                <p className="text-text-muted mt-1 text-sm">
                  Manage your classes, monitor student progress, and check billing status.
                </p>
              </div>
              <div className="mt-4 md:mt-0 flex gap-3">
                <button
                  onClick={() => navigate("/classrooms/new")}
                  className="btn-blue text-white flex items-center gap-2"
                >
                  <span>+ New Classroom</span>
                </button>
              </div>
            </div>

            {/* Error banner */}
            {multiClassError && (
              <div className="alert alert-error mb-6">
                {multiClassError}
                <button onClick={() => void fetchMultiClassData()} className="btn-outline btn-xs ml-4">
                  Retry
                </button>
              </div>
            )}

            {/* Sections */}
            <div className="space-y-6 w-full">
              {/* My Classrooms */}
              <div className="card">
                <div className="flex items-center justify-between border-b border-ui-border pb-4 mb-4">
                  <h2 className="heading-lg font-bold">My Classrooms</h2>
                  <span className="badge bg-brand-teal/10 text-brand-teal px-2.5 py-0.5 text-xs font-semibold rounded-full">
                    {myClassrooms.length} Active
                  </span>
                </div>

                {isFetchingMultiClass ? (
                  <div className="flex justify-center items-center py-12">
                    <i className="pi pi-spin pi-spinner text-brand-teal text-3xl" />
                  </div>
                ) : myClassrooms.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-teal/10 text-brand-teal mb-4">
                      <i className="pi pi-school text-xl" />
                    </div>
                    <h3 className="heading-md font-semibold text-text-primary mb-1">No Classrooms Yet</h3>
                    <p className="text-text-muted text-sm max-w-sm mx-auto mb-6">
                      Get started by creating your first classroom. You can use templates to prefill scenarios and variable configurations.
                    </p>
                    <button
                      onClick={() => navigate("/classrooms/new")}
                      className="btn-teal"
                    >
                      Create Classroom
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myClassrooms.map((cls) => {
                      const db = classDashboards[cls._id];
                      const activeScenarioTitle = db?.activeScenario?.title || "No Active Scenario";
                      const studentCount = db?.students ?? 0;
                      const pendingApprovals = db?.pendingApprovals ?? 0;

                      return (
                        <div
                          key={cls._id}
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
                                <i className="pi pi-users text-brand-teal" />
                                <strong>{studentCount}</strong> students
                              </span>
                              <span className="flex items-center gap-1.5 bg-ui-surface-hover px-2.5 py-1 rounded-md">
                                <i className="pi pi-play text-brand-blue" />
                                Active Challenge: <strong className="text-text-primary">{activeScenarioTitle}</strong>
                              </span>
                              {pendingApprovals > 0 && (
                                <span className="flex items-center gap-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-md font-medium">
                                  <i className="pi pi-exclamation-triangle" />
                                  <strong>{pendingApprovals}</strong> pending reviews
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end md:self-center">
                            <button
                              onClick={() => void handleClassroomSelect(cls)}
                              className="btn-teal py-1.5 px-4 text-sm font-medium whitespace-nowrap"
                            >
                              Enter Class
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Organization Classes to Join */}
              {allOrgClassrooms.length > 0 && (
                <div className="card">
                  <div className="flex items-center justify-between border-b border-ui-border pb-4 mb-4">
                    <h2 className="heading-lg font-bold">Other Classes in Organization</h2>
                    <span className="text-xs text-text-muted">{allOrgClassrooms.length} available</span>
                  </div>
                  <div className="space-y-3">
                    {allOrgClassrooms.map((cls) => (
                      <div
                        key={cls._id}
                        className="border border-ui-border/60 rounded-xl p-4 bg-ui-surface/50 flex items-center justify-between gap-4"
                      >
                        <div>
                          <h3 className="font-semibold text-text-primary">{cls.name}</h3>
                          {cls.description && (
                            <p className="text-xs text-text-muted line-clamp-1">{cls.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => void handleJoinClassroom(cls)}
                          className="btn-outline py-1 px-3 text-xs"
                        >
                          Join as Teacher
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Workspace Status */}
              <div className="card space-y-4">
                <h2 className="heading-lg font-bold border-b border-ui-border pb-3">Workspace Status</h2>

                {/* Plan details */}
                <div className="space-y-1">
                  <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">Active Plan</p>
                  <h3 className="text-xl font-extrabold text-brand-teal">
                    {hasOrgSeats
                      ? PLAN_LABELS.org_seats
                      : "Free Teacher Workspace"}
                  </h3>
                </div>

                {/* Classroom limit */}
                <div className="space-y-1 pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Classroom Limit Usage</span>
                    <span className="font-bold text-text-primary">
                      {myClassrooms.length} / {billing?.freeTeacherLimits?.classroomLimit ?? 3} Classes
                    </span>
                  </div>
                  <div className="w-full bg-ui-border rounded-full h-2 overflow-hidden mt-1">
                    <div
                      className="bg-brand-teal h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          (myClassrooms.length / (billing?.freeTeacherLimits?.classroomLimit ?? 3)) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Seats status */}
                <div className="space-y-3 pt-2 border-t border-ui-border/60">
                  <div>
                    <p className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-1">Student Seats</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-ui-surface-hover rounded-lg p-2 border border-ui-border/40">
                        <p className="text-xs text-text-muted">Total</p>
                        <p className="text-lg font-bold text-text-primary">{totalSeats}</p>
                      </div>
                      <div className="bg-ui-surface-hover rounded-lg p-2 border border-ui-border/40">
                        <p className="text-xs text-text-muted">Claimed</p>
                        <p className="text-lg font-bold text-brand-blue">{usedSeats}</p>
                      </div>
                      <div className="bg-ui-surface-hover rounded-lg p-2 border border-ui-border/40">
                        <p className="text-xs text-text-muted">Available</p>
                        <p className="text-lg font-bold text-brand-teal">{remainingSeats}</p>
                      </div>
                    </div>
                  </div>

                  {totalSeats > 0 && (
                    <div className="w-full bg-ui-border rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-brand-blue h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min((usedSeats / totalSeats) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Info helper */}
                <div className="bg-brand-blue/5 border border-brand-blue/10 rounded-xl p-4 text-sm space-y-2 mt-4">
                  <h4 className="font-semibold text-text-primary flex items-center gap-1.5">
                    <i className="pi pi-info-circle text-brand-blue" />
                    Workspace Management
                  </h4>
                  <p className="text-text-muted text-xs leading-relaxed">
                    Need more classrooms or student seats? You can provision additional seat packs or upgrade your subscription from the <a href="/settings" className="text-brand-blue hover:underline font-semibold">Billing Settings</a> page.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>



      </BasicLayout>
    );
  }

  return (
    <BasicLayout>
      <LoadingOverlay loading={isLoadingScenarios || isLoadingDashboard} />
      <div className="page">
        <div className="container">
          {dashboard && dashboard.metricDefinitionCount === 0 && (
            <div className="mb-4">
              <Alert
                icon="pi pi-exclamation-triangle"
                title="Metrics need to be configured"
                message="This classroom has no metrics yet. Add at least one metric so challenge results, comparisons, and the leaderboard can be generated."
                variant="warning"
                actions={[
                  {
                    label: "Configure Metrics",
                    onClick: () =>
                      navigate(
                        `/classroom/${activeClassroom._id}?tab=definitions`
                      ),
                  },
                ]}
              />
            </div>
          )}
          {(nextScheduledScenario || blockedAutomations.length > 0) && (
            <div className="card mb-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="heading-md">Automation Status</h2>
                  {nextScheduledScenario ? (
                    <p className="text-sm text-text-muted mt-1">
                      Next scheduled challenge:{" "}
                      <strong className="text-text-primary">
                        {nextScheduledScenario.title}
                      </strong>{" "}
                      opens {formatDateTime(nextScheduledScenario.publishAt)}
                    </p>
                  ) : (
                    <p className="text-sm text-text-muted mt-1">
                      No upcoming automated challenges are scheduled.
                    </p>
                  )}
                </div>
                {blockedAutomations.length > 0 && (
                  <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {blockedAutomations.length} automated challenge
                    {blockedAutomations.length === 1 ? "" : "s"} need
                    attention.
                  </div>
                )}
              </div>
            </div>
          )}
          <ClassroomHeader
            classroomName={activeClassroom.name}
            classroomId={activeClassroom._id}
            dashboard={dashboard}
            isLoadingDashboard={isLoadingDashboard}
            challenges={challenges}
          />
        </div>
        <div className="container">
          <div className="flex flex-col lg:flex-row gap-4 w-full">
            <div className="card flex-1">
              <TeacherCurrentChallengeCard
                classroomId={classroomId}
                dashboard={dashboard}
                isLoadingDashboard={isLoadingDashboard}
                challenges={challenges}
                onRefreshDashboard={fetchDashboard}
                onRefreshScenarios={fetchScenarios}
              />
            </div>
            <div className="card flex-1">
              <TeacherActionRequired
                classroomId={classroomId}
                activeScenarioId={activeScenarioId}
                dashboard={dashboard}
              />
            </div>
            <div className="card flex-1">
              <LeaderboardSnapshot
                challengeId={activeScenarioId}
                variant="teacher"
                dashboard={dashboard}
              />
            </div>
          </div>
        </div>
        <div className="container">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="heading-lg">Students</h2>
              <a
                href={`/students`}
                className="btn-outline"
                style={{ minWidth: 0 }}
              >
                See All
              </a>
            </div>
            <StudentList
              key={`${classroomId}:${rosterRefreshKey}`}
              classroomId={classroomId}
              onStudentClick={handleStudentClick}
              onDelete={openRemoveStudentDialog}
            />
          </div>
        </div>
        <div className="container">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="heading-lg">Challenges</h2>
              <a
                href={`/challenges`}
                className="btn-outline"
                style={{ minWidth: 0 }}
              >
                See All
              </a>
            </div>
            <DataTable
              value={challenges}
              onRowClick={(e) => handleScenarioClick(e.data as Challenge)}
              selectionMode="single"
              dataKey="_id"
              emptyMessage="No challenges found"
              loading={isLoadingScenarios}
              paginator
              rows={10}
              rowsPerPageOptions={[5, 10, 20, 50]}
            >
              <Column
                field="title"
                header="Title"
                body={(rowData: Challenge) =>
                  rowData.title || "Untitled Challenge"
                }
                sortable
                sortField="title"
              />
              <Column
                field="description"
                header="Description"
                body={(rowData: Challenge) => {
                  const desc = rowData.description || "";
                  return desc.length > 50
                    ? `${desc.substring(0, 50)}...`
                    : desc || "—";
                }}
                sortable
                sortField="description"
              />
              <Column
                field="isPublished"
                header="Status"
                body={statusBodyTemplate}
                sortable
                sortField="isPublished"
              />
              <Column
                field="publishAt"
                header="Opens"
                body={(rowData: Challenge) => formatDateTime(rowData.publishAt)}
                sortable
                sortField="publishAt"
              />
              <Column
                field="submissionDeadlineAt"
                header="Due"
                body={(rowData: Challenge) =>
                  formatDateTime(rowData.submissionDeadlineAt)
                }
                sortable
                sortField="submissionDeadlineAt"
              />
              <Column
                field="automationStatus"
                header="Automation"
                body={(rowData: Challenge) =>
                  rowData.automationMode === "FULL"
                    ? rowData.automationStatus || "SCHEDULED"
                    : "Manual"
                }
                sortable
                sortField="automationStatus"
              />
              <Column
                field="createdAt"
                header="Created"
                body={(rowData: Challenge) => formatDate(rowData.createdDate)}
                sortable
                sortField="createdAt"
              />
            </DataTable>
          </div>
        </div>
      </div>

      {/* Remove Student Dialog */}
      <Dialog
        header="Remove Student"
        visible={isRemoveStudentDialogOpen}
        onHide={() => !isRemovingStudent && setIsRemoveStudentDialogOpen(false)}
        modal
        closable={!isRemovingStudent}
        dismissableMask={!isRemovingStudent}
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
            <Button
              label="Cancel"
              icon="pi pi-times"
              onClick={() => setIsRemoveStudentDialogOpen(false)}
              text
              disabled={isRemovingStudent}
            />
            <Button
              label="Remove student"
              icon="pi pi-check"
              onClick={handleRemoveStudent}
              severity="danger"
              loading={isRemovingStudent}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {removeStudentError ? (
            <p className="text-danger font-medium">{removeStudentError}</p>
          ) : null}
          <p className="text-text-muted">
            Remove{" "}
            <strong>
              {selectedStudent?.name ||
                selectedStudent?.email ||
                "this student"}
            </strong>{" "}
            from this classroom? This will revoke their access to this class.
          </p>
          <p className="text-danger font-semibold">
            This action cannot be undone.
          </p>
        </div>
      </Dialog>
    </BasicLayout>
  );
};

export default Dashboard;
