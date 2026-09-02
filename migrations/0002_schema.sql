-- Cifra — estudio honorarios schema
-- Firm-shared data. Access is gated by staff.role in server functions.

create table if not exists staff (
  user_id    text primary key,
  role       text not null check (role in ('owner', 'employee')),
  name       text,
  email      text,
  created_at timestamptz not null default now()
);

create table if not exists clients (
  id                    serial primary key,
  name                  text not null,
  contact               text,
  cuit                  text,
  company_type          text,
  iva_condition         text,
  fixed_fee             boolean not null default false,
  monthly_modules       numeric(12, 2) not null default 0,
  monthly_amount        numeric(14, 2) not null default 0,
  ganancias_in_monthly  boolean not null default false,
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists clients_name_idx on clients (lower(name));
create index if not exists clients_cuit_idx on clients (cuit);

create table if not exists transactions (
  id          serial primary key,
  client_id   integer not null references clients (id),
  date        date not null,
  concept     text not null,
  type        text not null check (type in ('charge', 'payment')),
  amount      numeric(14, 2) not null,
  created_by  text,
  created_at  timestamptz not null default now()
);

create index if not exists transactions_client_idx on transactions (client_id);
create index if not exists transactions_date_idx on transactions (date desc);
create index if not exists transactions_type_idx on transactions (type);

create table if not exists payment_details (
  id                serial primary key,
  transaction_id    integer not null references transactions (id) on delete cascade,
  documentation     text not null default '[]',
  payment_method    text not null,
  dollar_rate       numeric(12, 4),
  observations      text,
  transfer_account  text
);

create unique index if not exists payment_details_tx_idx on payment_details (transaction_id);

create table if not exists module_values (
  id          serial primary key,
  value       numeric(12, 2) not null,
  vigencia    text,
  fetched_at  timestamptz not null default now()
);

create table if not exists billing_runs (
  id             serial primary key,
  year           integer not null,
  month          integer not null,
  module_value   numeric(12, 2) not null,
  clients_billed integer not null default 0,
  run_at         timestamptz not null default now(),
  unique (year, month)
);
