import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import { useAuth } from "../../../context/AuthContext";
import StudentList from "../../../components/StudentList";
import InviteStudentDialog from "../../../components/InviteStudentDialog";
import ExportDialog from "../../../components/ExportDialog";
import enrollmentService from "../../../services/enrollment";
import type { StudentDisplay } from "../../../types/components";

const Students: React.FC = () => {
  const { activeClassroom } = useAuth();
  const navigate = useNavigate();
  const [studentCount, setStudentCount] = useState<number>(0);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const classroomId = activeClassroom?._id || null;

  const handleStudentClick = (student: StudentDisplay) => {
    const id = student.userId || student.id;
    if (!id) return;
    const selectedClassroomId = student.classroomId || classroomId;
    const query = selectedClassroomId
      ? `?classroomId=${encodeURIComponent(selectedClassroomId)}`
      : "";
    navigate(`/students/${id}${query}`);
  };

  const handleStudentsLoaded = (_students: StudentDisplay[], count: number) => {
    setStudentCount(count);
  };

  const handleInviteSuccess = () => {
    // Optionally refresh the student list
    // The StudentList component will automatically refresh when classroomId changes
    // For now, we'll just close the dialog and let the user manually refresh if needed
  };

  const handleExportClick = () => {
    if (!classroomId) return;
    setShowExportDialog(true);
  };

  const handleExport = async () => {
    if (!classroomId) {
      throw new Error("No classroom selected");
    }
    return await enrollmentService.exportRoster(classroomId, {});
  };

  const emptyState = (
    <div className="card text-center py-12">
      <svg
        className="w-16 h-16 mx-auto mb-4 text-text-muted"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
      <h2 className="heading-lg mb-2">No Students Yet</h2>
      <p className="text-text-muted mb-6">
        This class doesn't have any students enrolled yet. Invite students to
        get started!
      </p>
      <button className="btn-teal" onClick={() => setShowInviteDialog(true)}>
        Invite Your First Student
      </button>
    </div>
  );

  return (
    <BasicLayout>
      <div className="page">
        <div className="container">
          <div className="flex items-center justify-between mb-6">
            <h1 className="heading-xl">Students ({studentCount})</h1>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-outline"
                onClick={handleExportClick}
                disabled={!classroomId}
              >
                Export
              </button>
              <button
                className="btn-teal"
                onClick={() => setShowInviteDialog(true)}
                disabled={!classroomId}
              >
                + Invite Students
              </button>
            </div>
          </div>

          <StudentList
            classroomId={classroomId}
            onStudentClick={handleStudentClick}
            onStudentsLoaded={handleStudentsLoaded}
            emptyState={emptyState}
          />

          {classroomId && (
            <InviteStudentDialog
              visible={showInviteDialog}
              onHide={() => setShowInviteDialog(false)}
              classroomId={classroomId}
              onSuccess={handleInviteSuccess}
            />
          )}

          {classroomId && (
            <ExportDialog
              visible={showExportDialog}
              onHide={() => setShowExportDialog(false)}
              onExport={handleExport}
              exportName="roster"
            />
          )}
        </div>
      </div>
    </BasicLayout>
  );
};

export default Students;
