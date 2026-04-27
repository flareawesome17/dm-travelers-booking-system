"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { getErrorMessage } from "@/lib/utils";
import { Plus, Trash2, Package, Pencil } from "lucide-react";
import {
  CUSTOM_BOOKING_EXTRA_TYPE,
  getBookingExtraDisplayName,
  isPerDayExtra,
  PREDEFINED_BOOKING_EXTRA_TYPES,
  type BookingExtraType,
  type PredefinedBookingExtraType,
} from "@/lib/bookingExtras";

type ExtraRow = {
  id?: string;
  extra_type: BookingExtraType;
  custom_label?: string | null;
  quantity: number;
  unit_price: number;
  days: number;
  total_price: number;
};

type PendingExtraRow = {
  extra_type: BookingExtraType;
  custom_label?: string;
  quantity: number;
  unit_price: number;
  days: number;
};

type BookingExtrasSectionProps = {
  bookingId: string;
  token: string;
  onTotalChange?: (total: number) => void;
  onSuccess?: () => void;
  /** Number of nights for this booking — used to auto-fill days for per-day extras */
  bookingNights?: number;
};

const EMPTY_DEFAULT_PRICES: Record<PredefinedBookingExtraType, number> = {
  "Extra Bed": 0,
  "Extra Pillow": 0,
  "Extra Blanket": 0,
  "Extra Towel - Bath": 0,
  "Extra Towel - Hand": 0,
  "Extra Person": 0,
};

const TYPE_TO_KEY: Record<PredefinedBookingExtraType, string> = {
  "Extra Bed": "extra_bed_price",
  "Extra Pillow": "extra_pillow_price",
  "Extra Blanket": "extra_blanket_price",
  "Extra Towel - Bath": "extra_towel_price",
  "Extra Towel - Hand": "extra_towel_hand_price",
  "Extra Person": "extra_person_price",
};

function createCustomChargeRow(): PendingExtraRow {
  return {
    extra_type: CUSTOM_BOOKING_EXTRA_TYPE,
    custom_label: "",
    quantity: 1,
    unit_price: 0,
    days: 1,
  };
}

function computeExtraLineTotal(extra: { quantity: number; unit_price: number; days: number }) {
  return extra.quantity * extra.unit_price * extra.days;
}

