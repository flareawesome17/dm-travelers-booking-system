"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { PlusCircle } from "lucide-react";
import { getErrorMessage } from "@/lib/utils";

type AddExtraChargeModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  booking: {
    id: string;
    reference_number?: string;
  };
  token: string;
};

export function AddExtraChargeModal({ open, onClose, onSuccess, booking, token }: AddExtraChargeModalProps) {
  const [chargeName, setChargeName] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chargeName.trim()) {
      toast.error("Please enter a charge name");
      return;
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        extras: [
          {
            extra_type: chargeName.trim(),
            quantity: 1,
            unit_price: numAmount,
          }
        ]
      };

      const res = await fetch(`/api/bookings/${booking.id}/extras`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(getErrorMessage(data) || "Failed to add extra charge");
      }

      toast.success("Extra charge added successfully");
      setChargeName("");
      setAmount("");
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-700">
                <PlusCircle className="h-4 w-4" />
              </div>
              Add Extra Charge
            </DialogTitle>
            <DialogDescription>
              Add a custom extra charge (e.g. Missing Linens, Damage Fee) to {booking.reference_number || "this booking"}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="chargeName">Charge Name</Label>
              <Input
                id="chargeName"
                placeholder="e.g. Missing Linen"
                value={chargeName}
                onChange={(e) => setChargeName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount (PHP)</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700 text-white">
              {loading ? "Adding..." : "Add Charge"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
