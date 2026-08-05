import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import outcomeService from "../../services/outcome";
import jobService from "../../services/job";
import { unwrap } from "./utils";
import type { ScenarioWithVariables } from "../../types/challenge";
import type { SimulationJob } from "../../types/job";
import type { Outcome } from "../../types/outcome";
import type { ClassDashboard } from "../../types/dashboard";

interface TeacherActionRequiredProps {
  classroomId: string | null;
  activeScenarioId: string | null;
  dashboard: ClassDashboard | null;
}

const TeacherActionRequired: React.FC<TeacherActionRequiredProps> = ({
  classroomId,
  activeScenarioId,
  dashboard,
}) => {
  const { activeClassroom } = useAuth();
  const [jobs, setJobs] = useState<SimulationJob[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const activeScenario = useMemo(() => {
    const s = dashboard?.activeScenario;
    if (!s) return null;
    return s as unknown as ScenarioWithVariables;
  }, [dashboard?.activeScenario]);

  useEffect(() => {
    if (!classroomId) {
      const timeoutId = setTimeout(() => {
        setJobs([]);
        setOutcome(null);
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    const fetchData = async () => {
      try {
        // Fetch challenge-specific data (used after close: outcome + jobs status)
        if (activeScenarioId) {
          const [jobsRes, outcomeRes] = await Promise.allSettled([
            jobService.getJobsForScenario(activeScenarioId),
            outcomeService
              .getOutcome(activeScenarioId)
              .then((res) => res.data)
              .catch(() => null),
          ]);

          if (jobsRes.status === "fulfilled") {
            const list = unwrap(jobsRes.value) as unknown;
            setJobs(Array.isArray(list) ? (list as SimulationJob[]) : []);
          }

          if (outcomeRes.status === "fulfilled" && outcomeRes.value) {
            setOutcome(unwrap(outcomeRes.value) as unknown as Outcome);
          }
        } else {
          setJobs([]);
          setOutcome(null);
        }
      } catch (err) {
        console.error("Failed to fetch action required data:", err);
      }
    };

    void fetchData();
  }, [classroomId, activeScenarioId]);

  const missingSubmissionsCount = useMemo(() => {
    if (!activeScenarioId) return 0;
    const total =
      typeof dashboard?.students === "number" ? dashboard.students : 0;
    const completed =
      typeof dashboard?.submissionsCompleted === "number"
        ? dashboard.submissionsCompleted
        : 0;
    return Math.max(0, total - completed);
  }, [activeScenarioId, dashboard]);

  const jobCounts = useMemo(() => {
    const total = jobs.length;
    const completed = jobs.filter((j) => j.status === "completed").length;
    const failed = jobs.filter((j) => j.status === "failed").length;
    const running = jobs.filter((j) => j.status === "running").length;
    const pending = jobs.filter((j) => j.status === "pending").length;
    const inProgress = running + pending;
    return { total, completed, failed, running, pending, inProgress };
  }, [jobs]);

  const actionRequired = useMemo(() => {
    if (!activeClassroom?._id) {
      return {
        title: "Select a classroom",
        details: "Choose a classroom to view its dashboard.",
      };
    }

    if (!activeScenario) {
      return {
        title: "Create a challenge",
        details: "Start the week by creating a new challenge.",
      };
    }

    if (!activeScenario.isPublished) {
      return {
        title: "Publish the challenge",
        details: "Students can't submit until the challenge is published.",
      };
    }

    if (!activeScenario.isClosed) {
      if (missingSubmissionsCount > 0) {
        return {
          title: `${missingSubmissionsCount} students have not submitted`,
          details: "Remind them or intervene before closing decisions.",
        };
      }
      return {
        title: "All students submitted",
        details: "You can close decisions and move to global outcome.",
      };
    }

    // Closed
    if (!outcome) {
      return {
        title: "Challenge outcome not entered",
        details: "Enter the global outcome to begin AI processing.",
      };
    }

    if (jobCounts.inProgress > 0) {
      return {
        title: "AI simulations in progress",
        details: `${jobCounts.completed}/${jobCounts.total} completed.`,
      };
    }

    if (jobCounts.failed > 0) {
      return {
        title: `${jobCounts.failed} simulations failed`,
        details: "Retry failed jobs, then approve outcomes when ready.",
      };
    }

    // Check if outcome exists but jobs are completed (outcome may be ready to approve)
    if (outcome && jobCounts.completed > 0 && jobCounts.failed === 0) {
      return {
        title: "Ready to approve outcomes",
        details:
          "Preview results, then approve to publish outcomes to students.",
      };
    }

    return {
      title: "No action required",
      details: "You're all set for this week.",
    };
  }, [
    activeClassroom?._id,
    activeScenario,
    jobCounts.completed,
    jobCounts.failed,
    jobCounts.inProgress,
    jobCounts.total,
    missingSubmissionsCount,
    outcome,
  ]);

  return (
    <div className="w-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="heading-md">Action required</h2>
          <div className="mt-2 text-lg font-semibold">
            {actionRequired.title}
          </div>
          <p className="text-text-muted mt-1">{actionRequired.details}</p>
        </div>
      </div>
    </div>
  );
};

export default TeacherActionRequired;
