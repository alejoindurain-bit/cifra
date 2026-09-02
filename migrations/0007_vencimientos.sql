-- Vencimientos del estudio (IVA, IIBB, Ganancias, DDJJ, otro).
-- Alimentan el widget "Próximos vencimientos" del tablero.

alter table estudios
  add column if not exists mod_vencimientos boolean not null default true;

-- The widget existed as a flag with no data; turn it on so loaded items show.
update estudios set dash_vencimientos = true where dash_vencimientos is distinct from true;

create table if not exists vencimientos (
  id          serial primary key,
  estudio_id  text not null references estudios (id),
  title       text not null,
  due_date    date not null,
  kind        text not null check (kind in ('iva', 'iibb', 'ganancias', 'ddjj', 'otro')),
  client_id   integer references clients (id) on delete set null,
  status      text not null default 'pendiente' check (status in ('pendiente', 'cumplido')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists vencimientos_estudio_idx on vencimientos (estudio_id, due_date);
create index if not exists vencimientos_status_idx on vencimientos (estudio_id, status);
