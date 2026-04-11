"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type Intent = "danger" | "warning" | "neutral";

const intentStyles: Record<
  Intent,
  {
    icon: typeof AlertTriangle;
    iconShell: string;
    confirmButton: string;
  }
> = {
  danger: {
    icon: ShieldAlert,
    iconShell: "bg-red-100 text-red-600",
    confirmButton: "bg-red-600 text-white hover:bg-red-700",
  },
  warning: {
    icon: AlertTriangle,
    iconShell: "bg-amber-100 text-amber-600",
    confirmButton: "bg-amber-600 text-white hover:bg-amber-700",
  },
  neutral: {
    icon: Info,
    iconShell: "bg-[#07008A]/10 text-[#07008A]",
    confirmButton: "bg-[#07008A] text-white hover:bg-[#05006a]",
  },
};

type AdminConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  intent?: Intent;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmClassName?: string;
  confirmDisabled?: boolean;
  children?: ReactNode;
  onConfirm: () => void | Promise<void>;
};

export function AdminConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  intent = "danger",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmClassName,
  confirmDisabled = false,
  children,
  onConfirm,
}: AdminConfirmDialogProps) {
  const style = intentStyles[intent];
  const Icon = style.icon;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="admin-confirm-shell max-w-xl gap-0 overflow-hidden p-0">
        <div className="admin-confirm-accent" />
        <div className="p-5 sm:p-6">
          <AlertDialogHeader className="gap-4 text-left">
            <div className="flex items-start gap-4">
              <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", style.iconShell)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <AlertDialogTitle className="text-lg font-semibold tracking-tight text-slate-900">
                  {title}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm leading-6 text-slate-500">
                  {description}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          {children ? <div className="mt-5">{children}</div> : null}

          <AlertDialogFooter className="mt-6 border-t border-slate-200/80 pt-4">
            <AlertDialogCancel className="rounded-full border-slate-200 bg-white hover:bg-slate-50">
              {cancelLabel}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmDisabled}
              className={cn("rounded-full", style.confirmButton, confirmClassName)}
              onClick={onConfirm}
            >
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
