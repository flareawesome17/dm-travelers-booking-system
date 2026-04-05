"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  PackageSearch, Plus, Activity, ArrowRightLeft, UtensilsCrossed,
  Settings2, History, Search, AlertTriangle, TrendingDown, TrendingUp,
  Package, ChevronLeft, ChevronRight, Filter, Pencil, Trash2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StockAdjustmentModal } from "@/components/admin/inventory/StockAdjustmentModal";
import { EditItemModal } from "@/components/admin/inventory/EditItemModal";
import { RecipeEditorModal } from "@/components/admin/inventory/RecipeEditorModal";
import { toast } from "@/components/ui/sonner";
import { EmptyState } from "@/components/ui/empty-state";

const ITEMS_PER_PAGE = 10;
const MOVEMENTS_PER_PAGE = 15;

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [adjustItem, setAdjustItem] = useState<any | null>(null);
  const [recipeItem, setRecipeItem] = useState<any | null>(null);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("pcs");
  const [newItemMinAlert, setNewItemMinAlert] = useState("5");
  const [newItemRecipeUnit, setNewItemRecipeUnit] = useState("");
  const [newItemYield, setNewItemYield] = useState("1");

  // Search, Filter & Pagination
  const [stockSearch, setStockSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "ok" | "out">("all");
  const [stockPage, setStockPage] = useState(1);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [movementSearch, setMovementSearch] = useState("");
  const [movementFilter, setMovementFilter] = useState<"all" | "IN" | "OUT" | "ADJUSTMENT">("all");
  const [movementPage, setMovementPage] = useState(1);

  const fetchItems = async () => {
    const token = localStorage.getItem("admin_token");
    setLoading(true);
    try {
      const [invRes, movRes, menuRes] = await Promise.all([
        fetch("/api/inventory", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/inventory/movements?limit=200", { headers: { Authorization: `Bearer ${token}` } }),
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

  useEffect(() => { fetchItems(); }, []);

  const resetCreateForm = () => {
    setNewItemName(""); setNewItemUnit("pcs"); setNewItemMinAlert("5");
    setNewItemRecipeUnit(""); setNewItemYield("1");
  };

  const handleCreateNew = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = newItemName.trim();
    const unit = newItemUnit.trim() || "pcs";
    const minAlert = Number(newItemMinAlert);
    const recipe_unit = newItemRecipeUnit.trim() || undefined;
    const yield_per_unit = newItemYield.trim() ? Number(newItemYield) : undefined;
    if (!name) { toast.error("Item name is required."); return; }
    if (!Number.isFinite(minAlert) || minAlert < 0) { toast.error("Minimum alert must be 0 or greater."); return; }
    setCreateSubmitting(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, unit, recipe_unit, yield_per_unit, current_stock: 0, min_stock_alert: minAlert })
      });
      if (!res.ok) throw new Error("Failed to create item");
      toast.success(`${name} created successfully.`);
      setCreateOpen(false); resetCreateForm(); await fetchItems();
    } catch { toast.error("Failed to create item"); } finally { setCreateSubmitting(false); }
  };

  // Analytics
  const analytics = useMemo(() => {
    const totalItems = items.length;
    const outOfStock = items.filter(i => Number(i.current_stock) <= 0).length;
    const lowStock = items.filter(i => Number(i.current_stock) > 0 && Number(i.current_stock) <= Number(i.min_stock_alert)).length;
    const healthyStock = totalItems - outOfStock - lowStock;
    const todayMovements = movements.filter(m => {
      const d = new Date(m.created_at);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;
    return { totalItems, outOfStock, lowStock, healthyStock, todayMovements };
  }, [items, movements]);

  // Filtered Stock
  const filteredItems = useMemo(() => {
    let filtered = items;
    if (stockSearch) {
      const s = stockSearch.toLowerCase();
      filtered = filtered.filter(i => i.name?.toLowerCase().includes(s) || i.unit?.toLowerCase().includes(s));
    }
    if (stockFilter === "low") filtered = filtered.filter(i => Number(i.current_stock) > 0 && Number(i.current_stock) <= Number(i.min_stock_alert));
    else if (stockFilter === "out") filtered = filtered.filter(i => Number(i.current_stock) <= 0);
    else if (stockFilter === "ok") filtered = filtered.filter(i => Number(i.current_stock) > Number(i.min_stock_alert));
    return filtered;
  }, [items, stockSearch, stockFilter]);

  const stockTotalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const paginatedStock = filteredItems.slice((stockPage - 1) * ITEMS_PER_PAGE, stockPage * ITEMS_PER_PAGE);

  // Filtered Recipes
  const filteredRecipes = useMemo(() => {
    if (!recipeSearch) return menuItems;
    const s = recipeSearch.toLowerCase();
    return menuItems.filter(m => m.name?.toLowerCase().includes(s) || m.category?.toLowerCase().includes(s));
  }, [menuItems, recipeSearch]);

  // Filtered Movements
  const filteredMovements = useMemo(() => {
    let filtered = movements;
    if (movementSearch) {
      const s = movementSearch.toLowerCase();
      filtered = filtered.filter(m => m.inventory_items?.name?.toLowerCase().includes(s) || m.notes?.toLowerCase().includes(s));
    }
    if (movementFilter !== "all") filtered = filtered.filter(m => m.type === movementFilter);
    return filtered;
  }, [movements, movementSearch, movementFilter]);

  const movementTotalPages = Math.max(1, Math.ceil(filteredMovements.length / MOVEMENTS_PER_PAGE));
  const paginatedMovements = filteredMovements.slice((movementPage - 1) * MOVEMENTS_PER_PAGE, movementPage * MOVEMENTS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => { setStockPage(1); }, [stockSearch, stockFilter]);
  useEffect(() => { setMovementPage(1); }, [movementSearch, movementFilter]);

  const handleDeleteItem = async (id: string) => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`/api/inventory/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to delete item");
      toast.success("Item deleted successfully");
      await fetchItems();
    } catch {
      toast.error("Failed to delete item");
    } finally {
      setDeleteConfirmItem(null);
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

      {/* Analytics Cards */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border border-slate-200/80 bg-white shadow-xs overflow-hidden">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#07008A]/10 text-[#07008A]">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Items</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums leading-tight">{loading ? "—" : analytics.totalItems}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-red-200/80 bg-red-50/40 shadow-xs overflow-hidden">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-red-400 uppercase tracking-wider">Out of Stock</p>
              <p className="text-2xl font-bold text-red-700 tabular-nums leading-tight">{loading ? "—" : analytics.outOfStock}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-amber-200/80 bg-amber-50/40 shadow-xs overflow-hidden">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">Low Stock</p>
              <p className="text-2xl font-bold text-amber-700 tabular-nums leading-tight">{loading ? "—" : analytics.lowStock}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-emerald-200/80 bg-emerald-50/40 shadow-xs overflow-hidden">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider">Today&apos;s Movements</p>
              <p className="text-2xl font-bold text-emerald-700 tabular-nums leading-tight">{loading ? "—" : analytics.todayMovements}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Add Item Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent className="admin-modal-responsive [--admin-modal-width:36rem] max-h-[90vh] overflow-y-auto modal-scrollbar p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-[#07008A]">Add inventory item</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreateNew}>
            <div className="space-y-2">
              <Label htmlFor="inventory-item-name">Item name</Label>
              <Input id="inventory-item-name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Cooking Oil" required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="inventory-item-unit">Unit</Label>
                <Input id="inventory-item-unit" value={newItemUnit} onChange={(e) => setNewItemUnit(e.target.value)} placeholder="pcs, kg, ml" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inventory-item-min-alert">Minimum alert</Label>
                <Input id="inventory-item-min-alert" type="number" min={0} step="1" value={newItemMinAlert} onChange={(e) => setNewItemMinAlert(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div className="space-y-2">
                <Label htmlFor="inventory-item-recipe-unit">Recipe Unit (Optional)</Label>
                <div className="flex bg-slate-50 border border-slate-200 rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-[#07008A] transition-all">
                  <Input id="inventory-item-recipe-unit" value={newItemRecipeUnit} onChange={(e) => setNewItemRecipeUnit(e.target.value)} placeholder="e.g., ml, g, cup" className="border-0 focus-visible:ring-0 rounded-none bg-transparent" />
                </div>
                <p className="text-[10px] text-slate-500">Unit used in recipes</p>
              </div>
              {newItemRecipeUnit && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                  <Label htmlFor="inventory-item-yield">Yield per 1 {newItemUnit || "Unit"}</Label>
                  <Input id="inventory-item-yield" type="number" min={0.0001} step="0.0001" value={newItemYield} onChange={(e) => setNewItemYield(e.target.value)} />
                  <p className="text-[10px] text-[#07008A] font-medium">1 {newItemUnit || "Unit"} = {newItemYield || 1} {newItemRecipeUnit}</p>
                </div>
              )}
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>Cancel</Button>
              <Button type="submit" className="bg-[#07008A] hover:bg-[#05006a]" disabled={createSubmitting}>{createSubmitting ? "Saving..." : "Save item"}</Button>
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

        {/* ─── STOCK LIST TAB ─── */}
        <TabsContent value="stock">
          <Card className="border border-slate-200/80 shadow-xs bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/40 px-5 py-4">
              <CardTitle className="text-lg font-semibold text-[#07008A] flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#07008A]/10 text-[#07008A]"><Activity className="h-5 w-5" /></div>
                <span>Current Inventory Levels</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/20 gap-3">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input type="text" placeholder="Search items..." className="pl-9 h-9 text-sm bg-white" value={stockSearch} onChange={(e) => setStockSearch(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
                  <select className="h-9 rounded-md border border-input bg-white px-3 text-xs text-slate-700 w-full sm:w-[150px]" value={stockFilter} onChange={(e) => setStockFilter(e.target.value as any)}>
                    <option value="all">All Items</option>
                    <option value="ok">✅ In Stock</option>
                    <option value="low">⚠️ Low Stock</option>
                    <option value="out">🚫 Out of Stock</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="p-6 space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : filteredItems.length === 0 ? (
                <EmptyState icon={PackageSearch} title="No items found" description={stockSearch || stockFilter !== "all" ? "No items match your current filters." : "Add your first item to start tracking."} 
                  action={stockSearch || stockFilter !== "all" ? <Button variant="outline" onClick={() => { setStockSearch(""); setStockFilter("all"); }}>Reset Filters</Button> : undefined}
                />
              ) : (
                <div className="responsive-table-wrapper">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/30">
                        {["Item Name", "Current Stock", "Min Alert", "UOM", "Category", "Actions"].map((h) => (
                          <th key={h} className={`py-3.5 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedStock.map((i) => {
                        const stock = Number(i.current_stock);
                        const minAlert = Number(i.min_stock_alert);
                        const isOut = stock <= 0;
                        const isLow = !isOut && stock <= minAlert;
                        const pct = minAlert > 0 ? Math.min(100, (stock / minAlert) * 100) : (stock > 0 ? 100 : 0);
                        return (
                          <tr key={i.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="py-3.5 px-5">
                              <span className="font-medium text-slate-900">{i.name}</span>
                            </td>
                            <td className="py-3.5 px-5">
                              <div className="flex items-center gap-3">
                                <Badge variant={isOut ? "destructive" : isLow ? "outline" : "secondary"} className={`font-mono text-xs px-2 py-0.5 ${isOut ? "bg-red-100 text-red-700 border-red-200" : isLow ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                                  {stock.toFixed(stock % 1 === 0 ? 0 : 2)} {i.unit}
                                </Badge>
                                {/* Mini progress bar */}
                                <div className="hidden md:block w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${isOut ? "bg-red-400" : isLow ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-5 text-slate-500 text-xs">{i.min_stock_alert} {i.unit}</td>
                            <td className="py-3.5 px-5 text-xs">
                              {i.recipe_unit ? (
                                <span className="inline-flex items-center gap-1 text-[#07008A] bg-[#07008A]/5 border border-[#07008A]/10 px-2 py-0.5 rounded-sm font-medium">
                                  1 {i.unit} = {i.yield_per_unit} {i.recipe_unit}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-5 text-slate-500 text-xs capitalize">{i.category}</td>
                             <td className="py-3.5 px-5 text-right">
                               <div className="flex items-center justify-end gap-1.5">
                                 <TooltipProvider>
                                   <Tooltip>
                                     <TooltipTrigger asChild>
                                       <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => setAdjustItem(i)}>
                                         <ArrowRightLeft className="h-3.5 w-3.5" />
                                       </Button>
                                     </TooltipTrigger>
                                     <TooltipContent>Adjust Stock Levels</TooltipContent>
                                   </Tooltip>

                                   <Tooltip>
                                     <TooltipTrigger asChild>
                                       <Button variant="outline" size="sm" className="h-8 px-2 text-xs border-blue-100 hover:border-blue-200 hover:bg-blue-50 text-blue-600" onClick={() => setEditItem(i)}>
                                         <Pencil className="h-3.5 w-3.5" />
                                       </Button>
                                     </TooltipTrigger>
                                     <TooltipContent>Edit Item Details</TooltipContent>
                                   </Tooltip>

                                   <Tooltip>
                                     <TooltipTrigger asChild>
                                       <Button variant="outline" size="sm" className="h-8 px-2 text-xs border-red-100 hover:border-red-200 hover:bg-red-50 text-red-600" onClick={() => setDeleteConfirmItem(i)}>
                                         <Trash2 className="h-3.5 w-3.5" />
                                       </Button>
                                     </TooltipTrigger>
                                     <TooltipContent>Delete Item</TooltipContent>
                                   </Tooltip>
                                 </TooltipProvider>
                               </div>
                             </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {!loading && filteredItems.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/30 text-xs text-slate-500">
                  <span>Showing <strong>{(stockPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(stockPage * ITEMS_PER_PAGE, filteredItems.length)}</strong> of <strong>{filteredItems.length}</strong></span>
                  <div className="inline-flex items-center gap-1">
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-full" disabled={stockPage <= 1} onClick={() => setStockPage(p => p - 1)}><ChevronLeft className="h-3 w-3" /></Button>
                    <span className="mx-1 text-[11px]">Page <strong>{stockPage}</strong> of <strong>{stockTotalPages}</strong></span>
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-full" disabled={stockPage >= stockTotalPages} onClick={() => setStockPage(p => p + 1)}><ChevronRight className="h-3 w-3" /></Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── ITEMS & RECIPES TAB ─── */}
        <TabsContent value="recipes">
          <Card className="border border-slate-200/80 shadow-xs bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/40 px-5 py-4">
              <CardTitle className="text-lg font-semibold text-[#07008A]">Restaurant Items & Recipes</CardTitle>
              <CardDescription>Link menu items to ingredients or ready-made stock items so inventory is deducted correctly on every sale.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {/* Search Bar */}
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/20">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input type="text" placeholder="Search menu items..." className="pl-9 h-9 text-sm bg-white" value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} />
                </div>
              </div>

              {filteredRecipes.length === 0 ? (
                <EmptyState icon={UtensilsCrossed} title="No menu items found" description={recipeSearch ? "No items match your search." : "No menu items exist yet."}
                  action={recipeSearch ? <Button variant="outline" onClick={() => setRecipeSearch("")}>Clear Search</Button> : undefined}
                />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/30">
                      <th className="py-3.5 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Menu Item</th>
                      <th className="py-3.5 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Category</th>
                      <th className="py-3.5 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Stock Status</th>
                      <th className="py-3.5 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecipes.map((m) => (
                      <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-5 font-medium text-slate-900">{m.name}</td>
                        <td className="py-3.5 px-5 text-slate-500 text-xs">{m.category}</td>
                        <td className="py-3.5 px-5 text-xs">
                          {m.dynamic_available === false ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-sm text-[10px] font-bold w-fit">UNAVAILABLE</span>
                              <span className="text-[10px] text-red-500/80">Needs: {m.deficient_ingredients}</span>
                            </div>
                          ) : (
                            <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-sm text-[10px] font-bold">AVAILABLE</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setRecipeItem(m)}>
                            <Settings2 className="mr-1.5 h-3 w-3" /> Edit Recipe
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── MOVEMENTS TAB ─── */}
        <TabsContent value="history">
          <Card className="border border-slate-200/80 shadow-xs bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/40 px-5 py-4">
              <CardTitle className="text-lg font-semibold text-[#07008A]">Movement History</CardTitle>
              <CardDescription>Complete audit trail of all stock changes</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/20 gap-3">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input type="text" placeholder="Search by item or notes..." className="pl-9 h-9 text-sm bg-white" value={movementSearch} onChange={(e) => setMovementSearch(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
                  <select className="h-9 rounded-md border border-input bg-white px-3 text-xs text-slate-700 w-full sm:w-[150px]" value={movementFilter} onChange={(e) => setMovementFilter(e.target.value as any)}>
                    <option value="all">All Types</option>
                    <option value="IN">📥 Stock In</option>
                    <option value="OUT">📤 Stock Out</option>
                    <option value="ADJUSTMENT">🔄 Adjustments</option>
                  </select>
                </div>
              </div>

              {filteredMovements.length === 0 ? (
                <EmptyState icon={History} title="No movements found" description={movementSearch || movementFilter !== "all" ? "No records match your filters." : "No stock movements recorded yet."}
                  action={movementSearch || movementFilter !== "all" ? <Button variant="outline" onClick={() => { setMovementSearch(""); setMovementFilter("all"); }}>Reset Filters</Button> : undefined}
                />
              ) : (
                <div className="responsive-table-wrapper">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/30">
                        {["Date", "Item", "Type", "Change", "Stock Before → After", "Notes"].map((h) => (
                          <th key={h} className="py-3.5 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedMovements.map((m) => (
                        <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                          <td className="py-3 px-5 text-slate-500 text-xs whitespace-nowrap">{new Date(m.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                          <td className="py-3 px-5 font-medium text-slate-800 text-xs">{m.inventory_items?.name}</td>
                          <td className="py-3 px-5">
                            <Badge variant="outline" className={`text-[10px] font-bold ${m.type === "IN" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : m.type === "OUT" ? "text-amber-700 bg-amber-50 border-amber-200" : "text-slate-700 bg-slate-50 border-slate-200"}`}>
                              {m.type}
                            </Badge>
                          </td>
                          <td className={`py-3 px-5 font-mono font-semibold text-xs ${m.type === "IN" ? "text-emerald-600" : m.type === "OUT" ? "text-amber-600" : "text-slate-600"}`}>
                            {m.type === "IN" ? "+" : m.type === "OUT" ? "-" : ""}{Number(m.quantity).toFixed(Number(m.quantity) % 1 === 0 ? 0 : 4)} {m.inventory_items?.unit}
                          </td>
                          <td className="py-3 px-5 font-mono text-xs text-slate-500">
                            {Number(m.previous_stock).toFixed(Number(m.previous_stock) % 1 === 0 ? 0 : 2)} → <strong className="text-slate-900">{Number(m.new_stock).toFixed(Number(m.new_stock) % 1 === 0 ? 0 : 2)}</strong>
                          </td>
                          <td className="py-3 px-5 text-slate-500 text-xs max-w-[200px] truncate" title={m.notes || m.source}>{m.notes || m.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {filteredMovements.length > MOVEMENTS_PER_PAGE && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/30 text-xs text-slate-500">
                  <span>Showing <strong>{(movementPage - 1) * MOVEMENTS_PER_PAGE + 1}–{Math.min(movementPage * MOVEMENTS_PER_PAGE, filteredMovements.length)}</strong> of <strong>{filteredMovements.length}</strong></span>
                  <div className="inline-flex items-center gap-1">
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-full" disabled={movementPage <= 1} onClick={() => setMovementPage(p => p - 1)}><ChevronLeft className="h-3 w-3" /></Button>
                    <span className="mx-1 text-[11px]">Page <strong>{movementPage}</strong> of <strong>{movementTotalPages}</strong></span>
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-full" disabled={movementPage >= movementTotalPages} onClick={() => setMovementPage(p => p + 1)}><ChevronRight className="h-3 w-3" /></Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {adjustItem && (
        <StockAdjustmentModal item={adjustItem} onClose={() => setAdjustItem(null)} onSuccess={() => fetchItems()} />
      )}
      {editItem && (
        <EditItemModal item={editItem} onClose={() => setEditItem(null)} onSuccess={() => fetchItems()} />
      )}
      {recipeItem && (
        <RecipeEditorModal menuItem={recipeItem} onClose={() => setRecipeItem(null)} />
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!deleteConfirmItem} onOpenChange={(open) => !open && setDeleteConfirmItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete {deleteConfirmItem?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this inventory item? This will archive the item and prevent it from appearing in current stock lists, but historical records will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirmItem && handleDeleteItem(deleteConfirmItem.id)} className="bg-red-600 hover:bg-red-700">
              Delete Item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
