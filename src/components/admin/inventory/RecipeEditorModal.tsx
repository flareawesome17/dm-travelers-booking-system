"use client";

import { useEffect, useState } from "react";
import { UtensilsCrossed, Plus, Trash2, Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";
import {
  AdminModal,
  AdminModalBody,
  AdminModalHeader,
  AdminModalTitle,
} from "@/components/admin/ui";

export function RecipeEditorModal({
  menuItem,
  onClose,
}: {
  menuItem: any;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [recipeIngredients, setRecipeIngredients] = useState<any[]>([]);
  const [ingredientToRemove, setIngredientToRemove] = useState<any | null>(null);
  
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const selectedItemData = inventoryItems.find((i) => i.id === selectedItemId);
  const displayUnit = selectedItemData?.recipe_unit || selectedItemData?.unit || "";

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem("admin_token");
      if (!token) return;

      try {
        const [invRes, recRes] = await Promise.all([
          fetch("/api/inventory?category=ingredient", { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`/api/inventory/recipes?menu_item_id=${menuItem.id}`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        if (invRes.ok) setInventoryItems(await invRes.json());
        if (recRes.ok) setRecipeIngredients(await recRes.json());
      } catch (err) {
        toast.error("Failed to load recipe data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [menuItem.id]);

  const handleAddIngredient = async () => {
    if (!selectedItemId) return toast.error("Select an ingredient");
    if (!quantity || Number(quantity) <= 0) return toast.error("Invalid quantity");

    setSubmitting(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/inventory/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          menu_item_id: menuItem.id,
          inventory_item_id: selectedItemId,
          quantity_required: Number(quantity)
        })
      });

      if (!res.ok) throw new Error(await res.text());
      const newIng = await res.json();
      
      const exists = recipeIngredients.find(r => r.id === newIng.id);
      if (exists) {
        setRecipeIngredients(prev => prev.map(r => r.id === newIng.id ? newIng : r));
      } else {
        setRecipeIngredients(prev => [...prev, newIng]);
      }
      
      setSelectedItemId("");
      setQuantity("1");
      toast.success("Ingredient added to recipe");
    } catch (err) {
      toast.error("Failed to add ingredient");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`/api/inventory/recipes?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Delete failed");
      setRecipeIngredients(prev => prev.filter(r => r.id !== id));
      toast.success("Ingredient removed");
    } catch (err) {
      toast.error("Failed to remove ingredient");
    } finally {
      setIngredientToRemove(null);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <AdminModal size="lg">
        <AdminModalHeader>
          <AdminModalTitle className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-[#07008A]" />
            Items & Recipes for {menuItem?.name}
          </AdminModalTitle>
        </AdminModalHeader>

        <AdminModalBody>
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
        ) : (
          <div className="space-y-6">
            <div className="flex gap-2 items-end bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-semibold text-slate-600 uppercase">Ingredient</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 text-sm px-2"
                >
                  <option value="">Select ingredient...</option>
                  {inventoryItems.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit}) {i.recipe_unit ? `— Uses: ${i.recipe_unit}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-32 space-y-1">
                <label className="text-xs font-semibold text-slate-600 uppercase">
                  Qty req. {displayUnit ? `(${displayUnit})` : ""}
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 text-sm px-2"
                />
              </div>
              <Button type="button" onClick={handleAddIngredient} disabled={submitting} className="h-9 bg-[#07008A] hover:bg-[#05006a]">
                <Plus className="h-4 w-4 mr-1"/> Add
              </Button>
            </div>

            <div className="modal-scrollbar border rounded-md divide-y overflow-hidden max-h-60 overflow-y-auto">
              {recipeIngredients.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">No ingredients configured for this item.</div>
              ) : (
                recipeIngredients.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-white hover:bg-slate-50 transition-colors">
                    <div>
                      <div className="font-medium text-sm text-slate-900">{r.inventory_items?.name}</div>
                      <div className="text-xs text-slate-500">
                        Uses {r.quantity_required} {r.inventory_items?.recipe_unit || r.inventory_items?.unit} per order
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setIngredientToRemove(r)} className="h-8 w-8 text-red-500 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        </AdminModalBody>

        <ConfirmActionDialog
          open={!!ingredientToRemove}
          onOpenChange={(open) => { if (!open) setIngredientToRemove(null); }}
          title="Remove this ingredient?"
          description={(
            <>
              This will remove{" "}
              <span className="font-semibold text-slate-800">
                {ingredientToRemove?.inventory_items?.name || "this ingredient"}
              </span>
              {" "}from the recipe for {menuItem?.name}.
            </>
          )}
          confirmLabel="Remove Ingredient"
          onConfirm={() => {
            if (!ingredientToRemove?.id) return;
            return handleRemove(ingredientToRemove.id);
          }}
        />
      </AdminModal>
    </Dialog>
  );
}
