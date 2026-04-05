"use client";

import { Edit2, MoreVertical, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DiscountListProps {
  discounts: any[];
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (discount: any) => void;
  onDelete: (id: string) => void;
}

export default function DiscountList({ 
  discounts, 
  canUpdate, 
  canDelete, 
  onEdit, 
  onDelete 
}: DiscountListProps) {
  if (discounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-slate-200">
        <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-4">
          <Trash2 className="h-6 w-6 text-slate-300" />
        </div>
        <p className="text-slate-500 font-medium">No discounts found</p>
        <p className="text-slate-400 text-sm">Create your first discount to get started</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto overflow-y-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200">
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Discount</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Value</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Validity</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Applied To</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {discounts.map((discount) => {
              const isExpired = new Date(discount.end_date) < new Date();
              const isFuture = new Date(discount.start_date) > new Date();
              const isActive = discount.is_active && !isExpired && !isFuture;

              return (
                <tr key={discount.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-bold text-slate-800">{discount.name}</div>
                      {discount.description && (
                        <div className="text-xs text-slate-500 max-w-[200px] truncate">
                          {discount.description}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-[#07008A]">
                        {discount.type === "percent" ? `${discount.value}%` : `₱${Number(discount.value).toLocaleString()}`}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#07008A]/[0.05] text-[#07008A] font-medium border border-[#07008A]/10">
                        {discount.type === "percent" ? "Off" : "Reduction"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs space-y-0.5">
                      <div className="text-slate-600">
                        From <span className="font-semibold">{format(new Date(discount.start_date), "MMM dd, yyyy")}</span>
                      </div>
                      <div className="text-slate-600">
                        To <span className="font-semibold">{format(new Date(discount.end_date), "MMM dd, yyyy")}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {discount.apply_to_rooms && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          Rooms
                        </span>
                      )}
                      {discount.apply_to_restaurant && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-100">
                          Restaurant
                        </span>
                      )}
                      {!discount.apply_to_rooms && !discount.apply_to_restaurant && (
                        <span className="text-[10px] text-slate-400">None</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={cn(
                        "h-2 w-2 rounded-full mr-2",
                        isActive ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-slate-300"
                      )} />
                      <span className={cn(
                        "text-xs font-bold",
                        isActive ? "text-green-600" : "text-slate-500"
                      )}>
                        {isActive ? "ACTIVE" : isExpired ? "EXPIRED" : isFuture ? "SCHEDULED" : "PAUSED"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {(canUpdate || canDelete) ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-200/50 rounded-lg">
                            <MoreVertical className="h-4 w-4 text-slate-500" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px] p-1.5 rounded-xl border-slate-200 shadow-xl">
                          {canUpdate && (
                            <DropdownMenuItem
                              onClick={() => onEdit(discount)}
                              className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer focus:bg-slate-100"
                            >
                              <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                              Update Details
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem
                              onClick={() => onDelete(discount.id)}
                              className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer focus:bg-red-50 text-red-600 focus:text-red-700 mt-0.5"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete Forever
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">No access</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
