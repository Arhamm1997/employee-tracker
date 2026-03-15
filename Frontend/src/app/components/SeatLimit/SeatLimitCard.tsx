import React from "react";
import { useSubscription } from "../../lib/subscription-context";

export function SeatLimitCard() {
  const { seatInfo, loading } = useSubscription();

  if (loading) {
    return <div className="p-4">Loading subscription...</div>;
  }
  if (!seatInfo) return null;

  const planName = (seatInfo as any).plan_name ?? seatInfo.plan?.name ?? "Free";
  const price =
    (seatInfo as any).price_pkr ?? seatInfo.plan?.price_pkr ?? 0;

  const adminSeats = (seatInfo as any).admin_seats ?? seatInfo.admin_seats;
  const employeeSeats =
    (seatInfo as any).employee_seats ?? seatInfo.employee_seats;

  return (
    <div className="bg-muted border border-border rounded-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">Your Subscription</h3>
        <span className="bg-primary/10 text-primary px-3 py-1 rounded text-sm font-medium">
          {String(planName).toUpperCase()}
        </span>
      </div>

      {price > 0 && (
        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mb-6">
          PKR {price}/month
        </p>
      )}

      {/* Admin Seats */}
      {adminSeats && (
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="font-medium">Admin Seats</span>
            <span className="text-sm font-semibold">
              {adminSeats.used} / {adminSeats.limit}
            </span>
          </div>
          <div className="w-full bg-muted-foreground/20 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                adminSeats.percentage > 80 ? "bg-red-500" : "bg-emerald-500"
              }`}
              style={{ width: `${adminSeats.percentage}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {adminSeats.remaining} seat(s) remaining
          </p>
        </div>
      )}

      {/* Employee Seats */}
      {employeeSeats && (
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="font-medium">Employee Seats</span>
            <span className="text-sm font-semibold">
              {employeeSeats.used} / {employeeSeats.limit}
            </span>
          </div>
          <div className="w-full bg-muted-foreground/20 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                employeeSeats.percentage > 80 ? "bg-red-500" : "bg-emerald-500"
              }`}
              style={{ width: `${employeeSeats.percentage}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {employeeSeats.remaining} seat(s) remaining
          </p>
        </div>
      )}

      {/* Upgrade Button */}
      {adminSeats &&
        employeeSeats &&
        (adminSeats.percentage > 80 || employeeSeats.percentage > 80) && (
          <button className="w-full bg-primary text-primary-foreground py-2 rounded font-medium hover:bg-primary/90">
            Upgrade Plan
          </button>
        )}

      {/* Trial Info */}
      {(seatInfo as any).is_trial && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-900/40 dark:text-amber-300">
          Trial ends on{" "}
          {new Date(
            (seatInfo as any).trial_end || "",
          ).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

