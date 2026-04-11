"use client";

import type { ReactNode } from "react";
import { AdminConfirmDialog } from "@/components/admin/ui";

type ConfirmActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmClassName?: string;
  intent?: "danger" | "warning" | "neutral";
  onConfirm: () => void | Promise<void>;
};

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmClassName = "bg-red-600 hover:bg-red-700 text-white",
  intent = "danger",
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <AdminConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      confirmClassName={confirmClassName}
      intent={intent}
      onConfirm={onConfirm}
    />
  );
}
