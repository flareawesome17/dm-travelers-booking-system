"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type AdminTableShellProps = React.HTMLAttributes<HTMLDivElement> & {
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  emptyState?: React.ReactNode;
  hasData?: boolean;
};

const AdminTableShell = React.forwardRef<HTMLDivElement, AdminTableShellProps>(
  ({ className, toolbar, footer, emptyState, hasData = true, children, ...props }, ref) => (
    <div ref={ref} className={cn("admin-table-shell", className)} {...props}>
      {toolbar ? <div className="admin-toolbar px-5 py-3 sm:px-6">{toolbar}</div> : null}
      <div className="admin-table-frame">
        {hasData ? children : emptyState}
      </div>
      {footer ? <div className="admin-table-footer px-5 py-3 sm:px-6">{footer}</div> : null}
    </div>
  ),
);
AdminTableShell.displayName = "AdminTableShell";

export { AdminTableShell };
