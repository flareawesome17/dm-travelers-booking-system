"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { LockKeyhole, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";

const closeSchema = z.object({
  close_notes: z.string().max(500, "Notes are too long").optional(),
});
type CloseSchema = z.infer<typeof closeSchema>;

export function CloseShiftModal({
  shiftLog,
  onClose,
  onSuccess,
}: {
  shiftLog: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const form = useForm<CloseSchema>({
    resolver: zodResolver(closeSchema),
    defaultValues: { close_notes: "" },
  });

  const onSubmit = async (values: CloseSchema) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/shifts/close", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to close shift");
      }

      toast.success("Shift closed successfully and ledger locked.");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md border-red-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <LockKeyhole className="h-5 w-5" />
            Close Shift Ledger
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to close the ledger for this shift? This action will freeze the current totals and prevent new transactions from being logged under this shift.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-red-50 p-3 rounded-md border border-red-100 flex items-start gap-3 mt-2">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-none" />
          <div className="text-sm text-red-800">
            <strong>Expected Cash Handover:</strong> ₱{(shiftLog?.net_total ?? 0).toFixed(2)}<br />
            Ensure that physical cash matches the ledger before closing.
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Closing Notes (Optional)</label>
            <Textarea 
              placeholder="e.g. Cash drawer was short by 50 pesos, or shift ran smoothly..." 
              {...form.register("close_notes")} 
              className="resize-none h-20"
            />
            {form.formState.errors.close_notes && <p className="text-red-500 text-xs">{form.formState.errors.close_notes.message}</p>}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={loading}>
              {loading ? "Closing..." : "Close Shift"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
