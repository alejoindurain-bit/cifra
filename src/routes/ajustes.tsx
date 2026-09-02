import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthGate, useSessionStaff } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateEstudioSettings } from "@/lib/fn/estudio";
import { VocabManager } from "@/components/vocab-manager";
import { MetadataForm } from "@/components/estudio-metadata-form";
import type { EstudioFlags } from "@/lib/fn/types";

export const Route = createFileRoute("/ajustes")({ component: AjustesRoute });

const MODULE_FLAGS: Array<{ key: keyof EstudioFlags; label: string; hint: string }> = [
  { key: "caja", label: "Caja", hint: "Registrar cobros" },
  { key: "cuentaCorriente", label: "Cuenta corriente", hint: "Saldos y libro mayor" },
  { key: "honorarios", label: "Honorarios", hint: "Cargos de honorarios" },
  { key: "cpceba", label: "Módulo CPCEBA", hint: "Valor del módulo y honorarios por módulos" },
  { key: "cobrosFijos", label: "Cobros fijos", hint: "Clientes con honorario fijo" },
  { key: "honorariosMensuales", label: "Honorarios mensuales", hint: "Liquidación del día 1" },
  { key: "honorariosExtraordinarios", label: "Honorarios extraordinarios", hint: "Trabajos aislados" },
  { key: "pbaIibb", label: "Módulo PBA / IIBB", hint: "Recuadro de Ingresos Brutos PBA" },
  { key: "vencimientos", label: "Vencimientos", hint: "Obligaciones y widget del tablero" },
];

const DASH_FLAGS: Array<{ key: keyof EstudioFlags; label: string }> = [
  { key: "dashCobradoMes", label: "Cobrado del mes" },
  { key: "dashPendiente", label: "Pendiente / deuda" },
  { key: "dashVencimientos", label: "Próximos vencimientos" },
  { key: "dashGrafico", label: "Gráfico de flujo" },
  { key: "dashIibbPba", label: "Recuadro IIBB / CPCEBA" },
];

function AjustesRoute() {
  return (
    <AuthGate role="owner">
      <AppShell title="Ajustes" description="Nombre, módulos, tablero y vocabulario de este estudio">
        <AjustesBody />
      </AppShell>
    </AuthGate>
  );
}

function AjustesBody() {
  const { estudio } = useSessionStaff();
  if (!estudio) return null;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <SettingsForm key={estudio.id} />
      <VocabManager key={`${estudio.id}-vocab`} />
      <MetadataForm key={`${estudio.id}-metadata`} />
    </div>
  );
}

function SettingsForm() {
  const { estudio } = useSessionStaff();
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState(estudio?.displayName ?? "");
  const [accent, setAccent] = useState(estudio?.accentColor ? `#${estudio.accentColor}` : "");
  const [flags, setFlags] = useState<EstudioFlags>(
    estudio?.flags ?? {
      caja: true,
      cuentaCorriente: true,
      honorarios: true,
      cpceba: true,
      cobrosFijos: true,
      honorariosMensuales: true,
      honorariosExtraordinarios: true,
      pbaIibb: true,
      vencimientos: true,
      dashCobradoMes: true,
      dashPendiente: true,
      dashVencimientos: true,
      dashGrafico: true,
      dashIibbPba: true,
    },
  );

  const save = useMutation({
    mutationFn: () =>
      updateEstudioSettings({
        data: {
          displayName,
          accentColor: accent || null,
          flags,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["session"] });
      toast.success("Ajustes guardados");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(key: keyof EstudioFlags, value: boolean) {
    setFlags((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estudio</CardTitle>
        <CardDescription>
          El nombre aparece en el recibo. El color es opcional y no cambia el resto de la interfaz.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="estudio-name">Nombre del estudio</Label>
            <Input
              id="estudio-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="accent">Color de acento (opcional)</Label>
            <Input
              id="accent"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              placeholder="#2A4A3C"
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Módulos</p>
            <div className="space-y-1">
              {MODULE_FLAGS.map((f) => (
                <label
                  key={f.key}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-2"
                >
                  <span>
                    <span className="block text-sm">{f.label}</span>
                    <span className="block text-xs text-muted-foreground">{f.hint}</span>
                  </span>
                  <Switch checked={flags[f.key]} onCheckedChange={(v) => toggle(f.key, v)} />
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Tablero</p>
            <div className="space-y-1">
              {DASH_FLAGS.map((f) => (
                <label
                  key={f.key}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-2"
                >
                  <span className="text-sm">{f.label}</span>
                  <Switch checked={flags[f.key]} onCheckedChange={(v) => toggle(f.key, v)} />
                </label>
              ))}
            </div>
            <p className="mt-2 px-2 text-xs text-muted-foreground">
              Próximos vencimientos no se muestra si no hay datos de vencimientos.
            </p>
          </div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Guardando…" : "Guardar ajustes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
