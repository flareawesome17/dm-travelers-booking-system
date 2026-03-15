"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { UtensilsCrossed, Plus, Pencil, Trash2, MoreHorizontal, CheckCircle2, XCircle, Banknote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RestaurantOrderForm } from "@/components/admin/restaurant/RestaurantOrderForm";
import { RestaurantReceiptModal } from "@/components/admin/restaurant/RestaurantReceiptModal";
import { ChevronLeft, ChevronRight, Search, Receipt } from "lucide-react";

type MenuItem = { id: string; name?: string; description?: string | null; category?: string | null; price?: number | null; is_available?: boolean | null; image_url?: string | null };
type RestaurantCategory = { id: string; name: string; sort_order?: number | null };
type BookingOption = { id: string; reference_number?: string; check_in_date?: string; check_out_date?: string; status?: string; guests?: { full_name?: string | null }; rooms?: { room_number?: string | null } };
type RestaurantOrder = { id: string; booking_id?: string | null; room_id?: string | null; order_source?: string | null; customer_name?: string | null; payment_method?: string | null; status?: string | null; subtotal?: number | null; service_charge?: number | null; total_amount?: number | null; created_at?: string | null; notes?: string | null };

export default function AdminRestaurantPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<RestaurantCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [bookings, setBookings] = useState<BookingOption[]>([]);
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingOrder, setEditingOrder] = useState<RestaurantOrder | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<RestaurantOrder | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<RestaurantOrder | null>(null);
  const [payMethod, setPayMethod] = useState<string>("Cash");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");
  const [orderSourceFilter, setOrderSourceFilter] = useState<string>("all");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderSource, setOrderSource] = useState<"Restaurant" | "Room Service" | "Walk-In">("Restaurant");
  const [orderBookingRef, setOrderBookingRef] = useState<string>("");
  const [orderBookingSearch, setOrderBookingSearch] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderItemSearch, setOrderItemSearch] = useState("");
  const [orderLines, setOrderLines] = useState<{ menu_item_id: string; quantity: string }[]>([]);
  const router = useRouter();

  // Pagination & Search States
  const [menuSearch, setMenuSearch] = useState("");
  const [menuPage, setMenuPage] = useState(1);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const itemsPerPage = 8;

  const loadOrders = () => {
    const token = localStorage.getItem("admin_token");
    if (!token) return;
    fetch("/api/restaurant/orders", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setOrders(Array.isArray(data) ? (data as RestaurantOrder[]) : []))
      .catch(() => setOrders([]));
  };

  const loadItems = () => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.replace("/admin/login"); return; }
    setLoading(true);
    fetch("/api/menu", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((data) => setItems(Array.isArray(data) ? data as MenuItem[] : []))
      .catch(() => setItems([])).finally(() => setLoading(false));
  };

  const loadCategories = () => {
    setCategoriesLoading(true);
    fetch("/api/restaurant-categories").then((r) => r.json())
      .then((data) => { const list = Array.isArray(data) ? data as RestaurantCategory[] : []; setCategories(list); if (!editingItem && !category && list.length > 0) setCategory(list[0].name); })
      .catch(() => setCategories([])).finally(() => setCategoriesLoading(false));
  };

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.replace("/admin/login"); return; }
    loadItems(); loadCategories(); loadOrders();
    fetch("/api/bookings", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then((data) => setBookings(Array.isArray(data) ? data as BookingOption[] : [])).catch(() => setBookings([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const resetForm = () => { setName(""); setCategory(categories[0]?.name ?? ""); setPrice(""); setDescription(""); setIsAvailable(true); setEditingItem(null); setImageFile(null); setImagePreview(null); };
  const openForCreate = () => { resetForm(); setOpen(true); };
  const openForEdit = (item: MenuItem) => { setEditingItem(item); setName(item.name ?? ""); setCategory(item.category ?? categories[0]?.name ?? ""); setPrice(item.price != null ? String(item.price) : ""); setDescription(item.description ?? ""); setIsAvailable(item.is_available ?? true); setImageFile(null); setImagePreview(item.image_url ?? null); setOpen(true); };

  const updateOrderStatus = async (orderId: string, updates: Partial<RestaurantOrder>) => {
    const token = localStorage.getItem("admin_token");
    if (!token) return;
    try {
      const res = await fetch(`/api/restaurant/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "Failed to update order.");
        return;
      }
      toast.success("Order updated.");
      loadOrders();
    } catch {
      toast.error("Something went wrong.");
    }
  };

  const deleteOrder = async (orderId: string) => {
    const token = localStorage.getItem("admin_token");
    if (!token) return;
    try {
      const res = await fetch(`/api/restaurant/orders/${orderId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        toast.error("Failed to delete order.");
        return;
      }
      toast.success("Order deleted.");
      loadOrders();
    } catch {
      toast.error("Something went wrong.");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("admin_token");
    if (!token) { router.replace("/admin/login"); return; }
    if (!name.trim() || !price.trim() || !category.trim()) { toast.error("Name, category, and price are required."); return; }
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) { toast.error("Price must be a positive number."); return; }
    setSaving(true);
    try {
      const isEdit = Boolean(editingItem?.id);
      const endpoint = isEdit ? `/api/menu/${editingItem!.id}` : "/api/menu";
      const method = isEdit ? "PATCH" : "POST";
      let imageUrlToUse: string | null = editingItem?.image_url ?? null;
      if (imageFile) {
        const filePayload = await new Promise<{ name: string; type: string; data: string }>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve({ name: imageFile.name, type: imageFile.type || "image/jpeg", data: String(reader.result ?? "") }); reader.onerror = () => reject(new Error("Failed to read file")); reader.readAsDataURL(imageFile); });
        const uploadRes = await fetch("/api/menu/upload-image", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ file: filePayload }) });
        const uploadData = (await uploadRes.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!uploadRes.ok || !uploadData.url) { toast.error(uploadData.error || "Failed to upload image."); setSaving(false); return; }
        imageUrlToUse = uploadData.url;
      }
      const res = await fetch(endpoint, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: name.trim(), description: description.trim() || null, price: numericPrice, category, is_available: isAvailable, image_url: imageUrlToUse }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error((data as { error?: string }).error || "Failed to save."); return; }
      setItems((prev) => { const u = data as MenuItem; if (!u.id) return prev; const idx = prev.findIndex((i) => i.id === u.id); if (idx === -1) return [...prev, u]; const c = [...prev]; c[idx] = u; return c; });
      toast.success(isEdit ? "Menu item updated." : "Menu item added.");
      setOpen(false); resetForm();
    } catch { toast.error("Something went wrong."); } finally { setSaving(false); }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Restaurant Menu</h1>
          <p className="text-muted-foreground mt-1">Manage menu items and pricing</p>
        </div>
      </motion.div>

      <Tabs defaultValue="menu" className="w-full space-y-6">
        <TabsList className="bg-slate-200/50 p-1 w-full max-w-sm grid grid-cols-2">
          <TabsTrigger value="menu" className="data-[state=active]:bg-white data-[state=active]:text-[#07008A] data-[state=active]:font-semibold shadow-sm">
            <UtensilsCrossed className="h-4 w-4 mr-2" />
            Menu
          </TabsTrigger>
          <TabsTrigger value="orders" className="data-[state=active]:bg-white data-[state=active]:text-[#07008A] data-[state=active]:font-semibold shadow-sm">
            <Receipt className="h-4 w-4 mr-2" />
            Orders & POS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="mt-0 outline-none">
      <Card className="border-0 shadow-lg bg-white overflow-hidden">
        <CardHeader className="border-b bg-slate-50/50 px-6 py-4 flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-[#07008A] flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5" /> 
            Menu Items
          </CardTitle>
          <div className="flex items-center gap-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <Button type="button" size="sm" className="bg-[#07008A] hover:bg-[#05006a] text-white rounded-full px-4" onClick={openForCreate}><Plus className="h-4 w-4 mr-1" /> Add item</Button>
              <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{editingItem ? "Edit menu item" : "Add menu item"}</DialogTitle></DialogHeader>
                <form className="space-y-4" onSubmit={handleSave}>
                  <div className="space-y-2"><Label htmlFor="menu-name">Name</Label><Input id="menu-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tapsilog" required /></div>
                  <div className="space-y-2"><Label htmlFor="menu-category">Category</Label><select id="menu-category" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)} disabled={categoriesLoading || categories.length === 0}>{categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                  <div className="space-y-2"><Label htmlFor="menu-price">Price (₱)</Label><Input id="menu-price" type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="150" required /></div>
                  <div className="space-y-2"><Label htmlFor="menu-description">Description (optional)</Label><Input id="menu-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description..." /></div>
                  <div className="space-y-2"><Label htmlFor="menu-image">Image (optional)</Label><Input id="menu-image" type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0] ?? null; setImageFile(file); if (file) { setImagePreview(URL.createObjectURL(file)); } else { setImagePreview(editingItem?.image_url ?? null); } }} />{(imagePreview || editingItem?.image_url) && <div className="mt-2"><img src={imagePreview || editingItem?.image_url || ""} className="h-24 w-24 rounded-md object-cover border border-slate-200 bg-slate-100" alt="" /></div>}</div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} /><span>Available</span></label>
                  <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving..." : editingItem ? "Update item" : "Save item"}</Button></div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-6 space-y-4">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div> : (
            <div className="overflow-x-auto">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 border-b bg-slate-50/60 gap-4">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input type="text" placeholder="Search menu items..." className="pl-9 h-9 text-sm bg-white" value={menuSearch} onChange={(e) => { setMenuSearch(e.target.value); setMenuPage(1); }} />
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <span className="font-medium text-xs text-slate-600 hidden sm:inline-block">Items ({items.length})</span>
                  <select className="h-9 rounded-md border border-input bg-white px-3 text-xs text-slate-700 w-full sm:w-[160px]" value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setMenuPage(1); }}>
                    <option value="all">All categories</option>
                    {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-slate-50/80">{["Name", "Category", "Price", "Media", "Status", "Actions"].map((h) => <th key={h} className={`${h === "Actions" ? "text-right pr-6" : "text-left"} py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider ${h === "Name" ? "pl-6" : ""}`}>{h}</th>)}</tr></thead>
                <tbody>
                  {(() => {
                    const filtered = items.filter((item) => {
                      const matchesCat = filterCategory === "all" || item.category === filterCategory;
                      const matchesSearch = !menuSearch || item.name?.toLowerCase().includes(menuSearch.toLowerCase());
                      return matchesCat && matchesSearch;
                    });
                    const startIndex = (menuPage - 1) * itemsPerPage;
                    const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);
                    
                    if (filtered.length === 0) return <tr><td colSpan={6} className="py-8 text-center text-slate-500">No items found.</td></tr>;
                    
                    return paginated.map((item) => (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-medium text-[#07008A]">{item.name ?? "—"}</td>
                      <td className="py-4 px-4 text-xs text-slate-600">{item.category ?? "—"}</td>
                      <td className="py-4 px-4 font-semibold text-[#07008A]">₱{Number(item.price ?? 0).toFixed(0)}</td>
                      <td className="py-4 px-4 text-xs text-slate-600">{item.image_url ? <div className="flex items-center gap-2"><div className="h-8 w-8 overflow-hidden rounded-md border border-slate-200 bg-slate-100"><img src={item.image_url} className="h-full w-full object-cover" alt="" /></div></div> : <span className="text-xs text-slate-400">No image</span>}</td>
                      <td className="py-4 px-4 text-xs text-slate-600">{item.is_available ? "Available" : "Hidden"}</td>
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-[#07008A] hover:bg-[#07008A]/10" onClick={() => openForEdit(item)}><Pencil className="h-4 w-4" /></Button>
                          <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this menu item?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={async () => { const token = localStorage.getItem("admin_token"); if (!token) { router.replace("/admin/login"); return; } try { const res = await fetch(`/api/menu/${item.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); if (!res.ok) { toast.error("Failed to delete."); return; } setItems((prev) => prev.filter((m) => m.id !== item.id)); toast.success("Menu item deleted."); } catch { toast.error("Something went wrong."); } }}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                        </div>
                      </td>
                    </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Menu Pagination Controls */}
          {!loading && items.length > 0 && (
            <div className="flex items-center justify-between px-6 py-3 border-t bg-slate-50/60 text-xs text-slate-600 rounded-b-lg">
              {(() => {
                const filtered = items.filter((item) => (filterCategory === "all" || item.category === filterCategory) && (!menuSearch || item.name?.toLowerCase().includes(menuSearch.toLowerCase())));
                const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
                const startIndex = (menuPage - 1) * itemsPerPage;
                return (
                  <>
                    <div>Showing <span className="font-semibold">{filtered.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + itemsPerPage, filtered.length)}</span> of <span className="font-semibold">{filtered.length}</span> item{filtered.length !== 1 ? "s" : ""}</div>
                    <div className="inline-flex items-center gap-1">
                      <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-full" disabled={menuPage <= 1} onClick={() => setMenuPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-3 w-3" /></Button>
                      <span className="mx-1 text-[11px]">Page <span className="font-semibold">{menuPage}</span> of <span className="font-semibold">{totalPages}</span></span>
                      <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-full" disabled={menuPage >= totalPages} onClick={() => setMenuPage((p) => Math.min(totalPages, p + 1))}><ChevronRight className="h-3 w-3" /></Button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="orders" className="mt-0 outline-none">
      {/* Recent Orders */}
      <Card className="border-0 shadow-lg bg-white overflow-hidden">
        <CardHeader className="border-b bg-slate-50/50 px-6 py-4 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-[#07008A] flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Recent Orders
          </CardTitle>
          
          <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
            <Button type="button" size="sm" className="bg-[#07008A] hover:bg-[#05006a] text-white rounded-full px-4" onClick={() => { setOrderOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Order</Button>
            <DialogContent className="sm:max-w-4xl max-h-[95vh] gap-0 p-6 pt-5">
              <DialogHeader className="mb-4">
                <DialogTitle className="text-[#07008A] text-xl">Add Restaurant Order</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-hidden min-h-[500px]">
                <RestaurantOrderForm items={items} bookings={bookings} onSuccess={() => { setOrderOpen(false); loadOrders(); }} onCancel={() => setOrderOpen(false)} />
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between px-6 py-4 border-b bg-slate-50/60 gap-4">
            <div className="relative w-full lg:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input type="text" placeholder="Search orders..." className="pl-9 h-9 text-sm bg-white" value={orderSearch} onChange={(e) => { setOrderSearch(e.target.value); setOrderPage(1); }} />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <select className="h-9 rounded-md border border-input bg-white px-3 text-xs text-slate-700 flex-1 lg:flex-none lg:w-[140px]" value={orderStatusFilter} onChange={(e) => { setOrderStatusFilter(e.target.value); setOrderPage(1); }}>
                <option value="all">All statuses</option>
                <option value="Pending">Pending</option>
                <option value="Served">Served</option>
                <option value="Paid">Paid</option>
                <option value="Charged to Room">Charged to Room</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <select className="h-9 rounded-md border border-input bg-white px-3 text-xs text-slate-700 flex-1 lg:flex-none lg:w-[140px]" value={orderSourceFilter} onChange={(e) => { setOrderSourceFilter(e.target.value); setOrderPage(1); }}>
                <option value="all">All sources</option>
                <option value="Restaurant">Restaurant</option>
                <option value="Room Service">Room Service</option>
                <option value="Walk-In">Walk-In</option>
              </select>
            </div>
          </div>
          {orders.length === 0 ? <div className="p-6 text-sm text-slate-500 text-center">No restaurant orders yet.</div> : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-slate-50/80">{["Source", "Customer / Booking", "Status", "Payment", "Created", "Total", "Actions"].map((h) => <th key={h} className={`${h === "Total" || h === "Actions" ? "text-right pr-6" : "text-left"} py-3 px-4 text-[11px] font-semibold text-slate-600 uppercase tracking-wider ${h === "Source" ? "pl-6" : ""}`}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(() => {
                      const filteredOrders = orders.filter((o) => {
                        const matchesStatus = orderStatusFilter === "all" || o.status === orderStatusFilter;
                        const matchesSource = orderSourceFilter === "all" || o.order_source === orderSourceFilter;
                        
                        if (!matchesStatus || !matchesSource) return false;
                        if (!orderSearch) return true;
                        
                        const src = o.order_source?.toLowerCase() || "";
                        const st = o.status?.toLowerCase() || "";
                        const cName = o.customer_name?.toLowerCase() || "";
                        const bRef = o.booking_id ? bookings.find(b => b.id === o.booking_id)?.reference_number?.toLowerCase() || "" : "";
                        const s = orderSearch.toLowerCase();
                        return src.includes(s) || st.includes(s) || bRef.includes(s) || cName.includes(s);
                      });
                      const startIndex = (orderPage - 1) * itemsPerPage;
                      const paginatedOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage);
                      
                      if (filteredOrders.length === 0) return <tr><td colSpan={7} className="py-8 text-center text-slate-500">No orders match your search.</td></tr>;

                      return paginatedOrders.map((o) => {
                        const booking = o.booking_id ? bookings.find((b) => b.id === o.booking_id) : undefined;
                        return (
                          <tr key={o.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-6 text-xs font-medium text-slate-700">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "h-2 w-2 rounded-full",
                                  o.order_source === "Room Service" ? "bg-purple-400" : 
                                  o.order_source === "Walk-In" ? "bg-blue-400" : "bg-orange-400"
                                )} />
                                {o.order_source ?? "Restaurant"}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600">
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-900 text-sm">{o.customer_name || (booking?.guests?.full_name ?? "Walk-in Guest")}</span>
                                {booking ? (
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="inline-flex items-center rounded-sm bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-100">
                                      {booking.rooms?.room_number ? `Rm ${booking.rooms.room_number}` : "No room"}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {booking.reference_number}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">No linked booking</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-xs">
                              <span className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                o.status === "Charged to Room" ? "bg-amber-100 text-amber-700 border border-amber-200" : 
                                o.status === "Paid" ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : 
                                o.status === "Served" ? "bg-blue-100 text-blue-700 border border-blue-200" :
                                o.status === "Cancelled" ? "bg-red-100 text-red-700 border border-red-200" :
                                "bg-slate-100 text-slate-700 border border-slate-200"
                              )}>
                                {o.status ?? "Pending"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600">
                              {o.payment_method ? (
                                <div className="flex items-center gap-1.5">
                                  {o.payment_method === "Cash" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                                  {o.payment_method === "GCash" && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                                  {o.payment_method === "Card" && <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />}
                                  <span className="font-medium">{o.payment_method}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Unspecified</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-500">{o.created_at ? new Date(o.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                            <td className="py-3 px-6 text-right font-semibold text-[#07008A]">₱{Number(o.total_amount ?? 0).toFixed(0)}</td>
                            <td className="py-3 px-6 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-[#07008A] hover:bg-[#07008A]/10 rounded-full">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuLabel className="text-[10px] font-bold uppercase text-slate-400">Order Actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  
                                  {o.order_source !== "Room Service" && (
                                    <DropdownMenuItem onClick={() => setReceiptOrder(o)} className="text-slate-700 focus:bg-slate-100 cursor-pointer">
                                      <Receipt className="mr-2 h-4 w-4" /> Print Receipt
                                    </DropdownMenuItem>
                                  )}

                                  {o.status === "Pending" && (
                                    <>
                                      <DropdownMenuItem onClick={() => { setPaymentOrder(o); setPayMethod("Cash"); }} className="text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50 cursor-pointer">
                                        <Banknote className="mr-2 h-4 w-4" /> Record Payment
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => updateOrderStatus(o.id, { status: "Served" })} className="text-blue-600 focus:text-blue-700 focus:bg-blue-50 cursor-pointer">
                                        <CheckCircle2 className="mr-2 h-4 w-4" /> Mark as Served
                                      </DropdownMenuItem>
                                    </>
                                  )}

                                  {o.status === "Served" && (
                                    <DropdownMenuItem onClick={() => { setPaymentOrder(o); setPayMethod("Cash"); }} className="text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50 cursor-pointer">
                                      <Banknote className="mr-2 h-4 w-4" /> Record Payment
                                    </DropdownMenuItem>
                                  )}

                                  {o.status !== "Cancelled" && o.status !== "Paid" && o.status !== "Charged to Room" && (
                                    <DropdownMenuItem onClick={() => updateOrderStatus(o.id, { status: "Cancelled" })} className="text-red-500 focus:text-red-600 focus:bg-red-50 cursor-pointer">
                                      <XCircle className="mr-2 h-4 w-4" /> Cancel Order
                                    </DropdownMenuItem>
                                  )}

                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer">
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete this order?</AlertDialogTitle>
                                        <AlertDialogDescription>This will permanently remove the order from records. This action cannot be undone.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Keep Order</AlertDialogCancel>
                                        <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteOrder(o.id)}>Delete Permanently</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
              
              {/* Orders Pagination Controls */}
              <div className="flex items-center justify-between px-6 py-3 border-t bg-slate-50/60 text-xs text-slate-600 rounded-b-lg">
                {(() => {
                  const filteredOrders = orders.filter((o) => !orderSearch || o.order_source?.toLowerCase().includes(orderSearch.toLowerCase()) || o.status?.toLowerCase().includes(orderSearch.toLowerCase()));
                  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
                  const startIndex = (orderPage - 1) * itemsPerPage;
                  return (
                    <>
                      <div>Showing <span className="font-semibold">{filteredOrders.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredOrders.length)}</span> of <span className="font-semibold">{filteredOrders.length}</span> order{filteredOrders.length !== 1 ? "s" : ""}</div>
                      <div className="inline-flex items-center gap-1">
                        <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-full" disabled={orderPage <= 1} onClick={() => setOrderPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-3 w-3" /></Button>
                        <span className="mx-1 text-[11px]">Page <span className="font-semibold">{orderPage}</span> of <span className="font-semibold">{totalPages}</span></span>
                        <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-full" disabled={orderPage >= totalPages} onClick={() => setOrderPage((p) => Math.min(totalPages, p + 1))}><ChevronRight className="h-3 w-3" /></Button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </TabsContent>
      </Tabs>

      {/* Restaurant Payment Modal */}
      <Dialog open={!!paymentOrder} onOpenChange={(o) => !o && setPaymentOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#07008A] flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Record Restaurant Payment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
              <div className="flex justify-between text-sm text-slate-500 mb-1">
                <span>Order Total</span>
                <span className="font-bold text-slate-900">₱{Number(paymentOrder?.total_amount ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Source</span>
                <span>{paymentOrder?.order_source}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pay-method">Payment Method</Label>
              <select 
                id="pay-method"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-[#07008A]/20 focus:border-[#07008A]"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
              >
                <option value="Cash">Cash</option>
                <option value="GCash">GCash</option>
                <option value="Card">Card</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setPaymentOrder(null)}>Cancel</Button>
              <Button 
                className="bg-[#07008A] hover:bg-[#05006a] text-white"
                onClick={() => {
                  if (paymentOrder) {
                    updateOrderStatus(paymentOrder.id, { 
                      status: "Paid", 
                      payment_method: payMethod 
                    });
                    setPaymentOrder(null);
                  }
                }}
              >
                Confirm Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restaurant Receipt Modal */}
      <RestaurantReceiptModal 
        order={receiptOrder} 
        onClose={() => setReceiptOrder(null)} 
      />

    </>
  );
}
