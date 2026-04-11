-- 039_shift_cash_reports.sql
-- Per-shift cash-on-hand report snapshots and turnover tracking

CREATE TABLE IF NOT EXISTS public.shift_cash_reports (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_log_id             UUID NOT NULL UNIQUE REFERENCES public.shift_logs(id) ON DELETE CASCADE,
  shift_id                 UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  report_date              DATE NOT NULL,
  total_cash               NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_gcash              NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_card               NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cheque             NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_qrph               NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount             NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cash_expenses      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_non_cash_expenses  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_expenses           NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_on_hand             NUMERIC(12,2) NOT NULL DEFAULT 0,
  activity_row_count       INT NOT NULL DEFAULT 0,
  turnover_row_count       INT NOT NULL DEFAULT 0,
  export_template_version  INT NOT NULL DEFAULT 1,
  generated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_cash_reports_shift_date
ON public.shift_cash_reports(shift_id, report_date DESC);

CREATE TABLE IF NOT EXISTS public.shift_cash_report_rows (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id          UUID NOT NULL REFERENCES public.shift_cash_reports(id) ON DELETE CASCADE,
  shift_log_id       UUID NOT NULL REFERENCES public.shift_logs(id) ON DELETE CASCADE,
  booking_id         UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  row_order          INT NOT NULL DEFAULT 0,
  room_no            TEXT,
  guest_name         TEXT NOT NULL DEFAULT '',
  check_in_at        TIMESTAMPTZ,
  check_out_at       TIMESTAMPTZ,
  room_rate          NUMERIC(12,2) NOT NULL DEFAULT 0,
  extra_bed_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  extra_person_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  linens_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  charge_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  minimart_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  food_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  gcash_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  card_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  cheque_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  qrph_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_count      INT NOT NULL DEFAULT 0,
  reference_numbers  JSONB NOT NULL DEFAULT '[]'::jsonb,
  latest_activity_at TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_cash_report_rows_report_booking
ON public.shift_cash_report_rows(report_id, booking_id)
WHERE booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shift_cash_report_rows_report_order
ON public.shift_cash_report_rows(report_id, row_order);

CREATE TABLE IF NOT EXISTS public.shift_cash_report_turnovers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_report_id     UUID NOT NULL REFERENCES public.shift_cash_reports(id) ON DELETE CASCADE,
  source_shift_log_id  UUID NOT NULL REFERENCES public.shift_logs(id) ON DELETE CASCADE,
  target_shift_id      UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  target_date          DATE NOT NULL,
  booking_id           UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  room_no              TEXT,
  guest_name           TEXT NOT NULL DEFAULT '',
  check_in_at          TIMESTAMPTZ,
  check_out_at         TIMESTAMPTZ,
  room_rate            NUMERIC(12,2) NOT NULL DEFAULT 0,
  extra_bed_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  extra_person_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  linens_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  charge_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  minimart_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  food_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  latest_activity_at   TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_cash_report_turnovers_target
ON public.shift_cash_report_turnovers(target_shift_id, target_date, created_at);

CREATE INDEX IF NOT EXISTS idx_shift_cash_report_turnovers_source
ON public.shift_cash_report_turnovers(source_shift_log_id);

ALTER TABLE public.shift_cash_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_cash_report_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_cash_report_turnovers ENABLE ROW LEVEL SECURITY;
