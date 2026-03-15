CREATE TABLE IF NOT EXISTS public.daily_ledgers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  date date NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  total_income numeric(12,2) NOT NULL DEFAULT 0,
  total_expense numeric(12,2) NOT NULL DEFAULT 0,
  net_total numeric(12,2) NOT NULL DEFAULT 0,
  closed_at timestamptz,
  closed_by_admin_id uuid REFERENCES public.admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS daily_ledgers_date_idx ON public.daily_ledgers(date);

CREATE TABLE IF NOT EXISTS public.ledger_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ledger_id uuid NOT NULL REFERENCES public.daily_ledgers(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category text NOT NULL,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  source_table text,
  source_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_admin_id uuid REFERENCES public.admin_users(id)
);

CREATE INDEX IF NOT EXISTS ledger_transactions_ledger_id_idx ON public.ledger_transactions(ledger_id);
CREATE INDEX IF NOT EXISTS ledger_transactions_type_idx ON public.ledger_transactions(type);
