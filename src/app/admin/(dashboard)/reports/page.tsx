"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BarChart3, Download, Banknote, TrendingUp, TrendingDown, 
  Wallet, Plus, Calendar, Filter, PieChart, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, PieChart as RePieChart, Pie, Legend
} from "recharts";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ReportData = {
  total_revenue: number;
  room_revenue: number;
  restaurant_revenue: number;
  total_expenses: number;
  net_profit: number;
  by_method: Record<string, number>;
  by_source: Record<string, number>;
  booking_count: number;
  order_count: number;
  expenses_list: any[];
};

export default function AdminReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("monthly");
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const router = useRouter();

  // Expense form state
  const [expDesc, setExpDesc] = useState("");
  const [expAmt, setExpAmt] = useState("");
  const [expCat, setExpCat] = useState("Supplies");
  const [expDate, setExpDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReportData();
  }, [period]);

  const fetchReportData = async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) { router.replace("/admin/login"); return; }
    
    setLoading(true);
    try {
      let start = new Date();
      if (period === "daily") start.setHours(0,0,0,0);
      else if (period === "weekly") start.setDate(start.getDate() - 7);
      else if (period === "monthly") start.setMonth(start.getMonth() - 1);
      else if (period === "yearly") start.setFullYear(start.getFullYear() - 1);

      const res = await fetch(`/api/reports/revenue?startDate=${start.toISOString()}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      const report = await res.json();
      setData(report);
    } catch (error) {
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          description: expDesc,
          amount: parseFloat(expAmt),
          category: expCat,
          date: expDate
        })
      });
      if (res.ok) {
        toast.success("Expense recorded");
        setIsAddExpenseOpen(false);
        setExpDesc(""); setExpAmt("");
        fetchReportData();
      }
    } catch {
      toast.error("Failed to record expense");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) return;
    const res = await fetch("/api/reports/revenue?format=csv", { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `revenue_${period}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const chartData = data ? [
    { name: "Revenue", amount: data.total_revenue || 0, fill: "#07008A" },
    { name: "Expenses", amount: data.total_expenses || 0, fill: "#ef4444" },
    { name: "Net Profit", amount: data.net_profit || 0, fill: "#10b981" }
  ] : [];

  const sourceData = data?.by_source ? Object.entries(data.by_source).map(([name, value]) => ({ name, value })) : [];
  const COLORS = ["#07008A", "#3b82f6", "#10b981", "#f59e0b"];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Financial Reports</h1>
          <p className="text-muted-foreground mt-1 text-sm">Analytics and accounting for D&M Travelers Inn</p>
        </motion.div>
        
        <div className="flex items-center gap-2">
          <Tabs value={period} onValueChange={setPeriod} className="w-auto">
            <TabsList className="bg-slate-100 border p-1">
              <TabsTrigger value="daily" className="text-xs px-3 py-1.5">Daily</TabsTrigger>
              <TabsTrigger value="weekly" className="text-xs px-3 py-1.5">Weekly</TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs px-3 py-1.5">Monthly</TabsTrigger>
              <TabsTrigger value="yearly" className="text-xs px-3 py-1.5">Yearly</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={handleExport} variant="outline" size="sm" className="h-9">
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
      ) : data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="border-0 shadow-sm bg-white overflow-hidden group">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 rounded-lg bg-[#07008A]/10 text-[#07008A] group-hover:scale-110 transition-transform"><TrendingUp className="h-5 w-5" /></div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-1 rounded">Revenue</span>
                  </div>
                  <h3 className="text-2xl font-bold text-[#07008A]">₱{(data.total_revenue || 0).toLocaleString()}</h3>
                  <div className="flex items-center gap-1 mt-1 text-emerald-600 text-xs font-medium">
                    <ArrowUpRight className="h-3 w-3" />
                    <span>Total Income</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="border-0 shadow-sm bg-white overflow-hidden group">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 rounded-lg bg-red-50 text-red-600 group-hover:scale-110 transition-transform"><TrendingDown className="h-5 w-5" /></div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-1 rounded">Expenses</span>
                  </div>
                  <h3 className="text-2xl font-bold text-red-600">₱{(data.total_expenses || 0).toLocaleString()}</h3>
                  <div className="flex items-center gap-1 mt-1 text-red-500 text-xs font-medium">
                    <ArrowDownRight className="h-3 w-3" />
                    <span>Operating Costs</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="border-0 shadow-sm bg-[#07008A] text-white overflow-hidden group">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 rounded-lg bg-white/20 text-white group-hover:scale-110 transition-transform"><Wallet className="h-5 w-5" /></div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 bg-white/5 px-2 py-1 rounded">Net Profit</span>
                  </div>
                  <h3 className="text-2xl font-bold">₱{(data.net_profit || 0).toLocaleString()}</h3>
                  <div className="flex items-center gap-1 mt-1 text-white/60 text-xs font-medium">
                    <TrendingUp className="h-3 w-3" />
                    <span>Take-home Earnings</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Main Comparison Chart */}
            <Card className="border-0 shadow-sm bg-white overflow-hidden">
              <CardHeader className="border-b bg-slate-50/30">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[#07008A]" />
                  Financial Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]} barSize={60}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Revenue by Source */}
            <Card className="border-0 shadow-sm bg-white overflow-hidden">
              <CardHeader className="border-b bg-slate-50/30">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-[#07008A]" />
                  Revenue by Source
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={sourceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {sourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                  </RePieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Expense Management */}
          <Card className="border-0 shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-b bg-slate-50/30 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Recent Expenses</CardTitle>
                <CardDescription className="text-xs">Manage your operational costs</CardDescription>
              </div>
              <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-[#07008A] hover:bg-[#05006a] h-8">
                    <Plus className="h-4 w-4 mr-1" /> Add Expense
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record New Expense</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddExpense} className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="exp-desc">Description</Label>
                      <Input id="exp-desc" value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="e.g. Electricity Bill" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="exp-amt">Amount (₱)</Label>
                        <Input id="exp-amt" type="number" step="0.01" value={expAmt} onChange={e => setExpAmt(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="exp-cat">Category</Label>
                        <select 
                          id="exp-cat" 
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-[#07008A]/20"
                          value={expCat}
                          onChange={e => setExpCat(e.target.value)}
                        >
                          <option value="Utilities">Utilities</option>
                          <option value="Supplies">Supplies</option>
                          <option value="Maintenance">Maintenance</option>
                          <option value="Salaries">Salaries</option>
                          <option value="Food & Beverage">Food & Beverage</option>
                          <option value="Taxes">Taxes</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="exp-date">Date</Label>
                      <Input id="exp-date" type="date" value={expDate} onChange={e => setExpDate(e.target.value)} required />
                    </div>
                    <Button type="submit" disabled={submitting} className="w-full bg-[#07008A] hover:bg-[#05006a]">
                      {submitting ? "Saving..." : "Record Expense"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 border-b">
                    <tr>
                      <th className="py-3 px-6 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="py-3 px-6 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                      <th className="py-3 px-6 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Category</th>
                      <th className="py-3 px-6 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {!data.expenses_list || data.expenses_list.length === 0 ? (
                      <tr><td colSpan={4} className="py-12 text-center text-slate-400 text-xs italic">No expenses recorded for this period.</td></tr>
                    ) : (
                      data.expenses_list.map((exp: any) => (
                        <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-6 text-slate-600 text-xs">{new Date(exp.date).toLocaleDateString()}</td>
                          <td className="py-4 px-6 font-medium text-slate-800 text-xs">{exp.description}</td>
                          <td className="py-4 px-6 text-xs">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                              {exp.category}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right font-bold text-red-500 text-xs">₱{Number(exp.amount).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
