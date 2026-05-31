import React, { useEffect, useState } from "react";
import licensingService from "@/services/licensing";
import type { BillingSummary, SeatPool } from "@/types/licensing";

const PLAN_LABELS: Record<string, string> = {
  student_class_pass: "Student Class Pass",
  teacher_seat_pack_30: "Teacher Seat Pack - 30",
  teacher_seat_pack_100: "Teacher Seat Pack - 100",
  institution_enterprise: "Institution Enterprise",
};

const BillingSeatsPanel: React.FC = () => {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [seatPools, setSeatPools] = useState<SeatPool[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [summaryData, poolsData] = await Promise.all([
        licensingService.getSummary(),
        licensingService.getSeatPools(),
      ]);
      setSummary(summaryData);
      setSeatPools(poolsData);
    } catch (e) {
      console.error("Failed to load billing summary:", e);
      setError("Failed to load billing and seat information.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createSeatPack = async (planKey: string, totalSeats: number) => {
    setIsCreating(true);
    setError(null);
    try {
      await licensingService.createManualSeatPool({ planKey, totalSeats });
      await load();
    } catch (e) {
      console.error("Failed to create seat pack:", e);
      setError("Unable to create a seat pack.");
    } finally {
      setIsCreating(false);
    }
  };

  const totalSeats = seatPools.reduce(
    (sum, pool) => sum + (pool.totalSeats ?? 0),
    0
  );
  const usedSeats = seatPools.reduce((sum, pool) => sum + (pool.usedSeats || 0), 0);
  const remainingSeats = Math.max(totalSeats - usedSeats, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Billing & Seats</h2>
        <p className="text-text-muted">
          Manage SCALE seats purchased through Clerk Billing and allocated across
          classrooms. Seat enforcement happens on the backend.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-text-muted text-sm">Purchased Seats</p>
          <p className="heading-lg">{isLoading ? "..." : totalSeats}</p>
        </div>
        <div className="card">
          <p className="text-text-muted text-sm">Claimed Seats</p>
          <p className="heading-lg">{isLoading ? "..." : usedSeats}</p>
        </div>
        <div className="card">
          <p className="text-text-muted text-sm">Available Seats</p>
          <p className="heading-lg">{isLoading ? "..." : remainingSeats}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="heading-md">Seat Pools</h3>
            <p className="text-text-muted">
              Buy or provision seats, then allocate them to classrooms.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn-outline"
              disabled={isCreating}
              onClick={() =>
                void createSeatPack("teacher_seat_pack_30", 30)
              }
            >
              Add 30 Seats
            </button>
            <button
              className="btn-teal"
              disabled={isCreating}
              onClick={() =>
                void createSeatPack("teacher_seat_pack_100", 100)
              }
            >
              Add 100 Seats
            </button>
          </div>
        </div>

        {seatPools.length === 0 ? (
          <p className="text-text-muted">
            No teacher-paid seat pools yet. Students can still pay individually
            in student-paid classrooms.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-ui-border">
                  <th className="py-2">Plan</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Used</th>
                  <th className="py-2">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {seatPools.map((pool) => (
                  <tr key={pool._id} className="border-b border-ui-border/60">
                    <td className="py-3">
                      {PLAN_LABELS[pool.planKey] || pool.planKey}
                    </td>
                    <td className="py-3">{pool.status}</td>
                    <td className="py-3">
                      {pool.usedSeats} / {pool.totalSeats ?? "Unlimited"}
                    </td>
                    <td className="py-3">
                      {pool.remainingSeats ?? "Unlimited"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="heading-md mb-2">Classroom Usage</h3>
        {summary?.classroomUsage?.length ? (
          <div className="space-y-2">
            {summary.classroomUsage.map((classroom) => (
              <div
                key={classroom.classroomId}
                className="flex items-center justify-between gap-4 border-b border-ui-border/60 py-2"
              >
                <div>
                  <p className="font-medium">{classroom.name}</p>
                  <p className="text-xs text-text-muted">
                    {classroom.billingMode || "student_paid"} ·{" "}
                    {classroom.joinPolicy || "invite_link"}
                  </p>
                </div>
                <span className="text-sm text-text-muted">
                  {classroom.claimedSeats} claimed
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-muted">No classroom seat usage yet.</p>
        )}
      </div>
    </div>
  );
};

export default BillingSeatsPanel;
