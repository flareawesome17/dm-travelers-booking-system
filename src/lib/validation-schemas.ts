/**
 * Centralized Zod validation schemas for all API endpoints.
 * Ensures strict input validation and prevents mass assignment attacks.
 */
import { z } from "zod";
import { BOOKING_EXTRA_TYPES } from "@/lib/bookingExtras";

// ─── Common Validators ────────────────────────────────────────────────────────

const positiveNumber = z.number().positive("Must be a positive number");
const nonNegativeNumber = z.number().min(0, "Cannot be negative");
const ymdDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");
const hhmmTime = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Must be HH:MM format");
const isoDateTime = z.string().datetime({ offset: true });
const safeString = z.string().trim().min(1, "Cannot be empty").max(500, "Too long");
const email = z.string().email("Invalid email address").transform((v) => v.toLowerCase().trim());

// ─── Room Schemas ──────────────────────────────────────────────────────────────

export const createRoomSchema = z.object({
  room_number: z.string().trim().min(1).max(20),
  room_type: z.string().trim().min(1).max(50),
  floor: z.number().int().min(0).max(100).optional().nullable(),
  capacity: z.number().int().min(1).max(50).optional().nullable(),
  max_occupancy: z.number().int().min(1).max(20).optional().nullable(),
  status: z.enum(["Available", "Occupied", "Maintenance", "Reserved", "Dirty", "In Cleaning"]).default("Available"),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false).optional(),
  
  rate_24h_enabled: z.boolean().optional(),
  rate_24h_price: nonNegativeNumber.optional().nullable(),
  rate_24h_early_checkin_fee: nonNegativeNumber.optional().nullable(),
  rate_24h_late_checkout_fee: nonNegativeNumber.optional().nullable(),
  
  rate_12h_enabled: z.boolean().optional(),
  rate_12h_price: nonNegativeNumber.optional().nullable(),
  rate_12h_late_checkout_fee: nonNegativeNumber.optional().nullable(),
  
  rate_5h_enabled: z.boolean().optional(),
  rate_5h_price: nonNegativeNumber.optional().nullable(),
  rate_5h_late_checkout_fee: nonNegativeNumber.optional().nullable(),
  
  rate_3h_enabled: z.boolean().optional(),
  rate_3h_price: nonNegativeNumber.optional().nullable(),
  rate_3h_late_checkout_fee: nonNegativeNumber.optional().nullable(),
  
  rate_plans: z.any().optional().nullable(),

  // LGU rate overrides (Feature 2)
  lgu_rate_enabled: z.boolean().optional(),
  lgu_rate_24h_price: nonNegativeNumber.optional().nullable(),
  lgu_rate_12h_price: nonNegativeNumber.optional().nullable(),
  lgu_rate_5h_price: nonNegativeNumber.optional().nullable(),
  lgu_rate_3h_price: nonNegativeNumber.optional().nullable(),

  description: z.string().max(1000).optional().nullable(),
  amenities: z.array(z.string().max(100)).max(30).optional().nullable(),
  image_url: z.string().url().max(500).optional().nullable(),
  image_urls: z.array(z.string().url().max(500)).max(10).optional().nullable(),
}).strict();

export const updateRoomSchema = createRoomSchema.partial();

// ─── Booking Schemas ───────────────────────────────────────────────────────────

