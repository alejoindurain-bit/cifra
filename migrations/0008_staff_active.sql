-- Equipo: an owner can deactivate a person without deleting the user.
alter table staff add column if not exists active boolean not null default true;
