"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Clock, RefreshCcw, ChevronLeft, ChevronRight, Lock, AlertTriangle, X } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/sonner";
import { adminFetchOrRedirect, requireAdminSession } from "@/lib/admin-client";

interface ShiftLog {
  id: string;
  date: string;
  status: string;
  closed_at: string | null;
  close_notes: string | null;
  total_income: number;
  total_expense: number;
  net_total: number;
  shifts: { id: string; name: string; start_time: string; end_time: string } | null;
}

interface Transaction {
  id: string;
  source: string;
  reference_id: string | null;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string | null;
  created_at: string;
}

interface DetailData {
  shift_log: ShiftLog;
  transactions: Transaction[];
  income_transactions: Transaction[];
  expense_transactions: Transaction[];
  summary: {
    total_income: number;
    total_expense: number;
    net_total: number;
    stored_net_total: number;
    has_discrepancy: boolean;
    transaction_count: number;
  };
}

export default function ShiftHistoryPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<ShiftLog[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchHistory = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const res = await adminFetchOrRedirect(router, `/api/shifts/history?page=${page}&limit=${pagination.limit}`);
        if (!res.ok) throw new Error("Failed to load shift history");
        const json = await res.json();
        setLogs(json.data ?? []);
        setPagination(json.pagination);
      } catch {
        toast.error("Failed to fetch shift history");
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  const fetchDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      setDetail(null);
      try {
        const res = await adminFetchOrRedirect(router, `/api/shifts/${id}/ledger`);
        if (!res.ok) throw new Error("Failed to load shift detail");
        setDetail(await res.json());
      } catch {
        toast.error("Failed to fetch shift detail");
      } finally {
        setDetailLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    (async () => {
      if (!(await requireAdminSession(router))) {
        setLoading(false);
        return;
      }
      fetchHistory(1);
    })();
  }, [fetchHistory]);


  return <div className="p-6"><p>Shift history loading...</p></div>;
}
