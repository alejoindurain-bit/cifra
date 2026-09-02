export const APP_NAME = "Cifra";
export const APP_TAGLINE = "Honorarios del estudio";

export const ORIGINAL_ESTUDIO_ID = "original";
export const MUESTRA_ESTUDIO_ID = "muestra";
export const BELTRAN_ESTUDIO_ID = "beltran";

export const COMPANY_TYPES = [
  "S.A.",
  "S.R.L.",
  "S.A.S.",
  "Unipersonal",
  "Cooperativa",
  "Otro",
] as const;

export const IVA_CONDITIONS = [
  "Responsable Inscripto",
  "Monotributo",
  "Exento",
  "Consumidor Final",
  "No Responsable",
] as const;

export const MONOTRIBUTO_CATEGORIES = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
] as const;

export const DOCUMENTATION_OPTIONS = ["Recibo", "Factura", "Cobra Mónica"] as const;

export const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Cheque", "Dólares"] as const;

export const TRANSFER_ACCOUNTS = [
  "Cuenta DNI",
  "Banco Provincia",
  "Banco Galicia",
  "Mercado Pago",
] as const;

export const PAYMENT_METHOD_KINDS = [
  "transferencia",
  "mercado_pago",
  "efectivo",
  "cheque",
  "dolares",
] as const;

export const VENCIMIENTO_KINDS = ["iva", "iibb", "ganancias", "ddjj", "otro"] as const;
export const VENCIMIENTO_STATUSES = ["pendiente", "cumplido"] as const;

export const VENCIMIENTO_KIND_LABEL: Record<(typeof VENCIMIENTO_KINDS)[number], string> = {
  iva: "IVA",
  iibb: "IIBB",
  ganancias: "Ganancias",
  ddjj: "DDJJ",
  otro: "Otro",
};

export const VENCIMIENTO_STATUS_LABEL: Record<(typeof VENCIMIENTO_STATUSES)[number], string> = {
  pendiente: "Pendiente",
  cumplido: "Cumplido",
};

export const MODULE_SOURCE_URL =
  "https://www.cpba.com.ar/2016/item/151-valor-del-modulo";

export const DOLLAR_API_URL = "https://dolarapi.com/v1/dolares/oficial";

/** Fallback if CPCEBA is unreachable and no snapshot exists (Res. CD 4087, 01/08/2026). */
export const MODULE_FALLBACK_VALUE = 3693;

export type Role = "owner" | "employee";

export const DEMO_ACCOUNTS = [
  {
    estudioId: MUESTRA_ESTUDIO_ID,
    email: "muestra@cifra.demo",
    password: "muestra12",
    name: "Dueño Muestra",
    label: "Muestra",
    hint: "Todo encendido, datos de juguete",
  },
  {
    estudioId: BELTRAN_ESTUDIO_ID,
    email: "lapaz@cifra.demo",
    password: "lapaz12",
    name: "Dueño La Paz",
    label: "La Paz",
    hint: "CABA · sin módulo PBA/CPCEBA",
  },
] as const;

export const DEMO_LOGIN_HIDE_KEY = "cifra-hide-demo-logins";

/** Set on sign-out so /login does not bounce back into the leftover session. */
export const SIGNED_OUT_KEY = "cifra-signed-out";
