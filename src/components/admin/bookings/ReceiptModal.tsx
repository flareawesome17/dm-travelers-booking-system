import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

type BookingRow = {
  id?: string; reference_number?: string; status?: string;
  check_in_date?: string; check_out_date?: string;
  total_amount?: number; deposit_paid?: number; balance_due?: number;
  restaurant_charges_total?: number;
  rate_plan_kind?: string; special_requests?: string | null;
  early_checkin_fee_applied?: number; late_checkout_fee_applied?: number; is_lgu_booking?: boolean;
  guests?: { full_name?: string; email?: string; phone_number?: string };
  rooms?: { room_number?: string; room_type?: string; } | null;
  restaurant_orders?: { id: string; total_amount: number; status: string; }[];
};

type ReceiptModalProps = {
  booking: BookingRow | null;
  onClose: () => void;
};

export function ReceiptModal({ booking, onClose }: ReceiptModalProps) {
  if (!booking) return null;

  const roomTotal = Number(booking.total_amount ?? 0);
  const deposit = Number(booking.deposit_paid ?? 0);
  const earlyFee = Number(booking.early_checkin_fee_applied ?? 0);
  const lateFee = Number(booking.late_checkout_fee_applied ?? 0);
  const restaurantTotal =
    booking.restaurant_charges_total != null
      ? Number(booking.restaurant_charges_total || 0)
      : booking.restaurant_orders?.reduce(
          (sum, order) => (order.status === "Charged to Room" ? sum + Number(order.total_amount || 0) : sum),
          0,
        ) || 0;

  const grandTotal = roomTotal + restaurantTotal;
  const balance = Number(booking.balance_due ?? grandTotal);
  const totalPaid = Math.max(0, grandTotal - balance);
  const baseRate = Math.max(0, roomTotal - earlyFee - lateFee);

  return (
    <Dialog open={!!booking} onOpenChange={(open) => !open && onClose()}>
      {/* 
        The overlay and standard dialog close buttons are hidden during print via CSS classes.
        We make the content itself cover the page block when printing.
       */}
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible print:max-w-none print:shadow-none print:border-none print:top-0 print:translate-y-0 print:p-0">
        <DialogHeader className="print:hidden">
          <DialogTitle>View Receipt</DialogTitle>
          <DialogDescription>
            You can print this receipt or save it as a PDF.
          </DialogDescription>
        </DialogHeader>

        {/* Printable Area - Hidden when not printing, but styled so it looks good on screen too */}
        <div className="p-8 bg-white text-slate-900 mx-auto w-full max-w-[800px] border border-slate-200 rounded-lg print:border-none print:m-0 print:p-4">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-300 pb-6 mb-6">
            <div className="flex items-center gap-4">
              <img src="/logo.png" alt="D&M Travelers Inn" className="h-16 w-auto object-contain print:h-12" />
              <div>
                <h1 className="text-2xl font-bold text-[#07008A] tracking-tight print:text-black">D&M Travelers Inn</h1>
                <p className="text-sm text-slate-500 mt-1">Looc Proper, Plaridel, Misamis Occidental</p>
                <p className="text-sm text-slate-500">+63 951 868 3018</p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <h2 className="text-xl font-bold text-slate-800 uppercase tracking-widest print:text-black">Official Receipt</h2>
              <div className="mt-2 text-sm">
                <p><span className="text-slate-500 font-medium">Date:</span> {new Date().toLocaleDateString()}</p>
                <p><span className="text-slate-500 font-medium">Receipt No:</span> {booking.reference_number}</p>
              </div>
            </div>
          </div>

          {/* Guest and Stay Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Billed To</h3>
              <p className="font-semibold text-lg">{booking.guests?.full_name ?? "Guest Name"}</p>
              <p className="text-sm text-slate-600">{booking.guests?.email ?? "No Email Provided"}</p>
              {booking.guests?.phone_number && <p className="text-sm text-slate-600">{booking.guests.phone_number}</p>}
              {booking.is_lgu_booking && <p className="text-xs font-bold text-[#07008A] mt-1 print:text-black">LGU Booking</p>}
            </div>
            <div className="bg-slate-50 p-4 rounded-xl print:bg-transparent print:border print:border-black print:p-2">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Stay Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-slate-500">Room</span>
                  <span className="font-medium text-slate-900">{booking.rooms?.room_number ?? "—"} <span className="text-slate-500 font-normal">({booking.rooms?.room_type ?? "—"})</span></span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-slate-500">Rate Plan</span>
                  <span className="font-medium text-slate-900 uppercase">{booking.rate_plan_kind ?? "—"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-slate-500">Check In</span>
                  <span className="font-medium text-slate-900">{booking.check_in_date ?? "—"}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-slate-500">Check Out</span>
                  <span className="font-medium text-slate-900">{booking.check_out_date ?? "—"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Billing Table */}
          <div className="mb-8">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-800 text-slate-800 print:border-black">
                  <th className="py-4 font-bold text-xs uppercase tracking-wider">Description</th>
                  <th className="py-4 font-bold text-xs uppercase tracking-wider text-center w-24">Qty/Unit</th>
                  <th className="py-4 font-bold text-xs uppercase tracking-wider text-right w-32">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-4 pr-4">
                    <div className="font-semibold text-slate-800">Room Accommodation</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{booking.rooms?.room_type || "Standard Room"} · {booking.rooms?.room_number ? `Room ${booking.rooms.room_number}` : "No room"}</div>
                  </td>
                  <td className="py-4 text-center">1</td>
                  <td className="py-4 text-right font-medium text-slate-900">₱{baseRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                {earlyFee > 0 && (
                  <tr>
                    <td className="py-4 pr-4">
                      <div className="font-semibold text-slate-800">Early Check-in Fee</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Applied for check-in before standard time</div>
                    </td>
                    <td className="py-4 text-center">1</td>
                    <td className="py-4 text-right font-medium text-slate-900">₱{earlyFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                )}
                {lateFee > 0 && (
                  <tr>
                    <td className="py-4 pr-4">
                      <div className="font-semibold text-slate-800">Late Check-out Fee</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Applied for check-out after standard time</div>
                    </td>
                    <td className="py-4 text-center">1</td>
                    <td className="py-4 text-right font-medium text-slate-900">₱{lateFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                )}
                {restaurantTotal > 0 && (
                  <tr>
                    <td className="py-4 pr-4">
                      <div className="font-semibold text-slate-800">Restaurant Orders</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Charged to room from hotel restaurant</div>
                    </td>
                    <td className="py-4 text-center">—</td>
                    <td className="py-4 text-right font-medium text-slate-900">₱{restaurantTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end pb-8">
            <div className="w-full sm:w-2/3 md:w-1/2">
              <div className="flex justify-between mb-2 text-sm">
                <span className="font-bold text-slate-600">Subtotal</span>
                <span className="text-slate-900 font-medium">₱{grandTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-4 text-sm pb-4 border-b border-slate-300">
                <span className="font-bold text-slate-600">Deposit Paid</span>
                <span className="text-emerald-600 font-medium print:text-black">- ₱{deposit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-4 text-sm">
                <span className="font-bold text-slate-600">Total Paid</span>
                <span className="text-emerald-700 font-bold print:text-black">₱{totalPaid.toFixed(2)}</span>
              </div>
              <div className="flex flex-row justify-between items-center bg-slate-100 p-4 rounded-lg print:bg-transparent print:border-2 print:border-black print:p-2 ml-auto w-full gap-4">
                <span className="font-bold text-slate-800 text-sm sm:text-base uppercase tracking-wider shrink-0">Balance Due</span>
                <span className="text-xl sm:text-2xl font-bold text-[#07008A] print:text-black truncate">₱{balance.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
            <p className="font-medium text-slate-700 mb-1 print:text-black">Thank you for choosing Traveler's Booking System.</p>
            <p>If you have any questions regarding this receipt, please contact the front desk.</p>
          </div>

        </div>

        {/* Action Buttons - Hidden during print */}
        <div className="flex justify-end gap-3 px-6 pb-6 print:hidden">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={() => window.print()} className="bg-[#07008A] hover:bg-[#05006a] text-white">
              <Printer className="mr-2 h-4 w-4" />
              Download / Print
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
