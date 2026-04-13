-- Direct cash deposit recording for the initial simplified workflow.
-- Keeps approval/reversal tables and functions available for future maker-checker rollout.

CREATE OR REPLACE FUNCTION public.record_cash_deposit_request(
  p_amount NUMERIC,
  p_deposit_reference TEXT,
  p_deposited_at TIMESTAMPTZ,
  p_bank_account_id UUID,
  p_bank_account_label TEXT,
  p_bank_name TEXT,
  p_account_name TEXT,
  p_account_number_masked TEXT,
  p_branch_label TEXT,
  p_proof_bucket TEXT,
  p_proof_path TEXT,
  p_proof_filename TEXT,
  p_proof_content_type TEXT,
  p_proof_size_bytes INT,
  p_note TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  available_before NUMERIC(12,2);
  deposit_id UUID;
  ledger_entry_id UUID;
  now_ts TIMESTAMPTZ := now();
BEGIN
  available_before := public.compute_available_cash_balance();

  IF available_before < p_amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'insufficient_cash',
      'error_message', 'Recorded deposit exceeds available cash. Available: ' || to_char(available_before, 'FM9999999990.00') || '.'
    );
  END IF;

  INSERT INTO public.cash_deposit_requests (
    amount,
    deposit_reference,
    deposited_at,
    bank_account_id,
    bank_account_label,
    bank_name,
    account_name,
    account_number_masked,
    branch_label,
    proof_bucket,
    proof_path,
    proof_filename,
    proof_content_type,
    proof_size_bytes,
    note,
    status,
    requested_by_admin_id,
    approved_by_admin_id,
    requested_at,
    approved_at,
    created_at,
    updated_at
  )
  VALUES (
    p_amount,
    p_deposit_reference,
    p_deposited_at,
    p_bank_account_id,
    p_bank_account_label,
    p_bank_name,
    p_account_name,
    p_account_number_masked,
    p_branch_label,
    p_proof_bucket,
    p_proof_path,
    p_proof_filename,
    p_proof_content_type,
    p_proof_size_bytes,
    p_note,
    'approved',
    p_admin_id,
    p_admin_id,
    now_ts,
    now_ts,
    now_ts,
    now_ts
  )
  RETURNING id INTO deposit_id;

  INSERT INTO public.cash_ledger_entries (
    direction,
    entry_type,
    amount,
    currency,
    effective_at,
    deposit_request_id,
    description,
    note,
    performed_by_admin_id,
    meta,
    created_at
  )
  VALUES (
    'debit',
    'bank_deposit',
    p_amount,
    'PHP',
    p_deposited_at,
    deposit_id,
    format('Bank deposit to %s', p_bank_account_label),
    p_note,
    p_admin_id,
    jsonb_build_object(
      'deposit_reference', p_deposit_reference,
      'bank_account_label', p_bank_account_label,
      'bank_name', p_bank_name,
      'account_name', p_account_name,
      'account_number_masked', p_account_number_masked,
      'branch_label', p_branch_label
    ),
    now_ts
  )
  RETURNING id INTO ledger_entry_id;

  RETURN jsonb_build_object(
    'ok', true,
    'deposit_id', deposit_id,
    'ledger_entry_id', ledger_entry_id,
    'available_cash_after', ROUND(available_before - p_amount, 2)
  );
END;
$$;
