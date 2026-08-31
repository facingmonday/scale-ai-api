import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Alert from "@/components/Alert";
import classroomService from "@/services/classroom";
import type {
  ClassroomReadiness,
  ClassroomReadinessCheck,
  ReadinessOperation,
} from "@/types/readiness";

interface ClassroomReadinessPanelProps {
  classroomId: string;
  challengeId?: string | null;
  operation?: ReadinessOperation;
  refreshKey?: string | number;
}

function failedChecks(readiness: ClassroomReadiness) {
  return readiness.checks.filter((check) => check.status === "fail");
}

const ClassroomReadinessPanel = ({
  classroomId,
  challengeId = null,
  operation = "process",
  refreshKey,
}: ClassroomReadinessPanelProps) => {
  const navigate = useNavigate();
  const [readiness, setReadiness] = useState<ClassroomReadiness | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;

    void classroomService
      .getPreflight(classroomId, { challengeId, operation })
      .then((value) => {
        if (active) {
          setReadiness(value);
          setLoadError(false);
        }
      })
      .catch((error) => {
        console.error("Failed to load classroom readiness:", error);
        if (active) setLoadError(true);
      });

    return () => {
      active = false;
    };
  }, [challengeId, classroomId, operation, refreshKey]);

  const failures = useMemo(
    () => (readiness ? failedChecks(readiness) : []),
    [readiness],
  );
  const primaryActions = useMemo(() => {
    const actions = new Map<string, ClassroomReadinessCheck["action"]>();
    failures.forEach((item) => {
      if (item.action) actions.set(item.action.href, item.action);
    });
    return [...actions.values()].filter(
      (action): action is NonNullable<ClassroomReadinessCheck["action"]> =>
        Boolean(action),
    );
  }, [failures]);

  if (loadError) {
    return (
      <Alert
        icon="pi pi-info-circle"
        title="Classroom readiness unavailable"
        message="Readiness could not be checked. Result operations will still be validated by the server."
        variant="info"
      />
    );
  }

  if (!readiness) return null;

  const statusLabel =
    readiness.status === "blocked"
      ? "Classroom is not ready to process results"
      : readiness.status === "warning"
        ? "Classroom is ready with warnings"
        : "Classroom is ready for results";
  const operationLabel =
    operation === "preview"
      ? "preview"
      : operation === "rerun"
        ? "rerun"
        : "processing";

  return (
    <Alert
      icon={
        readiness.status === "ready"
          ? "pi pi-check-circle"
          : "pi pi-exclamation-triangle"
      }
      title={`Classroom Readiness: ${statusLabel}`}
      variant={
        readiness.status === "blocked"
          ? "error"
          : readiness.status === "warning"
            ? "warning"
            : "success"
      }
      message={
        failures.length > 0 ? (
          <div className="space-y-2">
            <p>
              {readiness.status === "blocked"
                ? `Resolve the blocking items below before result ${operationLabel}. You can continue editing the challenge and collecting submissions.`
                : `Result ${operationLabel} can continue, but review these recommendations.`}
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {failures.map((item) => (
                <li key={item.key}>
                  <strong>{item.title}:</strong> {item.message}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          `All required checks passed for result ${operationLabel}.`
        )
      }
      actions={primaryActions.map((action) => ({
        label: action.label,
        onClick: () => navigate(action.href),
        variant: "secondary",
      }))}
    />
  );
};

export default ClassroomReadinessPanel;
