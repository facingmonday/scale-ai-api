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

  // B2B Organization Seats calculations
  const totalOrgSeats = seatPools.reduce(
    (sum, pool) => sum + (pool.totalSeats ?? 0),
    0
  );
  const claimedOrgSeats = seatPools.reduce(
    (sum, pool) => sum + (pool.usedSeats || 0),
    0
  );
  const remainingOrgSeats = Math.max(totalOrgSeats - claimedOrgSeats, 0);

  // B2C Student Self-Paid Seats calculations
  const studentPaidSeats = summary?.classroomUsage?.reduce(
    (sum, classroom) => sum + (classroom.billingMode === "student_paid" ? classroom.claimedSeats : 0),
    0
  ) || 0;

  // Percentage for progress bar
  const orgSeatsPercent = totalOrgSeats > 0 ? Math.min((claimedOrgSeats / totalOrgSeats) * 100, 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-text-primary tracking-tight">Billing & Seats</h2>
        <p className="text-text-muted mt-1 text-sm md:text-base">
          Manage classroom licenses and billing. Classrooms can be configured for individual student payment or organization-funded seats.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Org Seats */}
        <div className="card bg-ui-surface border border-ui-border rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <p className="text-text-muted text-xs font-semibold uppercase tracking-wider">Organization Seats (B2B)</p>
            <p className="text-3xl font-bold text-text-primary mt-1">
              {isLoading ? "..." : `${claimedOrgSeats} / ${totalOrgSeats}`}
            </p>
          </div>
          <div className="w-full bg-ui-border rounded-full h-2 overflow-hidden">
            <div
              className="bg-brand-teal h-full transition-all duration-500 rounded-full"
              style={{ width: `${orgSeatsPercent}%` }}
            />
          </div>
          <p className="text-xs text-text-muted">
            {isLoading ? "..." : `${remainingOrgSeats} seats remaining for roster classrooms.`}
          </p>
        </div>

        {/* Card 2: Student Paid */}
        <div className="card bg-ui-surface border border-ui-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-text-muted text-xs font-semibold uppercase tracking-wider">Student-Paid Seats (B2C)</p>
            <p className="text-3xl font-bold text-text-primary mt-1">
              {isLoading ? "..." : studentPaidSeats}
            </p>
          </div>
          <p className="text-xs text-text-muted mt-4">
            Students pay individually before joining student-paid classrooms.
          </p>
        </div>

        {/* Card 3: Total Active Students */}
        <div className="card bg-ui-surface border border-ui-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-text-muted text-xs font-semibold uppercase tracking-wider">Total Active Licenses</p>
            <p className="text-3xl font-bold text-text-primary mt-1">
              {isLoading ? "..." : claimedOrgSeats + studentPaidSeats}
            </p>
          </div>
          <p className="text-xs text-text-muted mt-4">
            Combined active student seats across all classrooms in this organization.
          </p>
        </div>
      </div>

      {/* Seat Pools Section */}
      <div className="card bg-ui-surface border border-ui-border rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-text-primary">Organization Seat Pools</h3>
            <p className="text-text-muted text-xs md:text-sm mt-0.5">
              Seat allocations provisioned via Clerk B2B plans for rostered students.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn-outline border border-ui-border hover:bg-ui-border px-3 py-1.5 rounded-lg text-sm transition-all"
              disabled={isCreating}
              onClick={() => void createSeatPack("teacher_seat_pack_30", 30)}
            >
              Add 30 Seats
            </button>
            <button
              className="btn-teal bg-brand-teal text-white hover:bg-brand-teal/90 px-3 py-1.5 rounded-lg text-sm transition-all"
              disabled={isCreating}
              onClick={() => void createSeatPack("teacher_seat_pack_100", 100)}
            >
              Add 100 Seats
            </button>
          </div>
        </div>

        {seatPools.length === 0 ? (
          <p className="text-text-muted text-sm py-4">
            No active organization seat pools. Roster classrooms require organization seats to enroll students.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-text-muted border-b border-ui-border font-medium">
                  <th className="pb-3 pr-4">Plan Name</th>
                  <th className="pb-3 px-4">Status</th>
                  <th className="pb-3 px-4">Used Seats</th>
                  <th className="pb-3 pl-4 text-right">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {seatPools.map((pool) => (
                  <tr key={pool._id} className="border-b border-ui-border/60 hover:bg-ui-border/10 transition-colors">
                    <td className="py-3.5 pr-4 font-semibold text-text-primary">
                      {PLAN_LABELS[pool.planKey] || pool.planKey}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                        pool.status === "active" || pool.status === "manual"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-red-500/10 text-red-400"
                      }`}>
                        {pool.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-text-secondary font-mono">
                      {pool.usedSeats} / {pool.totalSeats ?? "Unlimited"}
                    </td>
                    <td className="py-3.5 pl-4 text-right font-semibold text-text-primary font-mono">
                      {pool.remainingSeats ?? "Unlimited"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Classroom Usage Section */}
      <div className="card bg-ui-surface border border-ui-border rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-text-primary mb-4">Classroom License Allocations</h3>
        {summary?.classroomUsage?.length ? (
          <div className="divide-y divide-ui-border/60">
            {summary.classroomUsage.map((classroom) => (
              <div
                key={classroom.classroomId}
                className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-semibold text-text-primary text-base">{classroom.name}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      classroom.billingMode === "teacher_paid_roster"
                        ? "bg-blue-500/10 text-blue-400"
                        : "bg-orange-500/10 text-orange-400"
                    }`}>
                      {classroom.billingMode === "teacher_paid_roster"
                        ? "Paid by Organization (Roster)"
                        : "Paid by Students (Individual)"}
                    </span>
                    <span className="text-xs text-text-muted">
                      · {classroom.joinPolicy === "roster_only" ? "Roster Only" : "Invite Link"}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-brand-teal font-mono">
                    {classroom.claimedSeats}
                  </span>
                  <span className="text-xs text-text-muted ml-1 font-medium">claimed</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-muted text-sm py-4">No active classrooms.</p>
        )}
      </div>
    </div>
  );
};

export default BillingSeatsPanel;
