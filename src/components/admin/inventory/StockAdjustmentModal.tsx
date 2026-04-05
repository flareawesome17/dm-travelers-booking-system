"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PackageOpen, ArrowUpRight, ArrowDownRight, ClipboardEdit, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";

const adjustSchema = z.object({
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.number().positive("Quantity must be greater than 0"),
  notes: z.string().max(300, "Notes too long").optional(),
});

type AdjustSchema = z.infer<typeof adjustSchema>;

export function StockAdjustmentModal({
  item,
  onClose,
  onSuccess,
}: {
  item: any;
  onClose: () => void;
  onSuccess: (updatedItem: any) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"IN" | "OUT" | "ADJUSTMENT">("IN");
  const [useRecipeUnit, setUseRecipeUnit] = useState(false);

  const hasRecipeUnit = !!item?.recipe_unit && !!item?.yield_per_unit;
  const currentStock = Number(item?.current_stock || 0);
  const isLow = currentStock > 0 && currentStock <= Number(item?.min_stock_alert || 0);
  const isOut = currentStock <= 0;

  const form = useForm<AdjustSchema>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { type: "IN", quantity: 1, notes: "" },
  });

  const watchedQty = form.watch("quantity");

  // Preview what the resulting stock will be
  const preview = useMemo(() => {
    const qty = Number(watchedQty) || 0;
    if (qty <= 0) return null;

    let effectiveQty = qty;
    if (useRecipeUnit && hasRecipeUnit) {
      effectiveQty = qty / Number(item.yield_per_unit);
    }

    let newStock = currentStock;
    if (type === "IN") newStock = currentStock + effectiveQty;
    else if (type === "OUT") newStock = currentStock - effectiveQty;
    else newStock = effectiveQty;

    return { effectiveQty, newStock };
  }, [watchedQty, type, useRecipeUnit, hasRecipeUnit, currentStock, item?.yield_per_unit]);

  const onSubmit = async (values: AdjustSchema) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("admin_token");

      let finalQty = values.quantity;
      let noteSuffix = "";

      if (useRecipeUnit && hasRecipeUnit) {
        finalQty = values.quantity / Number(item.yield_per_unit);
        noteSuffix = ` (Adjusted via Recipe Unit: ${values.quantity} ${item.recipe_unit})`;
      }

      const res = await fetch(`/api/inventory/${item.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...values,
          quantity: finalQty,
          type,
          notes: values.notes ? `${values.notes}${noteSuffix}` : noteSuffix || undefined
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to adjust stock");
      }

      const { data } = await res.json();
      toast.success(`Stock for ${item.name} adjusted successfully.`);
      onSuccess(data);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const typeConfig = {
    IN: { label: "Stock In", desc: "Add new stock to inventory", color: "emerald", icon: ArrowUpRight },
    OUT: { label: "Stock Out", desc: "Remove stock (spoilage, usage)", color: "amber", icon: ArrowDownRight },
    ADJUSTMENT: { label: "Set Exact", desc: "Override with a physical count", color: "slate", icon: ClipboardEdit },
  };

  const activeConfig = typeConfig[type];

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="admin-modal-responsive [--admin-modal-width:32rem] max-h-[90vh] overflow-y-auto modal-scrollbar p-0">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#07008A] to-[#0a00b8] px-6 py-5 rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
              <PackageOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">{item?.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${isOut ? "bg-red-500/25 text-red-200" : isLow ? "bg-amber-500/25 text-amber-200" : "bg-emerald-500/25 text-emerald-200"}`}>
                  {isOut ? <AlertCircle className="h-3 w-3" /> : isLow ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                  {currentStock.toFixed(currentStock % 1 === 0 ? 0 : 2)} {item?.unit}
                </span>
                {hasRecipeUnit && (
                  <span className="text-[10px] text-white/50">
                    ({(currentStock * Number(item.yield_per_unit)).toFixed(0)} {item.recipe_unit})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="px-6 py-5 space-y-5">
          {/* Type Selector */}
          <div className="space-y-2">
            <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Adjustment Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["IN", "OUT", "ADJUSTMENT"] as const).map((t) => {
                const cfg = typeConfig[t];
                const Icon = cfg.icon;
                const isActive = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setType(t); form.setValue("type", t); }}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-center transition-all ${
                      isActive
                        ? `border-${cfg.color}-500 bg-${cfg.color}-50 shadow-sm`
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                    style={isActive ? {
                      borderColor: t === "IN" ? "#10b981" : t === "OUT" ? "#f59e0b" : "#64748b",
                      backgroundColor: t === "IN" ? "#ecfdf5" : t === "OUT" ? "#fffbeb" : "#f8fafc",
                    } : undefined}
                  >
                    <Icon className="h-5 w-5" style={{ color: isActive ? (t === "IN" ? "#059669" : t === "OUT" ? "#d97706" : "#475569") : "#94a3b8" }} />
                    <span className={`text-xs font-semibold ${isActive ? "text-slate-900" : "text-slate-500"}`}>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 text-center">{activeConfig.desc}</p>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium text-slate-700">
                {type === "ADJUSTMENT" ? "New Total" : "Quantity"}
              </Label>
              {hasRecipeUnit && (
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setUseRecipeUnit(false)}
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${!useRecipeUnit ? "bg-white text-[#07008A] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    {item.unit}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseRecipeUnit(true)}
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${useRecipeUnit ? "bg-white text-[#07008A] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    {item.recipe_unit}
                  </button>
                </div>
              )}
            </div>
            <div className="relative">
              <Input
                type="number"
                step="0.0001"
                min="0.0001"
                className="h-12 text-lg font-semibold pl-4 pr-16 tabular-nums"
                {...form.register("quantity", { valueAsNumber: true })}
                placeholder="0"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">
                {useRecipeUnit ? item.recipe_unit : item.unit}
              </span>
            </div>
            {form.formState.errors.quantity && <p className="text-red-500 text-xs">{form.formState.errors.quantity.message}</p>}

            {/* Conversion hint */}
            {useRecipeUnit && hasRecipeUnit && preview && (
              <p className="text-[11px] text-[#07008A] bg-[#07008A]/5 px-3 py-1.5 rounded-md">
                Converting: {watchedQty} {item.recipe_unit} → <strong>{preview.effectiveQty.toFixed(4)} {item.unit}</strong>
              </p>
            )}
          </div>

          {/* Preview Card */}
          {preview && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Stock Preview</p>
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <p className="text-xs text-slate-500">Before</p>
                  <p className="text-lg font-bold text-slate-700 tabular-nums">{currentStock.toFixed(currentStock % 1 === 0 ? 0 : 2)}</p>
                  <p className="text-[10px] text-slate-400">{item.unit}</p>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${type === "IN" ? "bg-emerald-100 text-emerald-700" : type === "OUT" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"}`}>
                    {type === "IN" ? `+${preview.effectiveQty.toFixed(preview.effectiveQty % 1 === 0 ? 0 : 4)}` :
                     type === "OUT" ? `-${preview.effectiveQty.toFixed(preview.effectiveQty % 1 === 0 ? 0 : 4)}` :
                     "= SET"}
                  </span>
                  <div className="h-[1px] w-8 bg-slate-300" />
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500">After</p>
                  <p className={`text-lg font-bold tabular-nums ${preview.newStock < 0 ? "text-red-600" : preview.newStock <= Number(item?.min_stock_alert || 0) ? "text-amber-600" : "text-emerald-600"}`}>
                    {preview.newStock.toFixed(preview.newStock % 1 === 0 ? 0 : 2)}
                  </p>
                  <p className="text-[10px] text-slate-400">{item.unit}</p>
                </div>
              </div>
              {preview.newStock < 0 && (
                <p className="text-[10px] text-red-500 mt-2 flex items-center gap-1 justify-center">
                  <AlertCircle className="h-3 w-3" /> Warning: Stock will go negative
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Notes / Reason</Label>
            <Input
              placeholder="e.g. Weekly delivery, Spoilage, Manual recount..."
              className="h-10"
              {...form.register("notes")}
            />
            {form.formState.errors.notes && <p className="text-red-500 text-xs">{form.formState.errors.notes.message}</p>}
          </div>

          {/* Footer */}
          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button
              type="submit"
              disabled={loading}
              className={`min-w-[160px] ${type === "IN" ? "bg-emerald-600 hover:bg-emerald-700" : type === "OUT" ? "bg-amber-600 hover:bg-amber-700" : "bg-[#07008A] hover:bg-[#05006a]"}`}
            >
              {loading ? "Saving..." : type === "IN" ? "Confirm Stock In" : type === "OUT" ? "Confirm Stock Out" : "Set Stock Level"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
