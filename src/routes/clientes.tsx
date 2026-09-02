import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { AuthGate, useSessionStaff } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { BackupButton } from "@/components/backup-button";
import { GananciasBadge } from "@/components/ganancias-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { COMPANY_TYPES, IVA_CONDITIONS, MONOTRIBUTO_CATEGORIES } from "@/lib/constants";
import { previewHonorariosBackfill, runHonorariosBackfill } from "@/lib/fn/billing";
import { createClient, listClients, updateClient } from "@/lib/fn/clients";
import type { Client, FeeKind } from "@/lib/fn/types";
import { TemplatePicker } from "@/components/honorario-templates";
import type { HonorarioTemplate } from "@/lib/fn/honorario-templates";
import { clientFeeKind, formatARS, formatQty, parseArgentineNumber } from "@/lib/money";
import { useMoneyDisplay } from "@/lib/privacy";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/clientes")({ component: ClientesRoute });

function LedgerMonthMax() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ClientesRoute() {
  return (
    <AuthGate role="owner">
      <ClientesPage />
    </AuthGate>
  );
}

type GananciasFilter = "all" | "monthly" | "ddjj";

function ClientesPage() {
  const money = useMoneyDisplay();
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [gananciasFilter, setGananciasFilter] = useState<GananciasFilter>("all");
  const [editing, setEditing] = useState<Client | "new" | null>(null);
  const clients = useQuery({
    queryKey: ["clients", q, showInactive],
    queryFn: () => listClients({ data: { q, includeInactive: showInactive } }),
  });

  const rows = useMemo(() => {
    const all = clients.data ?? [];
    if (gananciasFilter === "monthly") return all.filter((c) => c.gananciasInMonthly);
    if (gananciasFilter === "ddjj") return all.filter((c) => !c.gananciasInMonthly);
    return all;
  }, [clients.data, gananciasFilter]);

  const ddjjCount = (clients.data ?? []).filter((c) => !c.gananciasInMonthly).length;
  const monthlyCount = (clients.data ?? []).filter((c) => c.gananciasInMonthly).length;

  return (
    <AppShell
      title="Clientes"
      description="Alta y edición. Cambiar el honorario no toca cargos ya emitidos."
      action={
        <div className="flex gap-2">
          <BackupButton kind="clients" compact />
          <Button type="button" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" />
            Nuevo
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o CUIT"
            className="max-w-sm"
          />
          <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            Incluir inactivos
          </label>
        </div>
        <Tabs
          value={gananciasFilter}
          onValueChange={(v) => setGananciasFilter(v as GananciasFilter)}
        >
          <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="monthly">En mensual ({monthlyCount})</TabsTrigger>
            <TabsTrigger value="ddjj">En DDJJ ({ddjjCount})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">CUIT</TableHead>
                <TableHead>Honorario</TableHead>
                <TableHead className="hidden sm:table-cell">Ganancias</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const fee = money.honorarioSummary(c);
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => setEditing(c)}
                  >
                    <TableCell>
                      <p className="font-medium">{money.maskName(c.name)}</p>
                      <p className="text-xs text-muted-foreground">{c.ivaCondition ?? c.companyType}</p>
                      <div className="mt-1 sm:hidden">
                        <GananciasBadge included={c.gananciasInMonthly} />
                      </div>
                    </TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">
                      {money.maskCuit(c.cuit, "—")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={fee.kind === "variable" ? "muted" : "secondary"}>{fee.label}</Badge>
                      {!c.active ? (
                        <Badge variant="outline" className="ml-1">
                          Inactivo
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <GananciasBadge included={c.gananciasInMonthly} />
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        c.balance > 0 && "text-charge",
                        c.balance < 0 && "text-payment",
                      )}
                    >
                      {money.formatARS(c.balance)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No hay clientes con ese criterio.</p>
          ) : null}
        </CardContent>
      </Card>
      {editing !== null ? (
        <ClientForm
          key={editing === "new" ? "new" : editing.id}
          client={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </AppShell>
  );
}

function ChoiceCard({
  selected,
  title,
  hint,
  onSelect,
}: {
  selected: boolean;
  title: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "rounded-xl px-4 py-3 text-left transition-colors",
        selected ? "bg-card shadow-[var(--shadow-border)]" : "hover:bg-card/60",
      )}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </button>
  );
}

function ClientForm({ client, onClose }: { client: Client | null; onClose: () => void }) {
  const qc = useQueryClient();
  const money = useMoneyDisplay();
  const { estudio } = useSessionStaff();
  const showModules = Boolean(estudio?.flags.cpceba);
  const isEdit = Boolean(client);
  const [form, setForm] = useState({
    name: client?.name ?? "",
    contact: client?.contact ?? "",
    email: client?.email ?? "",
    phone: client?.phone ?? "",
    notes: client?.notes ?? "",
    cuit: client?.cuit ?? "",
    companyType: client?.companyType ?? "S.R.L.",
    ivaCondition: client?.ivaCondition ?? "Responsable Inscripto",
    monotributoCategory: client?.monotributoCategory ?? "",
    feeKind: (client
      ? clientFeeKind(client)
      : showModules
        ? "modules"
        : "amount") as FeeKind,
    monthlyModules: client?.monthlyModules || 1,
    monthlyAmount: client?.monthlyAmount || 40000,
    gananciasInMonthly: client?.gananciasInMonthly ?? false,
    active: client?.active ?? true,
  });
  const [amountText, setAmountText] = useState(
    client?.monthlyAmount ? String(client.monthlyAmount) : "40000",
  );
  const [backfillFrom, setBackfillFrom] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<HonorarioTemplate | null>(null);
  const maxMonth = LedgerMonthMax();

  function applyTemplate(t: HonorarioTemplate | null) {
    setSelectedTemplate(t);
    if (!t) return;
    setForm((f) => ({
      ...f,
      feeKind: t.feeKind,
      monthlyModules: t.monthlyModules ?? f.monthlyModules,
      monthlyAmount: t.monthlyAmount ?? f.monthlyAmount,
      gananciasInMonthly: t.gananciasInMonthly,
    }));
    if (t.monthlyAmount) setAmountText(String(t.monthlyAmount));
  }
  const isMonthly = form.feeKind === "modules" || form.feeKind === "amount";
  const feeValueOk =
    form.feeKind === "modules"
      ? Number(form.monthlyModules) > 0
      : form.feeKind === "amount"
        ? Number(form.monthlyAmount) > 0
        : false;
  const canPreview = isMonthly && /^\d{4}-\d{2}$/.test(backfillFrom) && feeValueOk;

  const preview = useQuery({
    queryKey: [
      "backfill-preview",
      client?.id,
      form.feeKind,
      form.monthlyModules,
      form.monthlyAmount,
      backfillFrom,
    ],
    queryFn: () =>
      previewHonorariosBackfill({
        data: {
          clientId: client?.id,
          monthlyModules: form.feeKind === "modules" ? Number(form.monthlyModules) : undefined,
          monthlyAmount: form.feeKind === "amount" ? Number(form.monthlyAmount) : undefined,
          from: backfillFrom,
        },
      }),
    enabled: canPreview,
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        contact: form.contact || null,
        email: form.email || null,
        phone: form.phone || null,
        notes: form.notes || null,
        cuit: form.cuit || null,
        companyType: form.companyType,
        ivaCondition: form.ivaCondition,
        monotributoCategory:
          form.ivaCondition === "Monotributo" ? form.monotributoCategory || null : null,
        feeKind: form.feeKind,
        monthlyModules: Number(form.monthlyModules) || 0,
        monthlyAmount: Number(form.monthlyAmount) || 0,
        gananciasInMonthly: form.gananciasInMonthly,
        active: form.active,
      };
      const saved = client
        ? await updateClient({ data: { ...payload, id: client.id } }).then(() => ({
            id: client.id,
          }))
        : await createClient({ data: payload });
      let backfill: { billed: number; skipped: number; totalAmount: number } | null = null;
      if (isMonthly && canPreview) {
        backfill = await runHonorariosBackfill({
          data: { clientId: saved.id, from: backfillFrom },
        });
      }
      return { id: saved.id, backfill };
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["clients"] });
      void qc.invalidateQueries({ queryKey: ["ledger"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["account"] });
      void qc.invalidateQueries({ queryKey: ["clients-ddjj"] });
      if (res.backfill && res.backfill.billed > 0) {
        toast.success(
          `${isEdit ? "Cliente actualizado" : "Cliente creado"}. ${res.backfill.billed} meses de honorarios · ${formatARS(res.backfill.totalAmount)}`,
        );
      } else if (res.backfill && res.backfill.skipped > 0 && res.backfill.billed === 0) {
        toast.message("Cliente guardado. Esos meses ya estaban cargados.");
      } else {
        toast.success(isEdit ? "Cliente actualizado" : "Cliente creado");
      }
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cliente" : "Alta de cliente"}</DialogTitle>
          <DialogDescription>
            Cambiar el honorario no toca cargos ya emitidos. Los atrasados por módulos usan el
            CPCEBA de cada mes; el monto fijo se repite igual.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="cname">Nombre / Razón social</Label>
            <Input
              id="cname"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cuit">CUIT</Label>
              <Input id="cuit" value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact">Contacto</Label>
              <Input
                id="contact"
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cemail">Correo</Label>
              <Input
                id="cemail"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cphone">Teléfono</Label>
              <Input
                id="cphone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo de empresa</Label>
              <Select value={form.companyType} onValueChange={(v) => setForm({ ...form, companyType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Condición IVA</Label>
              <Select
                value={form.ivaCondition}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    ivaCondition: v,
                    monotributoCategory: v === "Monotributo" ? form.monotributoCategory : "",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IVA_CONDITIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.ivaCondition === "Monotributo" ? (
            <div className="space-y-1.5">
              <Label>Categoría monotributo</Label>
              <Select
                value={form.monotributoCategory || undefined}
                onValueChange={(v) => setForm({ ...form, monotributoCategory: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="A–K" />
                </SelectTrigger>
                <SelectContent>
                  {MONOTRIBUTO_CATEGORIES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="cnotes">Notas</Label>
            <Textarea
              id="cnotes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <TemplatePicker
            estudioId={estudio?.id ?? ""}
            value={selectedTemplate}
            onChange={applyTemplate}
          />
          <div className="space-y-2 rounded-2xl bg-muted p-2">
            <div className="px-2 pt-1">
              <p className="text-sm font-medium">Honorario mensual</p>
              <p className="text-xs text-muted-foreground">Se factura el día 1, si corresponde.</p>
            </div>
            {showModules || form.feeKind === "modules" ? (
            <ChoiceCard
              selected={form.feeKind === "modules"}
              onSelect={() => setForm({ ...form, feeKind: "modules" })}
              title="Por módulos CPCEBA"
              hint="Módulos × valor vigente de cada mes."
            />
            ) : null}
            <ChoiceCard
              selected={form.feeKind === "amount"}
              onSelect={() => setForm({ ...form, feeKind: "amount" })}
              title="Monto fijo en pesos"
              hint="El mismo importe todos los meses, sin módulo."
            />
            <ChoiceCard
              selected={form.feeKind === "variable"}
              onSelect={() => setForm({ ...form, feeKind: "variable" })}
              title="Variable"
              hint="Sin cargo automático. Solo extraordinarios y pagos."
            />
          </div>
          {form.feeKind === "modules" ? (
            <div className="space-y-1.5">
              <Label htmlFor="mods">Módulos mensuales</Label>
              <Input
                id="mods"
                type="number"
                min={0}
                step={0.5}
                value={form.monthlyModules}
                onChange={(e) => setForm({ ...form, monthlyModules: Number(e.target.value) })}
              />
            </div>
          ) : null}
          {form.feeKind === "amount" ? (
            <div className="space-y-1.5">
              <Label htmlFor="ars">Importe mensual (ARS)</Label>
              <Input
                id="ars"
                inputMode="decimal"
                value={amountText}
                onChange={(e) => {
                  const raw = e.target.value;
                  setAmountText(raw);
                  const n = parseArgentineNumber(raw);
                  setForm({ ...form, monthlyAmount: n ?? 0 });
                }}
                placeholder="40000"
              />
              <p className="text-xs text-muted-foreground">
                Ejemplo: 40000. Se carga igual todos los meses.
              </p>
            </div>
          ) : null}
          <div className="space-y-2 rounded-2xl bg-muted p-2">
            <div className="px-2 pt-1">
              <p className="text-sm font-medium">Ganancias</p>
              <p className="text-xs text-muted-foreground">
                Si va incluida en el mensual o la cobrás aparte al presentar la DDJJ.
              </p>
            </div>
            <ChoiceCard
              selected={form.gananciasInMonthly}
              onSelect={() => setForm({ ...form, gananciasInMonthly: true })}
              title="Incluida en el honorario mensual"
              hint="El impuesto va prorrateado (÷12) dentro del mensual."
            />
            <ChoiceCard
              selected={!form.gananciasInMonthly}
              onSelect={() => setForm({ ...form, gananciasInMonthly: false })}
              title="Se cobra en la DDJJ"
              hint="No está en el mensual. La cargás como extraordinario al presentar."
            />
          </div>
          {isMonthly ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="from-month">Cargar honorarios desde</Label>
                <Input
                  id="from-month"
                  type="month"
                  min="2000-01"
                  max={maxMonth}
                  value={backfillFrom}
                  onChange={(e) => setBackfillFrom(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {form.feeKind === "amount"
                    ? "Opcional. Genera el mismo importe cada mes hasta hoy. No duplica meses que ya estén en el mayor."
                    : "Opcional. Genera un cargo por mes hasta hoy, con el valor CPCEBA de ese período. No duplica meses que ya estén en el mayor."}
                </p>
              </div>
              {canPreview && preview.data ? (
                <div className="max-h-40 overflow-y-auto rounded-2xl border border-border">
                  <table className="w-full text-sm">
                    <tbody>
                      {preview.data.months.map((m) => (
                        <tr
                          key={`${m.year}-${m.month}`}
                          className={cn(m.skipped && "text-muted-foreground")}
                        >
                          <td className="px-3 py-1.5">{m.label}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {m.kind === "amount"
                              ? "Monto fijo"
                              : `${formatQty(m.modules)} × ${money.formatARS(m.moduleValue)}`}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {m.skipped ? "Ya estaba" : money.formatARS(m.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                    {preview.data.toCharge} meses a cargar · {money.formatARS(preview.data.totalAmount)}
                    {preview.data.skipped ? ` · ${preview.data.skipped} ya existentes` : ""}
                  </p>
                </div>
              ) : canPreview && preview.isFetching ? (
                <p className="text-xs text-muted-foreground">
                  {form.feeKind === "amount" ? "Armando la liquidación…" : "Calculando módulo de cada mes…"}
                </p>
              ) : null}
            </>
          ) : null}
          {isEdit ? (
            <div className="flex items-center justify-between">
              <Label htmlFor="active">Cliente activo</Label>
              <Switch
                id="active"
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending
                ? "Guardando…"
                : canPreview && (preview.data?.toCharge ?? 0) > 0
                  ? "Guardar y cargar honorarios"
                  : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
