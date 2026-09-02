-- Multi-estudio: tenant isolation. Existing rows become the original estudio.

create table if not exists estudios (
  id                          text primary key,
  slug                        text not null unique,
  display_name                text not null,
  accent_color                text,
  mod_caja                    boolean not null default true,
  mod_cuenta_corriente        boolean not null default true,
  mod_honorarios              boolean not null default true,
  mod_cpceba                  boolean not null default true,
  mod_cobros_fijos            boolean not null default true,
  mod_honorarios_mensuales    boolean not null default true,
  mod_honorarios_extraordinarios boolean not null default true,
  mod_pba_iibb                boolean not null default true,
  dash_cobrado_mes            boolean not null default true,
  dash_pendiente              boolean not null default true,
  dash_vencimientos           boolean not null default false,
  dash_grafico                boolean not null default true,
  dash_iibb_pba               boolean not null default true,
  created_at                  timestamptz not null default now()
);

insert into estudios (
  id, slug, display_name,
  mod_caja, mod_cuenta_corriente, mod_honorarios, mod_cpceba,
  mod_cobros_fijos, mod_honorarios_mensuales, mod_honorarios_extraordinarios, mod_pba_iibb,
  dash_cobrado_mes, dash_pendiente, dash_vencimientos, dash_grafico, dash_iibb_pba
) values
  (
    'original', 'original', 'Estudio',
    true, true, true, true,
    true, true, true, true,
    true, true, false, true, true
  ),
  (
    'muestra', 'muestra', 'Muestra',
    true, true, true, true,
    true, true, true, true,
    true, true, false, true, true
  ),
  (
    'beltran', 'beltran', 'Estudio Contable Beltrán',
    true, true, true, false,
    true, true, true, false,
    true, true, false, true, false
  )
on conflict (id) do nothing;

create table if not exists payment_methods (
  id          serial primary key,
  estudio_id  text not null references estudios (id),
  name        text not null,
  kind        text not null check (kind in ('transferencia', 'mercado_pago', 'efectivo', 'cheque', 'dolares')),
  bank        text,
  cbu_alias   text,
  active      boolean not null default true,
  sort_order  integer not null default 0
);

create index if not exists payment_methods_estudio_idx on payment_methods (estudio_id);

alter table staff add column if not exists estudio_id text;
update staff set estudio_id = 'original' where estudio_id is null;
alter table staff alter column estudio_id set default 'original';

alter table clients add column if not exists estudio_id text;
alter table clients add column if not exists email text;
alter table clients add column if not exists phone text;
alter table clients add column if not exists notes text;
alter table clients add column if not exists monotributo_category text;
update clients set estudio_id = 'original' where estudio_id is null;
alter table clients alter column estudio_id set default 'original';

alter table transactions add column if not exists estudio_id text;
update transactions t
  set estudio_id = c.estudio_id
  from clients c
  where t.client_id = c.id and t.estudio_id is null;
update transactions set estudio_id = 'original' where estudio_id is null;
alter table transactions alter column estudio_id set default 'original';

alter table payment_details add column if not exists estudio_id text;
update payment_details p
  set estudio_id = t.estudio_id
  from transactions t
  where p.transaction_id = t.id and p.estudio_id is null;
update payment_details set estudio_id = 'original' where estudio_id is null;

alter table module_values add column if not exists estudio_id text;
update module_values set estudio_id = 'original' where estudio_id is null;
alter table module_values alter column estudio_id set default 'original';

alter table billing_runs add column if not exists estudio_id text;
update billing_runs set estudio_id = 'original' where estudio_id is null;
alter table billing_runs alter column estudio_id set default 'original';

alter table billing_runs drop constraint if exists billing_runs_year_month_key;
create unique index if not exists billing_runs_estudio_period_idx
  on billing_runs (estudio_id, year, month);

create index if not exists staff_estudio_idx on staff (estudio_id);
create index if not exists clients_estudio_idx on clients (estudio_id);
create index if not exists transactions_estudio_idx on transactions (estudio_id);
create index if not exists module_values_estudio_idx on module_values (estudio_id);
