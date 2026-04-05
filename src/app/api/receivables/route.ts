import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePermission } from "@/lib/rbac";
import { dbError, internalError } from "@/lib/api-security";
import { toMoneyNumber } from "@/lib/bookingTotals";
import { manilaDateString } from "@/lib/ledgerDate";

function isMissingReceivableArchiveColumn(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error || error.code !== "42703") return false;
  return String(error.message || "").includes("receivables.is_archived");
}

function getContributionLabel(row: {
  type?: string | null;
  bookings?: { special_booking_label?: string | null } | null;
}) {
  if (row.type === "LGU") return "LGU";
  const label = String(row.bookings?.special_booking_label || "").toLowerCase();
  if (/(corp|corporate|company|business|enterprise)/.test(label)) return "Corporate";
  return "Special Agency";
}

const CONTRIBUTION_COLORS: Record<string, string> = {
  LGU: "#07008A",
  "Special Agency": "#2E8B57",
  Corporate: "#F59E0B",
};

function buildReceivablesQuery(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  options: { type: string | null; status: string | null; includeArchiveFilter: boolean },
) {
  let query = supabase
    .from("receivables")
    .select(`
      *,
      bookings(
        id,
        reference_number,
        check_out_date,
        special_booking_label,
        guests(full_name),
        rooms(room_number)
      )
    `)
    .order("created_at", { ascending: false });

  if (options.includeArchiveFilter) {
    query = query.eq("is_archived", false);
  }

  if (options.type) {
    query = query.eq("type", options.type);
  }

  if (options.status) {
    query = query.eq("status", options.status);
  }

  return query;
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "bookings.read");
  if ("error" in auth) return auth.error;

  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");

    let { data, error } = await buildReceivablesQuery(supabase, {
      type,
      status,
      includeArchiveFilter: true,
    });

    if (isMissingReceivableArchiveColumn(error)) {
      const fallbackResult = await buildReceivablesQuery(supabase, {
        type,
        status,
        includeArchiveFilter: false,
      });
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) return dbError(error, "Failed to load receivables");

    const receivables = data ?? [];
    const today = manilaDateString();

    const summary = receivables.reduce(
      (acc, row) => {
        const due = toMoneyNumber(row.amount_due);
        const paid = toMoneyNumber(row.amount_paid);
        const checkOutDate = String(row.bookings?.check_out_date || "").slice(0, 10);
        const isPastDue = due > 0 && Boolean(checkOutDate) && checkOutDate < today;

        acc.outstandingBalance += due;
        acc.totalCollected += paid;
        acc.activeCases += due > 0 ? 1 : 0;
        if (isPastDue) acc.pastDueCases += 1;
        return acc;
      },
      { outstandingBalance: 0, totalCollected: 0, activeCases: 0, pastDueCases: 0 },
    );

    const forecastMap = new Map<string, { date: string; amount: number; count: number }>();
    const agingMap = new Map<string, { label: string; amount: number; count: number; color: string }>();
    const contributionMap = new Map<string, { label: string; amount: number; count: number; color: string }>();

    for (const row of receivables) {
      const due = toMoneyNumber(row.amount_due);
      const checkOutDate = String(row.bookings?.check_out_date || "").slice(0, 10);

      const agingLabel = due > 0 && checkOutDate && checkOutDate < today ? "Past Due" : "Current";
      const agingColor = agingLabel === "Past Due" ? "#B91C1C" : "#0F766E";
      const existingAging = agingMap.get(agingLabel) ?? { label: agingLabel, amount: 0, count: 0, color: agingColor };
      agingMap.set(agingLabel, {
        ...existingAging,
        amount: existingAging.amount + due,
        count: existingAging.count + (due > 0 ? 1 : 0),
      });

      const contributionLabel = getContributionLabel(row);
      const existingContribution = contributionMap.get(contributionLabel) ?? {
        label: contributionLabel,
        amount: 0,
        count: 0,
        color: CONTRIBUTION_COLORS[contributionLabel] || "#64748B",
      };
      contributionMap.set(contributionLabel, {
        ...existingContribution,
        amount: existingContribution.amount + due,
        count: existingContribution.count + 1,
      });

      if (row.type === "LGU" && due > 0 && checkOutDate) {
        const existingForecast = forecastMap.get(checkOutDate) ?? { date: checkOutDate, amount: 0, count: 0 };
        forecastMap.set(checkOutDate, {
          date: checkOutDate,
          amount: existingForecast.amount + due,
          count: existingForecast.count + 1,
        });
      }
    }

    const forecast = Array.from(forecastMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        ...item,
        label: new Date(`${item.date}T00:00:00+08:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
      }));

    const aging = Array.from(agingMap.values()).sort((a, b) => b.amount - a.amount);
    const contribution = Array.from(contributionMap.values()).sort((a, b) => b.amount - a.amount);

    return NextResponse.json({
      summary: {
        ...summary,
        recoveryRate:
          summary.outstandingBalance + summary.totalCollected > 0
            ? (summary.totalCollected / (summary.outstandingBalance + summary.totalCollected)) * 100
            : 0,
      },
      analytics: {
        forecast,
        aging,
        contribution,
      },
      receivables,
    });
  } catch (error) {
    console.error("[RECEIVABLES_GET_ERROR]", error);
    return internalError();
  }
}
