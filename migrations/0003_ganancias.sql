-- Whether Ganancias is bundled into the monthly honorario (÷12)
-- or charged later as an extraordinario at DDJJ time.
-- Default false = cobra en la DDJJ, so it stays visible as pending.

alter table clients
  add column if not exists ganancias_in_monthly boolean not null default false;