export const createBookingSchema = z.object({
  guest_id: z.string().uuid().optional(),
  guest: z.object({
    full_name: safeString,
    email: z.string().email("Invalid email address").optional().nullable().or(z.literal("").transform(() => null)),
    phone_number: z.string().trim().max(30).optional().nullable(),
  }).optional(),
  room_id: z.string().uuid().optional(),
  room_type_requested: z.string().trim().min(1).max(50).default("Standard"),
  check_in_date: ymdDate,
  check_out_date: ymdDate,
  num_adults: z.number().int().min(1).max(20).default(1),
  num_children: z.number().int().min(0).max(20).default(0),
  total_amount: nonNegativeNumber,
  deposit_paid: nonNegativeNumber.default(0),
  balance_due: nonNegativeNumber.optional(),
  status: z.enum([
    "Pending Payment", "Confirmed", "Checked-In", "Checked-Out",
    "Cancelled", "No Show", "Pending Verification",
  ]).optional(),
  special_requests: z.string().max(1000).optional().nullable(),
  reference_number: z.string().max(30).optional(),
  rate_plan_kind: z.string().max(20).optional(),
  deposit_method: z.enum(["Cash", "GCash", "Card", "Stripe", "PayPal", "Cheque"]).optional().nullable(),
  deposit_reference_number: z.string().trim().max(100).optional().nullable(),
  // Feature 2 / 3 – LGU + Special Booking
  is_lgu_booking: z.boolean().optional(),
  is_special_booking: z.boolean().optional(),
  special_booking_label: z.string().trim().max(200).optional().nullable(),
  cheque_number: z.string().trim().max(100).optional().nullable(),
  // Discounts (Feature 7)
  discount_value: nonNegativeNumber.optional().default(0),
  discount_type: z.enum(["fixed", "percent"]).optional().default("fixed"),
  discount_amount: nonNegativeNumber.optional().default(0),
  discount_id: z.string().uuid().optional().nullable(),
  // Booking source (OTA tagging)
  booking_source: z.enum(["Walk-in", "Booking.com", "Online", "Phone", "Other"]).optional().default("Walk-in"),
  external_reference: z.string().trim().max(200).optional().nullable(),
  // Booking Extras from initial creation
  extras: z.array(z.object({
    extra_type: z.enum(BOOKING_EXTRA_TYPES),
    quantity: z.number().int().min(1).max(20),
    unit_price: nonNegativeNumber,
    days: z.number().int().min(1).max(365).optional().default(1),
    custom_label: z.string().trim().min(1).max(150).optional().nullable(),
  }).superRefine((data, ctx) => {
    if (data.extra_type === "Custom Charge" && !String(data.custom_label || "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["custom_label"],
        message: "Custom charge label is required",
      });
    }
  })).optional(),
}).strict().superRefine((data, ctx) => {
  if (
    Number(data.deposit_paid || 0) > 0 &&
    (data.deposit_method === "GCash" || data.deposit_method === "Card") &&
    !String(data.deposit_reference_number || "").trim()
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["deposit_reference_number"],
      message: "Reference number is required for GCash and card deposits",
    });
  }
});

// ─── Payment Schemas ───────────────────────────────────────────────────────────

export const createPaymentSchema = z.object({
  booking_id: z.string().uuid("Invalid booking ID"),
  amount: positiveNumber,
  method: z.enum(["Cash", "GCash", "Card", "Stripe", "PayPal", "QRPh", "Cheque"], {
    errorMap: () => ({ message: "Invalid payment method" }),
  }),
  type: z.enum(["Deposit", "Balance", "Restaurant", "Extension", "Extra", "Receivable"], {
    errorMap: () => ({ message: "Invalid payment type" }),
  }),
  transaction_id: z.string().max(100).optional(),
}).strict();

// ─── Expense Schemas ───────────────────────────────────────────────────────────

export const createExpenseSchema = z.object({
  description: safeString.max(500),
  amount: positiveNumber,
  category: z.string().trim().min(1).max(100),
  payment_method: z.enum(["Cash", "GCash", "Card", "Bank Transfer"]).optional(),
  date: ymdDate.optional(),
  notes: z.string().max(1000).optional().nullable(),
}).strict();

// ─── Settings Schema ──────────────────────────────────────────────────────────

export const updateSettingsSchema = z.record(
  z.string().min(1).max(100),
  z.string().max(5000)
).refine(
  (obj) => Object.keys(obj).length > 0 && Object.keys(obj).length <= 50,
  "Must provide between 1 and 50 settings"
);

export const updateShiftSchedulesSchema = z.array(z.object({
  id: z.string().uuid("Invalid shift id"),
  name: z.string().trim().min(1, "Shift name is required").max(50, "Shift name is too long"),
  start_time: hhmmTime,
  end_time: hhmmTime,
  sort_order: z.number().int().min(0).max(100),
  is_active: z.boolean(),
}).strict()).min(1, "At least one shift is required").max(10, "Too many shifts").superRefine((shifts, ctx) => {
  const ids = new Set<string>();
  const sortOrders = new Set<number>();

  shifts.forEach((shift, index) => {
    if (ids.has(shift.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, "id"], message: "Duplicate shift id" });
    }
    ids.add(shift.id);

    if (sortOrders.has(shift.sort_order)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, "sort_order"], message: "Sort order must be unique" });
    }
    sortOrders.add(shift.sort_order);

    if (shift.start_time === shift.end_time) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, "end_time"], message: "Start and end time cannot match" });
    }
  });

  if (!shifts.some((shift) => shift.is_active)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [], message: "At least one shift must remain active" });
  }
});

// ─── Admin User Schemas ────────────────────────────────────────────────────────

export const createAdminUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: email,
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  role_id: z.number().int().min(1).max(100).default(3),
  is_active: z.boolean().default(true),
}).strict();