export function BookingExtrasSection({ bookingId, token, onTotalChange, onSuccess, bookingNights }: BookingExtrasSectionProps) {
  const [extras, setExtras] = useState<ExtraRow[]>([]);
  const [defaultPrices, setDefaultPrices] = useState<Record<PredefinedBookingExtraType, number>>(EMPTY_DEFAULT_PRICES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingExtras, setPendingExtras] = useState<PendingExtraRow[]>([]);
  const [patchingId, setPatchingId] = useState<string | null>(null);

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
        const prices = { ...EMPTY_DEFAULT_PRICES };
        if (settingsData && typeof settingsData === "object") {
          for (const type of PREDEFINED_BOOKING_EXTRA_TYPES) {
            const key = TYPE_TO_KEY[type];
            if (Array.isArray(settingsData)) {
              const row = settingsData.find((setting: { key: string }) => setting.key === key);
              prices[type] = row ? Number(row.value) || 0 : 0;
            } else if (settingsData[key]) {
              prices[type] = Number(settingsData[key]) || 0;
            }
          }
        }
        setDefaultPrices(prices);
      } catch {
        // Ignore load errors and let existing UI state render.
      }
      setLoading(false);
    };

    load();
  }, [bookingId, token]);

  const extrasTotal = extras.reduce((sum, extra) => sum + Number(extra.total_price || 0), 0);
  const pendingTotal = pendingExtras.reduce((sum, extra) => sum + computeExtraLineTotal(extra), 0);

  const notifyTotal = useCallback((saved: ExtraRow[], pending: PendingExtraRow[]) => {
    const total = saved.reduce((sum, extra) => sum + Number(extra.total_price || 0), 0)
      + pending.reduce((sum, extra) => sum + computeExtraLineTotal(extra), 0);
    onTotalChange?.(total);
  }, [onTotalChange]);

  const defaultDaysForType = (type: BookingExtraType) => {
    if (isPerDayExtra(type) && bookingNights && bookingNights > 0) return bookingNights;
    return 1;
  };

  const addPending = () => {
    const usedTypes = new Set(
      [
        ...extras.map((extra) => extra.extra_type),
        ...pendingExtras.map((extra) => extra.extra_type),
      ].filter((type): type is PredefinedBookingExtraType => type !== CUSTOM_BOOKING_EXTRA_TYPE),
    );

    const available = PREDEFINED_BOOKING_EXTRA_TYPES.find((type) => !usedTypes.has(type)) || PREDEFINED_BOOKING_EXTRA_TYPES[0];
    const next = [
      ...pendingExtras,
      { extra_type: available, quantity: 1, unit_price: defaultPrices[available] || 0, days: defaultDaysForType(available) },
    ];

    setPendingExtras(next);
    notifyTotal(extras, next);
  };

  const addCustomCharge = () => {
    const next = [...pendingExtras, createCustomChargeRow()];
    setPendingExtras(next);
    notifyTotal(extras, next);
  };

  const removePending = (idx: number) => {
    const next = pendingExtras.filter((_, index) => index !== idx);
    setPendingExtras(next);
    notifyTotal(extras, next);
  };

  const updatePending = (idx: number, field: keyof PendingExtraRow, value: string | number) => {
    const next = [...pendingExtras];
    const current = next[idx];

    if (field === "extra_type") {
      const type = value as BookingExtraType;
      next[idx] = type === CUSTOM_BOOKING_EXTRA_TYPE
        ? {
            ...current,
            extra_type: type,
            custom_label: current.custom_label || "",
            days: 1,
          }
        : {
            extra_type: type,
            quantity: current.quantity,
            unit_price: defaultPrices[type as PredefinedBookingExtraType] || current.unit_price,
            custom_label: "",
            days: defaultDaysForType(type),
          };
    } else if (field === "custom_label") {
      next[idx] = { ...current, custom_label: String(value) };
    } else if (field === "quantity") {
      next[idx] = { ...current, quantity: Math.max(1, Number(value) || 1) };
    } else if (field === "unit_price") {
      next[idx] = { ...current, unit_price: Math.max(0, Number(value) || 0) };
    } else if (field === "days") {
      next[idx] = { ...current, days: Math.max(1, Number(value) || 1) };
    }

    setPendingExtras(next);
    notifyTotal(extras, next);
  };

  const savePending = async () => {
    if (!pendingExtras.length) return;

    for (const extra of pendingExtras) {
      if (extra.extra_type === CUSTOM_BOOKING_EXTRA_TYPE && !String(extra.custom_label || "").trim()) {
        toast.error("Custom charge label is required.");
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/extras`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          extras: pendingExtras.map((extra) => ({
            extra_type: extra.extra_type,
            custom_label: extra.extra_type === CUSTOM_BOOKING_EXTRA_TYPE ? extra.custom_label?.trim() || null : null,
            quantity: extra.quantity,
            unit_price: extra.unit_price,
            days: extra.days,
          })),
        }),
      });

      const data = await res.json().catch(() => []);
      if (!res.ok) {
        toast.error(getErrorMessage(data) || "Failed to save extras.");
        return;
      }

      const newExtras = Array.isArray(data) ? data : [];
      const combined = [...extras, ...newExtras];
      setExtras(combined);
      setPendingExtras([]);
      notifyTotal(combined, []);
      onSuccess?.();
      toast.success("Extras added!");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const patchExtra = async (extra: ExtraRow, updates: { days?: number; quantity?: number }) => {
    if (!extra.id) return;

    setPatchingId(extra.id);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/extras/${extra.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(getErrorMessage(data) || "Failed to update extra.");
        return;
      }

      const next = extras.map((item) => (item.id === extra.id ? { ...item, ...data } : item));
      setExtras(next);
      notifyTotal(next, pendingExtras);
      onSuccess?.();
      toast.success("Extra updated.");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setPatchingId(null);
    }
  };

  const deleteExtra = async (extra: ExtraRow) => {
    if (!extra.id) return;

    try {
      const res = await fetch(`/api/bookings/${bookingId}/extras/${extra.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        toast.error("Failed to remove extra.");
        return;
      }

      const next = extras.filter((item) => item.id !== extra.id);
      setExtras(next);
      notifyTotal(next, pendingExtras);
      onSuccess?.();
      toast.success("Extra removed.");
    } catch {
      toast.error("Something went wrong.");
    }
  };

  if (loading) return <div className="py-2 text-xs text-slate-400">Loading extras...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Package className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold text-slate-700">Booking Extras</span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addPending} className="h-7 text-xs">
            <Plus className="mr-1 h-3 w-3" /> Add Extra
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addCustomCharge} className="h-7 text-xs">
            <Plus className="mr-1 h-3 w-3" /> Custom Charge
          </Button>
        </div>
      </div>

      {extras.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-3 py-2 text-left font-medium text-slate-500">Type</th>
                <th className="px-3 py-2 text-center font-medium text-slate-500">Qty</th>
                <th className="px-3 py-2 text-right font-medium text-slate-500">Price</th>
                <th className="px-2 py-2 text-center font-medium text-slate-500">Days</th>
                <th className="px-3 py-2 text-right font-medium text-slate-500">Total</th>
                <th className="w-14" />
              </tr>
            </thead>
            <tbody>
              {extras.map((extra, index) => {
                const perDay = isPerDayExtra(extra.extra_type);
                return (
                  <tr key={extra.id || index} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-700">{getBookingExtraDisplayName(extra)}</div>
                      {extra.extra_type === CUSTOM_BOOKING_EXTRA_TYPE ? (
                        <div className="text-[10px] uppercase tracking-wide text-slate-400">Custom Charge</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-center text-slate-600">{extra.quantity}</td>
                    <td className="px-3 py-2 text-right text-slate-600">₱{Number(extra.unit_price).toFixed(2)}</td>
                    <td className="px-2 py-2 text-center">
                      {perDay ? (
                        <div className="flex items-center justify-center gap-1">
                          <Input
                            type="number"
                            min={1}
                            max={365}
                            className="h-6 w-12 text-center text-xs px-1"
                            value={extra.days ?? 1}
                            disabled={patchingId === extra.id}
                            onChange={(e) => {
                              const newDays = Math.max(1, Number(e.target.value) || 1);
                              // Optimistic update
                              const updated = extras.map((item) =>
                                item.id === extra.id
                                  ? { ...item, days: newDays, total_price: item.quantity * Number(item.unit_price) * newDays }
                                  : item
                              );
                              setExtras(updated);
                              notifyTotal(updated, pendingExtras);
                            }}
                            onBlur={(e) => {
                              const newDays = Math.max(1, Number(e.target.value) || 1);
                              if (newDays !== (extra.days ?? 1)) {
                                patchExtra(extra, { days: newDays });
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-[#07008A]">₱{Number(extra.total_price).toFixed(2)}</td>
                    <td className="px-1 py-2">
                      <button
                        type="button"
                        onClick={() => deleteExtra(extra)}
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pendingExtras.map((extra, idx) => {
        const perDay = isPerDayExtra(extra.extra_type);
        return (
          <div
            key={`${extra.extra_type}-${idx}`}
            className="grid grid-cols-12 items-end gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/30 p-2"
          >
            <div className={extra.extra_type === CUSTOM_BOOKING_EXTRA_TYPE ? "col-span-3" : perDay ? "col-span-3" : "col-span-4"}>
              <Label className="text-[10px]">Type</Label>
              <select
                value={extra.extra_type}
                onChange={(event) => updatePending(idx, "extra_type", event.target.value)}
                className="flex h-8 w-full rounded border border-input bg-background px-2 py-1 text-xs"
              >
                {PREDEFINED_BOOKING_EXTRA_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
                <option value={CUSTOM_BOOKING_EXTRA_TYPE}>{CUSTOM_BOOKING_EXTRA_TYPE}</option>
              </select>
            </div>

            {extra.extra_type === CUSTOM_BOOKING_EXTRA_TYPE ? (
              <div className="col-span-3">
                <Label className="text-[10px]">Label</Label>
                <Input
                  value={extra.custom_label || ""}
                  onChange={(event) => updatePending(idx, "custom_label", event.target.value)}
                  placeholder="e.g. Broken glass"
                  className="h-8 text-xs"
                />
              </div>
            ) : null}

            <div className="col-span-2">
              <Label className="text-[10px]">Qty</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={extra.quantity}
                onChange={(event) => updatePending(idx, "quantity", event.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className={perDay ? "col-span-2" : "col-span-3"}>
              <Label className="text-[10px]">Price (₱)</Label>
              <Input
                type="number"
                min={0}
                value={extra.unit_price}
                onChange={(event) => updatePending(idx, "unit_price", event.target.value)}
                className="h-8 text-xs"
              />
            </div>
            {perDay && (
              <div className="col-span-2">
                <Label className="text-[10px]">Nights</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={extra.days}
                  onChange={(event) => updatePending(idx, "days", event.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            )}
            <div className="col-span-1 pb-1 text-right text-xs font-semibold text-[#07008A]">
              ₱{computeExtraLineTotal(extra).toFixed(2)}
            </div>
            <div className="col-span-12 flex justify-end sm:col-span-1 sm:block sm:pb-1">
              <button
                type="button"
                onClick={() => removePending(idx)}
                className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        );
      })}

      {(extras.length > 0 || pendingExtras.length > 0) && (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-xs font-semibold text-slate-600">
            Extras Total: <span className="text-[#07008A]">₱{(extrasTotal + pendingTotal).toFixed(2)}</span>
          </span>
          {pendingExtras.length > 0 && (
            <Button
              type="button"
              size="sm"
              onClick={savePending}
              disabled={saving}
              className="h-7 bg-[#07008A] text-xs text-white hover:bg-[#05006a]"
            >
              {saving ? "Saving..." : "Save Extras"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
