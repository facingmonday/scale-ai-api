import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import challengeService from "../../services/challenge";
import { unwrap } from "./utils";
import type { Challenge } from "@/types/challenge";

interface PastScenariosProps {
  currentScenarioId?: string | null;
  variant?: "student" | "teacher";
  limit?: number;
  onRerun?: (challengeId: string) => Promise<void>;
}

const PastScenarios: React.FC<PastScenariosProps> = ({
  currentScenarioId,
  variant = "student",
}) => {
  const { activeClassroom } = useAuth();
  const navigate = useNavigate();
  const [challenges, setScenarios] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const classroomId = activeClassroom?._id ?? null;

  useEffect(() => {
    if (!classroomId) {
      setScenarios([]);
      setIsLoading(false);
      return;
    }

    const fetchScenarios = async () => {
      setIsLoading(true);
      try {
        const response = await challengeService.getAll(
          classroomId,
          variant === "teacher" ? "admin" : "student"
        );
        const list = unwrap(response) as Challenge[];
        setScenarios(list);
      } catch (err) {
        console.error("Failed to fetch challenges:", err);
        setScenarios([]);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchScenarios();
  }, [classroomId, currentScenarioId, variant]);

  if (variant === "student") {
    return (
      <div className="card">
        <h2 className="heading-md mb-3">Past Challenges</h2>
        {challenges.length === 0 ? (
          <p className="text-text-muted text-sm">No past challenges yet.</p>
        ) : (
          <div className="space-y-2">
            {challenges.map((s: Challenge) => (
              <button
                key={String(s?._id ?? s?.id)}
                type="button"
                className="block w-full max-w-full text-left rounded-md border border-ui-border bg-ui-surface px-4 py-3 hover:bg-ui-muted transition-colors overflow-hidden"
                onClick={() => {
                  const id = String(s?._id ?? s?.id);
                  if (id) navigate(`/challenges/${id}`);
                }}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="block font-medium min-w-0 max-w-full whitespace-normal break-all md:truncate md:whitespace-nowrap">
                      {s?.title}
                    </div>
                    <div className="text-text-muted text-sm truncate">
                      {s?.isClosed ? "Closed" : "Active"}
                    </div>
                  </div>
                  <span className="badge badge-success flex-shrink-0 self-start md:self-center">
                    View
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Teacher variant
  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h2 className="heading-md">Past Challenges</h2>
        <button
          type="button"
          className="btn-outline w-full sm:w-auto"
          onClick={() => navigate("/challenges")}
        >
          View all
        </button>
      </div>

      {isLoading ? (
        <p className="text-text-muted mt-3">Loading challenges…</p>
      ) : challenges.length === 0 ? (
        <p className="text-text-muted mt-3">No past challenges yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {challenges.map((s: Challenge) => {
            const statusLabel = !s.isPublished
              ? "Draft"
              : s.isClosed
              ? "Closed"
              : "Published";
            return (
              <div
                key={s._id}
                className="flex items-start justify-between gap-3 rounded-md border border-ui-border bg-ui-surface px-4 py-3 overflow-hidden"
              >
                <div className="min-w-0 flex-1 overflow-hidden">
                  <button
                    type="button"
                    className="font-medium text-left hover:underline truncate block w-full"
                    onClick={() => navigate(`/challenges/${s._id}`)}
                  >
                    {s?.title}
                  </button>
                  <div className="text-sm text-text-muted truncate">
                    {s.createdDate
                      ? new Date(s.createdDate).toLocaleDateString()
                      : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="badge bg-ui-muted text-text-secondary whitespace-nowrap">
                    {statusLabel}
                  </span>
                  {s.isClosed && (
                    <button
                      type="button"
                      className="btn-outline whitespace-nowrap"
                      onClick={async () => {
                        const ok = window.confirm(
                          "Rerun this challenge? This may overwrite existing results."
                        );
                        if (!ok) return;
                      }}
                    >
                      Rerun
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PastScenarios;
