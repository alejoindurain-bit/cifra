import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listAllVocab,
  upsertVocabEntry,
  deleteVocabEntry,
  toggleVocabEntry,
  type VocabKind,
  type VocabEntry,
} from "@/lib/fn/estudio-vocab";
import { useSessionStaff } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const KIND_LABELS: Record<VocabKind, string> = {
  payment_method: "Medios de cobro",
  transfer_account: "Cuentas de transferencia",
  documentation: "Documentación",
  company_type: "Tipos de empresa",
  iva_condition: "Condiciones IVA",
  monotributo_category: "Categorías monotributo",
};

const KIND_HINTS: Record<VocabKind, string> = {
  payment_method: "Efectivo, Transferencia, Mercado Pago, etc.",
  transfer_account: "CBU, Banco, Alias para transferencias",
  documentation: "Recibo, Factura, Nota de crédito, etc.",
  company_type: "S.A., S.R.L., S.A.S., Unipersonal, etc.",
  iva_condition: "Responsable Inscripto, Monotributo, Exento, etc.",
  monotributo_category: "Categorías A a K del monotributo",
};

export function VocabManager() {
  const [activeTab, setActiveTab] = useState<VocabKind>("payment_method");
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const qc = useQueryClient();
  const { estudio, user } = useSessionStaff();

  // Invalidate the session query so useSessionStaff() re-fetches and re-renders
  const refreshSession = async () => {
    await qc.invalidateQueries({ queryKey: ["session", user?.id ?? ""] });
  };

  const saveMutation = useMutation({
    mutationFn: (payload: { kind: VocabKind; value: string; kindLabel?: string | null }) =>
      upsertVocabEntry({ data: { kind: payload.kind, data: { value: payload.value, kindLabel: payload.kindLabel } } }),
    onSuccess: async () => {
      await refreshSession();
      toast.success("Guardado");
      setEditingValue(null);
      setEditingLabel("");
      setNewValue("");
      setNewLabel("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (payload: { kind: VocabKind; value: string }) =>
      deleteVocabEntry({ data: { kind: payload.kind, value: payload.value } }),
    onSuccess: async () => {
      await refreshSession();
      toast.success("Eliminado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (payload: { kind: VocabKind; value: string; active: boolean }) =>
      toggleVocabEntry({ data: { kind: payload.kind, value: payload.value, active: payload.active } }),
    onSuccess: async () => {
      await refreshSession();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Use the vocab that comes with the session, not a separate query
  const entries: VocabEntry[] = estudio?.vocab?.[activeTab] ?? [];

  function handleSave(value: string, label: string) {
    saveMutation.mutate({ kind: activeTab, value: value.trim(), kindLabel: label.trim() || null });
  }

  function handleDelete(value: string) {
    deleteMutation.mutate({ kind: activeTab, value });
  }

  function handleToggle(value: string, currentActive: boolean) {
    toggleMutation.mutate({ kind: activeTab, value, active: !currentActive });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-border">
        {(Object.keys(KIND_LABELS) as VocabKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => {
              setActiveTab(kind);
              setEditingValue(null);
              setEditingLabel("");
              setNewValue("");
              setNewLabel("");
            }}
            className={`px-3 py-2 text-sm transition-colors ${
              activeTab === kind
                ? "border-b-2 border-primary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {KIND_LABELS[kind]}
          </button>
        ))}
      </div>

      <div>
        <p className="mb-1 text-xs text-muted-foreground">{KIND_HINTS[activeTab]}</p>
        <p className="mb-3 text-xs text-muted-foreground">
          {entries.length} {entries.length === 1 ? "valor" : "valores"} configurados
        </p>

        <div className="space-y-2">
          {entries.map((entry) => (
            <VocabEntryRow
              key={entry.value}
              entry={entry}
              isEditing={editingValue === entry.value}
              onEdit={() => {
                setEditingValue(entry.value);
                setEditingLabel(entry.kindLabel ?? "");
                setNewValue("");
                setNewLabel("");
              }}
              onCancel={() => {
                setEditingValue(null);
                setEditingLabel("");
              }}
              onSave={(label) => handleSave(entry.value, label)}
              onDelete={() => handleDelete(entry.value)}
              onToggle={() => handleToggle(entry.value, entry.active)}
              editingLabel={editingLabel}
              onEditingLabelChange={setEditingLabel}
              isPending={saveMutation.isPending || deleteMutation.isPending || toggleMutation.isPending}
            />
          ))}

          <NewVocabEntry
            newValue={newValue}
            newLabel={newLabel}
            onValueChange={setNewValue}
            onLabelChange={setNewLabel}
            onSave={() => handleSave(newValue, newLabel)}
            isPending={saveMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}

function VocabEntryRow({
  entry,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  onToggle,
  editingLabel,
  onEditingLabelChange,
  isPending,
}: {
  entry: VocabEntry;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (label: string) => void;
  onDelete: () => void;
  onToggle: () => void;
  editingLabel: string;
  onEditingLabelChange: (v: string) => void;
  isPending: boolean;
}) {
  if (isEditing) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-3">
        <div className="flex-1 space-y-1.5">
          <Input
            value={entry.value}
            disabled
            className="font-medium"
          />
          <Input
            value={editingLabel}
            onChange={(e) => onEditingLabelChange(e.target.value)}
            placeholder="Etiqueta opcional (se muestra en el formulario)"
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onSave(editingLabel)}
            disabled={isPending}
          >
            Guardar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
        entry.active ? "border-border bg-muted/30" : "border-dashed border-muted-foreground/30 bg-muted/10"
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            entry.active
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {entry.active ? "Activo" : "Off"}
        </button>
        <div>
          <span className={entry.active ? "font-medium" : "text-muted-foreground"}>{entry.value}</span>
          {entry.kindLabel && (
            <span className="ml-2 text-xs text-muted-foreground">({entry.kindLabel})</span>
          )}
        </div>
      </div>
      <div className="flex gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={onEdit} disabled={isPending}>
          Editar
        </Button>
        <ConfirmDialog
          title="Eliminar valor"
          description={`¿Eliminar "${entry.value}" de la lista?`}
          confirmLabel="Eliminar"
          destructive
          onConfirm={onDelete}
        >
          {({ open }) => (
            <Button type="button" variant="ghost" size="sm" onClick={open} disabled={isPending}>
              Eliminar
            </Button>
          )}
        </ConfirmDialog>
      </div>
    </div>
  );
}

function NewVocabEntry({
  newValue,
  newLabel,
  onValueChange,
  onLabelChange,
  onSave,
  isPending,
}: {
  newValue: string;
  newLabel: string;
  onValueChange: (v: string) => void;
  onLabelChange: (v: string) => void;
  onSave: () => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => setExpanded(true)}
      >
        + Agregar valor
      </Button>
    );
  }

  return (
    <div className="flex items-end gap-2 rounded-xl border border-dashed border-border p-3">
      <div className="flex-1 space-y-1.5">
        <Label className="text-xs text-muted-foreground">Nuevo valor</Label>
        <Input
          value={newValue}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder="Ej: Transferencia, Efectivo…"
        />
      </div>
      <div className="flex-1 space-y-1.5">
        <Label className="text-xs text-muted-foreground">Etiqueta (opcional)</Label>
        <Input
          value={newLabel}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="Descripción adicional"
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setExpanded(false);
            onValueChange("");
            onLabelChange("");
          }}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={!newValue.trim() || isPending}
        >
          Agregar
        </Button>
      </div>
    </div>
  );
}
