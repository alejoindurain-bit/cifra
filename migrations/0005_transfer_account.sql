-- Destination account for Transferencia payments (estudio cobranzas).
alter table payment_details
  add column if not exists transfer_account text;
