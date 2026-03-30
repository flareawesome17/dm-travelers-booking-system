"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { getErrorMessage } from "@/lib/utils";
import { ArrowRight, Banknote, Building2, ReceiptText, ShieldCheck } from "lucide-react";

type CollectPaymentModalProps = {
  open: boolean;
  onClose: () => void;
  receivable: {
    id: string;
    amount_due: number;
    amount_paid: number;
    status: string;
    type: string;
    organization_name?: string | null;
    reference_number?: string | null;
    guest_name?: string | null;
  };
  token: string;
  onSuccess: () => void;
};

export function CollectPaymentModal({ open, onClose, receivable, token, onSuccess }: CollectPaymentModalProps) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"Cash" | "GCash" | "Card" | "Bank Transfer">("Cash");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const outstanding = Math.max(0, Number(receivable.amount_due) || 0);
  const collected = Math.max(0, Number(receivable.amount_paid) || 0);
  const paymentAmount = Number(amount) || 0;

  const quickAmounts = useMemo(() => {
    const base = [outstanding, Math.round(outstanding * 0.5), Math.round(outstanding * 0.25)];
    return Array.from(new Set(base.filter((value) => value > 0))).sort((a, b) => b - a);
  }, [outstanding]);

  const handleSubmit = async () => {
    if (paymentAmount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (paymentAmount > outstanding) {
      toast.error("Amount exceeds the outstanding balance.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/receivables/${receivable.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: paymentAmount, method, notes: notes.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(getErrorMessage(data) || "Failed to record payment.");
        return;
      }
      toast.success("Collection recorded.");
      onSuccess();
      onClose();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl overflow-hidden border-0 bg-transparent p-0 shadow-none">
        <div className="rounded-[28px] border border-[#07008A]/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(248,248,255,0.94))] shadow-[0_30px_90px_rgba(7,0,138,0.12)] backdrop-blur">
          <div className="relative overflow-hidden rounded-[28px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(7,0,138,0.12),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.12),transparent_30%)]" />
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(to right, rgba(7,0,138,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(7,0,138,0.12) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />

            <div className="relative p-6 sm:p-7">
              <DialogHeader className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#07008A]/10 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#07008A]">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Quick Collect
                    </div>
                    <DialogTitle className="text-2xl font-bold tracking-tight text-slate-900">
                      Record receivable payment
                    </DialogTitle>
                    <p className="max-w-xl text-sm text-slate-500">
                      Capture a collection, sync the booking balance, and keep the receivables ledger current in one step.
                    </p>
                  </div>
                  <div className="hidden h-14 w-14 items-center justify-center rounded-2xl border border-white/60 bg-white/80 text-[#07008A] shadow-sm sm:flex">
                    <Banknote className="h-6 w-6" />
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_0.95fr]">
                <div className="rounded-[24px] border border-slate-200/80 bg-white/92 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Collection target</p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">
                        {receivable.organization_name || receivable.guest_name || "Receivable account"}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {receivable.reference_number ? (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-600">
                            {receivable.reference_number}
                          </span>
                        ) : null}
                        <span className="inline-flex items-center rounded-full border border-[#07008A]/10 bg-[#07008A]/5 px-2.5 py-1 font-medium text-[#07008A]">
                          {receivable.type}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                          {receivable.status}
                        </span>
                      </div>
                    </div>
                    <div className="hidden rounded-2xl bg-slate-50 p-3 text-slate-400 lg:block">
                      <Building2 className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Outstanding</p>
                      <p className="mt-2 text-lg font-bold text-slate-900">PHP {outstanding.toFixed(0)}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-600">Collected</p>
                      <p className="mt-2 text-lg font-bold text-emerald-700">PHP {collected.toFixed(0)}</p>
                    </div>
                    <div className="rounded-2xl border border-[#07008A]/10 bg-[#07008A]/[0.05] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#07008A]/65">After payment</p>
                      <p className="mt-2 text-lg font-bold text-[#07008A]">PHP {Math.max(0, outstanding - paymentAmount).toFixed(0)}</p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="collect-amount" className="text-sm font-semibold text-slate-700">
                        Payment amount
                      </Label>
                      <span className="text-xs text-slate-400">Precision sync with booking balance</span>
                    </div>
                    <div className="relative">
                      <Input
                        id="collect-amount"
                        type="number"
                        min={1}
                        max={outstanding}
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder={`Up to PHP ${outstanding.toFixed(0)}`}
                        className="h-14 rounded-2xl border-slate-200 bg-white pr-28 text-lg font-semibold shadow-sm focus-visible:ring-[#07008A]/30"
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        PHP
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {quickAmounts.map((value) => (
                        <Button
                          key={value}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-full border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:border-[#07008A]/30 hover:bg-[#07008A]/5 hover:text-[#07008A]"
                          onClick={() => setAmount(String(value))}
                        >
                          PHP {value.toFixed(0)}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#07008A]/12 bg-[#07008A] p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">
                    <ReceiptText className="h-3.5 w-3.5" />
                    Settlement details
                  </div>

                  <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">Payment method</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["Cash", "GCash", "Card", "Bank Transfer"] as const).map((entry) => (
                          <button
                            key={entry}
                            type="button"
                            onClick={() => setMethod(entry)}
                            className={`rounded-2xl border px-3 py-3 text-left text-xs font-semibold transition-all ${
                              method === entry
                                ? "border-white/70 bg-white text-[#07008A] shadow-sm"
                                : "border-white/10 bg-white/5 text-white/78 hover:bg-white/10"
                            }`}
                          >
                            {entry}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="collect-notes" className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">
                        Notes
                      </Label>
                      <Input
                        id="collect-notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Reference number, collector note, or remittance detail"
                        className="h-12 rounded-2xl border-white/10 bg-white/8 text-white placeholder:text-white/35"
                      />
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">Integrity check</p>
                      <div className="mt-3 flex items-center justify-between text-sm text-white/80">
                        <span>Receivable ledger</span>
                        <ArrowRight className="h-4 w-4 text-white/35" />
                        <span>Booking balance</span>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-white/65">
                        This payment updates the receivable and the linked booking together so the finance view and booking view stay aligned.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-6 flex-col gap-3 border-t border-slate-200/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-400">
                  Audit-safe collection entry with synchronized booking balance.
                </p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || paymentAmount <= 0}
                    className="rounded-full bg-emerald-600 px-5 text-white hover:bg-emerald-700"
                  >
                    {submitting ? "Recording..." : `Collect PHP ${paymentAmount.toFixed(0)}`}
                  </Button>
                </div>
              </DialogFooter>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
