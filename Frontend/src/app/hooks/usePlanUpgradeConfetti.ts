import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import type { SeatInfo } from "../types/subscription";

const STORAGE_KEY = "monitor_last_plan_name";
const BANNER_SHOWN_KEY = "monitor_upgrade_banner_shown_for";

const PLAN_HIERARCHY: Record<string, number> = {
  free: 0,
  professional: 1,
  enterprise: 2,
};

function getPlanTier(planName: string): number {
  const lower = planName.toLowerCase();
  for (const [key, tier] of Object.entries(PLAN_HIERARCHY)) {
    if (lower.includes(key)) return tier;
  }
  return 0;
}

function getPlanName(seatInfo: SeatInfo | null): string | null {
  if (!seatInfo) return null;
  return (seatInfo as { plan?: { name?: string }; plan_name?: string }).plan?.name
    ?? (seatInfo as { plan_name?: string }).plan_name
    ?? null;
}

export function usePlanUpgradeConfetti(seatInfo: SeatInfo | null) {
  const [upgradedTo, setUpgradedTo] = useState<string | null>(null);

  useEffect(() => {
    const currentPlan = getPlanName(seatInfo);
    if (!currentPlan) return;

    const storedPlan = localStorage.getItem(STORAGE_KEY);

    // First ever visit — just record the plan, no notification
    if (storedPlan === null) {
      localStorage.setItem(STORAGE_KEY, currentPlan);
      return;
    }

    if (storedPlan !== currentPlan) {
      localStorage.setItem(STORAGE_KEY, currentPlan);

      const bannerShownFor = localStorage.getItem(BANNER_SHOWN_KEY);
      if (bannerShownFor !== currentPlan) {
        localStorage.setItem(BANNER_SHOWN_KEY, currentPlan);

        const isUpgrade = getPlanTier(currentPlan) > getPlanTier(storedPlan);

        if (isUpgrade) {
          setUpgradedTo(currentPlan);
          fireConfetti();
        } else {
          // Downgrade — simple toast, no banner, no confetti
          toast.info(`You are now on ${currentPlan} Plan`, { duration: 6000 });
        }
      }
    }
  }, [getPlanName(seatInfo)]);  // eslint-disable-line react-hooks/exhaustive-deps

  const dismissBanner = () => setUpgradedTo(null);

  return { upgradedTo, dismissBanner };
}

function fireConfetti() {
  const duration = 3500;
  const end = Date.now() + duration;

  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];

  confetti({
    particleCount: 80,
    spread: 70,
    origin: { x: 0.1, y: 0.6 },
    colors,
    startVelocity: 55,
    scalar: 1.1,
  });

  confetti({
    particleCount: 80,
    spread: 70,
    origin: { x: 0.9, y: 0.6 },
    colors,
    startVelocity: 55,
    scalar: 1.1,
  });

  confetti({
    particleCount: 120,
    spread: 100,
    origin: { x: 0.5, y: 0.5 },
    colors,
    startVelocity: 45,
    scalar: 1.2,
  });

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
