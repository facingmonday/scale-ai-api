import React from "react";
import { useNavigate } from "react-router-dom";

interface QuickLinksProps {
  activeClassroomId: string;
  onCreateScenario: () => void;
}

const QuickLinks: React.FC<QuickLinksProps> = ({
  activeClassroomId,
  onCreateScenario,
}) => {
  const navigate = useNavigate();

  return (
    <div className="card">
      <h2 className="heading-md">Quick links</h2>
      <div className="mt-3 grid gap-2">
        <button type="button" className="btn-teal" onClick={onCreateScenario}>
          Create new challenge
        </button>
        <button
          type="button"
          className="btn-outline"
          onClick={() => navigate("/challenges")}
        >
          Manage challenges
        </button>
        <button
          type="button"
          className="btn-outline"
          onClick={() =>
            navigate(
              `/classrooms?edit=${encodeURIComponent(activeClassroomId)}`
            )
          }
        >
          Classroom settings
        </button>
        <button
          type="button"
          className="btn-outline"
          onClick={() => navigate("/students")}
        >
          Students
        </button>
        <button
          type="button"
          className="btn-outline"
          onClick={() => navigate("/decisions")}
        >
          Decisions
        </button>
        <button
          type="button"
          className="btn-outline"
          onClick={() => navigate("/profile")}
        >
          Help / docs
        </button>
      </div>
    </div>
  );
};

export default QuickLinks;
