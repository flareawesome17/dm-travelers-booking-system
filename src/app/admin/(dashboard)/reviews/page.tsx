"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Star, Trash2, CheckCircle, XCircle, 
  MessageSquare, Calendar, User, Hash,
  Search, Filter, Loader2, AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { usePermissions } from "@/context/PermissionsContext";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Review {
  id: string;
  booking_id: string;
  guest_name: string;
  rating: number;
  comment: string | null;
  is_approved: boolean;
  created_at: string;
  bookings: {
    reference_number: string;
  } | null;
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const { hasPermission } = usePermissions();
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await fetch("/api/admin/reviews", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load reviews");
      const data = await res.json();
      setReviews(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleToggleApproval = async (id: string, currentStatus: boolean) => {
    if (!hasPermission("reviews.approve")) {
      toast.error("You don't have permission to approve reviews");
      return;
    }

    setActionId(id);
    const token = localStorage.getItem("admin_token");
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_approved: !currentStatus }),
      });

      if (!res.ok) throw new Error("Failed to update review status");
      
      setReviews(prev => prev.map(r => r.id === id ? { ...r, is_approved: !currentStatus } : r));
      toast.success(currentStatus ? "Review hidden from public" : "Review approved and published");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!hasPermission("reviews.delete")) {
      toast.error("You don't have permission to delete reviews");
      return;
    }

    if (!confirm("Are you sure you want to permanently delete this review?")) return;

    setActionId(id);
    const token = localStorage.getItem("admin_token");
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to delete review");
      
      setReviews(prev => prev.filter(r => r.id !== id));
      toast.success("Review deleted successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Deletion failed");
    } finally {
      setActionId(null);
    }
  };

  const filteredReviews = reviews.filter(review => {
    const matchesFilter = 
      filter === "all" || 
      (filter === "pending" && !review.is_approved) || 
      (filter === "approved" && review.is_approved);
    
    const matchesSearch = 
      review.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.bookings?.reference_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (review.comment?.toLowerCase() || "").includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#07008A] tracking-tight">Guest Reviews</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage and moderate feedback from your guests</p>
        </motion.div>
        
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border">
          {(["all", "pending", "approved"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter(f)}
              className={cn(
                "capitalize h-8 px-3 text-xs",
                filter === f && "bg-[#07008A] text-white shadow-sm"
              )}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {/* Filters & Search */}
      <Card className="border-0 shadow-sm bg-slate-50/50">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by guest name, reference, or comment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white border-slate-200"
            />
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      <div className="space-y-4">
        {filteredReviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
            <MessageSquare className="h-12 w-12 text-slate-200 mb-4" />
            <p className="text-slate-500 font-medium">No reviews found matching your criteria</p>
          </div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence mode="popLayout">
              {filteredReviews.map((review) => (
                <motion.div
                  key={review.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <Card className={cn(
                    "border-l-4 shadow-sm transition-all hover:shadow-md",
                    review.is_approved ? "border-l-emerald-500" : "border-l-amber-500"
                  )}>
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row gap-6">
                        {/* Guest Info */}
                        <div className="lg:w-1/4 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-[#07008A]/10 flex items-center justify-center text-[#07008A] font-bold">
                              {review.guest_name[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 leading-tight">{review.guest_name}</p>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                <Hash className="h-3 w-3" />
                                {review.bookings?.reference_number || "WALK-IN"}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(review.created_at), "MMM d, yyyy")}
                            </div>
                            <Badge variant={review.is_approved ? "success" : "warning"} className="text-[10px] uppercase tracking-tighter h-5 px-1.5">
                              {review.is_approved ? "Published" : "Pending Approval"}
                            </Badge>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={cn(
                                  "h-4 w-4",
                                  star <= review.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"
                                )}
                              />
                            ))}
                            <span className="ml-2 text-sm font-bold text-slate-700">{review.rating}.0</span>
                          </div>
                          
                          {review.comment ? (
                            <p className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-3 rounded-xl italic">
                              "{review.comment}"
                            </p>
                          ) : (
                            <p className="text-slate-400 text-sm italic">No comment provided</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex lg:flex-col gap-2 justify-end lg:justify-start lg:w-32">
                          <Button
                            size="sm"
                            variant={review.is_approved ? "outline" : "default"}
                            className={cn(
                              "flex-1 lg:flex-none h-9 text-xs font-medium transition-all group",
                              !review.is_approved && "bg-emerald-600 hover:bg-emerald-700 text-white"
                            )}
                            onClick={() => handleToggleApproval(review.id, review.is_approved)}
                            disabled={actionId === review.id}
                          >
                            {actionId === review.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : review.is_approved ? (
                              <>
                                <XCircle className="h-3.5 w-3.5 mr-1.5 text-slate-400 transition-colors group-hover:text-amber-500" />
                                Unpublish
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                                Approve
                              </>
                            )}
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="ghost"
                            className="flex-1 lg:flex-none h-9 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(review.id)}
                            disabled={actionId === review.id}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
