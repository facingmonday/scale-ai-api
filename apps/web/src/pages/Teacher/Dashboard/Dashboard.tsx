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
import LoadingOverlay from "../../../components/LoadingOverlay";

const Dashboard: React.FC = () => {
  const { activeClassroom } = useAuth();
  const navigate = useNavigate();
  const globalContext = useGlobalContext();

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
  const fetchDashboard = useCallback(async () => {
    if (!classroomId) {
      setDashboard(null);
      return;
    }

    cancelledRef.current = false;

    try {
      setIsLoadingDashboard(true);
      const data = await classroomService.getAdminDashboard(classroomId);
      if (cancelledRef.current) return;
      setDashboard(data);
    } catch (err) {
      if (cancelledRef.current) return;
      console.error("Failed to fetch dashboard:", err);
      setDashboard(null);
    } finally {
      if (!cancelledRef.current) {
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
      await enrollmentService.removeStudent(classroomId, id);
      globalContext?.showToast?.("Student removed from classroom", "success");
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
        void fetchDashboard(); // Refresh on focus
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
    if (!rowData.isPublished) {
      return <span className="badge badge-warning">Draft</span>;
    }
    if (rowData.isClosed) {
      return (
        <span className="badge bg-ui-muted text-text-secondary">Closed</span>
      );
    }
    return <span className="badge badge-success">Open</span>;
  };

  if (!activeClassroom) return <div>No classroom found</div>;

  return (
    <BasicLayout>
      <LoadingOverlay loading={isLoadingScenarios || isLoadingDashboard} />
      <div className="page">
        <div className="container">
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
