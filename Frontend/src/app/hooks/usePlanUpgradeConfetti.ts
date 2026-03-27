import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import type { SeatInfo } from "../types/subscription";

const STORAGE_KEY = "monitor_last_plan_name";

function getPlanName(seatInfo: SeatInfo | null): string | null {
  if (!seatInfo) return null;
  return (seatInfo as { plan?: { name?: string }; plan_name?: string }).plan?.name
    ?? (seatInfo as { plan_name?: string }).plan_name
    ?? null;
}

export function usePlanUpgradeConfetti(seatInfo: SeatInfo | null) {
  const initialized = useRef(false);
  const [upgradedTo, setUpgradedTo] = useState<string | null>(null);

  useEffect(() => {
    const currentPlan = getPlanName(seatInfo);
    if (!currentPlan) return;

    const previousPlan = localStorage.getItem(STORAGE_KEY);

    if (!initialized.current) {
      initialized.current = true;
      // First load — just store, don't fire
      if (previousPlan === null) {
        localStorage.setItem(STORAGE_KEY, currentPlan);
      } else if (previousPlan !== currentPlan) {
        // Plan changed since last visit — still fire
        fireConfetti();
        setUpgradedTo(currentPlan);
        localStorage.setItem(STORAGE_KEY, currentPlan);
      }
      return;
    }

    // Subsequent updates within the same session
    if (previousPlan !== null && previousPlan !== currentPlan) {
      fireConfetti();
      setUpgradedTo(currentPlan);
      localStorage.setItem(STORAGE_KEY, currentPlan);
    } else {
      localStorage.setItem(STORAGE_KEY, currentPlan);
    }
  }, [getPlanName(seatInfo)]);

  const dismissBanner = () => setUpgradedTo(null);

  return { upgradedTo, dismissBanner };
}

function fireConfetti() {
  const duration = 3500;
  const end = Date.now() + duration;

  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];

  // Left cannon
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { x: 0.1, y: 0.6 },
    colors,
    startVelocity: 55,
    scalar: 1.1,
  });

  // Right cannon
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { x: 0.9, y: 0.6 },
    colors,
    startVelocity: 55,
    scalar: 1.1,
  });

  // Center burst
  confetti({
    particleCount: 120,
    spread: 100,
    origin: { x: 0.5, y: 0.5 },
    colors,
    startVelocity: 45,
    scalar: 1.2,
  });

  // Continuous rain from top
  const frame = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.1 },
      colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.1 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}
