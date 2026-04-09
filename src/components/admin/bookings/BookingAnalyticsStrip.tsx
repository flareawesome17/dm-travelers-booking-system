"use client";

import type { ComponentType } from "react";
import {
  BedDouble,
  Building2,
  CalendarCheck,
  Clock3,
  KeyRound,
  LogIn,
  LogOut,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { BookingAnalyticsCardKey, BookingAnalyticsSummary } from "@/lib/bookingAnalytics";

type Props = {
  summary: BookingAnalyticsSummary | null;
  loading: boolean;
  error: boolean;
  onCardClick: (key: BookingAnalyticsCardKey) => void;
};

const CARD_CONFIG: Array<{
  key: BookingAnalyticsCardKey;
  label: string;
  tone: string;
  surface: string;
  ring: string;
  icon: ComponentType<{ className?: string }>;
  clickable: boolean;
  formatValue?: (summary: BookingAnalyticsSummary) => string;
  subtitle?: (summary: BookingAnalyticsSummary) => string | null;
}> = [
  {
    key: "checkedInToday",
    label: "Checked-In Today",
    tone: "text-emerald-600",
    surface: "bg-emerald-50",
    ring: "ring-emerald-100",
    icon: LogIn,
    clickable: true,
  },
  {
    key: "checkedOutToday",
    label: "Checked-Out Today",
    tone: "text-amber-600",
    surface: "bg-amber-50",
    ring: "ring-amber-100",
    icon: LogOut,
    clickable: true,
  },
  {
    key: "totalBookings",
    label: "Total Bookings",
    tone: "text-[#07008A]",
    surface: "bg-[#07008A]/[0.06]",
    ring: "ring-[#07008A]/10",
    icon: CalendarCheck,
    clickable: true,
  },
  {
    key: "lguBookings",
    label: "LGU Bookings",
    tone: "text-blue-600",
    surface: "bg-blue-50",
    ring: "ring-blue-100",
    icon: Building2,
    clickable: true,
  },
  {
    key: "specialBookings",
    label: "Special Bookings",
    tone: "text-fuchsia-600",
    surface: "bg-fuchsia-50",
    ring: "ring-fuchsia-100",
    icon: Sparkles,
    clickable: true,
  },
  {
    key: "pendingPayment",
    label: "Pending Payment",
    tone: "text-slate-700",
    surface: "bg-slate-100",
    ring: "ring-slate-200",
    icon: Clock3,
    clickable: true,
  },
  {
    key: "occupancyPercent",
    label: "Occupancy",
    tone: "text-rose-600",
    surface: "bg-rose-50",
    ring: "ring-rose-100",
    icon: BedDouble,
    clickable: false,
    formatValue: (summary) => `${summary.occupancyPercent}%`,
    subtitle: (summary) => `${summary.occupiedRooms} occupied of ${summary.activeRooms - summary.roomsExcludedFromOccupancy} usable`,
  },
  {
    key: "availableRoomsToday",
    label: "Available Rooms Today",
    tone: "text-cyan-700",
    surface: "bg-cyan-50",
    ring: "ring-cyan-100",
    icon: KeyRound,
    clickable: false,
  },
];

export function BookingAnalyticsStrip({ summary, loading, error, onCardClick }: Props) {
  if (error) {
    return (
      <Card className="border border-amber-200/80 bg-amber-50/70 shadow-sm">
        <CardContent className="px-4 py-3 text-sm text-amber-900">
          Booking analytics are temporarily unavailable. The bookings table and actions remain fully usable.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {CARD_CONFIG.map(({ key, label, icon: Icon, tone, surface, ring, clickable, formatValue, subtitle }) => {
        const value = summary
          ? formatValue
            ? formatValue(summary)
            : String(summary[key])
          : "0";
        const subtitleText = summary && subtitle ? subtitle(summary) : null;

        const cardBody = (
          <Card
            className={cn(
              "border border-slate-100 bg-white shadow-elevation-card transition-all duration-200",
              clickable ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : "cursor-default",
            )}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1", surface, tone, ring)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                {loading ? (
                  <>
                    <Skeleton className="mb-2 h-7 w-20" />
                    <Skeleton className="h-3 w-28" />
                  </>
                ) : (
                  <>
                    <p className="truncate text-2xl font-bold tracking-tight text-slate-900">{value}</p>
                    <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                    {subtitleText ? <p className="mt-0.5 truncate text-[10px] text-slate-400">{subtitleText}</p> : null}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );

        if (!clickable) return <div key={key}>{cardBody}</div>;

        return (
          <button
            key={key}
            type="button"
            className="text-left"
            onClick={() => onCardClick(key)}
            aria-label={`Filter by ${label}`}
          >
            {cardBody}
          </button>
        );
      })}
    </div>
  );
}
