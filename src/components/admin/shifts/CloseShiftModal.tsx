"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { LockKeyhole, AlertCircle, ShieldAlert, Clock } from "lucide-react";
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
  shiftDef,
  onClose,
  onSuccess,
}: {
  shiftLog: any;
  shiftDef?: { name?: string; start_time?: string; end_time?: string } | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const form = useForm<CloseSchema>({
    resolver: zodResolver(closeSchema),
    defaultValues: { close_notes: "" },
  });

  const shiftName = shiftDef?.name || "Current";
  const shiftStart = shiftDef?.start_time?.substring(0, 5) || "--:--";
  const shiftEnd = shiftDef?.end_time?.substring(0, 5) || "--:--";
  const shiftDate = shiftLog?.date || "—";

  const onSubmit = async (values: CloseSchema) => {
    if (!confirmed) {
      toast.error("Please confirm that you understand this action by checking the confirmation box.");
      return;
    }
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
      <DialogContent className="sm:max-w-lg border-red-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <LockKeyhole className="h-5 w-5" />
            Close Shift Ledger
          </DialogTitle>
          <DialogDescription>
            You are about to permanently close and lock the ledger for the current shift. No more transactions can be added after this.
          </DialogDescription>
        </DialogHeader>

        {/* ── Current Shift Highlight ──────────────────────────── */}
        <div className="bg-[#07008A]/[0.04] border-2 border-[#07008A]/30 p-4 rounded-xl mt-2">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-[#07008A]" />
            <span className="text-xs font-bold text-[#07008A] uppercase tracking-wider">You are closing this shift</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-bold text-[#07008A]">{shiftName} Shift</div>
              <div className="text-sm text-slate-600 font-medium mt-0.5">{shiftStart} – {shiftEnd}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 font-medium">Date</div>
              <div className="text-sm font-bold text-slate-800">{shiftDate}</div>
            </div>
          </div>
        </div>

        {/* ── Warning Banner ───────────────────────────────────── */}
        <div className="bg-amber-50 p-3 rounded-md border border-amber-200 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 flex-none animate-pulse" />
          <div className="text-sm text-amber-800 space-y-1">
            <strong className="block">⚠️ This action is irreversible</strong>
            <span>
              Once closed, <strong>no payments or transactions</strong> made after this point will appear on this shift&apos;s ledger.
              Make sure all current bookings have their payments recorded before proceeding.
            </span>
          </div>
        </div>

        {/* ── Cash Handover Summary ────────────────────────────── */}
        <div className="bg-red-50 p-3 rounded-md border border-red-100 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-none" />
          <div className="text-sm text-red-800">
            <strong>Expected Cash Handover:</strong> ₱{(shiftLog?.net_total ?? 0).toFixed(2)}<br />
            Ensure that physical cash matches the ledger before closing.
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Closing Notes (Optional)</label>
            <Textarea 
              placeholder="e.g. Cash drawer was short by 50 pesos, or shift ran smoothly..." 
              {...form.register("close_notes")} 
              className="resize-none h-20"
            />
            {form.formState.errors.close_notes && <p className="text-red-500 text-xs">{form.formState.errors.close_notes.message}</p>}
          </div>

          {/* ── Confirmation Checkbox ──────────────────────────── */}
          <label className="flex items-start gap-3 cursor-pointer bg-slate-50 border border-slate-200 rounded-lg p-3 hover:bg-slate-100 transition-colors select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 mt-0.5 flex-none accent-red-600"
            />
            <span className="text-sm text-slate-700 leading-snug">
              I confirm that I want to close the <strong className="text-[#07008A]">{shiftName} Shift</strong> ledger for <strong>{shiftDate}</strong>. 
              I understand that no further transactions will be recorded under this shift.
            </span>
          </label>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={loading || !confirmed}>
              {loading ? "Closing..." : `Close ${shiftName} Shift Ledger`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
