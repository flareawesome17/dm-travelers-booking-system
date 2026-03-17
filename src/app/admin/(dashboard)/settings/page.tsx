"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Settings as SettingsIcon, Save, Building2, Clock, 
  Banknote, Share2, Info, Loader2, Globe, Phone, Mail, MapPin, ShieldAlert
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchSettings();
  }, [router]);

  const fetchSettings = async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.replace("/admin/login"); return; }
    try {
      const res = await fetch("/api/settings", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setSettings(typeof data === "object" ? data : {});
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast.success("Settings saved successfully");
      } else {
        toast.error("Failed to save settings");
      }
    } catch {
      toast.error("An error occurred while saving");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("admin_token");
    if (!token) { router.replace("/admin/login"); return; }
    if (!pwCurrent.trim() || !pwNew.trim() || !pwConfirm.trim()) {
      toast.error("Please fill out all password fields.");
      return;
    }
    if (pwNew.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (pwNew !== pwConfirm) {
      toast.error("New password and confirmation do not match.");
      return;
    }

    setPwSaving(true);
    try {
      const res = await fetch("/api/admin/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: pwCurrent, new_password: pwNew }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error || "Failed to change password.");
        return;
      }
      toast.success("Password updated.");
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Skeleton className="h-64 col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Hotel Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage your property details and system preferences</p>
        </motion.div>
        
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-[#07008A] hover:bg-[#05006a] text-white shadow-md transition-all active:scale-95"
        >
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="bg-slate-100 p-1 border mb-6">
          <TabsTrigger value="general" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Building2 className="h-4 w-4 mr-2" /> General
          </TabsTrigger>
          <TabsTrigger value="operations" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Clock className="h-4 w-4 mr-2" /> Operations
          </TabsTrigger>
          <TabsTrigger value="financial" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Banknote className="h-4 w-4 mr-2" /> Financial
          </TabsTrigger>
          <TabsTrigger value="social" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Share2 className="h-4 w-4 mr-2" /> Social
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <SettingsIcon className="h-4 w-4 mr-2" /> Security
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-0 shadow-sm">
              <CardHeader className="border-b bg-slate-50/30">
                <CardTitle className="text-base font-bold">Property Information</CardTitle>
                <CardDescription>Basic details about D&M Travelers Inn</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="hotel_name">Hotel Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input 
                      id="hotel_name" 
                      value={settings.hotel_name || ""} 
                      onChange={e => handleUpdate("hotel_name", e.target.value)} 
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hotel_address">Address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Textarea 
                      id="hotel_address" 
                      value={settings.hotel_address || ""} 
                      onChange={e => handleUpdate("hotel_address", e.target.value)} 
                      className="pl-10 min-h-[80px]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hotel_phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input 
                        id="hotel_phone" 
                        value={settings.hotel_phone || ""} 
                        onChange={e => handleUpdate("hotel_phone", e.target.value)} 
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hotel_email">Contact Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input 
                        id="hotel_email" 
                        value={settings.hotel_email || ""} 
                        onChange={e => handleUpdate("hotel_email", e.target.value)} 
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hotel_website">Website URL</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input 
                      id="hotel_website" 
                      value={settings.hotel_website || ""} 
                      onChange={e => handleUpdate("hotel_website", e.target.value)} 
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-[#07008A] text-white">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Branding
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/20 rounded-2xl bg-white/5">
                  <img src="/logo.png" alt="Hotel Logo" className="h-20 w-auto object-contain mb-4" />
                  <p className="text-[10px] text-white/60 text-center uppercase tracking-widest font-bold">Standard Logo</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-white/80 leading-relaxed italic">
                    The logo and property details are used across all receipts, invoices, and booking confirmations.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-slate-50 border border-slate-200">
              <CardHeader className="border-b bg-white">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  Site Status
                </CardTitle>
                <CardDescription>Control public access to the website</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <Label htmlFor="site_status">Current Status</Label>
                  <Select 
                    value={settings.site_status || "live"} 
                    onValueChange={(value) => handleUpdate("site_status", value)}
                  >
                    <SelectTrigger id="site_status" className="w-full bg-white">
                      <SelectValue placeholder="Select site status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="live">Live (Publicly Accessible)</SelectItem>
                      <SelectItem value="development">Under Development</SelectItem>
                      <SelectItem value="maintenance">Under Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-2">
                    Changing this from "Live" will prevent visitors from accessing the website.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Operations Settings */}
        <TabsContent value="operations">
          <Card className="border-0 shadow-sm max-w-3xl mx-auto">
            <CardHeader className="border-b bg-slate-50/30">
              <CardTitle className="text-base font-bold">Stay Preferences</CardTitle>
              <CardDescription>Configure check-in times and policies</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="check_in_time">Default Check-in Time</Label>
                  <Input 
                    id="check_in_time" 
                    type="time"
                    value={settings.check_in_time || "14:00"} 
                    onChange={e => handleUpdate("check_in_time", e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="check_out_time">Default Check-out Time</Label>
                  <Input 
                    id="check_out_time" 
                    type="time"
                    value={settings.check_out_time || "12:00"} 
                    onChange={e => handleUpdate("check_out_time", e.target.value)} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="late_checkout_grace_period">Late Check-out Grace Period (Minutes)</Label>
                <div className="flex items-center gap-3">
                  <Input 
                    id="late_checkout_grace_period" 
                    type="number"
                    value={settings.late_checkout_grace_period || "30"} 
                    onChange={e => handleUpdate("late_checkout_grace_period", e.target.value)} 
                    className="max-w-[120px]"
                  />
                  <span className="text-xs text-muted-foreground">Minutes allowed after checkout time before fees apply.</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cancellation_policy">Cancellation Policy</Label>
                <Textarea 
                  id="cancellation_policy" 
                  value={settings.cancellation_policy || ""} 
                  onChange={e => handleUpdate("cancellation_policy", e.target.value)} 
                  className="min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Settings */}
        <TabsContent value="financial">
          <Card className="border-0 shadow-sm max-w-3xl mx-auto">
            <CardHeader className="border-b bg-slate-50/30">
              <CardTitle className="text-base font-bold">Accounting & Billing</CardTitle>
              <CardDescription>Tax rates and payment preferences</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="currency">Base Currency</Label>
                  <Input 
                    id="currency" 
                    value={settings.currency || "PHP"} 
                    onChange={e => handleUpdate("currency", e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deposit_percent">Required Deposit %</Label>
                  <div className="relative">
                    <Input 
                      id="deposit_percent" 
                      type="number"
                      value={settings.deposit_percent || "30"} 
                      onChange={e => handleUpdate("deposit_percent", e.target.value)} 
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="tax_rate">VAT / Tax Rate (%)</Label>
                  <div className="relative">
                    <Input 
                      id="tax_rate" 
                      type="number"
                      value={settings.tax_rate || "12"} 
                      onChange={e => handleUpdate("tax_rate", e.target.value)} 
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service_charge">Restaurant Service Charge (%)</Label>
                  <div className="relative">
                    <Input 
                      id="service_charge" 
                      type="number"
                      value={settings.service_charge || "0"} 
                      onChange={e => handleUpdate("service_charge", e.target.value)} 
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social Settings */}
        <TabsContent value="social">
          <Card className="border-0 shadow-sm max-w-3xl mx-auto">
            <CardHeader className="border-b bg-slate-50/30">
              <CardTitle className="text-base font-bold">Social Media & Links</CardTitle>
              <CardDescription>Connect your online presence</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="facebook_url">Facebook Page URL</Label>
                <Input 
                  id="facebook_url" 
                  value={settings.facebook_url || ""} 
                  onChange={e => handleUpdate("facebook_url", e.target.value)} 
                  placeholder="https://facebook.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram_url">Instagram Profile URL</Label>
                <Input 
                  id="instagram_url" 
                  value={settings.instagram_url || ""} 
                  onChange={e => handleUpdate("instagram_url", e.target.value)} 
                  placeholder="https://instagram.com/..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security">
          <Card className="border-0 shadow-sm max-w-3xl mx-auto">
            <CardHeader className="border-b bg-slate-50/30">
              <CardTitle className="text-base font-bold">Change Password</CardTitle>
              <CardDescription>Update your own admin password</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form className="space-y-4" onSubmit={handleChangePassword}>
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={pwCurrent}
                    onChange={(e) => setPwCurrent(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={pwSaving} className="bg-[#07008A] hover:bg-[#05006a] text-white">
                    {pwSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    {pwSaving ? "Updating..." : "Update password"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
