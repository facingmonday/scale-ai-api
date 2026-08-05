import React from "react";
import StudentList from "@/components/StudentList";

interface StudentOverviewProps {
  classroomId: string | null;
  onStudentClick: (student: { id: string; userId?: string }) => void;
}

const StudentOverview: React.FC<StudentOverviewProps> = ({
  classroomId,
  onStudentClick,
}) => {
  return (
    <div className="card">
      <details>
        <summary className="cursor-pointer select-none">
          <span className="heading-md">Student overview</span>
        </summary>

        <div className="mt-4">
          <StudentList
            classroomId={classroomId}
            onStudentClick={(student) => {
              const id = (student.userId as string) || student.id;
              if (id) onStudentClick({ id, userId: student.userId as string });
            }}
          />
        </div>
      </details>
    </div>
  );
};

export default StudentOverview;
