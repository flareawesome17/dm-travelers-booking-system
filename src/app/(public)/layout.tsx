import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { getSupabaseAdmin } from "@/lib/supabase";
import { Construction, Wrench } from "lucide-react";

async function getSiteStatus() {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from("settings").select("value").eq("key", "site_status").single();
    return data?.value || "live";
  } catch (error) {
    return "live";
  }
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const siteStatus = await getSiteStatus();

  if (siteStatus === "development") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900 p-4">
        <Construction className="h-16 w-16 text-blue-600 mb-6" />
        <h1 className="text-4xl font-bold mb-4 text-center text-[#07008A]">Website Under Development</h1>
        <p className="text-lg text-slate-600 text-center max-w-md">
          We are currently building our new website to serve you better. Please check back soon!
        </p>
      </div>
    );
  }

  if (siteStatus === "maintenance") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900 p-4">
        <Wrench className="h-16 w-16 text-amber-500 mb-6" />
        <h1 className="text-4xl font-bold mb-4 text-center text-[#07008A]">Website Under Maintenance</h1>
        <p className="text-lg text-slate-600 text-center max-w-md">
          We are currently performing scheduled maintenance. We will be back online shortly. Thank you for your patience!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  );
}
