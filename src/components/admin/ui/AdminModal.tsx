"use client";

import * as React from "react";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type AdminModalSize = "sm" | "md" | "lg" | "xl" | "full";
type AdminModalScrollMode = "content" | "shell";

type AdminModalContextValue = {
  stickyFooter: boolean;
};

const AdminModalContext = React.createContext<AdminModalContextValue>({
  stickyFooter: false,
});

type AdminModalProps = React.ComponentPropsWithoutRef<typeof DialogContent> & {
  size?: AdminModalSize;
  stickyFooter?: boolean;
  scrollMode?: AdminModalScrollMode;
};

const sizeMap: Record<AdminModalSize, string> = {
  sm: "[--admin-modal-width:var(--admin-modal-width-sm)]",
  md: "[--admin-modal-width:var(--admin-modal-width-md)]",
  lg: "[--admin-modal-width:var(--admin-modal-width-lg)]",
  xl: "[--admin-modal-width:var(--admin-modal-width-xl)]",
  full: "[--admin-modal-width:var(--admin-modal-width-full)]",
};

const AdminModal = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  AdminModalProps
>(({ className, children, size = "lg", stickyFooter = false, scrollMode = "content", ...props }, ref) => (
  <AdminModalContext.Provider value={{ stickyFooter }}>
    <DialogContent
      ref={ref}
      data-size={size}
      data-scroll-mode={scrollMode}
      className={cn(
        "admin-modal-responsive admin-modal-shell flex flex-col gap-0 overflow-hidden p-0",
        sizeMap[size],
        scrollMode === "shell" ? "h-[min(94vh,58rem)]" : "max-h-[92vh]",
        className,
      )}
      {...props}
    >
      {children}
    </DialogContent>
  </AdminModalContext.Provider>
));
AdminModal.displayName = "AdminModal";

function AdminModalHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogHeader>) {
  return (
    <DialogHeader
      className={cn("admin-modal-header gap-2 px-5 py-4 text-left sm:px-6", className)}
      {...props}
    />
  );
}
AdminModalHeader.displayName = "AdminModalHeader";

const AdminModalTitle = React.forwardRef<
  React.ElementRef<typeof DialogTitle>,
  React.ComponentPropsWithoutRef<typeof DialogTitle>
>(({ className, ...props }, ref) => (
  <DialogTitle
    ref={ref}
    className={cn("text-lg font-semibold tracking-tight text-[#07008A]", className)}
    {...props}
  />
));
AdminModalTitle.displayName = "AdminModalTitle";

const AdminModalDescription = React.forwardRef<
  React.ElementRef<typeof DialogDescription>,
  React.ComponentPropsWithoutRef<typeof DialogDescription>
>(({ className, ...props }, ref) => (
  <DialogDescription ref={ref} className={cn("text-sm text-slate-500", className)} {...props} />
));
AdminModalDescription.displayName = "AdminModalDescription";

const AdminModalBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("modal-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6", className)}
    {...props}
  />
));
AdminModalBody.displayName = "AdminModalBody";

function AdminModalFooter({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogFooter>) {
  const { stickyFooter } = React.useContext(AdminModalContext);
  return (
    <DialogFooter
      className={cn(
        "admin-modal-footer gap-2 px-5 py-4 sm:px-6",
        stickyFooter && "sticky bottom-0 mt-auto",
        className,
      )}
      {...props}
    />
  );
}
AdminModalFooter.displayName = "AdminModalFooter";

export {
  AdminModal,
  AdminModalHeader,
  AdminModalTitle,
  AdminModalDescription,
  AdminModalBody,
  AdminModalFooter,
};
