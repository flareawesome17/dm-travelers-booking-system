import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { generateShiftCashReportWorkbook, type ShiftCashReport } from "./shiftCashReports";

vi.mock("@/lib/settings", () => ({
  getGlobalTimeConfig: vi.fn(async () => ({
    timezone: "Asia/Manila",
    offset: "+08:00",
    check_in_time: "14:00",
    check_out_time: "12:00",
  })),
}));

describe("generateShiftCashReportWorkbook", () => {
  it("renders the compact print layout with consolidated charges and non-cash payment indicators", async () => {
    const report: ShiftCashReport = {
      shift_log: {
        id: "shift-log-1",
        shift_id: "shift-1",
        date: "2026-04-11",
        status: "OPEN",
        shifts: {
          id: "shift-1",
          name: "Morning Shift",
          start_time: "06:00:00",
          end_time: "14:00:00",
          sort_order: 1,
          is_active: true,
        },
      },
      summary: {
        total_cash: 500,
        total_gcash: 250,
        total_card: 100,
        total_cheque: 75,
        total_qrph: 50,
        total_amount: 975,
        total_cash_expenses: 50,
        total_non_cash_expenses: 0,
        total_expenses: 50,
        cash_on_hand: 450,
        activity_row_count: 1,
        turnover_row_count: 0,
      },
      activity_rows: [
        {
          booking_id: "booking-1",
          room_no: "101",
          guest_name: "Guest One",
          scheduled_check_in_at: null,
          scheduled_check_out_at: null,
          remaining_balance_due: 0,
          check_in_at: "2026-04-11T06:10:00.000Z",
          check_out_at: null,
          room_rate: 1000,
          extra_bed_amount: 0,
          extra_person_amount: 0,
          linens_amount: 0,
          charge_amount: 25,
          minimart_amount: 0,
          food_amount: 0,
          early_checkin_amount: 40,
          late_checkout_amount: 60,
          cash_amount: 500,
          gcash_amount: 250,
          card_amount: 100,
          cheque_amount: 75,
          qrph_amount: 50,
          total_amount: 975,
          payment_count: 4,
          reference_numbers: ["QR-123"],
          latest_activity_at: "2026-04-11T07:00:00.000Z",
        },
        {
          booking_id: "booking-2",
          room_no: "204",
          guest_name: "Reservation Guest",
          scheduled_check_in_at: "2026-04-12T06:00:00.000Z",
          scheduled_check_out_at: "2026-04-13T04:00:00.000Z",
          remaining_balance_due: 0,
          check_in_at: null,
          check_out_at: null,
          room_rate: 1930,
          extra_bed_amount: 0,
          extra_person_amount: 0,
          linens_amount: 0,
          charge_amount: 0,
          minimart_amount: 0,
          food_amount: 0,
          early_checkin_amount: 0,
          late_checkout_amount: 0,
          cash_amount: 0,
          gcash_amount: 700,
          card_amount: 0,
          cheque_amount: 0,
          qrph_amount: 0,
          total_amount: 700,
          payment_count: 1,
          reference_numbers: ["TXN-1775905057294-326"],
          latest_activity_at: "2026-04-11T05:00:00.000Z",
        },
      ],
      turnover_rows: [],
      expense_summary: {
        cash_paid: 50,
        non_cash_paid: 0,
        total: 50,
        expense_count: 1,
      },
      export_template_version: 2,
      report_mode: "live",
    };

    const buffer = await generateShiftCashReportWorkbook(report, {
      preparedByName: "Ernie Saavedra Jr.",
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.worksheets[0];

    expect(worksheet.getCell("G8").value).toBe("EXTRAS");
    expect(worksheet.getCell("M8").value).toBe("PAYMENT METHODS");
    expect(worksheet.getCell("D8").value).toBe("CHECK-IN");
    expect(worksheet.getCell("E8").value).toBe("CHECK-OUT");
    expect(worksheet.getCell("J9").value).toBe("CHARGE:");
    expect(worksheet.getCell("N9").value).toBe("NON-CASH");
    expect(worksheet.getCell("O9").value).toBe("METHOD");
    expect(worksheet.getCell("P9").value).toBe("REF NO.");
    expect(worksheet.getCell("M10").border.left?.style).toBe("medium");
    expect(worksheet.getCell("N10").border.left?.style).toBe("thin");
    expect(worksheet.getCell("O10").border.left?.style).toBe("thin");
    expect(worksheet.getCell("P10").border.right?.style).toBe("medium");
    expect(worksheet.getCell("M7").border.top?.style).toBe("medium");
    expect(worksheet.getCell("P7").border.top?.style).toBe("medium");
    expect(worksheet.getCell("M8").border.top?.style).toBe("medium");
    expect(worksheet.getCell("P8").border.top?.style).toBe("medium");
    expect(worksheet.getCell("P24").border.right?.style).toBe("medium");
    expect(worksheet.getCell("F24").border.right?.style).toBe("thin");
    expect(worksheet.getCell("L24").border.right?.style).toBe("medium");
    expect(worksheet.getCell("F24").border.bottom?.style).toBe("medium");
    expect(worksheet.getCell("N24").border.bottom?.style).toBe("medium");
    expect(worksheet.getCell("A24").border.top?.style).toBe("medium");
    expect(worksheet.getCell("A24").border.bottom?.style).toBe("medium");
    expect(worksheet.getCell("P24").border.top?.style).toBe("medium");
    expect(worksheet.getCell("P24").border.bottom?.style).toBe("medium");
    expect(worksheet.getCell("D10").font?.size).toBe(9);
    expect(worksheet.getCell("D10").alignment?.shrinkToFit).toBe(true);
    expect(worksheet.getCell("E10").font?.size).toBe(9);
    expect(worksheet.getCell("E10").alignment?.shrinkToFit).toBe(true);
    expect(worksheet.getCell("C11").value).toBe("Reservation Guest");
    expect(worksheet.getCell("F11").value).toBe(1930);
    expect(worksheet.getCell("J10").value).toBe(125);
    expect(worksheet.getCell("M10").value).toBe(500);
    expect(worksheet.getCell("N10").value).toBe(475);
    expect(worksheet.getCell("O10").value).toBe("GCASH / CARD / CHEQUE / QRPH");
    expect(worksheet.getCell("P10").alignment?.wrapText).toBe(true);
    expect(worksheet.getRow(10).height).toBeGreaterThanOrEqual(28);
    expect(worksheet.getCell("N11").value).toBe(700);
    expect(worksheet.getCell("O11").value).toBe("GCASH");
    expect(worksheet.getCell("P10").value).toBe("123");
    expect(worksheet.getCell("P11").value).toBe("4326");
    expect(worksheet.getCell("F24").value).toBe(2930);
    expect(worksheet.getCell("G24").value).toBe(0);
    expect(worksheet.getCell("H24").value).toBe(0);
    expect(worksheet.getCell("I24").value).toBe(0);
    expect(worksheet.getCell("J24").value).toBe(125);
    expect(worksheet.getCell("K24").value).toBe(0);
    expect(worksheet.getCell("L24").value).toBe(0);
    expect(worksheet.getCell("M24").value).toBe(500);
    expect(worksheet.getCell("N24").value).toBe(1175);
    expect(worksheet.getColumn(17).hidden).toBe(true);
    expect(worksheet.pageSetup.printArea).toBe("A1:P35");
    expect(worksheet.pageSetup.fitToWidth).toBe(1);
    expect(worksheet.pageSetup.fitToHeight).toBe(1);
    expect(worksheet.getCell("C34").value).toBe("ERNIE SAAVEDRA JR.");
    expect((worksheet as any).sheetProtection).toBeTruthy();
    expect((worksheet as any).sheetProtection.sheet).toBe(true);
  });

  it("does not render a separate incoming turnover block below the worksheet footer", async () => {
    const report: ShiftCashReport = {
      shift_log: {
        id: "shift-log-2",
        shift_id: "shift-1",
        date: "2026-04-12",
        status: "OPEN",
        shifts: {
          id: "shift-1",
          name: "Morning Shift",
          start_time: "06:00:00",
          end_time: "14:00:00",
          sort_order: 1,
          is_active: true,
        },
      },
      summary: {
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
      },
      activity_rows: [
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
          minimart_amount: 0,
          food_amount: 0,
          early_checkin_amount: 0,
          late_checkout_amount: 0,
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
      turnover_rows: [
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
          minimart_amount: 0,
          food_amount: 0,
          early_checkin_amount: 0,
          late_checkout_amount: 0,
          total_amount: 200,
          collectible_amount: 200,
          latest_activity_at: "2026-04-12T00:30:00.000Z",
          source_shift_log_id: "shift-log-1",
          source_shift_name: "Night Shift",
        },
      ],
      expense_summary: {
        cash_paid: 0,
        non_cash_paid: 0,
        total: 0,
        expense_count: 0,
      },
      export_template_version: 2,
      report_mode: "live",
    };

    const buffer = await generateShiftCashReportWorkbook(report);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.worksheets[0];

    expect(worksheet.getCell("A37").value).not.toBe("INCOMING TURNOVER");
    expect(worksheet.getCell("B10").value).toBe("105");
    expect(worksheet.getCell("F10").value).toBeNull();
    expect(worksheet.getCell("J10").value).toBe(200);
  });
});
