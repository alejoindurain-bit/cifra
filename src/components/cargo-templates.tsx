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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listCargoTemplates,
  saveCargoTemplate,
  deleteCargoTemplate,
  createCargoTemplateId,
  CARGO_TEMPLATE_CATEGORIES,
  type CargoTemplate,
  type CargoTemplateCategory,
} from "@/lib/fn/cargo-templates";
import { useMoneyDisplay } from "@/lib/privacy";

interface TemplateEditorProps {
  estudioId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function TemplatesManager({ estudioId, open, onOpenChange }: TemplateEditorProps) {
  const { formatARS } = useMoneyDisplay();
  const [templates, setTemplates] = useState<CargoTemplate[]>([]);
  const [editing, setEditing] = useState<CargoTemplate | "new" | null>(null);
  const [form, setForm] = useState({
    name: "",
    concept: "",
    suggestedAmount: "",
    category: "honorarios" as CargoTemplateCategory,
    active: true,
  });

  useEffect(() => {
    if (open) setTemplates(listCargoTemplates(estudioId));
  }, [open, estudioId]);

  function startNew() {
    setForm({
      name: "",
      concept: "",
      suggestedAmount: "",
      category: "honorarios",
      active: true,
    });
    setEditing("new");
  }

  function startEdit(t: CargoTemplate) {
    setForm({
      name: t.name,
      concept: t.concept,
      suggestedAmount: t.suggestedAmount ? String(t.suggestedAmount) : "",
      category: t.category,
      active: t.active,
    });
    setEditing(t);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    const template: CargoTemplate = {
      id: editing === "new" ? createCargoTemplateId() : (editing as CargoTemplate).id,
      name: form.name.trim(),
      concept: form.concept.trim(),
      suggestedAmount: Number(form.suggestedAmount.replace(",", ".")) || 0,
      category: form.category,
      active: form.active,
    };
    saveCargoTemplate(estudioId, template);
    setTemplates(listCargoTemplates(estudioId));
    setEditing(null);
  }

  function handleDelete(id: string) {
    deleteCargoTemplate(estudioId, id);
    setTemplates(listCargoTemplates(estudioId));
    setEditing(null);
  }

  function categoryLabel(c: CargoTemplateCategory): string {
    return CARGO_TEMPLATE_CATEGORIES.find((x) => x.value === c)?.label ?? c;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Plantillas de cargo</DialogTitle>
          <DialogDescription>
            Conceptos pre-armados para emitir cargos en Extraordinarios. Solo vos
            del estudio las gestionás, todo el equipo las ve al cargar.
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
              <Label htmlFor="ctpl-name">Nombre</Label>
              <Input
                id="ctpl-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Liquidación IIBB"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ctpl-concept">Concepto</Label>
              <Textarea
                id="ctpl-concept"
                value={form.concept}
                onChange={(e) => setForm({ ...form, concept: e.target.value })}
                placeholder="Ej: Liquidación Ingresos Brutos período X/Y"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ctpl-amt">Importe sugerido (ARS)</Label>
              <Input
                id="ctpl-amt"
                inputMode="decimal"
                value={form.suggestedAmount}
                onChange={(e) => setForm({ ...form, suggestedAmount: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm({ ...form, category: v as CargoTemplateCategory })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARGO_TEMPLATE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select
                value={form.active ? "yes" : "no"}
                onValueChange={(v) => setForm({ ...form, active: v === "yes" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Activa</SelectItem>
                  <SelectItem value="no">Inactiva</SelectItem>
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
                    handleDelete((editing as CargoTemplate).id)
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
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {categoryLabel(t.category)}
                        {!t.active ? " · inactiva" : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {formatARS(t.suggestedAmount)}
                    </p>
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
  value: CargoTemplate | null;
  onChange: (t: CargoTemplate | null) => void;
}

export function CargoTemplatePicker({ estudioId, value, onChange }: TemplatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  function handleSelect(t: CargoTemplate) {
    onChange(t);
    setShowPicker(false);
  }

  function handleClear() {
    onChange(null);
  }

  return (
    <>
      {value ? (
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="flex-1 rounded-xl border border-dashed border-border px-4 py-2.5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
          >
            <p className="text-sm font-medium">Plantilla: {value.name}</p>
            <p className="text-xs text-muted-foreground">
              Concepto e importe pre-armados — editables antes de emitir
            </p>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            aria-label="Quitar plantilla"
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="w-full rounded-xl border border-dashed border-border px-4 py-2.5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <p className="text-sm font-medium">¿Aplicar una plantilla?</p>
          <p className="text-xs text-muted-foreground">
            Conceptos pre-armados para emitir cargos frecuentes
          </p>
        </button>
      )}

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
  onSelect: (t: CargoTemplate) => void;
}

function TemplatePickerDialog({
  estudioId,
  open,
  onOpenChange,
  onSelect,
}: TemplatePickerDialogProps) {
  const { formatARS } = useMoneyDisplay();
  const [templates, setTemplates] = useState<CargoTemplate[]>([]);
  const [showManager, setShowManager] = useState(false);

  useEffect(() => {
    if (open) setTemplates(listCargoTemplates(estudioId));
  }, [open, estudioId]);

  function categoryLabel(c: CargoTemplateCategory): string {
    return CARGO_TEMPLATE_CATEGORIES.find((x) => x.value === c)?.label ?? c;
  }

  const active = templates.filter((t) => t.active);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Elegir plantilla</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {active.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Sin plantillas activas. Creá una desde el gestor.
              </p>
            ) : (
              active.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left hover:bg-muted transition-colors"
                  onClick={() => onSelect(t)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {categoryLabel(t.category)}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {formatARS(t.suggestedAmount)}
                  </p>
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

export { TemplatesManager as CargoTemplatesManager };