// ─── Menu Item Schemas ─────────────────────────────────────────────────────────

export const createMenuItemSchema = z.object({
  name: safeString.max(200),
  description: z.string().max(1000).optional().nullable(),
  price: positiveNumber,
  staff_price: nonNegativeNumber.optional().nullable(),
  category_id: z.string().uuid().optional(),
  category: z.string().max(100).optional(),
  image_url: z.string().url().max(500).optional().nullable(),
  is_available: z.boolean().default(true),
  preparation_time: z.number().int().min(0).max(120).optional(),
  // Feature 5 – LGU markup
  lgu_markup_percentage: nonNegativeNumber.max(100).optional(),
  is_minimart: z.boolean().optional().default(false),
}).strict();

export const updateMenuItemSchema = createMenuItemSchema.partial();

// ─── Restaurant Order Schemas ──────────────────────────────────────────────────

export const createOrderSchema = z.object({
  customer_name: z.string().trim().max(200).optional(),
  items: z.array(z.object({
    menu_item_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(100),
    unit_price: nonNegativeNumber,
    notes: z.string().max(500).optional(),
  })).min(1, "At least one item is required"),
  order_source: z.enum(["Walk-in", "Room Service", "Online"]).default("Walk-in"),
  booking_id: z.string().uuid().optional().nullable(),
  room_id: z.string().uuid().optional().nullable(),
  total_amount: nonNegativeNumber.optional(),
  payment_method: z.enum(["Cash", "GCash", "Card", "Charge to Room"]).optional(),
  special_instructions: z.string().max(500).optional(),
  status: z.enum(["Pending", "Preparing", "Ready", "Served", "Paid", "Cancelled"]).default("Pending"),
  // Feature 5 – Restaurant LGU
  is_lgu_order: z.boolean().optional(),
}).strict();

export const updateRestaurantOrderSchema = z.object({
  status: z.enum(["Pending", "Preparing", "Served", "Charged to Room", "Paid", "Cancelled"]).optional(),
  payment_method: z.enum(["Cash", "GCash", "Card", "Charged to Room"]).optional(),
  payment_reference: z.string().trim().max(120).optional().nullable(),
}).strict().superRefine((data, ctx) => {
  if ((data.payment_method === "GCash" || data.payment_method === "Card") && !String(data.payment_reference || "").trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["payment_reference"],
      message: "Reference number is required for GCash and card payments",
    });
  }
});

// ─── Booking Extensions Schema (Feature 1) ─────────────────────────────────────

export const createExtensionSchema = z.object({
  duration_type: z.enum(["hours", "days"]),
  duration_value: z.number().int().min(1).max(30),
  additional_cost: nonNegativeNumber,
  new_checkout_date: z.string().min(1, "New checkout date required"),
}).strict();

export const transferBookingRoomSchema = z.object({
  target_room_id: z.string().uuid("Invalid target room ID"),
  reason: z.string().trim().max(500).optional().nullable(),
}).strict();

// ─── Booking Extras Schema (Feature 6) ──────────────────────────────────────────

const bookingExtraInputSchema = z.object({
  extra_type: z.enum(BOOKING_EXTRA_TYPES, {
    errorMap: () => ({ message: "Invalid extra type" }),
  }),
  quantity: z.number().int().min(1).max(20),
  unit_price: nonNegativeNumber,
  days: z.number().int().min(1).max(365).optional().default(1),
  custom_label: z.string().trim().min(1).max(150).optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.extra_type === "Custom Charge" && !String(data.custom_label || "").trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["custom_label"],
      message: "Custom charge label is required",
    });
  }
});

export const createBookingExtrasSchema = z.object({
  extras: z.array(bookingExtraInputSchema).min(1, "At least one extra item required"),
}).strict();

// ─── Receivable Payment Schema (Feature 4) ──────────────────────────────────────

export const createReceivablePaymentSchema = z.object({
  amount: positiveNumber,
  method: z.enum(["Cash", "GCash", "Card", "Bank Transfer", "Cheque"]),
  notes: z.string().max(500).optional().nullable(),
  cheque_number: z.string().max(100).optional().nullable(),
}).strict();

// ─── Login Schemas ─────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: email,
  password: z.string().min(1, "Password is required").max(128),
}).strict();

export const verifyOtpSchema = z.object({
  otp_id: z.string().uuid("Invalid OTP request"),
  otp: z.string().trim().length(6, "OTP must be 6 characters").transform((v) => v.toUpperCase()),
  email: email,
}).strict();

