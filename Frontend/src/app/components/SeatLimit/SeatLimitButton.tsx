import React from "react";
import { useSubscription } from "../../lib/subscription-context";
import { Button } from "../ui/button";

interface SeatLimitButtonProps {
  type: "admin" | "employee";
  onClick: () => void;
  children: React.ReactNode;
}

export function SeatLimitButton({
  type,
  onClick,
  children,
}: SeatLimitButtonProps) {
  const { seatInfo } = useSubscription();

  if (!seatInfo) {
    return (
      <Button onClick={onClick} disabled variant="outline">
        Loading...
      </Button>
    );
  }

  const canAdd =
    type === "admin"
      ? (seatInfo as any).can_add_admin ?? seatInfo.can_add_admin
      : (seatInfo as any).can_add_employee ?? seatInfo.can_add_employee;

  return (
    <Button
      onClick={onClick}
      disabled={!canAdd}
      className="bg-[#6366f1] hover:bg-[#5558e6] text-white disabled:opacity-50 disabled:cursor-not-allowed"
      title={!canAdd ? `Seat limit reached for ${type}s` : ""}
    >
      {children}
    </Button>
  );
}

