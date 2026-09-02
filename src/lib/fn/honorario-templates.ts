import type { FeeKind } from "@/lib/fn/types";

export type HonorarioTemplate = {
  id: string;
  name: string;
  description?: string;
  feeKind: FeeKind;
  monthlyModules?: number;
  monthlyAmount?: number;
  gananciasInMonthly: boolean;
};

const STORAGE_KEY_PREFIX = "cifra-honorario-templates-";

function storageKey(estudioId: string): string {
  return `${STORAGE_KEY_PREFIX}${estudioId}`;
}

export function listTemplates(estudioId: string): HonorarioTemplate[] {
  try {
    const raw = localStorage.getItem(storageKey(estudioId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTemplate(estudioId: string, template: HonorarioTemplate): void {
  const all = listTemplates(estudioId);
  const existing = all.findIndex((t) => t.id === template.id);
  if (existing >= 0) {
    all[existing] = template;
  } else {
    all.push(template);
  }
  localStorage.setItem(storageKey(estudioId), JSON.stringify(all));
}

export function deleteTemplate(estudioId: string, id: string): void {
  const all = listTemplates(estudioId).filter((t) => t.id !== id);
  localStorage.setItem(storageKey(estudioId), JSON.stringify(all));
}

export function createTemplateId(): string {
  return `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
