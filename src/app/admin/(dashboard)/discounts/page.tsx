"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Percent, RefreshCw, Search, Ticket, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import DiscountList from "@/components/admin/discounts/DiscountList";
import DiscountForm from "@/components/admin/discounts/DiscountForm";
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";
import { usePermissions } from "@/context/PermissionsContext";

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<any>(null);
  const [deleteConfirmDiscount, setDeleteConfirmDiscount] = useState<any>(null);
  
  const { hasPermission } = usePermissions();
  const canRead = hasPermission("discounts.read");
  const canCreate = hasPermission("discounts.create");
  const canUpdate = hasPermission("discounts.update");
  const canDelete = hasPermission("discounts.delete");

  const fetchDiscounts = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const res = await fetch("/api/discounts");
      if (!res.ok) throw new Error("Failed to load discounts");
      const data = await res.json();
      setDiscounts(data);
    } catch (error) {
      toast.error("Could not load discounts");
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  useEffect(() => {
    if (canRead) {
      fetchDiscounts();
    }
  }, [canRead, fetchDiscounts]);

  const handleDelete = async (id: string) => {
    if (!canDelete) {
      toast.error("You do not have permission to delete discounts");
      return;
    }

    try {
      const res = await fetch(`/api/discounts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setDiscounts(discounts.filter((d) => d.id !== id));
      toast.success("Discount deleted");
    } catch (error) {
      toast.error("Failed to delete discount");
    } finally {
      setDeleteConfirmDiscount(null);
    }
  };

  if (!canRead) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="p-4 rounded-full bg-red-50 text-red-600">
          <Ticket className="h-10 w-10 opacity-20" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Access Denied</h2>
        <p className="text-slate-500 text-sm max-w-xs text-center">
          You do not have the required permissions to view global discounts. Please contact your administrator.
        </p>
      </div>
    );
  }

  const filteredDiscounts = discounts.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-[#07008A]/[0.08] text-[#07008A]">
              <Ticket className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Global Discounts</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium ml-9">Manage promotional offers for rooms and restaurant</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchDiscounts}
            disabled={loading}
            className="h-10 w-10 border-slate-200 hover:bg-slate-100 rounded-xl"
          >
            <RefreshCw className={cn("h-4 w-4 text-slate-600", loading && "animate-spin")} />
          </Button>
          {canCreate && (
            <Button
              onClick={() => {
                setEditingDiscount(null);
                setIsModalOpen(true);
              }}
              className="bg-[#07008A] hover:bg-[#07008A]/90 h-10 px-5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg shadow-[#07008A]/20"
            >
              <Plus className="h-4 w-4" />
              New Discount
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Active Offers", value: discounts.filter(d => d.is_active).length, icon: Sparkles, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Room Target", value: discounts.filter(d => d.apply_to_rooms).length, icon: Percent, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Total Created", value: discounts.length, icon: Ticket, color: "text-slate-600", bg: "bg-slate-50" }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4">
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", stat.bg)}>
              <stat.icon className={cn("h-5 w-5", stat.color)} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
              <p className="text-xl font-black text-slate-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-[#07008A]" />
        <Input
          placeholder="Search discounts by name or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-11 h-12 bg-white border-slate-200 rounded-2xl ring-offset-background transition-all focus-visible:ring-2 focus-visible:ring-[#07008A]/30 focus-visible:border-[#07008A]"
        />
      </div>

      {/* Content Section */}
      {loading && discounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="relative">
            <RefreshCw className="h-10 w-10 text-[#07008A]/20 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Percent className="h-4 w-4 text-[#07008A]/40" />
            </div>
          </div>
          <p className="text-slate-400 font-bold text-sm">Synchronizing promotion data...</p>
        </div>
      ) : (
        <div className="page-enter">
          <DiscountList
            discounts={filteredDiscounts}
            canUpdate={canUpdate}
            canDelete={canDelete}
            onEdit={(d) => {
              if (canUpdate) {
                setEditingDiscount(d);
                setIsModalOpen(true);
              } else {
                toast.error("You do not have permission to update discounts");
              }
            }}
            onDelete={(id) => {
              const selectedDiscount = discounts.find((discount) => discount.id === id) || { id };
              setDeleteConfirmDiscount(selectedDiscount);
            }}
          />
        </div>
      )}

      {/* Modal for Create/Update */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>

        <DialogContent className="max-w-xl p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
          <div className="bg-[#07008A] px-6 py-8 text-white relative">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Ticket className="h-24 w-24 rotate-12" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight text-white">
                {editingDiscount ? "Update Discount Strategy" : "Create New Discount"}
              </DialogTitle>
              <p className="text-white/60 text-xs font-semibold uppercase tracking-widest pt-1">
                {editingDiscount ? `EDT: ${editingDiscount.id.slice(0, 8)}` : "Configure promotional values"}
              </p>
            </DialogHeader>
          </div>
          <div className="px-6 py-8 bg-white">
            <DiscountForm
              initialData={editingDiscount}
              onSuccess={() => {
                setIsModalOpen(false);
                fetchDiscounts();
              }}
              onCancel={() => setIsModalOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={!!deleteConfirmDiscount}
        onOpenChange={(open) => { if (!open) setDeleteConfirmDiscount(null); }}
        title="Delete this discount?"
        description={(
          <>
            This will permanently remove{" "}
            <span className="font-semibold text-slate-800">
              {deleteConfirmDiscount?.name || "this discount"}
            </span>
            . This action cannot be undone.
          </>
        )}
        confirmLabel="Delete Discount"
        onConfirm={() => {
          if (!deleteConfirmDiscount?.id) return;
          return handleDelete(deleteConfirmDiscount.id);
        }}
      />
    </div>
  );
}
