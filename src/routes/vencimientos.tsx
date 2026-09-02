import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { ClientPicker } from "@/components/client-picker";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  VENCIMIENTO_KIND_LABEL,
  VENCIMIENTO_KINDS,
  VENCIMIENTO_STATUS_LABEL,
} from "@/lib/constants";
import { listVencimientos, setVencimientoStatus, upsertVencimiento } from "@/lib/fn/vencimientos";
import type { Client, Vencimiento, VencimientoKind, VencimientoStatus } from "@/lib/fn/types";
import { formatDateAR, todayISO } from "@/lib/money";
import { useMoneyDisplay } from "@/lib/privacy";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vencimientos")({ component: VencimientosRoute });

type StatusFilter = "pendiente" | "cumplido" | "all";

function VencimientosRoute() {
  return (
    <AuthGate role="owner" module="vencimientos">
      <VencimientosPage />
    </AuthGate>
  );
}

function isOverdue(dueDate: string, status: VencimientoStatus) {
  return status === "pendiente" && dueDate < todayISO();
}

function clientStub(v: Vencimiento): Client | null {
  if (v.clientId == null || !v.clientName) return null;
  return {
    id: v.clientId,
    estudioId: v.estudioId,
    name: v.clientName,
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
    createdAt: v.createdAt,
    updatedAt: v.createdAt,
    balance: 0,
  };
}

function VencimientosPage() {
  const money = useMoneyDisplay();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("pendiente");
  const [editing, setEditing] = useState<Vencimiento | "new" | null>(null);

  const list = useQuery({
    queryKey: ["vencimientos", filter],
    queryFn: () => listVencimientos({ data: { status: filter } }),
  });

  const mark = useMutation({
    mutationFn: (id: number) => setVencimientoStatus({ data: { id, status: "cumplido" } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vencimientos"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Marcado como cumplido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = list.data ?? [];

  return (
    <AppShell
      title="Vencimientos"
      description="IVA, IIBB, Ganancias, DDJJ y otras fechas del estudio"
      action={
        <Button type="button" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" />
          Nuevo
        </Button>
      }
    >
      <div className="mb-4">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
          <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
            <TabsTrigger value="pendiente">Pendientes</TabsTrigger>
            <TabsTrigger value="cumplido">Cumplidos</TabsTrigger>
            <TabsTrigger value="all">Todos</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                <TableHead className="hidden md:table-cell">Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((v) => {
                const overdue = isOverdue(v.dueDate, v.status);
                return (
                  <TableRow
                    key={v.id}
                    className="cursor-pointer"
                    onClick={() => setEditing(v)}
                  >
                    <TableCell>
                      <p className="font-medium">{v.title}</p>
                      <p className="text-xs text-muted-foreground sm:hidden">
                        {VENCIMIENTO_KIND_LABEL[v.kind]}
                        {v.clientName ? ` · ${money.maskName(v.clientName)}` : ""}
                      </p>
                    </TableCell>
                    <TableCell
                      className={cn("tabular-nums", overdue && "font-medium text-charge")}
                    >
                      {formatDateAR(v.dueDate)}
                      {overdue ? (
                        <span className="mt-0.5 block text-xs">Vencido</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary">{VENCIMIENTO_KIND_LABEL[v.kind]}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {v.clientName ? money.maskName(v.clientName) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={v.status === "cumplido" ? "payment" : overdue ? "charge" : "outline"}>
                        {VENCIMIENTO_STATUS_LABEL[v.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {v.status === "pendiente" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={mark.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            mark.mutate(v.id);
                          }}
                        >
                          Cumplido
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {rows.length === 0 && !list.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">
              {filter === "pendiente"
                ? "No hay vencimientos pendientes. Cargá uno para que aparezca en el tablero."
                : "No hay vencimientos con ese criterio."}
            </p>
          ) : null}
        </CardContent>
      </Card>
      {editing !== null ? (
        <VencimientoForm
          key={editing === "new" ? "new" : editing.id}
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </AppShell>
  );
}

function VencimientoForm({
  item,
  onClose,
}: {
  item: Vencimiento | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(item?.title ?? "");
  const [dueDate, setDueDate] = useState(item?.dueDate ?? todayISO());
  const [kind, setKind] = useState<VencimientoKind>(item?.kind ?? "iva");
  const [status, setStatus] = useState<VencimientoStatus>(item?.status ?? "pendiente");
  const [client, setClient] = useState<Client | null>(item ? clientStub(item) : null);

  const save = useMutation({
    mutationFn: () =>
      upsertVencimiento({
        data: {
          id: item?.id,
          title,
          dueDate,
          kind,
          status,
          clientId: client?.id ?? null,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vencimientos"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(item ? "Vencimiento actualizado" : "Vencimiento cargado");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Editar vencimiento" : "Nuevo vencimiento"}</DialogTitle>
          <DialogDescription>
            Lo pendiente aparece en el widget del inicio, ordenado por fecha.
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
            <Label htmlFor="vence-title">Título</Label>
            <Input
              id="vence-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="IVA agosto 2026"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vence-date">Fecha</Label>
              <Input
                id="vence-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as VencimientoKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENCIMIENTO_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {VENCIMIENTO_KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Cliente (opcional)</Label>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <ClientPicker value={client} onChange={setClient} placeholder="Sin cliente" />
              </div>
              {client ? (
                <Button type="button" variant="outline" onClick={() => setClient(null)}>
                  Quitar
                </Button>
              ) : null}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as VencimientoStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendiente">{VENCIMIENTO_STATUS_LABEL.pendiente}</SelectItem>
                <SelectItem value="cumplido">{VENCIMIENTO_STATUS_LABEL.cumplido}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Guardando…" : item ? "Guardar" : "Cargar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
