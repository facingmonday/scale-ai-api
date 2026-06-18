import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import licensingService from "@/services/licensing";
import type { BillingSummary, SeatPool } from "@/types/licensing";

const PLAN_LABELS: Record<string, string> = {
  org_seats: "Organization Seats",
  student_class_pass: "Student Seat",
};

const BillingSeatsPanel: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [seatPools, setSeatPools] = useState<SeatPool[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseQuantity, setPurchaseQuantity] = useState(10);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      setCheckoutMessage(
        "Payment received. Organization seats have been updated.",
      );
      void load();
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("checkout");
        next.delete("session_id");
        return next;
      });
    }
  }, [searchParams, setSearchParams]);

  const purchaseSeats = async () => {
    if (purchaseQuantity <= 0 || isPurchasing) return;
    setIsPurchasing(true);
    setError(null);
    try {
      const checkout =
        await licensingService.createOrgCheckout(purchaseQuantity);
      window.location.href = checkout.checkoutUrl;
    } catch (e) {
      console.error("Failed to start org checkout:", e);
      setError("Unable to start seat purchase checkout.");
      setIsPurchasing(false);
    }
  };

  const orgSummary = summary?.orgSeatSummary;
  const totalOrgSeats =
    orgSummary?.totalSeats ??
    seatPools.reduce((sum, pool) => sum + (pool.totalSeats ?? 0), 0);
  const claimedOrgSeats =
    orgSummary?.usedSeats ??
    seatPools.reduce((sum, pool) => sum + (pool.usedSeats || 0), 0);
  const remainingOrgSeats =
    orgSummary?.remainingSeats ?? Math.max(totalOrgSeats - claimedOrgSeats, 0);
  const stripePaidSeats = summary?.stripePaidSeats ?? 0;
  const orgSeatsPercent =
    totalOrgSeats > 0
      ? Math.min((claimedOrgSeats / totalOrgSeats) * 100, 100)
      : 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-text-primary tracking-tight">
          Billing & Seats
        </h2>
        <p className="text-text-muted mt-1 text-sm md:text-base">
          Purchase organization seats via Stripe. Each classroom enrollment
          consumes one seat from your org pool, or students pay individually
          when seats run out.
        </p>
      </div>

      {checkoutMessage && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-sm">
          {checkoutMessage}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-ui-surface border border-ui-border rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <p className="text-text-muted text-xs font-semibold uppercase tracking-wider">
              Organization Seats
            </p>
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
            {isLoading
              ? "..."
              : `${remainingOrgSeats} prepaid seats remaining.`}
          </p>
        </div>

        <div className="card bg-ui-surface border border-ui-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-text-muted text-xs font-semibold uppercase tracking-wider">
              Student-Paid Seats
            </p>
            <p className="text-3xl font-bold text-text-primary mt-1">
              {isLoading ? "..." : stripePaidSeats}
            </p>
          </div>
          <p className="text-xs text-text-muted mt-4">
            Students who paid individually when org seats were unavailable.
          </p>
        </div>

        <div className="card bg-ui-surface border border-ui-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-text-muted text-xs font-semibold uppercase tracking-wider">
              Total Active Enrollments
            </p>
            <p className="text-3xl font-bold text-text-primary mt-1">
              {isLoading ? "..." : claimedOrgSeats + stripePaidSeats}
            </p>
          </div>
          <p className="text-xs text-text-muted mt-4">
            Combined active seat claims across all classrooms.
          </p>
        </div>
      </div>

      <div className="card bg-ui-surface border border-ui-border rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-text-primary">
              Purchase Seats
            </h3>
            <p className="text-text-muted text-xs md:text-sm mt-0.5">
              Buy prepaid organization seats through Stripe checkout.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Quantity</span>
              <input
                type="number"
                min={1}
                className="input w-24"
                value={purchaseQuantity}
                onChange={(e) =>
                  setPurchaseQuantity(Math.max(Number(e.target.value) || 1, 1))
                }
                disabled={isPurchasing}
              />
            </label>
            <button
              className="btn-teal bg-brand-teal text-white hover:bg-brand-teal/90 px-4 py-2 rounded-lg text-sm transition-all"
              disabled={isPurchasing}
              onClick={() => void purchaseSeats()}
            >
              {isPurchasing ? "Redirecting..." : "Purchase Seats"}
            </button>
          </div>
        </div>

        {seatPools.length === 0 ? (
          <p className="text-text-muted text-sm py-4">
            No organization seat pool yet. Purchase seats to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-text-muted border-b border-ui-border font-medium">
                  <th className="pb-3 pr-4">Plan</th>
                  <th className="pb-3 px-4">Status</th>
                  <th className="pb-3 px-4">Used Seats</th>
                  <th className="pb-3 pl-4 text-right">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {seatPools.map((pool) => (
                  <tr
                    key={pool._id}
                    className="border-b border-ui-border/60 hover:bg-ui-border/10 transition-colors"
                  >
                    <td className="py-3.5 pr-4 font-semibold text-text-primary">
                      {PLAN_LABELS[pool.planKey] || pool.planKey}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                          pool.status === "active" || pool.status === "manual"
                            ? "bg-green-500/10 text-green-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {pool.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-text-secondary font-mono">
                      {pool.usedSeats} / {pool.totalSeats ?? 0}
                    </td>
                    <td className="py-3.5 pl-4 text-right font-semibold text-text-primary font-mono">
                      {pool.remainingSeats ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default BillingSeatsPanel;
