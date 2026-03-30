import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getErrorMessage(error: unknown): string {
  if (!error) return "An unknown error occurred.";
  if (typeof error === "string") return error;
  
  if (typeof error === "object" && error !== null) {
    if ("error" in error) {
      // Sometimes API wraps like { error: "msg" } or { error: { message: "msg" } }
      const nested = (error as any).error;
      if (typeof nested === "string") return nested;
      if (typeof nested === "object" && nested !== null && "message" in nested) {
        return String((nested as any).message);
      }
    }
    if ("message" in error) {
      return String((error as any).message);
    }
  }
  
  return "An unknown error occurred.";
}
