"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Pencil, Save, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import {
  AdminModal,
  AdminModalBody,
  AdminModalFooter,
  AdminModalHeader,
  AdminModalTitle,
} from "@/components/admin/ui";

const editSchema = z.object({
  name: z.string().min(1, "Name is required"),
  unit: z.string().min(1, "Unit is required"),
  min_stock_alert: z.number().min(0, "Min alert must be 0 or more"),
  recipe_unit: z.string().optional(),
  yield_per_unit: z.number().positive("Yield must be greater than 0").optional(),
});

type EditSchema = z.infer<typeof editSchema>;

export function EditItemModal({
  item,
  onClose,
  onSuccess,
}: {
  item: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const form = useForm<EditSchema>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: item?.name || "",
      unit: item?.unit || "pcs",
      min_stock_alert: Number(item?.min_stock_alert || 0),
      recipe_unit: item?.recipe_unit || "",
      yield_per_unit: Number(item?.yield_per_unit || 1),
    },
  });

  const onSubmit = async (values: EditSchema) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`/api/inventory/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update item");
      }

      toast.success(`${values.name} updated successfully.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const recipeUnit = form.watch("recipe_unit");

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <AdminModal size="md">
        <AdminModalHeader>
          <AdminModalTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Edit inventory item
          </AdminModalTitle>
        </AdminModalHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <AdminModalBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-item-name">Item name</Label>
            <Input id="edit-item-name" {...form.register("name")} placeholder="Cooking Oil" required />
            {form.formState.errors.name && <p className="text-red-500 text-xs">{form.formState.errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-item-unit">Unit</Label>
              <Input id="edit-item-unit" {...form.register("unit")} placeholder="pcs, kg, ml" required />
              {form.formState.errors.unit && <p className="text-red-500 text-xs">{form.formState.errors.unit.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-item-min-alert">Minimum alert</Label>
              <Input id="edit-item-min-alert" type="number" step="1" {...form.register("min_stock_alert", { valueAsNumber: true })} required />
              {form.formState.errors.min_stock_alert && <p className="text-red-500 text-xs">{form.formState.errors.min_stock_alert.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-item-recipe-unit">Recipe Unit (Optional)</Label>
              <Input id="edit-item-recipe-unit" {...form.register("recipe_unit")} placeholder="e.g., ml, g, cup" />
              <p className="text-[10px] text-slate-500">Unit used in recipes</p>
            </div>
            {recipeUnit && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                <Label htmlFor="edit-item-yield">Yield per 1 {form.watch("unit") || "Unit"}</Label>
                <Input id="edit-item-yield" type="number" step="0.0001" {...form.register("yield_per_unit", { valueAsNumber: true })} />
                <p className="text-[10px] text-[#07008A] font-medium">
                  1 {form.watch("unit") || "Unit"} = {form.watch("yield_per_unit") || 1} {recipeUnit}
                </p>
              </div>
            )}
          </div>

          </AdminModalBody>
          <AdminModalFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
            <Button type="submit" className="bg-[#07008A] hover:bg-[#05006a]" disabled={loading}>
              <Save className="mr-2 h-4 w-4" /> {loading ? "Updating..." : "Update item"}
            </Button>
          </AdminModalFooter>
        </form>
      </AdminModal>
    </Dialog>
  );
}
