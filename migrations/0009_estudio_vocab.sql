-- Estudio vocab: configurable payment methods, transfer accounts,
-- documentation options, company types, IVA conditions, monotributo categories.
-- Per-estudio overrides of the built-in lists in src/lib/constants.ts.

create table if not exists estudio_vocab (
  estudio_id   text not null references estudios (id) on delete cascade,
  kind         text not null check (kind in (
    'payment_method', 'transfer_account', 'documentation',
    'company_type', 'iva_condition', 'monotributo_category'
  )),
  value        text not null,
  kind_label   text,
  active       boolean not null default true,
  sort_order   integer not null default 0,
  primary key (estudio_id, kind, value)
);

create index if not exists estudio_vocab_estudio_idx on estudio_vocab (estudio_id, kind);