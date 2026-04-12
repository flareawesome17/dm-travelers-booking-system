import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  generateAccountsReceivableWorkbook,
  type AccountsReceivableWorkbookInput,
} from "./accountsReceivableReports";

describe("generateAccountsReceivableWorkbook", () => {
  it("renders one booking support IR with additionals-only particulars and simple payment statuses", async () => {
    const input: AccountsReceivableWorkbookInput = {
      report: {
        shift_log: {
          id: "shift-log-1",
          shift_id: "shift-1",
          date: "2026-04-12",
          status: "OPEN",
          shifts: {
            id: "shift-1",
            name: "Night Shift",
            start_time: "22:00:00",
            end_time: "06:00:00",
            sort_order: 3,
            is_active: true,
          },
        },
        report_mode: "live",
      },
      reportRow: {
        booking_id: "booking-1",
        room_no: "105",
        guest_name: "Lucky Webon",
        scheduled_check_in_at: null,
        scheduled_check_out_at: null,
        remaining_balance_due: 350,
        check_in_at: "2026-04-11T14:00:00.000Z",
        check_out_at: null,
        room_rate: 300,
        extra_bed_amount: 100,
        extra_person_amount: 0,
        linens_amount: 0,
        charge_amount: 80,
        minimart_amount: 70,
        food_amount: 50,
        early_checkin_amount: 0,
        late_checkout_amount: 0,
        collectible_amount: 350,
        total_amount: 350,
        latest_activity_at: "2026-04-12T00:30:00.000Z",
        source_shift_log_id: "shift-log-0",
        source_shift_name: "Evening Shift",
      },
      booking: {
        id: "booking-1",
        reference_number: "REF-1001",
        balance_due: 350,
        actual_check_in_at: "2026-04-11T14:00:00.000Z",
        actual_check_out_at: null,
        reserved_checkin_datetime: "2026-04-11T14:00:00.000Z",
        reserved_checkout_datetime: "2026-04-12T12:00:00.000Z",
        guests: { full_name: "Lucky Webon" },
        rooms: { room_number: "105" },
        booking_extras: [
          {
            id: "extra-1",
            extra_type: "Extra Bed",
            quantity: 1,
            unit_price: 100,
            total_price: 100,
          },
          {
            id: "extra-2",
            extra_type: "Custom Charge",
            custom_label: "Broken glass",
            quantity: 1,
            unit_price: 80,
            total_price: 80,
          },
        ],
        restaurant_orders: [
          {
            id: "order-1",
            status: "Charged to Room",
            restaurant_order_items: [
              {
                id: "item-1",
                name: "Hotsilog",
                line_total: 50,
                is_minimart: false,
              },
              {
                id: "item-2",
                name: "Bottled Water",
                line_total: 70,
                is_minimart: true,
              },
            ],
          },
        ],
      },
      preparedByName: "Ella Joy",
      generatedAt: new Date("2026-04-12T08:15:00.000Z"),
    };

    const buffer = await generateAccountsReceivableWorkbook(input);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.worksheets[0];

    expect(worksheet.name).toContain("RM105");
    expect(worksheet.getCell("B2").value).toBe("105");
    expect(worksheet.getCell("E2").value).toBe("Lucky Webon");
    expect(worksheet.getCell("A6").value).toBe("Extra Bed");
    expect(worksheet.getCell("C6").value).toBe(100);
    expect(worksheet.getCell("D6").value).toBe("Unpaid");
    expect(worksheet.getCell("A7").value).toBe("Broken glass");
    expect(worksheet.getCell("C7").value).toBe(80);
    expect(worksheet.getCell("D7").value).toBe("Unpaid");
    expect(worksheet.getCell("A8").value).toBe("Hotsilog");
    expect(worksheet.getCell("C8").value).toBe(50);
    expect(worksheet.getCell("D8").value).toBe("Unpaid");
    expect(worksheet.getCell("A9").value).toBe("Bottled Water");
    expect(worksheet.getCell("C9").value).toBe(70);
    expect(worksheet.getCell("D9").value).toBe("Unpaid");
    expect(worksheet.getCell("A10").value).toBeNull();
    expect((worksheet.getCell("C16").value as { result?: number }).result).toBe(300);
    expect(String(worksheet.getCell("D17").value)).toContain("Ella Joy");
    expect((worksheet as any).sheetProtection).toBeTruthy();
    expect((worksheet as any).sheetProtection.sheet).toBe(true);
  });
});
