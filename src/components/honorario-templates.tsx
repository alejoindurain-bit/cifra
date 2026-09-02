import { useState, useEffect } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listTemplates,
  saveTemplate,
  deleteTemplate,
  createTemplateId,
  type HonorarioTemplate,
} from "@/lib/fn/honorario-templates";
import type { FeeKind } from "@/lib/fn/types";
import { useMoneyDisplay } from "@/lib/privacy";

interface TemplateEditorProps {
  estudioId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function TemplatesManager({ estudioId, open, onOpenChange }: TemplateEditorProps) {
  const { formatARS } = useMoneyDisplay();
  const [templates, setTemplates] = useState<HonorarioTemplate[]>([]);
  const [editing, setEditing] = useState<HonorarioTemplate | "new" | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    feeKind: "amount" as FeeKind,
    monthlyModules: 1,
    monthlyAmount: "40000",
    gananciasInMonthly: true,
  });

  useEffect(() => {
    if (open) setTemplates(listTemplates(estudioId));
  }, [open, estudioId]);

  function startNew() {
    setForm({
      name: "",
      description: "",
      feeKind: "amount",
      monthlyModules: 1,
      monthlyAmount: "40000",
      gananciasInMonthly: true,
    });
    setEditing("new");
  }

  function startEdit(t: HonorarioTemplate) {
    setForm({
      name: t.name,
      description: t.description ?? "",
      feeKind: t.feeKind,
      monthlyModules: t.monthlyModules ?? 1,
      monthlyAmount: t.monthlyAmount ? String(t.monthlyAmount) : "40000",
      gananciasInMonthly: t.gananciasInMonthly,
    });
    setEditing(t);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    const template: HonorarioTemplate = {
      id: editing === "new" ? createTemplateId() : (editing as HonorarioTemplate).id,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      feeKind: form.feeKind,
      monthlyModules: form.feeKind === "modules" ? form.monthlyModules : undefined,
      monthlyAmount: form.feeKind === "amount" ? Number(form.monthlyAmount) : undefined,
      gananciasInMonthly: form.gananciasInMonthly,
    };
    saveTemplate(estudioId, template);
    const updated = listTemplates(estudioId);
    setTemplates(updated);
    setEditing(null);
  }

  function handleDelete(id: string) {
    deleteTemplate(estudioId, id);
    const updated = listTemplates(estudioId);
    setTemplates(updated);
    setEditing(null);
  }

  function feeLabel(t: HonorarioTemplate) {
    if (t.feeKind === "variable") return "Variable";
    if (t.feeKind === "modules") return `${t.monthlyModules} módulos`;
    return formatARS(t.monthlyAmount ?? 0) + "/mes";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Plantillas de honorario</DialogTitle>
          <DialogDescription>
            Guardá combinaciones de honorario para reutilizarlas al crear clientes. Solo vos del
            estudio las ve.
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {editing === "new" ? "Nueva plantilla" : "Editar plantilla"}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setEditing(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Nombre</Label>
              <Input
                id="tpl-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Pyme mensual"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-desc">Descripción (opcional)</Label>
              <Input
                id="tpl-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ej: Incluye Ganancias"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de honorario</Label>
              <Select
                value={form.feeKind}
                onValueChange={(v) => setForm({ ...form, feeKind: v as FeeKind })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modules">Por módulos CPCEBA</SelectItem>
                  <SelectItem value="amount">Monto fijo en pesos</SelectItem>
                  <SelectItem value="variable">Variable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.feeKind === "modules" ? (
              <div className="space-y-1.5">
                <Label htmlFor="tpl-mods">Módulos mensuales</Label>
                <Input
                  id="tpl-mods"
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.monthlyModules}
                  onChange={(e) =>
                    setForm({ ...form, monthlyModules: Number(e.target.value) })
                  }
                />
              </div>
            ) : null}
            {form.feeKind === "amount" ? (
              <div className="space-y-1.5">
                <Label htmlFor="tpl-amt">Importe mensual (ARS)</Label>
                <Input
                  id="tpl-amt"
                  value={form.monthlyAmount}
                  onChange={(e) => setForm({ ...form, monthlyAmount: e.target.value })}
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Ganancias</Label>
              <Select
                value={form.gananciasInMonthly ? "yes" : "no"}
                onValueChange={(v) =>
                  setForm({ ...form, gananciasInMonthly: v === "yes" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Incluida en el mensual</SelectItem>
                  <SelectItem value="no">Se cobra en la DDJJ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {editing !== "new" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() =>
                    handleDelete((editing as HonorarioTemplate).id)
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
              <Button type="button" onClick={handleSave} className="flex-1">
                {form.name.trim() ? "Guardar" : "Cancelar"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={startNew}
            >
              <Plus className="h-4 w-4" />
              Nueva plantilla
            </Button>
            {templates.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Sin plantillas todavía.
              </p>
            ) : (
              <div className="space-y-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left hover:bg-muted transition-colors"
                    onClick={() => startEdit(t)}
                  >
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      {t.description ? (
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">{feeLabel(t)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface TemplatePickerProps {
  estudioId: string;
  value: HonorarioTemplate | null;
  onChange: (t: HonorarioTemplate | null) => void;
}

export function TemplatePicker({ estudioId, value, onChange }: TemplatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  function handleSelect(t: HonorarioTemplate) {
    onChange(t);
    setShowPicker(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowPicker(true)}
        className="w-full rounded-xl border border-dashed border-border px-4 py-2.5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
      >
        <p className="text-sm font-medium">
          {value ? `Plantilla: ${value.name}` : "¿Aplicar una plantilla?"}
        </p>
        {value ? (
          <p className="text-xs text-muted-foreground">{value.description}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Cargá una combinación de honorario y usala en otros clientes
          </p>
        )}
      </button>

      <TemplatePickerDialog
        estudioId={estudioId}
        open={showPicker}
        onOpenChange={setShowPicker}
        onSelect={handleSelect}
      />
    </>
  );
}

interface TemplatePickerDialogProps {
  estudioId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (t: HonorarioTemplate) => void;
}

function TemplatePickerDialog({
  estudioId,
  open,
  onOpenChange,
  onSelect,
}: TemplatePickerDialogProps) {
  const { formatARS } = useMoneyDisplay();
  const [templates, setTemplates] = useState<HonorarioTemplate[]>([]);
  const [showManager, setShowManager] = useState(false);

  useEffect(() => {
    if (open) setTemplates(listTemplates(estudioId));
  }, [open, estudioId]);

  function feeLabel(t: HonorarioTemplate) {
    if (t.feeKind === "variable") return "Variable";
    if (t.feeKind === "modules") return `${t.monthlyModules} módulos`;
    return formatARS(t.monthlyAmount ?? 0) + "/mes";
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Elegir plantilla</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {templates.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Sin plantillas. Creá una desde el gestor.
              </p>
            ) : (
              templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left hover:bg-muted transition-colors"
                  onClick={() => onSelect(t)}
                >
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    {t.description ? (
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{feeLabel(t)}</p>
                </button>
              ))
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={() => {
                onOpenChange(false);
                setTimeout(() => setShowManager(true), 100);
              }}
            >
              <Plus className="h-4 w-4" />
              Crear plantilla
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <TemplatesManager
        estudioId={estudioId}
        open={showManager}
        onOpenChange={setShowManager}
      />
    </>
  );
}

export { TemplatesManager };
