"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AdminPanelCard,
  AdminPanelCardContent,
} from "@/components/admin/ui/AdminPanelCard";

type Tone = "default" | "danger" | "warning" | "success" | "info";

const toneClasses: Record<
  Tone,
  {
    card: string;
    icon: string;
    label: string;
    value: string;
  }
> = {
  default: {
    card: "",
    icon: "bg-[#07008A]/10 text-[#07008A]",
    label: "text-slate-500",
    value: "text-slate-900",
  },
  danger: {
    card: "border-red-200/80 bg-red-50/60",
    icon: "bg-red-100 text-red-600",
    label: "text-red-500",
    value: "text-red-700",
  },
  warning: {
    card: "border-amber-200/80 bg-amber-50/60",
    icon: "bg-amber-100 text-amber-600",
    label: "text-amber-500",
    value: "text-amber-700",
  },
  success: {
    card: "border-emerald-200/80 bg-emerald-50/60",
    icon: "bg-emerald-100 text-emerald-600",
    label: "text-emerald-500",
    value: "text-emerald-700",
  },
  info: {
    card: "border-blue-200/80 bg-blue-50/60",
    icon: "bg-blue-100 text-blue-600",
    label: "text-blue-500",
    value: "text-blue-700",
  },
};

type AdminMetricCardProps = {
  title: string;
  value: React.ReactNode;
  icon: LucideIcon;
  description?: React.ReactNode;
  tone?: Tone;
  className?: string;
};

export function AdminMetricCard({
  title,
  value,
  icon: Icon,
  description,
  tone = "default",
  className,
}: AdminMetricCardProps) {
  const style = toneClasses[tone];

  return (
    <AdminPanelCard density="compact" className={cn(style.card, className)}>
      <AdminPanelCardContent className="flex items-center gap-4">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", style.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className={cn("text-[11px] font-bold uppercase tracking-[0.18em]", style.label)}>{title}</p>
          <p className={cn("mt-1 text-2xl font-bold leading-tight tabular-nums", style.value)}>{value}</p>
          {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
        </div>
      </AdminPanelCardContent>
    </AdminPanelCard>
  );
}
