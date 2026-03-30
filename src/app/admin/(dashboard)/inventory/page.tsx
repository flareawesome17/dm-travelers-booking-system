"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PackageSearch, Plus, Activity, ArrowRightLeft, UtensilsCrossed, Settings2, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StockAdjustmentModal } from "@/components/admin/inventory/StockAdjustmentModal";
import { RecipeEditorModal } from "@/components/admin/inventory/RecipeEditorModal";
import { toast } from "@/components/ui/sonner";
import { EmptyState } from "@/components/ui/empty-state";

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [adjustItem, setAdjustItem] = useState<any | null>(null);
  const [recipeItem, setRecipeItem] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("pcs");
  const [newItemMinAlert, setNewItemMinAlert] = useState("5");

  const fetchItems = async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.replace("/admin/login"); return; }
    setLoading(true);
    try {
      const [invRes, movRes, menuRes] = await Promise.all([
        fetch("/api/inventory", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/inventory/movements?limit=100", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/menu", { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (invRes.ok) setItems(await invRes.json());
      if (movRes.ok) setMovements(await movRes.json());
      if (menuRes.ok) setMenuItems(await menuRes.json());
    } catch {
      toast.error("Failed to load inventory data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const resetCreateForm = () => {
    setNewItemName("");
    setNewItemUnit("pcs");
    setNewItemMinAlert("5");
  };

  const handleCreateNew = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = newItemName.trim();
    const unit = newItemUnit.trim() || "pcs";
    const minAlert = Number(newItemMinAlert);
    if (!name) {
      toast.error("Item name is required.");
      return;
    }
    if (!Number.isFinite(minAlert) || minAlert < 0) {
      toast.error("Minimum alert must be 0 or greater.");
      return;
    }

    setCreateSubmitting(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, unit, current_stock: 0, min_stock_alert: minAlert })
      });
      if (!res.ok) throw new Error("Failed to create item");
      toast.success(`${name} created successfully.`);
      setCreateOpen(false);
      resetCreateForm();
      await fetchItems();
    } catch {
      toast.error("Failed to create item");
    } finally {
      setCreateSubmitting(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Inventory</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage restaurant stock, items, recipes, and movement history</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-[#07008A] hover:bg-[#05006a] rounded-full">
          <Plus className="mr-2 h-4 w-4" /> Add Item
        </Button>
      </motion.div>

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent className="admin-modal-responsive [--admin-modal-width:36rem] max-h-[90vh] overflow-y-auto modal-scrollbar p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-[#07008A]">Add inventory item</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreateNew}>
            <div className="space-y-2">
              <Label htmlFor="inventory-item-name">Item name</Label>
              <Input
                id="inventory-item-name"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Cooking Oil"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="inventory-item-unit">Unit</Label>
                <Input
                  id="inventory-item-unit"
                  value={newItemUnit}
                  onChange={(e) => setNewItemUnit(e.target.value)}
                  placeholder="pcs, kg, ml"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inventory-item-min-alert">Minimum alert</Label>
                <Input
                  id="inventory-item-min-alert"
                  type="number"
                  min={0}
                  step="1"
                  value={newItemMinAlert}
                  onChange={(e) => setNewItemMinAlert(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#07008A] hover:bg-[#05006a]" disabled={createSubmitting}>
                {createSubmitting ? "Saving..." : "Save item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="stock" className="space-y-6">
        <TabsList className="bg-white border rounded-lg p-1 space-x-1 h-12 w-full max-w-md justify-start">
          <TabsTrigger value="stock" className="flex items-center gap-2 data-[state=active]:bg-[#07008A]/5 data-[state=active]:text-[#07008A] h-9">
            <PackageSearch className="h-4 w-4" /> Stock List
          </TabsTrigger>
          <TabsTrigger value="recipes" className="flex items-center gap-2 data-[state=active]:bg-[#07008A]/5 data-[state=active]:text-[#07008A] h-9">
            <UtensilsCrossed className="h-4 w-4" /> Items & Recipes
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2 data-[state=active]:bg-[#07008A]/5 data-[state=active]:text-[#07008A] h-9">
            <History className="h-4 w-4" /> Movements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <Card className="border border-slate-200/80 shadow-xs bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/40 px-5 py-4">
              <CardTitle className="text-lg font-semibold text-[#07008A] flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#07008A]/10 text-[#07008A]"><Activity className="h-5 w-5" /></div>
                <span>Current Inventory Levels</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : items.length === 0 ? (
                <EmptyState icon={PackageSearch} title="No inventory items" description="Add your first item to start tracking." />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/30">
                      {["Item Name", "Current Stock", "Min Alert", "Category", "Actions"].map((h) => (
                        <th key={h} className={`py-4 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wide ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => {
                      const isLow = Number(i.current_stock) <= Number(i.min_stock_alert);
                      return (
                        <tr key={i.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="py-4 px-6 font-medium text-slate-900">{i.name}</td>
                          <td className="py-4 px-6">
                            <Badge variant={isLow ? "destructive" : "secondary"} className={`font-mono text-sm px-2 ${isLow ? 'bg-red-100 text-red-700' : 'bg-green-50 text-green-700'}`}>
                              {i.current_stock} {i.unit}
                            </Badge>
                          </td>
                          <td className="py-4 px-6 text-slate-500">{i.min_stock_alert} {i.unit}</td>
                          <td className="py-4 px-6 text-slate-500 capitalize">{i.category}</td>
                          <td className="py-4 px-6 text-right">
                            <Button variant="outline" size="sm" onClick={() => setAdjustItem(i)}>
                              <ArrowRightLeft className="mr-2 h-3 w-3" /> Adjust
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recipes">
          <Card className="border border-slate-200/80 shadow-xs bg-white overflow-hidden">
             <CardHeader className="border-b border-slate-100 bg-slate-50/40 px-5 py-4">
              <CardTitle className="text-lg font-semibold text-[#07008A]">Restaurant Items & Recipes</CardTitle>
              <CardDescription>Link menu items to ingredients or ready-made stock items so inventory is deducted correctly on every sale.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/30">
                    <th className="py-4 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-left">Menu Item</th>
                    <th className="py-4 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-left">Category</th>
                    <th className="py-4 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {menuItems.map((m) => (
                    <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-4 px-6 font-medium text-slate-900">{m.name}</td>
                      <td className="py-4 px-6 text-slate-500">{m.category}</td>
                      <td className="py-4 px-6 text-right">
                        <Button variant="outline" size="sm" onClick={() => setRecipeItem(m)}>
                          <Settings2 className="mr-2 h-3 w-3" /> Edit Items & Recipes
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="border border-slate-200/80 shadow-xs bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/40">
              <CardTitle className="text-lg font-semibold text-[#07008A]">Movement History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/30">
                    {["Date", "Item", "Type", "Change", "Total Stock", "Notes"].map((h) => (
                      <th key={h} className="py-4 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b border-slate-50">
                      <td className="py-3 px-6 text-slate-500 text-xs">{new Date(m.created_at).toLocaleString()}</td>
                      <td className="py-3 px-6 font-medium text-slate-800">{m.inventory_items?.name}</td>
                      <td className="py-3 px-6">
                        <Badge variant="outline" className={m.type === "IN" ? "text-emerald-700 bg-emerald-50" : m.type === "OUT" ? "text-amber-700 bg-amber-50" : "text-slate-700 bg-slate-50"}>
                          {m.type}
                        </Badge>
                      </td>
                      <td className={`py-3 px-6 font-mono font-medium ${m.type === "IN" ? "text-emerald-600" : m.type === "OUT" ? "text-amber-600" : ""}`}>
                        {m.type === "IN" ? "+" : m.type === "OUT" ? "-" : ""}{m.quantity} {m.inventory_items?.unit}
                      </td>
                      <td className="py-3 px-6 font-mono text-slate-500 text-xs">
                        {m.previous_stock} → <strong className="text-slate-900">{m.new_stock}</strong>
                      </td>
                      <td className="py-3 px-6 text-slate-500 text-xs">{m.notes || m.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {adjustItem && (
        <StockAdjustmentModal 
          item={adjustItem} 
          onClose={() => setAdjustItem(null)} 
          onSuccess={() => fetchItems()} 
        />
      )}

      {recipeItem && (
        <RecipeEditorModal
          menuItem={recipeItem}
          onClose={() => setRecipeItem(null)}
        />
      )}
    </>
  );
}
