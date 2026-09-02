import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import { AuthGate, useSessionStaff } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { ClientPicker } from "@/components/client-picker";
import { GananciasBadge } from "@/components/ganancias-badge";
import { BalanceFigure, StatementTable, TxList } from "@/components/tx-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getClientAccount } from "@/lib/fn/transactions";
import { useMoneyDisplay } from "@/lib/privacy";
import { generateClientAccountPdf } from "@/lib/pdf/client-account-pdf";

type CcSearch = { cliente?: number };

export const Route = createFileRoute("/cuenta-corriente")({
  validateSearch: (raw: Record<string, unknown>): CcSearch => {
    const n = Number(raw.cliente);
    return Number.isInteger(n) && n > 0 ? { cliente: n } : {};
  },
  component: CcRoute,
});

function CcRoute() {
  return (
    <AuthGate module="cuentaCorriente">
      <AppShell title="Cuenta corriente" description="Saldo, últimos movimientos y extracto">
        <AccountLookup />
      </AppShell>
    </AuthGate>
  );
}

function AccountLookup() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/cuenta-corriente" });
  const { formatARS, honorarioSummary, maskName, maskCuit } = useMoneyDisplay();
  const { estudio } = useSessionStaff();
  const clientId = search.cliente;
  const q = useQuery({
    queryKey: ["account", clientId],
    queryFn: () => getClientAccount({ data: { clientId: clientId! } }),
    enabled: Boolean(clientId),
  });
  const selected = q.data?.client ?? null;
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Card>
        <CardContent className="p-5">
          <ClientPicker
            value={selected}
            onChange={(c) => void navigate({ search: c ? { cliente: c.id } : {} })}
            placeholder="Buscar un cliente…"
          />
        </CardContent>
      </Card>

      {!clientId ? (
        <p className="px-1 text-sm text-muted-foreground">Elegí un cliente para ver su saldo.</p>
      ) : q.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando cuenta…</p>
      ) : q.data ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-display text-2xl">{maskName(q.data.client.name)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {maskCuit(q.data.client.cuit)}
                  {q.data.client.ivaCondition ? ` · ${q.data.client.ivaCondition}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(() => {
                    const fee = honorarioSummary(q.data.client);
                    return (
                      <Badge variant={fee.kind === "variable" ? "muted" : "secondary"}>
                        {fee.kind === "variable" ? "Sin honorario fijo" : fee.label}
                      </Badge>
                    );
                  })()}
                  <GananciasBadge included={q.data.client.gananciasInMonthly} />
                  {q.data.client.companyType ? (
                    <Badge variant="outline">{q.data.client.companyType}</Badge>
                  ) : null}
                </div>
              </div>
              <BalanceFigure amount={q.data.balance} />
              {selected && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isGeneratingPdf}
                  onClick={async () => {
                    setIsGeneratingPdf(true);
                    try {
                      const logoDataUrl = await loadLogoAsDataUrl(estudio?.metadata?.logoPath);
                      const doc = generateClientAccountPdf({
                        account: q.data,
                        estudio: estudio,
                        money: { formatARS, maskName, maskCuit },
                        logoDataUrl,
                      });
                      const name = selected.name.replace(/[^a-zA-Z0-9]/g, "_");
                      doc.save(`cta_cte_${name}.pdf`);
                    } finally {
                      setIsGeneratingPdf(false);
                    }
                  }}
                >
                  <FileDown className="h-4 w-4" />
                  {isGeneratingPdf ? "Generando…" : "Descargar PDF"}
                </Button>
              )}
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Últimos cargos</CardTitle>
              </CardHeader>
              <CardContent>
                <TxList rows={q.data.lastCharges} empty="Sin cargos." />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Últimos pagos</CardTitle>
              </CardHeader>
              <CardContent>
                <TxList rows={q.data.lastPayments} empty="Sin pagos." />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Extracto</CardTitle>
              <CardDescription>
                Planilla cronológica: cada cargo suma, cada pago resta. El saldo de la última fila
                es el de la cuenta.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[32rem] overflow-auto p-0">
              <StatementTable rows={q.data.statement} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="px-1 text-sm text-muted-foreground">No se encontró esa cuenta.</p>
      )}
    </div>
  );
}

/**
 * Carga el logo del estudio desde su URL pública y lo convierte a data URL.
 * Devuelve `null` si no hay logo, si la URL falla o si el formato no es
 * PNG/JPEG (jsPDF no soporta SVG ni WebP en addImage).
 */
async function loadLogoAsDataUrl(logoPath: string | null | undefined): Promise<string | null> {
  if (!logoPath) return null;
  const ext = logoPath.split(".").pop()?.toLowerCase() ?? "";
  if (ext !== "png" && ext !== "jpg" && ext !== "jpeg") return null;
  try {
    const res = await fetch(logoPath);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
