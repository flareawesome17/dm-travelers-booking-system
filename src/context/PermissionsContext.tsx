"use client";

import React, { createContext, useContext, ReactNode } from "react";

interface PermissionsContextType {
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  isLoading: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({
  children,
  permissions,
  isLoading = false,
}: {
  children: ReactNode;
  permissions: string[];
  isLoading?: boolean;
}) {
  const permSet = new Set(permissions);

  const hasPermission = (permission: string) => {
    // Super Admin check could go here if bypass logic is needed
    return permSet.has(permission);
  };

  const hasAnyPermission = (perms: string[]) => {
    return perms.some((p) => permSet.has(p));
  };

  const hasAllPermissions = (perms: string[]) => {
    return perms.every((p) => permSet.has(p));
  };

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        isLoading,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}
