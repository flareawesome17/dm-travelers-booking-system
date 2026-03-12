"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  className?: string;
  activeClassName?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ href, className, activeClassName, children, onClick, ...props }, ref) => {
    const pathname = usePathname();
    const isActive = pathname === href;

    return (
      <Link
        ref={ref}
        href={href}
        className={cn(className, isActive && activeClassName)}
        onClick={onClick}
        {...props}
      >
        {children}
      </Link>
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
