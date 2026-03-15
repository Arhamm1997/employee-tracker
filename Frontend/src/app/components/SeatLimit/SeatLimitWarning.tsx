import React from "react";
import { useSubscription } from "../../lib/subscription-context";

interface SeatLimitWarningProps {
  type: "admin" | "employee";
}

export function SeatLimitWarning({ type }: SeatLimitWarningProps) {
  const { seatInfo } = useSubscription();

  if (!seatInfo) return null;

  const adminSeats = (seatInfo as any).admin_seats ?? seatInfo.admin_seats;
  const employeeSeats =
    (seatInfo as any).employee_seats ?? seatInfo.employee_seats;

  const seatData = type === "admin" ? adminSeats : employeeSeats;

  if (!seatData || seatData.remaining > 0) return null;

  return (
    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded flex items-start gap-3 dark:bg-red-950/40 dark:border-red-900/50">
      <span className="text-xl leading-none">⚠️</span>
      <div>
        <p className="font-semibold text-red-800 dark:text-red-200">
          {type === "admin" ? "Admin" : "Employee"} Seat Limit Reached
        </p>
        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
          You&apos;ve used all {seatData.limit} {type} seat(s).
          <a
            href="/dashboard/billing"
            className="font-semibold ml-2 hover:underline"
          >
            Upgrade your plan →
          </a>
        </p>
      </div>
    </div>
  );
}

