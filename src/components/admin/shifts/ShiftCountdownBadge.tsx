"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ShiftCountdownBadge() {
  const [data, setData] = useState<any>(null);
  
  useEffect(() => {
    const fetchShift = async () => {
      if (document.visibilityState === "hidden") return;
      const token = localStorage.getItem("admin_token");
      if (!token) return;
      try {
        const res = await fetch("/api/shifts/current", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setData(await res.json());
        }
        } catch {
          // Silently fail — shift badge is non-critical UI
        }
    };

    fetchShift();
    const intv = setInterval(fetchShift, 120_000); // Check every 2 minutes
    return () => clearInterval(intv);
  }, []);

  if (!data?.time?.is_ending_soon) return null;

  return (
    <Badge variant="destructive" className="flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-700 font-semibold animate-pulse">
      <Clock className="w-3.5 h-3.5" />
      <span>{data.time.minutes_remaining}m left in {data.shift?.name} Shift</span>
    </Badge>
  );
}
