import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AuthGate, useSessionStaff } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cajaMedios } from "@/lib/medios";
import { getTransferReport } from "@/lib/fn/cobranzas";
import { formatDateAR, MONTHS_ES } from "@/lib/money";
import { useMoneyDisplay } from "@/lib/privacy";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cobranzas")({ component: CobranzasRoute });

function CobranzasRoute() {
  return (
    <AuthGate role="owner" module="caja">
      <CobranzasPage />
    </AuthGate>
  );
}

function currentYear() {
  return new Date().getFullYear();
}

function currentMonth() {
  return new Date().getMonth() + 1;
}

function CobranzasPage() {
  const money = useMoneyDisplay();
  const { estudio } = useSessionStaff();
  const { accounts } = cajaMedios(estudio?.paymentMethods);
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState<number | null>(currentMonth);
  const [account, setAccount] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["cobranzas", year, month, account],
    queryFn: () => getTransferReport({ data: { year, month, account } }),
  });
  const data = q.data;
  const years = data?.years?.length ? data.years : [year];
  const leader = data?.totals.find((t) => t.amount > 0);
  const concentrated = Boolean(leader && leader.share >= 0.5 && data && data.count >= 3);

  return (
    <AppShell
      title="Cobranzas"
      description="Transferencias por cuenta, para no amontonar todo en el mismo CBU"
    >
      <div className="space-y-4">
        <Card>
          <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Año</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger aria-label="Año">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mes</Label>
              <Select
                value={month == null ? "all" : String(month)}
                onValueChange={(v) => setMonth(v === "all" ? null : Number(v))}
              >
                <SelectTrigger aria-label="Mes">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo el año</SelectItem>
                  {MONTHS_ES.map((label, i) => (
                    <SelectItem key={label} value={String(i + 1)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cuenta</Label>
              <Select
                value={account ?? "all"}
                onValueChange={(v) => setAccount(v === "all" ? null : v)}
              >
                <SelectTrigger aria-label="Cuenta">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                  <SelectItem value="Sin cuenta">Sin cuenta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {q.isError ? (
          <p className="text-sm text-destructive">
            {q.error instanceof Error ? q.error.message : "No se pudo cargar el reporte."}
          </p>
        ) : q.isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Cargando cobranzas…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total del período
                </p>
                <p className="font-display text-3xl tabular-nums">{money.formatARS(data.amount)}</p>
                <p className="text-sm text-muted-foreground">
                  {data.count} {data.count === 1 ? "transferencia" : "transferencias"}
                  {account ? ` · viendo ${account}` : ""}
                </p>
              </div>
              {concentrated && leader ? (
                <p className="max-w-md text-sm text-warning">
                  {leader.account} concentra{" "}
                  {(leader.share * 100).toLocaleString("es-AR", { maximumFractionDigits: 0 })}% de
                  lo cobrado. Conviene dar el CBU de otra cuenta a algunos clientes.
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {data.totals.map((t) => {
                const pct = Math.round(t.share * 100);
                const active = account === t.account;
                return (
                  <button
                    key={t.account}
                    type="button"
                    onClick={() => setAccount(account === t.account ? null : t.account)}
                    className={cn(
                      "rounded-3xl bg-card p-5 text-left shadow-[var(--shadow-border)] transition-colors",
                      active && "ring-2 ring-ring",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{t.account}</p>
                      {leader?.account === t.account && t.amount > 0 ? (
                        <Badge variant="secondary">Más usada</Badge>
                      ) : null}
                    </div>
                    <p className="mt-3 font-display text-2xl tabular-nums tracking-tight">
                      {money.formatARS(t.amount)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.count} {t.count === 1 ? "cobro" : "cobros"}
                      {t.amount > 0 ? ` · ${pct}%` : ""}
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Movimientos</CardTitle>
                <CardDescription>
                  Cada transferencia del filtro. Tocá una cuenta arriba para ver solo esa.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {data.rows.length === 0 ? (
                  <p className="p-5 text-sm text-muted-foreground">
                    No hay transferencias con ese filtro.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="hidden sm:table-cell">Cuenta</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                            {formatDateAR(r.date)}
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{money.maskName(r.clientName)}</p>
                            <p className="text-xs text-muted-foreground sm:hidden">
                              {r.payment?.transferAccount || "Sin cuenta"}
                            </p>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {r.payment?.transferAccount || "Sin cuenta"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-payment">
                            {money.formatARS(r.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
