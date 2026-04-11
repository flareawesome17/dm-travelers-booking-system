"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Density = "default" | "compact";

type AdminPanelCardProps = React.ComponentPropsWithoutRef<typeof Card> & {
  density?: Density;
};

const densityPadding = {
  default: {
    header: "px-5 py-4 sm:px-6",
    content: "px-5 py-5 sm:px-6",
    footer: "px-5 py-4 sm:px-6",
  },
  compact: {
    header: "px-4 py-3 sm:px-5",
    content: "px-4 py-4 sm:px-5",
    footer: "px-4 py-3 sm:px-5",
  },
} as const;

const DensityContext = React.createContext<Density>("default");

function useDensity() {
  return React.useContext(DensityContext);
}

const AdminPanelCard = React.forwardRef<HTMLDivElement, AdminPanelCardProps>(
  ({ className, density = "default", ...props }, ref) => (
    <DensityContext.Provider value={density}>
      <Card
        ref={ref}
        data-density={density}
        className={cn("admin-panel-card overflow-hidden", className)}
        {...props}
      />
    </DensityContext.Provider>
  ),
);
AdminPanelCard.displayName = "AdminPanelCard";

const AdminPanelCardHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof CardHeader>
>(({ className, ...props }, ref) => {
  const density = useDensity();
  return (
    <CardHeader
      ref={ref}
      className={cn(
        "admin-panel-card-header flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
        densityPadding[density].header,
        className,
      )}
      {...props}
    />
  );
});
AdminPanelCardHeader.displayName = "AdminPanelCardHeader";

const AdminPanelCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof CardTitle>
>(({ className, ...props }, ref) => (
  <CardTitle
    ref={ref}
    className={cn("text-lg font-semibold tracking-tight text-[#07008A]", className)}
    {...props}
  />
));
AdminPanelCardTitle.displayName = "AdminPanelCardTitle";

const AdminPanelCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof CardDescription>
>(({ className, ...props }, ref) => (
  <CardDescription ref={ref} className={cn("text-sm text-slate-500", className)} {...props} />
));
AdminPanelCardDescription.displayName = "AdminPanelCardDescription";

const AdminPanelCardContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof CardContent>
>(({ className, ...props }, ref) => {
  const density = useDensity();
  return (
    <CardContent
      ref={ref}
      className={cn(densityPadding[density].content, density === "compact" ? "pt-0" : "pt-0", className)}
      {...props}
    />
  );
});
AdminPanelCardContent.displayName = "AdminPanelCardContent";

const AdminPanelCardFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof CardFooter>
>(({ className, ...props }, ref) => {
  const density = useDensity();
  return (
    <CardFooter
      ref={ref}
      className={cn("admin-table-footer", densityPadding[density].footer, className)}
      {...props}
    />
  );
});
AdminPanelCardFooter.displayName = "AdminPanelCardFooter";

export {
  AdminPanelCard,
  AdminPanelCardHeader,
  AdminPanelCardTitle,
  AdminPanelCardDescription,
  AdminPanelCardContent,
  AdminPanelCardFooter,
};
