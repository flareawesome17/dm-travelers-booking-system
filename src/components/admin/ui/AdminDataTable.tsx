"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Align = "left" | "center" | "right";

const alignClass: Record<Align, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const AdminTableContext = React.createContext({
  compact: false,
  stickyHeader: false,
});

type AdminDataTableProps = React.ComponentPropsWithoutRef<typeof Table> & {
  compact?: boolean;
  stickyHeader?: boolean;
};

const AdminDataTable = React.forwardRef<
  React.ElementRef<typeof Table>,
  AdminDataTableProps
>(({ className, compact = false, stickyHeader = false, ...props }, ref) => (
  <AdminTableContext.Provider value={{ compact, stickyHeader }}>
    <Table ref={ref} className={cn("min-w-full text-sm", className)} {...props} />
  </AdminTableContext.Provider>
));
AdminDataTable.displayName = "AdminDataTable";

const AdminDataTableHeader = React.forwardRef<
  React.ElementRef<typeof TableHeader>,
  React.ComponentPropsWithoutRef<typeof TableHeader>
>(({ className, ...props }, ref) => {
  const { stickyHeader } = React.useContext(AdminTableContext);
  return (
    <TableHeader
      ref={ref}
      className={cn(
        stickyHeader &&
          "[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-[hsl(var(--admin-table-header-bg))]",
        className,
      )}
      {...props}
    />
  );
});
AdminDataTableHeader.displayName = "AdminDataTableHeader";

const AdminDataTableBody = React.forwardRef<
  React.ElementRef<typeof TableBody>,
  React.ComponentPropsWithoutRef<typeof TableBody>
>(({ className, ...props }, ref) => (
  <TableBody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
AdminDataTableBody.displayName = "AdminDataTableBody";

const AdminDataTableRow = React.forwardRef<
  React.ElementRef<typeof TableRow>,
  React.ComponentPropsWithoutRef<typeof TableRow>
>(({ className, ...props }, ref) => (
  <TableRow
    ref={ref}
    className={cn("border-slate-200/75 hover:bg-[hsl(var(--admin-table-row-hover-bg))]", className)}
    {...props}
  />
));
AdminDataTableRow.displayName = "AdminDataTableRow";

type AdminDataTableHeadProps = React.ComponentPropsWithoutRef<typeof TableHead> & {
  align?: Align;
};

const AdminDataTableHead = React.forwardRef<
  React.ElementRef<typeof TableHead>,
  AdminDataTableHeadProps
>(({ className, align = "left", ...props }, ref) => {
  const { compact } = React.useContext(AdminTableContext);
  return (
    <TableHead
      ref={ref}
      className={cn(
        "bg-[hsl(var(--admin-table-header-bg))] font-semibold uppercase tracking-[0.18em] text-slate-500",
        compact ? "h-11 px-4 py-3 text-[10px]" : "h-12 px-5 py-3.5 text-[11px]",
        alignClass[align],
        className,
      )}
      {...props}
    />
  );
});
AdminDataTableHead.displayName = "AdminDataTableHead";

type AdminDataTableCellProps = React.ComponentPropsWithoutRef<typeof TableCell> & {
  align?: Align;
  truncate?: boolean;
};

const AdminDataTableCell = React.forwardRef<
  React.ElementRef<typeof TableCell>,
  AdminDataTableCellProps
>(({ className, align = "left", truncate = false, ...props }, ref) => {
  const { compact } = React.useContext(AdminTableContext);
  return (
    <TableCell
      ref={ref}
      className={cn(
        compact ? "px-4 py-3.5" : "px-5 py-4",
        alignClass[align],
        truncate && "max-w-[16rem] truncate",
        className,
      )}
      {...props}
    />
  );
});
AdminDataTableCell.displayName = "AdminDataTableCell";

export {
  AdminDataTable,
  AdminDataTableHeader,
  AdminDataTableBody,
  AdminDataTableRow,
  AdminDataTableHead,
  AdminDataTableCell,
};
