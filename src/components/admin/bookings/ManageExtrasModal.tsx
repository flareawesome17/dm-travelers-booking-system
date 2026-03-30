"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";
import { BookingExtrasSection } from "./BookingExtrasSection";

type ManageExtrasModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  booking: {
    id: string;
    reference_number?: string;
  };
  token: string;
};

export function ManageExtrasModal({ open, onClose, onSuccess, booking, token }: ManageExtrasModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Package className="h-4 w-4" />
            </div>
            Manage Extras for {booking.reference_number || "Booking"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-2">
          <BookingExtrasSection bookingId={booking.id} token={token} onSuccess={onSuccess} />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
