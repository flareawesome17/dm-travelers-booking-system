import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { generateShiftCashReportWorkbook, type ShiftCashReport } from "./shiftCashReports";

describe("generateShiftCashReportWorkbook", () => {
  it("adds payment-column borders, compacts date cells, uppercases the prepared-by name, and protects the worksheet", async () => {
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
          check_in_at: "2026-04-11T06:10:00.000Z",
          check_out_at: null,
          room_rate: 1000,
          extra_bed_amount: 0,
          extra_person_amount: 0,
          linens_amount: 0,
          charge_amount: 0,
          minimart_amount: 0,
          food_amount: 0,
          early_checkin_amount: 0,
          late_checkout_amount: 0,
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
      ],
      turnover_rows: [],
      expense_summary: {
        cash_paid: 50,
        non_cash_paid: 0,
        total: 50,
        expense_count: 1,
      },
      export_template_version: 1,
      report_mode: "live",
    };

    const buffer = await generateShiftCashReportWorkbook(report, {
      preparedByName: "Ernie Saavedra Jr.",
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    expect(worksheet.getCell("R10").border.left?.style).toBe("thin");
    expect(worksheet.getCell("R10").border.right?.style).toBe("thin");
    expect(worksheet.getCell("S10").border.left?.style).toBe("thin");
    expect(worksheet.getCell("S10").border.right?.style).toBe("thin");
    expect(worksheet.getCell("T10").border.right?.style).toBe("medium");
    expect(worksheet.getCell("T24").border.right?.style).toBe("medium");
    expect(worksheet.getCell("D10").font?.size).toBe(9);
    expect(worksheet.getCell("D10").alignment?.shrinkToFit).toBe(true);
    expect(worksheet.getCell("E10").font?.size).toBe(9);
    expect(worksheet.getCell("E10").alignment?.shrinkToFit).toBe(true);
    expect(worksheet.getCell("C34").value).toBe("ERNIE SAAVEDRA JR.");
    expect((worksheet as any).sheetProtection).toBeTruthy();
    expect((worksheet as any).sheetProtection.sheet).toBe(true);
  });
});
