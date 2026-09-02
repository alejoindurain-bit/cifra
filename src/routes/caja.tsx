import { useEffect, useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthGate, useSessionStaff } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { ClientPicker } from "@/components/client-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DOCUMENTATION_OPTIONS } from "@/lib/constants";
import type { Client, VocabEntry } from "@/lib/fn/types";
import { getDollarRate } from "@/lib/fn/rates";
import { recordPayment } from "@/lib/fn/transactions";
import { formatARS, todayISO } from "@/lib/money";
import { useMoneyDisplay } from "@/lib/privacy";
import { downloadRecibo } from "@/lib/recibo";

export const Route = createFileRoute("/caja")({ component: CajaRoute });

function CajaRoute() {
  return (
    <AuthGate module="caja">
      <AppShell title="Caja" description="Registrar un pago">
        <PaymentForm />
      </AppShell>
    </AuthGate>
  );
}

const emptyDocs: string[] = [];

function PaymentForm() {
  const money = useMoneyDisplay();
  const { estudio } = useSessionStaff();

  // Get labels from vocab (payment_method) - active only
  const labels = useMemo(() => {
    return (estudio?.vocab?.payment_method ?? [])
      .filter((e: VocabEntry) => e.active)
      .map((e: VocabEntry) => e.value);
  }, [estudio?.vocab]);

  // Get accounts from vocab (transfer_account) - active only
  const accounts = useMemo(() => {
    return (estudio?.vocab?.transfer_account ?? [])
      .filter((e: VocabEntry) => e.active)
      .map((e: VocabEntry) => e.value);
  }, [estudio?.vocab]);

  // Get documentation options from vocab - active only
  const docOptions = useMemo(() => {
    return (estudio?.vocab?.documentation ?? [])
      .filter((e: VocabEntry) => e.active)
      .map((e: VocabEntry) => e.value);
  }, [estudio?.vocab]);
  const defaultMethod = labels.includes("Transferencia") ? "Transferencia" : labels[0] ?? "Transferencia";
  const [client, setClient] = useState<Client | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [docs, setDocs] = useState<string[]>(emptyDocs);
  const [method, setMethod] = useState(defaultMethod);
  const [account, setAccount] = useState("");
  const [rate, setRate] = useState("");
  const [obs, setObs] = useState("");
  const [wantReceipt, setWantReceipt] = useState(false);

  useEffect(() => {
    if (!labels.includes(method) && labels[0]) setMethod(labels[0]);
  }, [labels, method]);

  useEffect(() => {
    try {
      if (localStorage.getItem("cifra-generar-recibo") === "1") setWantReceipt(true);
    } catch {
      /* ignore */
    }
  }, []);

  function setReceiptPref(next: boolean) {
    setWantReceipt(next);
    try {
      localStorage.setItem("cifra-generar-recibo", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  const dollar = useQuery({
    queryKey: ["dollar"],
    queryFn: () => getDollarRate(),
    enabled: method === "Dólares",
  });

  useEffect(() => {
    if (method === "Dólares" && dollar.data?.venta && !rate) {
      setRate(String(dollar.data.venta));
    }
  }, [method, dollar.data, rate]);

  const parsedAmount = Number(amount.replace(",", "."));
  const parsedRate = Number(rate.replace(",", "."));
  const arsPreview =
    method === "Dólares" && parsedAmount > 0 && parsedRate > 0
      ? Math.round(parsedAmount * parsedRate * 100) / 100
      : parsedAmount;

  const mutate = useMutation({
    mutationFn: () => {
      if (!client) throw new Error("Elegí un cliente");
      if (method === "Transferencia" && !account) {
        throw new Error("Elegí la cuenta donde se acreditó la transferencia");
      }
      return recordPayment({
        data: {
          clientId: client.id,
          amount: parsedAmount,
          date,
          documentation: docs,
          paymentMethod: method,
          dollarRate: method === "Dólares" ? parsedRate : null,
          observations: obs || null,
          transferAccount: method === "Transferencia" ? account : null,
        },
      });
    },
    onSuccess: (res) => {
      if (wantReceipt && client) {
        try {
          downloadRecibo({
            id: res.id,
            clientName: client.name,
            cuit: client.cuit,
            amount: res.amount,
            date,
            paymentMethod: method,
            transferAccount: method === "Transferencia" ? account || null : null,
            dollarAmount: method === "Dólares" ? parsedAmount : null,
            dollarRate: method === "Dólares" ? parsedRate : null,
            firmName: estudio?.displayName,
          });
          toast.success(`Pago de ${formatARS(res.amount)} registrado. Recibo listo para imprimir.`);
        } catch {
          toast.success(`Pago de ${formatARS(res.amount)} registrado`);
          toast.error("El pago quedó asentado, pero no se pudo armar el recibo PDF.");
        }
      } else {
        toast.success(`Pago de ${formatARS(res.amount)} registrado`);
      }
      setClient(null);
      setAmount("");
      setDate(todayISO());
      setDocs([]);
      setMethod(defaultMethod);
      setAccount("");
      setRate("");
      setObs("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleDoc(d: string) {
    setDocs((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Nuevo pago</CardTitle>
        <CardDescription>Queda asentado en la cuenta corriente del cliente.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            mutate.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <ClientPicker value={client} onChange={setClient} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Monto {method === "Dólares" ? "(USD)" : "(ARS)"}</Label>
              <Input
                id="amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Fecha</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Medio de pago</Label>
            <Select
              value={method}
              onValueChange={(v) => {
                setMethod(v);
                if (v !== "Transferencia") setAccount("");
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
              <Label htmlFor="rate">Cotización dólar oficial</Label>
              <Input
                id="rate"
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                {dollar.isLoading
                  ? "Consultando tipo de cambio…"
                  : dollar.data?.venta
                    ? `Oficial venta ${money.formatUSD(dollar.data.venta).replace("US$", "USD ")} · se puede editar`
                    : "No se pudo consultar la API; cargala a mano"}
              </p>
              {arsPreview > 0 ? (
                <p className="text-sm">
                  Equivale a <span className="tabular-nums font-medium">{money.formatARS(arsPreview)}</span> en la cuenta.
                </p>
              ) : null}
            </div>
          ) : null}

          <fieldset className="space-y-2">
            <Label>Documentación</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(docOptions.length > 0 ? docOptions : DOCUMENTATION_OPTIONS).map((d) => (
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
            <Label htmlFor="obs">Observaciones</Label>
            <Textarea id="obs" value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
          </div>

          <label className="flex min-h-11 items-start gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
            <Checkbox
              checked={wantReceipt}
              onCheckedChange={(v) => setReceiptPref(v === true)}
              aria-label="Generar Recibo PDF"
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium">Generar Recibo PDF</span>
              <span className="block text-xs text-muted-foreground">
                Tercio de arriba de una A4, con renglón de corte para reutilizar el resto de la hoja.
              </span>
            </span>
          </label>

          <Button type="submit" className="w-full" disabled={mutate.isPending}>
            {mutate.isPending ? "Procesando…" : "Procesar pago"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
