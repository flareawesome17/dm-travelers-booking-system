import { Metadata, Viewport } from "next";
import AdminViewportLock from "@/components/admin/AdminViewportLock";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function AdminGlobalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AdminViewportLock />
      {children}
    </>
  );
}
