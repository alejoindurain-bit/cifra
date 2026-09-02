import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { AuthGate, useSessionStaff } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { BackupButton } from "@/components/backup-button";
import { ClientPicker } from "@/components/client-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DOCUMENTATION_OPTIONS } from "@/lib/constants";
import { cajaMedios } from "@/lib/medios";
import { deleteTransaction, listLedger, updateTransaction } from "@/lib/fn/transactions";
import type { Client, LedgerRow } from "@/lib/fn/types";
import { formatARS, formatDateAR } from "@/lib/money";
import { getDollarRate } from "@/lib/fn/rates";
import { useMoneyDisplay } from "@/lib/privacy";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/libro-mayor")({ component: LedgerRoute });

function LedgerRoute() {
  return (
    <AuthGate role="owner" module="cuentaCorriente">
      <AppShell
        title="Libro mayor"
        description="Tocá un asiento para corregirlo o borrarlo"
        action={<BackupButton kind="ledger" compact />}
      >
        <Ledger />
      </AppShell>
    </AuthGate>
  );
}

function Ledger() {
  const money = useMoneyDisplay();
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | "charge" | "payment">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editing, setEditing] = useState<LedgerRow | null>(null);
  const data = useQuery({
    queryKey: ["ledger", q, type, from, to],
    queryFn: () =>
      listLedger({
        data: {
          q: q || undefined,
          type,
          from: from || undefined,
          to: to || undefined,
        },
      }),
  });

  const rows = data.data?.rows ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente o concepto" />
        <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="charge">Cargos</SelectItem>
            <SelectItem value="payment">Pagos</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Desde" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Hasta" />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Concepto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Editar</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => setEditing(r)}
                >
                  <TableCell className="whitespace-nowrap tabular-nums">{formatDateAR(r.date)}</TableCell>
                  <TableCell>
                    <p className="font-medium">{money.maskName(r.clientName)}</p>
                    <p className="text-xs text-muted-foreground md:hidden">{money.maskText(r.concept)}</p>
                    {r.payment ? (
                      <p className="text-xs text-muted-foreground">
                        {r.payment.paymentMethod}
                        {r.payment.transferAccount ? ` · ${r.payment.transferAccount}` : ""}
                        {r.payment.documentation.length
                          ? ` · ${r.payment.documentation.join(", ")}`
                          : ""}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden max-w-xs truncate md:table-cell">{money.maskText(r.concept)}</TableCell>
                  <TableCell>
                    <Badge variant={r.type === "charge" ? "charge" : "payment"}>
                      {r.type === "charge" ? "Cargo" : "Pago"}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      r.type === "charge" ? "text-charge" : "text-payment",
                    )}
                  >
                    {money.formatARS(r.amount)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <Pencil className="h-4 w-4" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5}>Totales</TableCell>
                <TableCell className="text-right tabular-nums">
                  <div>Cargos {money.formatARS(data.data?.charges ?? 0)}</div>
                  <div>Pagos {money.formatARS(data.data?.payments ?? 0)}</div>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No hay asientos con esos filtros.</p>
          ) : null}
        </CardContent>
      </Card>
      {editing ? (
        <LedgerEditor
          key={editing.id}
          row={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function stubClient(row: LedgerRow): Client {
  return {
    id: row.clientId,
    estudioId: "",
    name: row.clientName,
    contact: null,
    email: null,
    phone: null,
    notes: null,
    cuit: null,
    companyType: null,
    ivaCondition: null,
    monotributoCategory: null,
    fixedFee: false,
    monthlyModules: 0,
    monthlyAmount: 0,
    gananciasInMonthly: false,
    active: true,
    createdAt: "",
    updatedAt: "",
    balance: 0,
  };
}

function inputAmount(row: LedgerRow): string {
  if (
    row.type === "payment" &&
    row.payment?.paymentMethod === "Dólares" &&
    row.payment.dollarRate
  ) {
    return String(Math.round((row.amount / row.payment.dollarRate) * 100) / 100);
  }
  return String(row.amount);
}

function LedgerEditor({ row, onClose }: { row: LedgerRow; onClose: () => void }) {
  const qc = useQueryClient();
  const money = useMoneyDisplay();
  const { estudio } = useSessionStaff();
  const { labels, accounts } = cajaMedios(estudio?.paymentMethods);
  const isPayment = row.type === "payment";
  const [client, setClient] = useState<Client | null>(stubClient(row));
  const [date, setDate] = useState(row.date);
  const [concept, setConcept] = useState(row.concept);
  const [amount, setAmount] = useState(inputAmount(row));
  const [docs, setDocs] = useState<string[]>(row.payment?.documentation ?? []);
  const [method, setMethod] = useState(
    row.payment?.paymentMethod ?? (labels.includes("Transferencia") ? "Transferencia" : labels[0] ?? "Transferencia"),
  );
  const [account, setAccount] = useState(row.payment?.transferAccount ?? "");
  const [rate, setRate] = useState(
    row.payment?.dollarRate ? String(row.payment.dollarRate) : "",
  );
  const [obs, setObs] = useState(row.payment?.observations ?? "");

  const dollar = useQuery({
    queryKey: ["dollar"],
    queryFn: () => getDollarRate(),
    enabled: isPayment && method === "Dólares",
  });

  useEffect(() => {
    if (isPayment && method === "Dólares" && dollar.data?.venta && !rate) {
      setRate(String(dollar.data.venta));
    }
  }, [isPayment, method, dollar.data, rate]);

  const parsedAmount = Number(amount.replace(",", "."));
  const parsedRate = Number(rate.replace(",", "."));
  const arsPreview =
    isPayment && method === "Dólares" && parsedAmount > 0 && parsedRate > 0
      ? Math.round(parsedAmount * parsedRate * 100) / 100
      : parsedAmount;

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["ledger"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
    void qc.invalidateQueries({ queryKey: ["account"] });
    void qc.invalidateQueries({ queryKey: ["clients"] });
  }

  const save = useMutation({
    mutationFn: () => {
      if (!client) throw new Error("Elegí un cliente");
      if (isPayment && method === "Transferencia" && !account) {
        throw new Error("Elegí la cuenta donde se acreditó la transferencia");
      }
      return updateTransaction({
        data: {
          id: row.id,
          clientId: client.id,
          date,
          concept: isPayment ? concept.trim() || "Pago a cuenta" : concept,
          amount: parsedAmount,
          documentation: isPayment ? docs : undefined,
          paymentMethod: isPayment ? method : null,
          dollarRate: isPayment && method === "Dólares" ? parsedRate : null,
          observations: isPayment ? obs || null : null,
          transferAccount: isPayment && method === "Transferencia" ? account : null,
        },
      });
    },
    onSuccess: (res) => {
      invalidate();
      toast.success(`Asiento actualizado · ${formatARS(res.amount)}`);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteTransaction({ data: { id: row.id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Asiento eliminado");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleDoc(d: string) {
    setDocs((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isPayment ? "Editar pago" : "Editar cargo"}</DialogTitle>
          <DialogDescription>
            Corregí un error de carga. El saldo del cliente se recalcula al guardar.
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
            <Label>Cliente</Label>
            <ClientPicker value={client} onChange={setClient} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="led-date">Fecha</Label>
              <Input
                id="led-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="led-amt">
                Monto {isPayment && method === "Dólares" ? "(USD)" : "(ARS)"}
              </Label>
              <Input
                id="led-amt"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="led-concept">Concepto</Label>
            <Textarea
              id="led-concept"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              required
              rows={2}
            />
          </div>

          {isPayment ? (
            <>
              <div className="space-y-1.5">
                <Label>Medio de pago</Label>
                <Select
                  value={method}
                  onValueChange={(v) => {
                    const next = v;
                    setMethod(next);
                    if (next !== "Transferencia") setAccount("");
                  }}
                >
                  <SelectTrigger aria-label="Medio de pago">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {labels.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {method === "Transferencia" ? (
                <div className="space-y-1.5">
                  <Label>Cuenta de acreditación</Label>
                  <Select
                    value={account || undefined}
                    onValueChange={(v) => setAccount(v)}
                  >
                    <SelectTrigger aria-label="Cuenta de acreditación">
                      <SelectValue placeholder="¿A qué cuenta se transfirió?" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {method === "Dólares" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="led-rate">Cotización dólar oficial</Label>
                  <Input
                    id="led-rate"
                    inputMode="decimal"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {dollar.data?.venta
                      ? `Oficial venta ${money.formatUSD(dollar.data.venta).replace("US$", "USD ")}`
                      : "Cotización del asiento, editable"}
                  </p>
                  {arsPreview > 0 ? (
                    <p className="text-sm">
                      Equivale a{" "}
                      <span className="tabular-nums font-medium">{money.formatARS(arsPreview)}</span>
                    </p>
                  ) : null}
                </div>
              ) : null}
              <fieldset className="space-y-2">
                <Label>Documentación</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {DOCUMENTATION_OPTIONS.map((d) => (
                    <label
                      key={d}
                      className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-card px-3"
                    >
                      <Checkbox checked={docs.includes(d)} onCheckedChange={() => toggleDoc(d)} />
                      <span className="text-sm">{d}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-1.5">
                <Label htmlFor="led-obs">Observaciones</Label>
                <Textarea id="led-obs" value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
              </div>
            </>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
              <ConfirmDialog
                title="¿Eliminar este asiento?"
                description="Sale del mayor y del saldo del cliente. No se puede deshacer."
                confirmLabel={remove.isPending ? "Eliminando…" : "Sí, eliminar"}
                destructive
                onConfirm={() => remove.mutate()}
              >
                {({ open }) => (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive"
                    onClick={open}
                  >
                    Eliminar
                  </Button>
                )}
              </ConfirmDialog>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cerrar
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Guardando…" : "Guardar cambios"}
                </Button>
              </div>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
