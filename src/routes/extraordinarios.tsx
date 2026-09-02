import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthGate, useSessionStaff } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { ClientPicker } from "@/components/client-picker";
import { CargoTemplatePicker } from "@/components/cargo-templates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { listClients } from "@/lib/fn/clients";
import type { Client } from "@/lib/fn/types";
import { recordExtraordinaryCharge } from "@/lib/fn/transactions";
import type { CargoTemplate } from "@/lib/fn/cargo-templates";
import { formatARS, todayISO } from "@/lib/money";
import { useMoneyDisplay } from "@/lib/privacy";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/extraordinarios")({ component: ExtraRoute });

function ExtraRoute() {
  return (
    <AuthGate role="owner" module="honorariosExtraordinarios">
      <AppShell
        title="Honorarios extraordinarios"
        description="Trabajos aislados, fuera del módulo mensual"
      >
        <ExtraForm />
      </AppShell>
    </AuthGate>
  );
}

function ExtraForm() {
  const { honorarioSummary, maskName } = useMoneyDisplay();
  const { estudio } = useSessionStaff();
  const estudioId = estudio?.id ?? "";
  const [client, setClient] = useState<Client | null>(null);
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [template, setTemplate] = useState<CargoTemplate | null>(null);
  const year = new Date().getFullYear();

  function applyTemplate(t: CargoTemplate | null) {
    setTemplate(t);
    if (t) {
      setConcept(t.concept);
      if (t.suggestedAmount > 0) setAmount(String(t.suggestedAmount));
    }
  }

  const ddjj = useQuery({
    queryKey: ["clients-ddjj"],
    queryFn: () => listClients({ data: { ganancias: "ddjj" } }),
  });

  const mutate = useMutation({
    mutationFn: () => {
      if (!client) throw new Error("Elegí un cliente");
      return recordExtraordinaryCharge({
        data: {
          clientId: client.id,
          concept,
          amount: Number(amount.replace(",", ".")),
          date,
        },
      });
    },
    onSuccess: () => {
      toast.success(`Cargo de ${formatARS(Number(amount.replace(",", ".")))} emitido`);
      setClient(null);
      setConcept("");
      setAmount("");
      setDate(todayISO());
      setTemplate(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function pickDdjjClient(c: Client) {
    setClient(c);
    if (!concept.trim()) setConcept(`DDJJ Ganancias ${year}`);
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Nuevo cargo</CardTitle>
          <CardDescription>
            Balances, constituciones, DDJJ y otros trabajos puntuales. Si te
            equivocás, corregilo en el libro mayor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutate.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <ClientPicker value={client} onChange={setClient} />
              {client ? (
                <p className="text-xs text-muted-foreground">
                  {client.gananciasInMonthly
                    ? "Ganancias ya está incluida en el honorario mensual."
                    : "Este cliente cobra Ganancias en la DDJJ."}
                </p>
              ) : null}
            </div>
            {estudioId ? (
              <CargoTemplatePicker
                estudioId={estudioId}
                value={template}
                onChange={applyTemplate}
              />
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="concept">Concepto</Label>
              <Textarea
                id="concept"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                required
                placeholder="Ej. Balance 2025 y DDJJ Ganancias"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="amt">Monto (ARS)</Label>
                <Input
                  id="amt"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dt">Fecha</Label>
                <Input id="dt" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={mutate.isPending}>
              {mutate.isPending ? "Emitiendo…" : "Emitir cargo"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Ganancias en DDJJ</CardTitle>
          <CardDescription>
            Clientes que no la tienen en el mensual. Tocá uno para cargársela como extraordinario.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {(ddjj.data ?? []).length === 0 && !ddjj.isLoading ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Nadie cobra Ganancias en la DDJJ. En Clientes podés marcar la categoría.
            </p>
          ) : (
            <ul className="max-h-[28rem] overflow-y-auto">
              {(ddjj.data ?? []).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => pickDdjjClient(c)}
                    className={cn(
                      "flex w-full items-start justify-between gap-3 px-6 py-3 text-left hover:bg-muted",
                      client?.id === c.id && "bg-muted",
                    )}
                  >
                    <span>
                      <span className="block text-sm font-medium">{maskName(c.name)}</span>
                      <span className="text-xs text-muted-foreground">
                        {honorarioSummary(c).label}
                      </span>
                    </span>
                    <Badge variant="outline">DDJJ</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
