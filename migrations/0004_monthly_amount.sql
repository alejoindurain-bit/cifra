-- Fixed monthly honorario in ARS (not CPCEBA modules).
-- fixed_fee remains true for any recurring monthly fee.
-- monthly_amount > 0 and monthly_modules = 0 → peso fijo.
-- monthly_modules > 0 and monthly_amount = 0 → módulos.

alter table clients
  add column if not exists monthly_amount numeric(14, 2) not null default 0;
