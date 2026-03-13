"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Clock, AlertTriangle, AlertCircle } from "lucide-react";

type CountdownTimerProps = {
  checkInDateStr: string | undefined;
  checkOutDateStr: string | undefined;
  actualCheckInAt: string | undefined;
  ratePlanKind: string | undefined;
};

export function CountdownTimer({ checkInDateStr, checkOutDateStr, actualCheckInAt, ratePlanKind }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; isOvertime: boolean; totalMinutesLeft: number } | null>(null);

  useEffect(() => {
    // Determine the target expiration date based on rate plan
    let expirationDate: Date | null = null;
    
    // Default to a 24h checkout schema if there's no short-time data
    if (!ratePlanKind || ratePlanKind === "24h") {
      if (checkOutDateStr) {
        // Assume 12:00 PM on the check-out date for standard bookings
        expirationDate = new Date(`${checkOutDateStr.slice(0, 10)}T12:00:00`);
      }
    } else {
      // Short-time booking (3h, 5h, 12h)
      // These expire exactly X hours after the actual check-in time
      if (actualCheckInAt) {
        const hoursToAdd = parseInt(ratePlanKind.replace(/\D/g, ""), 10) || 0;
        expirationDate = new Date(actualCheckInAt);
        expirationDate.setHours(expirationDate.getHours() + hoursToAdd);
      } else if (checkInDateStr) {
        // Fallback if actual_check_in_at wasn't recorded (legacy data)
        const hoursToAdd = parseInt(ratePlanKind.replace(/\D/g, ""), 10) || 0;
        expirationDate = new Date(`${checkInDateStr.slice(0, 10)}T14:00:00`); // Assuming 2PM standard check-in as fallback
        expirationDate.setHours(expirationDate.getHours() + hoursToAdd);
      }
    }

    if (!expirationDate || isNaN(expirationDate.getTime())) return;

    const calculateTimeLeft = () => {
      const now = new Date();
      // @ts-ignore
      const diffMs = expirationDate.getTime() - now.getTime();
      const isOvertime = diffMs < 0;
      
      const absDiff = Math.abs(diffMs);
      const totalMinutes = Math.floor(absDiff / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      
      // Calculate signed minutes left for color logic
      const signedMinutesLeft = isOvertime ? -totalMinutes : totalMinutes;

      setTimeLeft({ hours, minutes, isOvertime, totalMinutesLeft: signedMinutesLeft });
    };

    calculateTimeLeft(); // Initial calc
    const timer = setInterval(calculateTimeLeft, 60000); // Update every minute

    return () => clearInterval(timer);
  }, [checkInDateStr, checkOutDateStr, actualCheckInAt, ratePlanKind]);

  if (!timeLeft) return null;

  // Render Logic
  if (timeLeft.isOvertime) {
    return (
      <div className="flex items-center gap-1.5 mt-2 bg-red-50 text-red-700 px-2 py-1 rounded border border-red-200 w-fit animate-pulse shadow-sm">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        <span className="text-[10px] font-bold tracking-tight">
          OVERTIME {timeLeft.hours > 0 ? `${timeLeft.hours}h ` : ""}{timeLeft.minutes}m
        </span>
      </div>
    );
  }

  // Warning state (less than 1 hour left)
  if (timeLeft.totalMinutesLeft <= 60) {
     return (
        <div className="flex items-center gap-1.5 mt-2 bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-200 w-fit">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span className="text-[10px] font-semibold tracking-tight">
            Leaves in {timeLeft.minutes}m
          </span>
        </div>
      );
  }

  // Normal state
  return (
    <div className="flex items-center gap-1.5 mt-2 bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100 w-fit">
      <Clock className="h-3 w-3 shrink-0 text-emerald-600" />
      <span className="text-[10px] font-medium tracking-tight">
        {timeLeft.hours}h {timeLeft.minutes}m left
      </span>
    </div>
  );
}
