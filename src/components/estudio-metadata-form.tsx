import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  updateMetadata,
  uploadLogo,
  removeLogo,
} from "@/lib/fn/estudio-metadata";
import { useSessionStaff } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { EstudioMetadata } from "@/lib/fn/types";

type Domicilio = EstudioMetadata["domicilio"];

const EMPTY_DOM: Domicilio = {
  calle: null,
  numero: null,
  piso: null,
  depto: null,
  localidad: null,
  provincia: null,
  cp: null,
};

function strOrEmpty(v: string | null | undefined): string {
  return v ?? "";
}

function parseDomicilio(d: Domicilio | undefined): Record<keyof Domicilio, string> {
  return {
    calle: strOrEmpty(d?.calle),
    numero: strOrEmpty(d?.numero),
    piso: strOrEmpty(d?.piso),
    depto: strOrEmpty(d?.depto),
    localidad: strOrEmpty(d?.localidad),
    provincia: strOrEmpty(d?.provincia),
    cp: strOrEmpty(d?.cp),
  };
}

function normalize(s: string): string | null {
  const t = s.trim();
  return t ? t : null;
}

export function MetadataForm() {
  const qc = useQueryClient();
  const { estudio, user } = useSessionStaff();
  const meta = estudio?.metadata ?? null;

  const [dom, setDom] = useState<Record<keyof Domicilio, string>>(
    parseDomicilio(meta?.domicilio),
  );
  const [cuit, setCuit] = useState(meta?.cuit ?? "");
  const [telefono, setTelefono] = useState(meta?.telefono ?? "");
  const [email, setEmail] = useState(meta?.email ?? "");
  const [web, setWeb] = useState(meta?.web ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(meta?.logoPath ?? null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // When the session is invalidated and refetched (e.g. after a save), sync
  // local form state from the fresh metadata.
  useEffect(() => {
    setDom(parseDomicilio(meta?.domicilio));
    setCuit(meta?.cuit ?? "");
    setTelefono(meta?.telefono ?? "");
    setEmail(meta?.email ?? "");
    setWeb(meta?.web ?? "");
    setLogoUrl(meta?.logoPath ?? null);
  }, [meta?.logoPath, meta?.cuit, meta?.telefono, meta?.email, meta?.web, meta?.domicilio?.calle, meta?.domicilio?.numero, meta?.domicilio?.piso, meta?.domicilio?.depto, meta?.domicilio?.localidad, meta?.domicilio?.provincia, meta?.domicilio?.cp]);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["session", user?.id ?? ""] });
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      updateMetadata({
        data: {
          cuit: normalize(cuit),
          telefono: normalize(telefono),
          email: normalize(email),
          web: normalize(web),
          domicilio: {
            calle: normalize(dom.calle),
            numero: normalize(dom.numero),
            piso: normalize(dom.piso),
            depto: normalize(dom.depto),
            localidad: normalize(dom.localidad),
            provincia: normalize(dom.provincia),
            cp: normalize(dom.cp),
          },
        },
      }),
    onSuccess: async () => {
      await refresh();
      toast.success("Datos guardados");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const bytes = await file.arrayBuffer();
      const contentBase64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
      return uploadLogo({
        data: {
          filename: file.name || "logo",
          mimeType: file.type || "application/octet-stream",
          contentBase64,
        },
      });
    },
    onSuccess: async (res) => {
      setLogoUrl(res.path);
      await refresh();
      toast.success("Logo subido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: () => removeLogo({}),
    onSuccess: async () => {
      setLogoUrl(null);
      await refresh();
      toast.success("Logo quitado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const anyPending = saveMutation.isPending || uploadMutation.isPending || removeMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos del estudio</CardTitle>
        <CardDescription>
          Aparecen en el encabezado del recibo PDF. El logo se sube desde tu
          equipo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <section className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/30">
                {logoUrl ? (
                  // eslint-disable-next-line jsx-a11y/img-redundant-alt
                  <img
                    src={logoUrl}
                    alt="Logo del estudio"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Sin logo</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadMutation.mutate(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={anyPending}
                >
                  {uploadMutation.isPending ? "Subiendo…" : logoUrl ? "Cambiar logo" : "Subir logo"}
                </Button>
                {logoUrl ? (
                  <ConfirmDialog
                    title="Quitar logo"
                    description="¿Eliminar el logo del estudio? Quedará sin imagen."
                    confirmLabel="Quitar"
                    destructive
                    onConfirm={() => removeMutation.mutate()}
                  >
                    {({ open }) => (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={open}
                        disabled={anyPending}
                      >
                        Quitar logo
                      </Button>
                    )}
                  </ConfirmDialog>
                ) : null}
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium">Domicilio</p>
            <div className="grid gap-3 sm:grid-cols-6">
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="dom-calle">Calle</Label>
                <Input
                  id="dom-calle"
                  value={dom.calle}
                  onChange={(e) => setDom((d) => ({ ...d, calle: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="dom-numero">Número</Label>
                <Input
                  id="dom-numero"
                  value={dom.numero}
                  onChange={(e) => setDom((d) => ({ ...d, numero: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="dom-piso">Piso</Label>
                <Input
                  id="dom-piso"
                  value={dom.piso}
                  onChange={(e) => setDom((d) => ({ ...d, piso: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="dom-depto">Dto</Label>
                <Input
                  id="dom-depto"
                  value={dom.depto}
                  onChange={(e) => setDom((d) => ({ ...d, depto: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="dom-localidad">Localidad</Label>
                <Input
                  id="dom-localidad"
                  value={dom.localidad}
                  onChange={(e) => setDom((d) => ({ ...d, localidad: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="dom-provincia">Provincia</Label>
                <Input
                  id="dom-provincia"
                  value={dom.provincia}
                  onChange={(e) => setDom((d) => ({ ...d, provincia: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="dom-cp">CP</Label>
                <Input
                  id="dom-cp"
                  value={dom.cp}
                  onChange={(e) => setDom((d) => ({ ...d, cp: e.target.value }))}
                />
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium">Contacto</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cuit">CUIT</Label>
                <Input
                  id="cuit"
                  value={cuit}
                  onChange={(e) => setCuit(e.target.value)}
                  placeholder="30-12345678-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="011 4321-0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="estudio@ejemplo.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="web">Web</Label>
                <Input
                  id="web"
                  value={web}
                  onChange={(e) => setWeb(e.target.value)}
                  placeholder="estudio.com.ar"
                />
              </div>
            </div>
          </section>

          <Button type="submit" disabled={anyPending}>
            {saveMutation.isPending ? "Guardando…" : "Guardar datos"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Keep the empty constant in scope for tests / future debug.
export const __test = { EMPTY_DOM };
