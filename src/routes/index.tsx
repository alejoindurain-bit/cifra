import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { AuthGate, useSessionStaff } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { BackupButton } from "@/components/backup-button";
import { TxList } from "@/components/tx-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboard } from "@/lib/fn/dashboard";
import { triggerMonthlyBilling } from "@/lib/fn/billing";
import { VENCIMIENTO_KIND_LABEL } from "@/lib/constants";
import { formatDateAR, monthLabel, todayISO } from "@/lib/money";
import { useMoneyDisplay } from "@/lib/privacy";

export const Route = createFileRoute("/")({ component: HomeRoute });

function HomeRoute() {
  return (
    <AuthGate>
      <Home />
    </AuthGate>
  );
}

function Home() {
  const { staff, isPending } = useSessionStaff();
  if (isPending) return null;
  if (staff?.role === "employee") return <Navigate to="/caja" />;
  return (
    <AppShell title="Tablero" description="Ingresos, deuda y flujo del estudio">
      <DashboardBody />
    </AppShell>
  );
}

function DashboardBody() {
  const qc = useQueryClient();
  const money = useMoneyDisplay();
  const { estudio } = useSessionStaff();
  const flags = estudio?.flags;
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const run = useMutation({
    mutationFn: () => triggerMonthlyBilling(),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (res.ran) {
        toast.success(
          `Honorarios ${monthLabel(res.year, res.month)}: ${res.clientsBilled} clientes`,
        );
      } else {
        toast.message("Los honorarios de este mes ya estaban generados");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading || !q.data) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
      </div>
    );
  }

  const d = q.data;
  const billedThisMonth = d.lastBilling?.alreadyDone || (d.lastBilling?.clientsBilled ?? 0) > 0;
  const showModule = Boolean(flags?.dashIibbPba && flags.cpceba);
  const showIncome = flags?.dashCobradoMes !== false;
  const showPending = flags?.dashPendiente !== false;
  const showChart = flags?.dashGrafico !== false;
  const showHonorarios = flags?.honorariosMensuales !== false;
  const upcoming = d.upcomingVencimientos ?? [];
  const showVencimientos = Boolean(flags?.dashVencimientos) && upcoming.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {showIncome ? (
          <Stat label="Ingresos del mes" value={money.formatARS(d.monthIncome)} hint="Pagos registrados" />
        ) : null}
        {flags?.honorarios !== false ? (
          <Stat label="Cargos del mes" value={money.formatARS(d.monthCharges)} hint="Honorarios y extras" />
        ) : null}
        {showPending ? (
          <Stat label="Deuda total" value={money.formatARS(d.totalDebt)} hint="Saldos positivos" />
        ) : null}
        {showModule ? (
          <Stat
            label="Módulo CPCEBA"
            value={money.formatARS(d.module.value)}
            hint={
              d.module.vigencia
                ? `Vigencia ${d.module.vigencia}`
                : d.module.source === "live"
                  ? "Valor vigente"
                  : "Último valor conocido"
            }
          />
        ) : null}
      </div>

      {showHonorarios ? (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-card p-5 shadow-[var(--shadow-border)]">
        <div>
          <p className="font-display text-lg">Honorarios fijos del mes</p>
          <p className="text-sm text-muted-foreground">
            {billedThisMonth
              ? `Ya se liquidaron ${d.lastBilling?.clientsBilled ?? d.activeFixed} clientes con honorario fijo.`
              : `${d.activeFixed} clientes con honorario fijo listos para liquidar.`}
          </p>
        </div>
        <Button type="button" onClick={() => run.mutate()} disabled={run.isPending}>
          {run.isPending ? "Liquidando…" : "Generar honorarios"}
        </Button>
      </div>
      ) : null}

      {showVencimientos ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Próximos vencimientos</CardTitle>
              <CardDescription>Pendientes, ordenados por fecha</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/vencimientos">Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {upcoming.map((v) => {
                const overdue = v.status === "pendiente" && v.dueDate < todayISO();
                return (
                  <li key={v.id}>
                    <Link
                      to="/vencimientos"
                      className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-muted"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{v.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {VENCIMIENTO_KIND_LABEL[v.kind]}
                          {v.clientName ? ` · ${money.maskName(v.clientName)}` : ""}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-2">
                        {overdue ? <Badge variant="charge">Vencido</Badge> : null}
                        <span className={overdue ? "tabular-nums text-sm text-charge" : "tabular-nums text-sm"}>
                          {formatDateAR(v.dueDate)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        {showChart ? (
        <Card className={showPending ? "lg:col-span-3" : "lg:col-span-5"}>
          <CardHeader>
            <CardTitle>Flujo de fondos</CardTitle>
            <CardDescription>Cargos frente a cobranzas</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {d.cashflow.length === 0 ? (
              <p className="py-10 text-sm text-muted-foreground">Todavía no hay movimientos.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.cashflow} barGap={4}>
                  <CartesianGrid stroke="color-mix(in oklab, var(--foreground) 8%, transparent)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={(v: number) => money.compact(v)}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip
                    formatter={(value) => money.formatARS(Number(value ?? 0))}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                    }}
                  />
                  <Bar dataKey="charges" name="Cargos" fill="var(--color-charge)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="payments" name="Pagos" fill="var(--color-payment)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        ) : null}

        {showPending ? (
        <Card className={showChart ? "lg:col-span-2" : "lg:col-span-5"}>
          <CardHeader>
            <CardTitle>Top deudores</CardTitle>
            <CardDescription>Saldo y atraso en meses de honorario</CardDescription>
          </CardHeader>
          <CardContent>
            {d.topDebtors.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nadie debe. Bien.</p>
            ) : (
              <ul className="space-y-1">
                {d.topDebtors.map((c, i) => (
                  <li key={c.id}>
                    <Link
                      to="/cuenta-corriente"
                      search={{ cliente: c.id }}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-muted"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          <span className="mr-2 text-muted-foreground">{i + 1}</span>
                          {money.maskName(c.name)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.monthsEquivalent != null
                            ? `${money.formatMonths(c.monthsEquivalent)} meses de honorario`
                            : "Sin honorario fijo"}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 tabular-nums text-sm text-charge">
                        {money.formatARS(c.balance)}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Últimos movimientos</CardTitle>
            <CardDescription>Cargos y pagos recientes</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/libro-mayor">Libro mayor</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <TxList rows={d.recent} empty="Sin movimientos todavía." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Respaldo</CardTitle>
          <CardDescription>
            Descargá el mayor y los clientes a tu computadora. Si alguna vez hay que reconstruir
            Cifra, con esos archivos no se parte de cero.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <BackupButton kind="clients" />
          <BackupButton kind="ledger" />
          <BackupButton kind="full" variant="secondary" />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 font-display text-2xl tabular-nums tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
