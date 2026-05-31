import React, { useEffect, useState } from "react";
import licensingService from "@/services/licensing";
import type { SeatClaim } from "@/types/licensing";

const StudentBillingAccessPanel: React.FC = () => {
  const [claims, setClaims] = useState<SeatClaim[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await licensingService.getStudentAccess();
        setClaims(data);
      } catch (e) {
        console.error("Failed to load student access:", e);
        setError("Failed to load class access.");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Class Access</h2>
      <div className="card">
        <h3 className="heading-md mb-1">Active Passes & Seats</h3>
        <p className="text-text-muted mb-4">
          View the classroom seats attached to your account.
        </p>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {isLoading ? (
          <p className="text-text-muted">Loading access...</p>
        ) : claims.length === 0 ? (
          <p className="text-text-muted">
            You do not have any paid or claimed classroom seats yet.
          </p>
        ) : (
          <div className="space-y-3">
            {claims.map((claim) => {
              const classroom =
                typeof claim.classroomId === "object" ? claim.classroomId : null;
              return (
                <div
                  key={claim._id}
                  className="rounded-lg border border-ui-border p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">
                        {classroom?.name || "Classroom"}
                      </p>
                      <p className="text-sm text-text-muted">
                        Source: {claim.source.replace(/_/g, " ")}
                      </p>
                    </div>
                    <span className="badge badge-muted">{claim.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentBillingAccessPanel;
