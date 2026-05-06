"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePermissions } from "@/context/PermissionsContext";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Car, Loader2, Pencil, Plus, RefreshCw, Shirt, Sparkles } from "lucide-react";

type ServiceType = {
  id: string;
  code: string;
  name: string;
  rate_amount: number;
  unit_label: string;
  unit_description: string | null;
  is_active: boolean;
};

type ServiceRecord = {
  id: string;
  service_name: string;
  unit_label: string;
  unit_rate: number;
  quantity: number;
  total_amount: number;
  payment_method: string;
  payment_reference: string | null;
  customer_name: string | null;
  room_number: string | null;
  note: string | null;
  accounting_date: string;
  created_at: string;
  recorded_by_name: string | null;
};

type ServicesSummary = {
  total_revenue: number;
  transaction_count: number;
  by_service: Record<string, number>;
  by_method: Record<string, number>;
};

function money(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
}

function dt(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function serviceIcon(code: string) {
  if (code === "parking") return Car;
  if (code === "laundry") return Shirt;
  return Sparkles;
}

function SummaryCard({ label, value, helper, emphasized = false }: { label: string; value: string; helper: string; emphasized?: boolean }) {
  return (
    <Card className={emphasized ? "border-[#07008A]/20 bg-[#07008A] text-white shadow-lg" : "border-slate-200 shadow-sm"}>
      <CardContent className="p-5">
        <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${emphasized ? "text-white/70" : "text-slate-400"}`}>{label}</p>
        <p className={`mt-3 text-3xl font-black tracking-tight ${emphasized ? "text-white" : "text-[#07008A]"}`}>{value}</p>
        <p className={`mt-2 text-sm leading-5 ${emphasized ? "text-white/80" : "text-slate-500"}`}>{helper}</p>
      </CardContent>
    </Card>
  );
}

export default function OtherServicesPage() {
  const { hasPermission } = usePermissions();
  const canRead = hasPermission("other_services.read");
  const canCreate = hasPermission("other_services.create");
  const canManage = hasPermission("other_services.manage");

  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [summary, setSummary] = useState<ServicesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceType | null>(null);

  const [serviceTypeId, setServiceTypeId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [note, setNote] = useState("");
  const [editName, setEditName] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editUnitLabel, setEditUnitLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const token = useCallback(() => localStorage.getItem("admin_token") || "", []);

  const load = useCallback(async (spin = false) => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    if (spin) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/other-services", { headers: { Authorization: `Bearer ${token()}` } });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(payload) || "Failed to load other services.");
      const types = Array.isArray(payload.service_types) ? payload.service_types as ServiceType[] : [];
      setServiceTypes(types);
      setRecords(Array.isArray(payload.records) ? payload.records as ServiceRecord[] : []);
      setSummary(payload.summary || null);
      setServiceTypeId((current) => current || types.find((type) => type.is_active)?.id || types[0]?.id || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load other services.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canRead, token]);

  useEffect(() => {
    if (!canRead) return;
    load();
  }, [canRead, load]);

  const selectedService = useMemo(() => serviceTypes.find((type) => type.id === serviceTypeId) || null, [serviceTypeId, serviceTypes]);
  const parsedQuantity = Number(quantity || 0);
  const previewTotal = selectedService && Number.isFinite(parsedQuantity) && parsedQuantity > 0
    ? Number((Number(selectedService.rate_amount || 0) * parsedQuantity).toFixed(2))
    : 0;

  const resetForm = () => {
    setServiceTypeId(serviceTypes.find((type) => type.is_active)?.id || serviceTypes[0]?.id || "");
    setQuantity("1");
    setPaymentMethod("Cash");
    setPaymentReference("");
    setCustomerName("");
    setRoomNumber("");
    setNote("");
  };

  const openEditService = (type: ServiceType) => {
    setEditingService(type);
    setEditName(type.name);
    setEditRate(String(type.rate_amount ?? ""));
    setEditUnitLabel(type.unit_label);
    setEditDescription(type.unit_description || "");
    setEditIsActive(Boolean(type.is_active));
    setEditDialogOpen(true);
  };

  const resetEditForm = () => {
    setEditingService(null);
    setEditName("");
    setEditRate("");
    setEditUnitLabel("");
    setEditDescription("");
    setEditIsActive(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/other-services", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          service_type_id: serviceTypeId,
          quantity: Number(quantity),
          payment_method: paymentMethod,
          payment_reference: paymentReference || null,
          customer_name: customerName || null,
          room_number: roomNumber || null,
          note: note || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(payload) || "Failed to record service.");
      toast.success("Service recorded.");
      setDialogOpen(false);
      resetForm();
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record service.");
    } finally {
      setSaving(false);
    }
  };

  const saveServiceType = async () => {
    if (!editingService) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/other-services/types/${editingService.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          name: editName,
          rate_amount: Number(editRate),
          unit_label: editUnitLabel,
          unit_description: editDescription || null,
          is_active: editIsActive,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getErrorMessage(payload) || "Failed to update service rate.");
      toast.success("Service rate updated.");
      setEditDialogOpen(false);
      resetEditForm();
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update service rate.");
    } finally {
      setSaving(false);
    }
  };

  if (!canRead) {
    return <div className="py-10"><EmptyState icon={Sparkles} title="Other services are restricted" description="You do not have permission to view hotel service records." /></div>;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#07008A]/70">Service Revenue</p>
          <h1 className="text-3xl font-black tracking-tight text-[#07008A]">Other Services</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">Record paid services outside room, restaurant, and booking extras: parking, laundry, massage, and future service items.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => load(true)} disabled={refreshing}>{refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Refresh</Button>
          {canCreate ? <Button className="bg-[#07008A] text-white hover:bg-[#05006a]" onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Record Service</Button> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Service Revenue" value={money(summary?.total_revenue || 0)} helper={`${summary?.transaction_count || 0} recorded service transaction(s).`} emphasized />
        {serviceTypes.slice(0, 3).map((type) => {
          const Icon = serviceIcon(type.code);
          return (
            <Card key={type.id} className="border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{type.name}</p>
                    <p className="mt-3 text-2xl font-black tracking-tight text-[#07008A]">{money(Number(type.rate_amount || 0))}</p>
                    <p className="mt-2 text-sm leading-5 text-slate-500">{type.unit_description || `Per ${type.unit_label}`}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="rounded-2xl bg-[#07008A]/5 p-3 text-[#07008A]"><Icon className="h-5 w-5" /></div>
                    {canManage ? <Button variant="ghost" size="sm" className="h-8 px-2 text-[#07008A]" onClick={() => openEditService(type)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button> : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Service Records</CardTitle>
          <CardDescription>Recent parking, laundry, massage, and other service sales.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {records.length === 0 ? <EmptyState title="No service records yet" description="Record a parking, laundry, or massage transaction to start the ledger." borderless /> : records.map((record) => (
            <article key={record.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-[#07008A]/15 bg-[#07008A]/5 text-[#07008A]">{record.service_name}</Badge>
                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{record.payment_method}</Badge>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{money(Number(record.total_amount || 0))}</h3>
                  <p className="mt-1 text-sm text-slate-500">{record.customer_name || "Walk-in customer"}{record.room_number ? ` - Room ${record.room_number}` : ""}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm font-medium text-slate-900">{dt(record.created_at)}</p>
                  <p className="mt-1 text-xs text-slate-500">By {record.recorded_by_name || "Unknown"}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Quantity</p><p className="mt-1 text-sm font-medium text-slate-800">{Number(record.quantity || 0)} {record.unit_label}(s)</p></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Rate</p><p className="mt-1 text-sm font-medium text-slate-800">{money(Number(record.unit_rate || 0))}</p></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Accounting Date</p><p className="mt-1 text-sm font-medium text-slate-800">{record.accounting_date}</p></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Reference</p><p className="mt-1 text-sm font-medium text-slate-800">{record.payment_reference || "-"}</p></div>
              </div>
              {record.note ? <p className="mt-3 text-sm leading-6 text-slate-600">{record.note}</p> : null}
            </article>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Service</DialogTitle>
            <DialogDescription>Rates are pulled from the service catalog and posted to the active shift as income.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="service-type">Service</Label>
              <select id="service-type" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={serviceTypeId} onChange={(event) => setServiceTypeId(event.target.value)}>
                {serviceTypes.filter((type) => type.is_active).map((type) => <option key={type.id} value={type.id}>{type.name} - {money(Number(type.rate_amount || 0))}/{type.unit_label}</option>)}
              </select>
            </div>
            <div className="space-y-2"><Label htmlFor="service-quantity">Quantity ({selectedService?.unit_label || "unit"})</Label><Input id="service-quantity" type="number" min="0" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div>
            <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Total</p><p className="mt-1 text-sm font-semibold text-slate-900">{money(previewTotal)}</p><p className="mt-1 text-xs text-slate-500">{selectedService?.unit_description || "Select a service."}</p></div>
            <div className="space-y-2">
              <Label htmlFor="service-payment">Payment Method</Label>
              <select id="service-payment" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                <option value="Cash">Cash</option>
                <option value="GCash">GCash</option>
                <option value="Card">Card</option>
                <option value="QRPh">QRPh</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
            {paymentMethod !== "Cash" ? <div className="space-y-2"><Label htmlFor="service-reference">Reference Number</Label><Input id="service-reference" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} /></div> : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="service-customer">Customer Name</Label><Input id="service-customer" value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="service-room">Room Number</Label><Input id="service-room" value={roomNumber} onChange={(event) => setRoomNumber(event.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="service-note">Note</Label><Textarea id="service-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Close</Button>
            <Button className="bg-[#07008A] text-white hover:bg-[#05006a]" onClick={submit} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Record Service</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) resetEditForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Service Rate</DialogTitle>
            <DialogDescription>Changes apply to new service records only. Existing records keep their historical rate snapshot.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="edit-service-name">Service Name</Label><Input id="edit-service-name" value={editName} onChange={(event) => setEditName(event.target.value)} /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="edit-service-rate">Rate</Label><Input id="edit-service-rate" type="number" min="0" step="0.01" value={editRate} onChange={(event) => setEditRate(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="edit-service-unit">Unit</Label><Input id="edit-service-unit" value={editUnitLabel} onChange={(event) => setEditUnitLabel(event.target.value)} placeholder="day, load, hour" /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="edit-service-description">Rate Description</Label><Textarea id="edit-service-description" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} rows={3} placeholder="PHP 250 per load up to 5 kilos" /></div>
            <div className="space-y-2">
              <Label htmlFor="edit-service-status">Status</Label>
              <select id="edit-service-status" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editIsActive ? "active" : "inactive"} onChange={(event) => setEditIsActive(event.target.value === "active")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Close</Button>
            <Button className="bg-[#07008A] text-white hover:bg-[#05006a]" onClick={saveServiceType} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}Save Rate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
