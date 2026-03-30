"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PackageOpen, ArrowUpRight, ArrowDownRight, MinusSquare } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  const form = useForm<AdjustSchema>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { type: "IN", quantity: 1, notes: "" },
  });

  const onSubmit = async (values: AdjustSchema) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`/api/inventory/${item.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...values, type }),
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

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="admin-modal-responsive [--admin-modal-width:40rem] max-h-[90vh] overflow-y-auto modal-scrollbar p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageOpen className="h-5 w-5 text-[#07008A]" />
            Adjust Stock for {item?.name}
          </DialogTitle>
          <DialogDescription>
            Current stock: <strong className="text-slate-900">{item?.current_stock} {item?.unit}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-4">
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant={type === "IN" ? "default" : "outline"}
              className={type === "IN" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              onClick={() => { setType("IN"); form.setValue("type", "IN"); }}
            >
              <ArrowUpRight className="mr-1 h-4 w-4" /> Stock In
            </Button>
            <Button
              type="button"
              variant={type === "OUT" ? "default" : "outline"}
              className={type === "OUT" ? "bg-amber-600 hover:bg-amber-700" : ""}
              onClick={() => { setType("OUT"); form.setValue("type", "OUT"); }}
            >
              <ArrowDownRight className="mr-1 h-4 w-4" /> Stock Out
            </Button>
            <Button
              type="button"
              variant={type === "ADJUSTMENT" ? "default" : "outline"}
              className={type === "ADJUSTMENT" ? "bg-slate-700 hover:bg-slate-800" : ""}
              onClick={() => { setType("ADJUSTMENT"); form.setValue("type", "ADJUSTMENT"); }}
            >
              <MinusSquare className="mr-1 h-4 w-4" /> Set Exact
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Quantity ({type === "ADJUSTMENT" ? "New Total" : "Amount"})</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              {...form.register("quantity", { valueAsNumber: true })}
            />
            {form.formState.errors.quantity && <p className="text-red-500 text-xs">{form.formState.errors.quantity.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Notes / Reason</Label>
            <Input placeholder="e.g. Weekly delivery, Spoilage, Manual recount..." {...form.register("notes")} />
            {form.formState.errors.notes && <p className="text-red-500 text-xs">{form.formState.errors.notes.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" className="bg-[#07008A] hover:bg-[#05006a]" disabled={loading}>
              {loading ? "Saving..." : "Confirm Adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
