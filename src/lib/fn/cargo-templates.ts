// Plantillas de cargo puntual — las usa el owner al emitir un honorario
// extraordinario en /extraordinarios. Persistidas en localStorage por
// estudio, igual que las plantillas de honorario del cliente.
//
// Diferencia con honorario-templates:
//   - honorario-templates = recurrente, define la cuota mensual automática
//     del cliente (módulos / monto fijo / variable + Ganancias incluida).
//   - cargo-templates     = puntual, un solo cargo que se emite una vez
//     (ej: "Liquidación IIBB", "Certificación", "Trámite AFIP").

export type CargoTemplateCategory = "honorarios" | "tramites" | "certificaciones";

export const CARGO_TEMPLATE_CATEGORIES: { value: CargoTemplateCategory; label: string }[] = [
  { value: "honorarios", label: "Honorarios" },
  { value: "tramites", label: "Trámites" },
  { value: "certificaciones", label: "Certificaciones" },
];

export type CargoTemplate = {
  id: string;
  name: string;
  concept: string;
  suggestedAmount: number;
  category: CargoTemplateCategory;
  active: boolean;
};

const STORAGE_KEY_PREFIX = "cifra-cargo-templates-";

function storageKey(estudioId: string): string {
  return `${STORAGE_KEY_PREFIX}${estudioId}`;
}

export function listCargoTemplates(estudioId: string): CargoTemplate[] {
  try {
    const raw = localStorage.getItem(storageKey(estudioId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CargoTemplate[]) : [];
  } catch {
    return [];
  }
}

export function saveCargoTemplate(estudioId: string, template: CargoTemplate): void {
  const all = listCargoTemplates(estudioId);
  const idx = all.findIndex((t) => t.id === template.id);
  if (idx >= 0) all[idx] = template;
  else all.push(template);
  localStorage.setItem(storageKey(estudioId), JSON.stringify(all));
}

export function deleteCargoTemplate(estudioId: string, id: string): void {
  const all = listCargoTemplates(estudioId).filter((t) => t.id !== id);
  localStorage.setItem(storageKey(estudioId), JSON.stringify(all));
}

export function createCargoTemplateId(): string {
  return `ctpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
