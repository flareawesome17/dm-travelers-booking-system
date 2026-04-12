import { describe, expect, it } from "vitest";
import { getShiftCashReportById } from "./shiftCashReports";

type QueryResult = { data: any; error: any };

function createSupabaseMock(options: {
  snapshot: Record<string, any>;
  snapshotRows?: Record<string, any>[];
  turnoverRows?: Record<string, any>[];
}) {
  const shiftLog = {
    id: "shift-log-1",
    shift_id: "shift-1",
    date: "2026-04-12",
    status: "CLOSED",
  };

  const shifts = [
    {
      id: "shift-1",
      name: "Morning Shift",
      start_time: "06:00:00",
      end_time: "14:00:00",
      sort_order: 1,
      is_active: true,
    },
    {
      id: "shift-0",
      name: "Night Shift",
      start_time: "22:00:00",
      end_time: "06:00:00",
      sort_order: 3,
      is_active: true,
    },
  ];

  function makeFilterChain(table: string): any {
    const state: Record<string, any> = {};

    return {
      eq(column: string, value: any) {
        state[column] = value;
        return this;
      },
      in(column: string, values: any[]) {
        state[column] = values;
        return this;
      },
      async single(): Promise<QueryResult> {
        if (table === "shift_logs" && state.id === "shift-log-1") {
          return { data: shiftLog, error: null };
        }
        throw new Error(`Unexpected single() on ${table}`);
      },
      async maybeSingle(): Promise<QueryResult> {
        if (table === "shift_cash_reports" && state.shift_log_id === "shift-log-1") {
          return { data: options.snapshot, error: null };
        }
        throw new Error(`Unexpected maybeSingle() on ${table}`);
      },
      async order(): Promise<QueryResult> {
        if (table === "shift_cash_report_rows" && state.report_id === options.snapshot.id) {
          return { data: options.snapshotRows ?? [], error: null };
        }
        if (
          table === "shift_cash_report_turnovers" &&
          state.target_shift_id === "shift-1" &&
          state.target_date === "2026-04-12"
        ) {
          return { data: options.turnoverRows ?? [], error: null };
        }
        if (table === "shift_transactions" && state.shift_log_id === "shift-log-1") {
          return { data: [], error: null };
        }
        throw new Error(`Unexpected order() on ${table}`);
      },
      async then(resolve: any, reject: any) {
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      },
    };
  }

  return {
    from(table: string) {
      return {
        select() {
          if (table === "shifts") {
            return {
              in: async (_column: string, ids: string[]) => ({
                data: shifts.filter((shift) => ids.includes(shift.id)),
                error: null,
              }),
            };
          }

          if (table === "shift_logs") {
            return {
              eq(_column: string, value: string) {
                return {
                  async single() {
                    if (value === "shift-log-1") {
                      return { data: shiftLog, error: null };
                    }
                    return { data: null, error: new Error("Shift log not found") };
                  },
                };
              },
              in: async (_column: string, ids: string[]) => ({
                data: ids.includes("source-log-1") ? [{ id: "source-log-1", shift_id: "shift-0" }] : [],
                error: null,
              }),
            };
          }

          if (
            table === "shift_cash_reports" ||
            table === "shift_cash_report_rows" ||
            table === "shift_cash_report_turnovers" ||
            table === "shift_transactions"
          ) {
            return makeFilterChain(table);
          }

          throw new Error(`Unexpected table ${table}`);
        },
      };
    },
  };
}

