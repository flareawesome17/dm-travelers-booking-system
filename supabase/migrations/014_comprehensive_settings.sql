-- 014_comprehensive_settings.sql
-- Add more comprehensive hotel settings

INSERT INTO public.settings (key, value, description) VALUES
  ('hotel_address', 'Looc Proper, Plaridel, Misamis Occidental', 'Full physical address'),
  ('hotel_phone', '+63 951 868 3018', 'Primary contact number'),
  ('hotel_email', 'contact@dmtravelersinn.com', 'Primary contact email'),
  ('hotel_website', 'https://dmtravelersinn.com', 'Hotel website URL'),
  ('check_in_time', '14:00', 'Standard check-in time'),
  ('check_out_time', '12:00', 'Standard check-out time'),
  ('tax_rate', '12', 'VAT or sales tax percentage'),
  ('service_charge', '0', 'Restaurant service charge percentage'),
  ('late_checkout_grace_period', '30', 'Grace period in minutes before charging late fee'),
  ('facebook_url', '', 'Facebook page URL'),
  ('instagram_url', '', 'Instagram profile URL')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;
