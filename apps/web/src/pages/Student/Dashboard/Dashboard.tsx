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
import challengeService from "../../../services/challenge";
import {
  unwrap,
  normalizeScenarioId,
} from "../../../components/dashboard/utils";
import type { ScenarioWithVariables } from "../../../types/challenge";
import Alert from "../../../components/Alert";
import LoadingOverlay from "../../../components/LoadingOverlay";

const Dashboard: React.FC = () => {
  const { activeClassroom } = useAuth();
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
