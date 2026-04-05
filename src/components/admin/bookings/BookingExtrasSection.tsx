"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { getErrorMessage } from "@/lib/utils";
import { Plus, Trash2, Package } from "lucide-react";

const EXTRA_TYPES = ["Extra Bed", "Extra Pillow", "Extra Blanket", "Extra Towel - Bath", "Extra Towel - Hand", "Extra Person"] as const;
type ExtraType = (typeof EXTRA_TYPES)[number];

type ExtraRow = {
  id?: string;
  extra_type: ExtraType;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type BookingExtrasSectionProps = {
  bookingId: string;
  token: string;
  onTotalChange?: (total: number) => void;
  onSuccess?: () => void;
};

// Map extra_type to settings key
const TYPE_TO_KEY: Record<ExtraType, string> = {
  "Extra Bed": "extra_bed_price",
  "Extra Pillow": "extra_pillow_price",
  "Extra Blanket": "extra_blanket_price",
  "Extra Towel - Bath": "extra_towel_price",
  "Extra Towel - Hand": "extra_towel_hand_price",
  "Extra Person": "extra_person_price",
};

export function BookingExtrasSection({ bookingId, token, onTotalChange, onSuccess }: BookingExtrasSectionProps) {
  const [extras, setExtras] = useState<ExtraRow[]>([]);
  const [defaultPrices, setDefaultPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingExtras, setPendingExtras] = useState<{ extra_type: ExtraType; quantity: number; unit_price: number }[]>([]);

  // Load existing extras + default prices
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [extrasRes, settingsRes] = await Promise.all([
          fetch(`/api/bookings/${bookingId}/extras`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`/api/settings`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        const extrasData = await extrasRes.json().catch(() => []);
        setExtras(Array.isArray(extrasData) ? extrasData : []);

        const settingsData = await settingsRes.json().catch(() => ({}));
        const prices: Record<string, number> = {};
        if (settingsData && typeof settingsData === "object") {
          for (const type of EXTRA_TYPES) {
            const key = TYPE_TO_KEY[type];
            // settings could be array of {key, value} or object
            if (Array.isArray(settingsData)) {
              const row = settingsData.find((s: { key: string }) => s.key === key);
              prices[type] = row ? Number(row.value) || 0 : 0;
            } else if (settingsData[key]) {
              prices[type] = Number(settingsData[key]) || 0;
            }
          }
        }
        setDefaultPrices(prices);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [bookingId, token]);

  const extrasTotal = extras.reduce((s, e) => s + Number(e.total_price || 0), 0);
  const pendingTotal = pendingExtras.reduce((s, e) => s + e.quantity * e.unit_price, 0);

  const notifyTotal = useCallback((saved: ExtraRow[], pending: typeof pendingExtras) => {
    const total = saved.reduce((s, e) => s + Number(e.total_price || 0), 0)
      + pending.reduce((s, e) => s + e.quantity * e.unit_price, 0);
    onTotalChange?.(total);
  }, [onTotalChange]);

  const addPending = () => {
    // Find first type not already in use
    const usedTypes = new Set([
      ...extras.map((e) => e.extra_type),
      ...pendingExtras.map((e) => e.extra_type),
    ]);
    const available = EXTRA_TYPES.find((t) => !usedTypes.has(t)) || EXTRA_TYPES[0];
    const newItem = { extra_type: available, quantity: 1, unit_price: defaultPrices[available] || 0 };
    const next = [...pendingExtras, newItem];
    setPendingExtras(next);
    notifyTotal(extras, next);
  };

  const removePending = (idx: number) => {
    const next = pendingExtras.filter((_, i) => i !== idx);
    setPendingExtras(next);
    notifyTotal(extras, next);
  };

  const updatePending = (idx: number, field: string, value: string | number) => {
    const next = [...pendingExtras];
    if (field === "extra_type") {
      const type = value as ExtraType;
      next[idx] = { ...next[idx], extra_type: type, unit_price: defaultPrices[type] || next[idx].unit_price };
    } else if (field === "quantity") {
      next[idx] = { ...next[idx], quantity: Math.max(1, Number(value) || 1) };
    } else if (field === "unit_price") {
      next[idx] = { ...next[idx], unit_price: Math.max(0, Number(value) || 0) };
    }
    setPendingExtras(next);
    notifyTotal(extras, next);
  };

  const savePending = async () => {
    if (!pendingExtras.length) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/extras`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ extras: pendingExtras }),
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) { toast.error(getErrorMessage(data) || "Failed to save extras."); return; }
      const newExtras = Array.isArray(data) ? data : [];
      const combined = [...extras, ...newExtras];
      setExtras(combined);
      setPendingExtras([]);
      notifyTotal(combined, []);
      onSuccess?.();
      toast.success("Extras added!");
    } catch { toast.error("Something went wrong."); } finally { setSaving(false); }
  };

  const deleteExtra = async (extra: ExtraRow) => {
    if (!extra.id) return;
    try {
      const res = await fetch(`/api/bookings/${bookingId}/extras/${extra.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { toast.error("Failed to remove extra."); return; }
      const next = extras.filter((e) => e.id !== extra.id);
      setExtras(next);
      notifyTotal(next, pendingExtras);
      onSuccess?.();
      toast.success("Extra removed.");
    } catch { toast.error("Something went wrong."); }
  };

  if (loading) return <div className="text-xs text-slate-400 py-2">Loading extras…</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Package className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold text-slate-700">Booking Extras</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addPending} className="h-7 text-xs">
          <Plus className="h-3 w-3 mr-1" /> Add Extra
        </Button>
      </div>

      {/* Existing saved extras */}
      {extras.length > 0 && (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="text-left py-2 px-3 text-slate-500 font-medium">Type</th>
                <th className="text-center py-2 px-3 text-slate-500 font-medium">Qty</th>
                <th className="text-right py-2 px-3 text-slate-500 font-medium">Price</th>
                <th className="text-right py-2 px-3 text-slate-500 font-medium">Total</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {extras.map((e, i) => (
                <tr key={e.id || i} className="border-t border-slate-100">
                  <td className="py-2 px-3 font-medium text-slate-700">{e.extra_type}</td>
                  <td className="py-2 px-3 text-center text-slate-600">{e.quantity}</td>
                  <td className="py-2 px-3 text-right text-slate-600">₱{Number(e.unit_price).toFixed(2)}</td>
                  <td className="py-2 px-3 text-right font-semibold text-[#07008A]">₱{Number(e.total_price).toFixed(2)}</td>
                  <td className="py-2 px-1">
                    <button type="button" onClick={() => deleteExtra(e)} className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pending extras (not yet saved) */}
      {pendingExtras.map((pe, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-end rounded-lg border border-dashed border-amber-300 bg-amber-50/30 p-2">
          <div className="col-span-4">
            <Label className="text-[10px]">Type</Label>
            <select
              value={pe.extra_type}
              onChange={(e) => updatePending(idx, "extra_type", e.target.value)}
              className="flex h-8 w-full rounded border border-input bg-background px-2 py-1 text-xs"
            >
              {EXTRA_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <Label className="text-[10px]">Qty</Label>
            <Input type="number" min={1} max={20} value={pe.quantity} onChange={(e) => updatePending(idx, "quantity", e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="col-span-3">
            <Label className="text-[10px]">Price (₱)</Label>
            <Input type="number" min={0} value={pe.unit_price} onChange={(e) => updatePending(idx, "unit_price", e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="col-span-2 text-right text-xs font-semibold text-[#07008A] pb-1">
            ₱{(pe.quantity * pe.unit_price).toFixed(2)}
          </div>
          <div className="col-span-1 pb-1">
            <button type="button" onClick={() => removePending(idx)} className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      ))}

      {/* Totals and save */}
      {(extras.length > 0 || pendingExtras.length > 0) && (
        <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
          <span className="text-xs font-semibold text-slate-600">
            Extras Total: <span className="text-[#07008A]">₱{(extrasTotal + pendingTotal).toFixed(2)}</span>
          </span>
          {pendingExtras.length > 0 && (
            <Button type="button" size="sm" onClick={savePending} disabled={saving} className="h-7 text-xs bg-[#07008A] hover:bg-[#05006a] text-white">
              {saving ? "Saving…" : "Save Extras"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
