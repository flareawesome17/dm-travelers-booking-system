"use client";

import { useEffect } from "react";

/**
 * Global viewport lock for the Admin panel.
 * 
 * 1. Attaches `admin-viewport-locked` class to `document.body` which applies CSS rules 
 *    that force text size to 16px to prevent iOS Safari auto-zoom on input focus.
 * 2. Attaches a passive=false event listener to prevent multi-touch pinch-to-zoom 
 *    manual gestures on iOS 10+ Safari.
 */
export default function AdminViewportLock() {
  useEffect(() => {
    // Apply CSS lock
    document.body.classList.add("admin-viewport-locked");

    // Prevent manual pinch-to-zoom gesture
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      document.body.classList.remove("admin-viewport-locked");
      document.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  return null;
}