export const createPublicBookingPaymongoIntentSchema = z.object({
  booking_id: z.string().uuid("Invalid booking ID"),
  email: email,
}).strict();

export const cancelPublicBookingPaymentSchema = z.object({
  booking_id: z.string().uuid("Invalid booking ID"),
  email: email,
}).strict();

export const createTreasuryDestinationSchema = z.object({
  label: z.string().trim().min(2).max(120),
  provider: z.enum(["instapay", "pesonet"]),
  institution_name: z.string().trim().min(2).max(120),
  institution_code: z.string().trim().min(2).max(60),
  account_name: z.string().trim().min(2).max(120),
  account_number: z.string().trim().min(4).max(60),
}).strict();

export const createTreasuryWithdrawalSchema = z.object({
  amount: positiveNumber,
  destination_id: z.string().uuid("Invalid destination ID"),
  request_note: z.string().trim().max(500).optional().nullable(),
}).strict();

export const approveTreasuryWithdrawalSchema = z.object({
  approval_note: z.string().trim().max(500).optional().nullable(),
}).strict();

export const completeTreasuryWithdrawalSchema = z.object({
  external_reference: z.string().trim().min(3).max(120),
  completion_note: z.string().trim().max(500).optional().nullable(),
}).strict();

export const createCashBankAccountSchema = z.object({
  bank_name: z.string().trim().min(2).max(120),
  label: z.string().trim().min(2).max(120).optional(),
  account_name: z.string().trim().max(120).optional().nullable(),
  account_number: z.string().trim().max(60).optional().nullable(),
  branch_label: z.string().trim().max(120).optional().nullable(),
}).strict();

export const updateCashBankAccountSchema = z.object({
  label: z.string().trim().min(2).max(120).optional(),
  bank_name: z.string().trim().min(2).max(120).optional(),
  account_name: z.string().trim().max(120).optional().nullable(),
  account_number: z.string().trim().max(60).optional().nullable(),
  branch_label: z.string().trim().max(120).optional().nullable(),
  is_active: z.boolean().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, "At least one bank account field is required");

export const createCashProofPayloadSchema = z.object({
  bucket: z.literal("cash-deposit-proofs"),
  path: z.string().trim().min(3).max(500),
  filename: z.string().trim().min(1).max(255),
  content_type: z.string().trim().min(3).max(120),
  size: z.number().int().positive().max(8 * 1024 * 1024),
}).strict();

export const createCashDepositRequestSchema = z.object({
  amount: positiveNumber,
  bank_account_id: z.string().uuid("Invalid bank account ID"),
  deposit_reference: z.string().trim().min(3).max(120),
  deposited_at: isoDateTime,
  proof: createCashProofPayloadSchema,
  note: z.string().trim().max(500).optional().nullable(),
}).strict();

export const approveCashDepositSchema = z.object({
  approval_note: z.string().trim().max(500).optional().nullable(),
}).strict();

export const rejectCashDepositSchema = z.object({
  rejection_note: z.string().trim().min(3).max(500),
}).strict();

export const cancelCashDepositSchema = z.object({
  cancellation_note: z.string().trim().max(500).optional().nullable(),
}).strict();

export const reverseCashDepositSchema = z.object({
  reversal_reason: z.string().trim().min(3).max(500),
}).strict();

export const createCashOpeningAdjustmentSchema = z.object({
  amount: z.number().refine((value) => Number.isFinite(value) && value !== 0, "Amount must be a non-zero number"),
  note: z.string().trim().max(500).optional().nullable(),
  effective_at: isoDateTime.optional(),
}).strict();

// ─── Discount Schemas (Global Module) ──────────────────────────────────────────

const discountBaseSchema = z.object({
  name: safeString.max(100),
  description: z.string().max(500).optional().nullable(),
  type: z.enum(["percent", "fixed"]),
  value: positiveNumber,
  start_date: z.string(),
  end_date: z.string(),
  is_active: z.boolean().default(true),
  apply_to_rooms: z.boolean().default(false),
  apply_to_restaurant: z.boolean().default(false),
}).strict();

const discountRefinement = (data: any, ctx: z.RefinementCtx) => {
  if (data.start_date && data.end_date && new Date(data.start_date) >= new Date(data.end_date)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["end_date"],
      message: "End date must be after start date",
    });
  }
  if (data.type === "percent" && data.value > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["value"],
      message: "Percentage discount cannot exceed 100%",
    });
  }
};

export const createDiscountSchema = discountBaseSchema.superRefine(discountRefinement);
export const updateDiscountSchema = discountBaseSchema.partial().superRefine(discountRefinement);
