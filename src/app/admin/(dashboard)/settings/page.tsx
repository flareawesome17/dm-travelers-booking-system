"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Settings as SettingsIcon, Save, Building2, Clock, 
  Banknote, Share2, Info, Loader2, Globe, Phone, Mail, MapPin, ShieldAlert, Package
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { usePermissions } from "@/context/PermissionsContext";
import { getErrorMessage } from "@/lib/utils";

type ShiftConfig = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  is_active: boolean;
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [shifts, setShifts] = useState<ShiftConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const { hasPermission } = usePermissions();
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const router = useRouter();

  const fetchSettings = useCallback(async () => {
    const token = localStorage.getItem("admin_token");
    
    try {
      const [settingsRes, shiftsRes] = await Promise.all([
        fetch("/api/settings", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/settings/shifts", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const settingsData = await settingsRes.json().catch(() => ({}));
      const shiftsData = await shiftsRes.json().catch(() => ([]));

      if (!settingsRes.ok) {
        throw new Error(getErrorMessage(settingsData) || "Failed to load settings");
      }
      if (!shiftsRes.ok) {
        throw new Error(getErrorMessage(shiftsData) || "Failed to load shift schedules");
      }

      setSettings(typeof settingsData === "object" ? settingsData : {});
      setShifts(Array.isArray(shiftsData) ? shiftsData : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleUpdate = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleShiftUpdate = (id: string, field: keyof ShiftConfig, value: string | boolean) => {
    setShifts((prev) => prev.map((shift) => (
      shift.id === id ? { ...shift, [field]: value } : shift
    )));
  };

  const handleSave = async () => {
    if (!shifts.some((shift) => shift.is_active)) {
      toast.error("At least one shift must remain active.");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("admin_token");
      const shiftPayload = shifts
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((shift) => ({
          ...shift,
          start_time: shift.start_time.slice(0, 5),
          end_time: shift.end_time.slice(0, 5),
        }));

      const shiftRes = await fetch("/api/settings/shifts", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(shiftPayload),
      });
      const shiftPayloadResponse = await shiftRes.json().catch(() => ({}));
      if (!shiftRes.ok) {
        throw new Error(getErrorMessage(shiftPayloadResponse) || "Failed to save shift schedule");
      }

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(settings),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(getErrorMessage(payload) || "Failed to save settings");
      }
      await fetchSettings();
      toast.success("Settings saved successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred while saving");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("admin_token");
    
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
        const errMsg = getErrorMessage(data);
        toast.error(errMsg || "Failed to change password.");
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Hotel Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage your property details and system preferences</p>
        </motion.div>
        
        {hasPermission("settings.write") && (
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="bg-[#07008A] hover:bg-[#05006a] text-white shadow-md transition-all active:scale-95"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        )}
      </div>

      <Tabs defaultValue="general" className="w-full">
        <div className="w-full overflow-x-auto pb-1 mb-6 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          <TabsList className="flex w-max min-w-full bg-slate-100 p-1 border">
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
            <TabsTrigger value="extras" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Package className="h-4 w-4 mr-2" /> Extras
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <SettingsIcon className="h-4 w-4 mr-2" /> Security
            </TabsTrigger>
          </TabsList>
        </div>

        {/* General Settings */}
        <TabsContent value="general">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Column: Main Property Info */}
            <div className="lg:col-span-2">
              <Card className="border-0 shadow-sm">
                <CardHeader className="border-b bg-slate-50/30">
                  <CardTitle className="text-base font-bold">Property Information</CardTitle>
                  <CardDescription>Basic details about D&M Travellers Inn</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-4">
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
            </div>

            {/* Right Column: Secondary Settings */}
            <div className="space-y-6">
              <Card className="border-0 shadow-sm bg-[#07008A] text-white overflow-hidden relative">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Branding
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div 
                    className="relative group flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/20 rounded-2xl bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                    onClick={() => document.getElementById("logo-upload")?.click()}
                  >
                    {uploadingLogo && (
                      <div className="absolute inset-0 bg-[#07008A]/80 flex items-center justify-center z-10 rounded-xl flex-col gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                        <p className="text-xs text-white/80 font-medium">Uploading...</p>
                      </div>
                    )}
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={!hasPermission("settings.write")}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        setUploadingLogo(true);
                        try {
                          const token = localStorage.getItem("admin_token");
                          const reader = new FileReader();
                          reader.onload = async () => {
                            const filePayload = {
                              name: file.name,
                              type: file.type || "image/jpeg",
                              data: String(reader.result ?? ""),
                            };

                            const uploadRes = await fetch(`/api/rooms/upload-image`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                              },
                              body: JSON.stringify({ files: [filePayload] }),
                            });

                            const uploadData = await uploadRes.json();
                            if (!uploadRes.ok) throw new Error(uploadData.error || "Failed to upload logo.");

                            const newLogoUrl = uploadData.urls[0];
                            handleUpdate("hotel_logo", newLogoUrl);
                            toast.success("Logo uploaded temporarily. Click Save Changes to apply.");
                            
                            setUploadingLogo(false);
                          };
                          reader.onerror = () => {
                            toast.error("Failed to read file");
                            setUploadingLogo(false);
                          };
                          reader.readAsDataURL(file);
                        } catch (err: any) {
                          toast.error(err.message || "An error occurred");
                          setUploadingLogo(false);
                        }
                      }}
                    />
                    <img src={settings.hotel_logo || "/logo.png"} alt="Hotel Logo" className="h-20 w-auto object-contain mb-4" />
                    <p className="text-[10px] text-white/60 text-center uppercase tracking-widest font-bold group-hover:text-white transition-colors">
                      {hasPermission("settings.write") ? "Click to Upload Logo" : "Logo Preview"}
                    </p>
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
          </div>
        </TabsContent>

        {/* Operations Settings */}
        <TabsContent value="operations">
          <div className="mx-auto max-w-4xl space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="border-b bg-slate-50/30">
                <CardTitle className="text-base font-bold">Stay Preferences</CardTitle>
                <CardDescription>Configure check-in times and guest-facing policies</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-dashed">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">System Timezone</Label>
                    <Select 
                      value={settings.timezone || "Asia/Manila"} 
                      onValueChange={(value) => handleUpdate("timezone", value)}
                      disabled={!hasPermission("settings.write")}
                    >
                      <SelectTrigger id="timezone" className="w-full">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Asia/Manila">Asia/Manila (PHT)</SelectItem>
                        <SelectItem value="Asia/Singapore">Asia/Singapore (SGT)</SelectItem>
                        <SelectItem value="Asia/Hong_Kong">Asia/Hong_Kong (HKT)</SelectItem>
                        <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                        <SelectItem value="UTC">UTC (Universal Time)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Standard timezone identifier</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone_offset">Timezone Offset</Label>
                    <Input 
                      id="timezone_offset" 
                      placeholder="+08:00"
                      value={settings.timezone_offset || "+08:00"} 
                      onChange={e => handleUpdate("timezone_offset", e.target.value)} 
                      disabled={!hasPermission("settings.write")}
                    />
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">ISO 8601 offset (e.g., +08:00, -05:00)</p>
                  </div>
                </div>

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
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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
                    placeholder="Example: A 30% down payment is required and non-refundable once a booking is cancelled."
                    className="min-h-[100px]"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="border-b bg-slate-50/30">
                <CardTitle className="text-base font-bold">Shift Schedule</CardTitle>
                <CardDescription>Set the exact time window for each shift. These values drive active-shift detection and ledger close timing on the Shifts page.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 border-b border-slate-100 mb-2">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">Automatic Shift Ledger Closing</p>
                    <p className="text-xs text-muted-foreground">Automatically close the active shift ledger when its schedule ends and open the next shift. If manual (off), the shift ledger remains open until explicitly closed.</p>
                  </div>
                  <Switch 
                    checked={settings.auto_close_shifts === "true"} 
                    onCheckedChange={(checked) => handleUpdate("auto_close_shifts", checked ? "true" : "false")} 
                  />
                </div>
                {shifts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No shift definitions found. Create shift rows first, then return here to configure their schedule.</p>
                ) : (
                  shifts
                    .slice()
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((shift, index) => (
                      <div key={shift.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{shift.name}</p>
                              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">Shift {index + 1}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">Use 24-hour time. Overnight shifts are supported automatically.</p>
                          </div>
                          <div className="flex items-center justify-between w-full md:w-auto gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
                             <span className="text-xs font-medium text-slate-600">Active</span>
                             <Switch
                               checked={shift.is_active}
                               onCheckedChange={(checked) => handleShiftUpdate(shift.id, "is_active", checked)}
                             />
                           </div>
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`shift-start-${shift.id}`}>Start time</Label>
                            <Input
                              id={`shift-start-${shift.id}`}
                              type="time"
                              value={shift.start_time?.slice(0, 5) || ""}
                              onChange={(e) => handleShiftUpdate(shift.id, "start_time", e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`shift-end-${shift.id}`}>End time</Label>
                            <Input
                              id={`shift-end-${shift.id}`}
                              type="time"
                              value={shift.end_time?.slice(0, 5) || ""}
                              onChange={(e) => handleShiftUpdate(shift.id, "end_time", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Financial Settings */}
        <TabsContent value="financial">
          <Card className="border-0 shadow-sm max-w-3xl mx-auto">
            <CardHeader className="border-b bg-slate-50/30">
              <CardTitle className="text-base font-bold">Accounting & Billing</CardTitle>
              <CardDescription>Tax rates and payment preferences</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-6">
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
                  <Label htmlFor="deposit_percent">Public Booking Downpayment %</Label>
                  <div className="relative">
                    <Input 
                      id="deposit_percent" 
                      type="number"
                      min={1}
                      max={100}
                      value={settings.deposit_percent || "30"} 
                      onChange={e => handleUpdate("deposit_percent", e.target.value)} 
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Used by the public booking page and QRPh payment flow before confirmation.
                  </p>
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

        {/* Extras Settings */}
        <TabsContent value="extras">
          <Card className="border-0 shadow-sm max-w-3xl mx-auto">
            <CardHeader className="border-b bg-slate-50/30">
              <CardTitle className="text-base font-bold">Extras Pricing</CardTitle>
              <CardDescription>Configure standard pricing for predefined booking extras items</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="extra_bed_price">Extra Bed Price (₱)</Label>
                  <Input 
                    id="extra_bed_price" 
                    type="number"
                    value={settings.extra_bed_price || "0"} 
                    onChange={e => handleUpdate("extra_bed_price", e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="extra_person_price">Extra Person Price (₱)</Label>
                  <Input 
                    id="extra_person_price" 
                    type="number"
                    value={settings.extra_person_price || "0"} 
                    onChange={e => handleUpdate("extra_person_price", e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="extra_pillow_price">Extra Pillow Price (₱)</Label>
                  <Input 
                    id="extra_pillow_price" 
                    type="number"
                    value={settings.extra_pillow_price || "0"} 
                    onChange={e => handleUpdate("extra_pillow_price", e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="extra_blanket_price">Extra Blanket Price (₱)</Label>
                  <Input 
                    id="extra_blanket_price" 
                    type="number"
                    value={settings.extra_blanket_price || "0"} 
                    onChange={e => handleUpdate("extra_blanket_price", e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="extra_towel_price">Extra Towel - Bath Price (₱)</Label>
                  <Input 
                    id="extra_towel_price" 
                    type="number"
                    value={settings.extra_towel_price || "0"} 
                    onChange={e => handleUpdate("extra_towel_price", e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="extra_towel_hand_price">Extra Towel - Hand Price (₱)</Label>
                  <Input 
                    id="extra_towel_hand_price" 
                    type="number"
                    value={settings.extra_towel_hand_price || "0"} 
                    onChange={e => handleUpdate("extra_towel_hand_price", e.target.value)} 
                  />
                </div>
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
            <CardContent className="p-4 sm:p-6">
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
