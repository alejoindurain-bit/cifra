-- Estudio metadata: per-estudio display data for the receipt header and future
-- surfaces. One row per estudio (1:1). Everything nullable so a freshly created
-- estudio is still usable with no display data.

create table if not exists estudio_metadata (
  estudio_id          text primary key references estudios (id) on delete cascade,
  logo_path           text,
  domicilio_calle     text,
  domicilio_numero    text,
  domicilio_piso      text,
  domicilio_depto     text,
  domicilio_localidad text,
  domicilio_provincia text,
  domicilio_cp        text,
  cuit                text,
  telefono            text,
  email               text,
  web                 text
);
