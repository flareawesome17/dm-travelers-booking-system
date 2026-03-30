import * as React from "react";
import { cn } from "@/lib/utils";
import { SearchX, LucideIcon } from "lucide-react";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  iconClassName?: string;
  borderless?: boolean;
}

export function EmptyState({
  className,
  icon: Icon = SearchX,
  title,
  description,
  action,
  iconClassName,
  borderless = false,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 lg:p-12 animate-in fade-in zoom-in-95 duration-500",
        !borderless && "rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 shadow-sm overflow-hidden relative",
        className
      )}
      {...props}
    >
      {/* Decorative oversized background icon rendering a watermark effect */}
      {!borderless && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.03]">
          <Icon className="w-[120%] h-[120%] text-[#07008A] -rotate-12 transform scale-150 blur-[2px]" />
        </div>
      )}

      {/* Main Container */}
      <div className="relative z-10 flex flex-col items-center max-w-sm mx-auto">
        <div 
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5 mb-6 relative",
            "before:absolute before:inset-0 before:rounded-2xl before:ring-1 before:ring-inset before:ring-[#07008A]/10",
            iconClassName
          )}
        >
          <Icon className="h-7 w-7 text-[#07008A]" strokeWidth={1.5} />
        </div>
        
        <h3 className="text-base font-semibold text-slate-900 tracking-tight leading-none mb-2.5">
          {title}
        </h3>
        
        {description && (
          <p className="text-sm text-slate-500 leading-relaxed mb-6 font-medium">
            {description}
          </p>
        )}
        
        {action && (
          <div className="mt-2 text-sm">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
