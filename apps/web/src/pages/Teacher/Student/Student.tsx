import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import membersService from "../../../services/members";
import enrollmentService from "../../../services/enrollment";
import decisionService from "../../../services/decision";
import SubmissionList from "../../../components/DecisionList";
import StudentStoreView from "../../../components/StudentProfileView";
import { useAuth } from "../../../context/AuthContext";
import type { MemberWithVirtuals } from "../../../types/member";
import LoadingOverlay from "../../../components/LoadingOverlay";

const Student: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeClassroom } = useAuth();
  const activeClassroomId = activeClassroom?._id;
  const [student, setStudent] = useState<MemberWithVirtuals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const formatClerkDate = (value?: string | number | null) => {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
  };

  const fetchStudent = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await membersService.getById(
        id,
        activeClassroomId,
      );
      setStudent(response.data || response);
    } catch (err) {
      console.error("Failed to fetch student:", err);
      setError("Failed to load student");
    } finally {
      setIsLoading(false);
    }
  }, [activeClassroomId, id]);

  useEffect(() => {
    if (id) {
      // The route parameter is the external trigger for this fetch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchStudent();
    }
  }, [id, fetchStudent]);

  const handleRemoveFromClass = async () => {
    if (!id || !activeClassroom?._id) return;

    setIsProcessing(true);
    try {
      await enrollmentService.removeStudent(activeClassroom._id, id);
      setShowRemoveDialog(false);
      navigate("/students");
    } catch (err) {
      console.error("Failed to remove student from class:", err);
      setError("Failed to remove student from class");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetSubmissions = async () => {
    if (!id || !activeClassroom?._id) return;

    setIsProcessing(true);
    try {
      await decisionService.deleteStudentSubmissions(id, activeClassroom._id);
      setShowResetDialog(false);
      // Refresh the page to show updated decisions
      window.location.reload();
    } catch (err) {
      console.error("Failed to reset decisions:", err);
      setError("Failed to reset decisions");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!id) return;

    setIsProcessing(true);
    try {
      await membersService.remove(id);
      setShowDeleteDialog(false);
      navigate("/students");
    } catch (err) {
      console.error("Failed to delete student:", err);
      setError("Failed to delete student");
    } finally {
      setIsProcessing(false);
    }
  };

  if (error) {
    return (
      <BasicLayout>
        <div className="page">
          <div className="container">
            <div className="card text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button onClick={fetchStudent} className="btn-teal">
                Try Again
              </button>
            </div>
          </div>
        </div>
      </BasicLayout>
    );
  }

  return (
    <BasicLayout>
      <LoadingOverlay loading={isLoading} />
      {!student ? (
        <div className="page">
          <div className="container">
            <div className="card text-center py-12">
              <h2 className="heading-lg mb-2">Student Not Found</h2>
              <p className="text-text-muted">
                The student you're looking for doesn't exist.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="page">
          <div className="container">
            <div className="card mb-6">
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                {student.imageUrl ? (
                  <img
                    src={student.imageUrl}
                    alt=""
                    className="size-20 rounded-full border border-ui-border object-cover"
                  />
                ) : (
                  <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-brand-teal/15 text-2xl font-bold text-brand-blue">
                    {(student.firstName?.[0] || student.lastName?.[0] || "S").toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Student
                  </p>
                  <h1 className="heading-xl mb-5">
                    {student.name ||
                      `${student.firstName || ""} ${student.lastName || ""}`.trim() ||
                      "Student"}
                  </h1>

                  <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Full name
                      </dt>
                      <dd className="mt-1 font-medium text-text-primary">
                        {student.fullName || student.name || "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Primary email
                      </dt>
                      <dd className="mt-1 break-all font-medium text-text-primary">
                        {student.email ? (
                          <a
                            href={`mailto:${student.email}`}
                            className="text-brand-blue hover:underline"
                          >
                            {student.email}
                          </a>
                        ) : (
                          "-"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Student ID
                      </dt>
                      <dd className="mt-1 font-medium text-text-primary">
                        {student.studentId || "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Username
                      </dt>
                      <dd className="mt-1 font-medium text-text-primary">
                        {student.username || "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Phone
                      </dt>
                      <dd className="mt-1 font-medium text-text-primary">
                        {student.phone || "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Clerk user ID
                      </dt>
                      <dd className="mt-1 break-all font-mono text-sm text-text-primary">
                        {student.clerkUserId || "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Email status
                      </dt>
                      <dd className="mt-1 capitalize font-medium text-text-primary">
                        {student.clerkProfile?.emailAddresses.find(
                          (email) => email.emailAddress === student.email,
                        )?.verification.status || "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Account created
                      </dt>
                      <dd className="mt-1 font-medium text-text-primary">
                        {formatClerkDate(student.clerkProfile?.createdAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Last sign-in
                      </dt>
                      <dd className="mt-1 font-medium text-text-primary">
                        {formatClerkDate(student.clerkProfile?.lastSignInAt)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            {activeClassroom?._id && id && (
              <>
                {/* Profile Section */}
                <div className="mb-6">
                  <h2 className="heading-lg mb-4">Profile</h2>
                  <StudentStoreView
                    studentId={id}
                    classroomId={activeClassroom._id}
                  />
                </div>

                {/* Decisions Section */}
                <div className="mb-6">
                  <SubmissionList
                    studentId={id}
                    classroomId={activeClassroom._id}
                  />
                </div>
              </>
            )}

            {/* Danger Zone */}
            <div className="card border-2 border-red-500/20">
              <h2 className="heading-md text-red-400 mb-4">Danger Zone</h2>
              <p className="text-text-muted text-sm mb-6">
                These actions are irreversible. Please be certain before
                proceeding.
              </p>

              <div className="flex flex-col gap-4">
                {activeClassroom?._id && (
                  <div className="flex items-center justify-between p-4 border border-red-500/20 rounded-lg">
                    <div>
                      <h3 className="font-semibold mb-1">Remove from Class</h3>
                      <p className="text-text-muted text-sm">
                        Remove this student from the current classroom. They
                        will no longer have access to this class.
                      </p>
                    </div>
                    <Button
                      label="Remove from Class"
                      icon="pi pi-sign-out"
                      onClick={() => setShowRemoveDialog(true)}
                      severity="danger"
                      outlined
                      className="[&_.p-button-icon]:mr-3"
                    />
                  </div>
                )}

                {activeClassroom?._id && (
                  <div className="flex items-center justify-between p-4 border border-red-500/20 rounded-lg">
                    <div>
                      <h3 className="font-semibold mb-1">
                        Reset All Decisions
                      </h3>
                      <p className="text-text-muted text-sm">
                        Delete all decisions for this student in the current
                        classroom. This action cannot be undone.
                      </p>
                    </div>
                    <Button
                      label="Reset Decisions"
                      icon="pi pi-refresh"
                      onClick={() => setShowResetDialog(true)}
                      severity="danger"
                      outlined
                      className="[&_.p-button-icon]:mr-3"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between p-4 border border-red-500/20 rounded-lg">
                  <div>
                    <h3 className="font-semibold mb-1">Delete Student</h3>
                    <p className="text-text-muted text-sm">
                      Permanently delete this student account. This will remove
                      them from all classrooms and delete all associated data.
                    </p>
                  </div>
                  <Button
                    label="Delete Student"
                    icon="pi pi-trash"
                    onClick={() => setShowDeleteDialog(true)}
                    severity="danger"
                    outlined
                    className="[&_.p-button-icon]:mr-3"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove from Class Dialog */}
      <Dialog
        header="Remove Student from Class"
        headerClassName="modal-header"
        visible={showRemoveDialog}
        onHide={() => !isProcessing && setShowRemoveDialog(false)}
        style={{ width: "50vw" }}
        className="modal"
        pt={{
          headerTitle: { className: "modal-title" },
          content: { className: "modal-content" },
          footer: { className: "modal-footer" },
        }}
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              label="Cancel"
              icon="pi pi-times"
              onClick={() => setShowRemoveDialog(false)}
              text
              disabled={isProcessing}
            />
            <Button
              label="Remove from Class"
              icon="pi pi-check"
              onClick={handleRemoveFromClass}
              severity="danger"
              loading={isProcessing}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-4 p-4">
          <p className="text-text-muted">
            Are you sure you want to remove{" "}
            <strong>
              {student?.name ||
                `${student?.firstName || ""} ${
                  student?.lastName || ""
                }`.trim() ||
                "this student"}
            </strong>{" "}
            from this classroom? They will no longer have access to this class,
            but their account and decisions will remain.
          </p>
        </div>
      </Dialog>

      {/* Reset Decisions Dialog */}
      <Dialog
        header="Reset All Decisions"
        visible={showResetDialog}
        onHide={() => !isProcessing && setShowResetDialog(false)}
        style={{ width: "50vw" }}
        headerClassName="modal-header"
        className="modal"
        pt={{
          headerTitle: { className: "modal-title" },
          content: { className: "modal-content" },
          footer: { className: "modal-footer" },
        }}
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              label="Cancel"
              icon="pi pi-times"
              onClick={() => setShowResetDialog(false)}
              text
              disabled={isProcessing}
            />
            <Button
              label="Reset Decisions"
              icon="pi pi-check"
              onClick={handleResetSubmissions}
              severity="danger"
              loading={isProcessing}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-text-muted">
            Are you sure you want to delete all decisions for{" "}
            <strong>
              {student?.name ||
                `${student?.firstName || ""} ${
                  student?.lastName || ""
                }`.trim() ||
                "this student"}
            </strong>{" "}
            in this classroom? This action cannot be undone.
          </p>
        </div>
      </Dialog>

      {/* Delete Student Dialog */}
      <Dialog
        header="Delete Student"
        visible={showDeleteDialog}
        onHide={() => !isProcessing && setShowDeleteDialog(false)}
        style={{ width: "50vw" }}
        headerClassName="modal-header"
        className="modal"
        pt={{
          headerTitle: { className: "modal-title" },
          content: { className: "modal-content" },
          footer: { className: "modal-footer" },
        }}
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              label="Cancel"
              icon="pi pi-times"
              onClick={() => setShowDeleteDialog(false)}
              text
              disabled={isProcessing}
            />
            <Button
              label="Delete Student"
              icon="pi pi-check"
              onClick={handleDeleteStudent}
              severity="danger"
              loading={isProcessing}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-text-muted">
            Are you sure you want to permanently delete{" "}
            <strong>
              {student?.name ||
                `${student?.firstName || ""} ${
                  student?.lastName || ""
                }`.trim() ||
                "this student"}
            </strong>
            ? This will:
          </p>
          <ul className="list-disc list-inside text-text-muted ml-4">
            <li>Remove them from all classrooms</li>
            <li>Delete all their decisions</li>
            <li>Permanently delete their account</li>
          </ul>
          <p className="text-red-400 font-semibold">
            This action cannot be undone.
          </p>
        </div>
      </Dialog>
    </BasicLayout>
  );
};

export default Student;