describe("getShiftCashReportById snapshot compatibility", () => {
  it("rehydrates legacy closed snapshots with the current carry-in rules", async () => {
    const supabase = createSupabaseMock({
      snapshot: {
        id: "report-1",
        shift_log_id: "shift-log-1",
        total_cash: 0,
        total_gcash: 0,
        total_card: 0,
        total_cheque: 0,
        total_qrph: 0,
        total_amount: 0,
        total_cash_expenses: 0,
        total_non_cash_expenses: 0,
        total_expenses: 0,
        cash_on_hand: 0,
        activity_row_count: 0,
        turnover_row_count: 1,
        export_template_version: 2,
      },
      turnoverRows: [
        {
          source_shift_log_id: "source-log-1",
          booking_id: "booking-1",
          room_no: "105",
          guest_name: "Lucky Webon",
          check_in_at: "2026-04-11T14:00:00.000Z",
          check_out_at: null,
          room_rate: 0,
          extra_bed_amount: 0,
          extra_person_amount: 0,
          linens_amount: 0,
          charge_amount: 200,
          early_checkin_amount: 0,
          late_checkout_amount: 0,
          minimart_amount: 0,
          food_amount: 0,
          collectible_amount: 200,
          total_amount: 200,
          latest_activity_at: "2026-04-12T00:30:00.000Z",
        },
      ],
    });

    const report = await getShiftCashReportById("shift-log-1", { supabase: supabase as any });

    expect(report.report_mode).toBe("snapshot");
    expect(report.export_template_version).toBe(2);
    expect(report.activity_rows).toHaveLength(1);
    expect(report.activity_rows[0]).toMatchObject({
      room_no: "105",
      charge_amount: 200,
      cash_amount: 0,
      total_amount: 0,
      remaining_balance_due: 200,
    });
    expect(report.turnover_rows).toHaveLength(1);
  });

  it("does not duplicate carry-in rows for current snapshot versions", async () => {
    const supabase = createSupabaseMock({
      snapshot: {
        id: "report-2",
        shift_log_id: "shift-log-1",
        total_cash: 0,
        total_gcash: 0,
        total_card: 0,
        total_cheque: 0,
        total_qrph: 0,
        total_amount: 0,
        total_cash_expenses: 0,
        total_non_cash_expenses: 0,
        total_expenses: 0,
        cash_on_hand: 0,
        activity_row_count: 1,
        turnover_row_count: 1,
        export_template_version: 3,
      },
      snapshotRows: [
        {
          booking_id: "booking-1",
          room_no: "105",
          guest_name: "Lucky Webon",
          scheduled_check_in_at: null,
          scheduled_check_out_at: null,
          remaining_balance_due: 200,
          check_in_at: "2026-04-11T14:00:00.000Z",
          check_out_at: null,
          room_rate: 0,
          extra_bed_amount: 0,
          extra_person_amount: 0,
          linens_amount: 0,
          charge_amount: 200,
          early_checkin_amount: 0,
          late_checkout_amount: 0,
          minimart_amount: 0,
          food_amount: 0,
          cash_amount: 0,
          gcash_amount: 0,
          card_amount: 0,
          cheque_amount: 0,
          qrph_amount: 0,
          total_amount: 0,
          payment_count: 0,
          reference_numbers: [],
          latest_activity_at: "2026-04-12T00:30:00.000Z",
        },
      ],
      turnoverRows: [
        {
          source_shift_log_id: "source-log-1",
          booking_id: "booking-1",
          room_no: "105",
          guest_name: "Lucky Webon",
          check_in_at: "2026-04-11T14:00:00.000Z",
          check_out_at: null,
          room_rate: 0,
          extra_bed_amount: 0,
          extra_person_amount: 0,
          linens_amount: 0,
          charge_amount: 200,
          early_checkin_amount: 0,
          late_checkout_amount: 0,
          minimart_amount: 0,
          food_amount: 0,
          collectible_amount: 200,
          total_amount: 200,
          latest_activity_at: "2026-04-12T00:30:00.000Z",
        },
      ],
    });

    const report = await getShiftCashReportById("shift-log-1", { supabase: supabase as any });

    expect(report.activity_rows).toHaveLength(1);
    expect(report.activity_rows[0]).toMatchObject({
      booking_id: "booking-1",
      charge_amount: 200,
      total_amount: 0,
    });
    expect(report.turnover_rows).toHaveLength(1);
  });
});
