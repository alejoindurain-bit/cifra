import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthGate, useSessionStaff } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createStaffMember, listStaff, setStaffActive, updateStaffRole } from "@/lib/fn/staff";
import type { Role } from "@/lib/constants";

export const Route = createFileRoute("/equipo")({ component: EquipoRoute });

function EquipoRoute() {
  return (
    <AuthGate role="owner">
      <AppShell title="Equipo" description="Personas de este estudio. El empleado entra con su correo y clave.">
        <div className="mx-auto max-w-2xl space-y-4">
          <AddMemberForm />
          <StaffList />
        </div>
      </AppShell>
    </AuthGate>
  );
}

function AddMemberForm() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("employee");

  const save = useMutation({
    mutationFn: () =>
      createStaffMember({
        data: { name, email, password, role },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Listo. Que entre con su correo y clave.");
      setName("");
      setEmail("");
      setPassword("");
      setRole("employee");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alta</CardTitle>
        <CardDescription>
          Queda en este estudio. No uses “Crear cuenta del estudio”: eso abre un estudio nuevo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="staff-name">Nombre</Label>
              <Input
                id="staff-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-email">Correo</Label>
              <Input
                id="staff-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="staff-pass">Clave</Label>
              <Input
                id="staff-pass"
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Empleado</SelectItem>
                  <SelectItem value="owner">Dueño</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Guardando…" : "Sumar al estudio"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function StaffList() {
  const { staff: me } = useSessionStaff();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["staff"], queryFn: () => listStaff() });
  const update = useMutation({
    mutationFn: (p: { userId: string; role: Role }) => updateStaffRole({ data: p }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff"] });
      void qc.invalidateQueries({ queryKey: ["session"] });
      toast.success("Rol actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (p: { userId: string; active: boolean }) => setStaffActive({ data: p }),
    onSuccess: (_, p) => {
      void qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success(p.active ? "Cuenta activada" : "Cuenta desactivada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personas del estudio</CardTitle>
        <CardDescription>Solo las de este estudio. El empleado no ve Ajustes ni Equipo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(q.data ?? []).map((s) => (
          <div
            key={s.userId}
            className="flex flex-col gap-3 rounded-2xl bg-muted/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">
                {s.name || s.email || "Usuario"}
                {s.userId === me?.userId ? (
                  <Badge variant="outline" className="ml-2">
                    Vos
                  </Badge>
                ) : null}
                {!s.active ? (
                  <Badge variant="muted" className="ml-2">
                    Inactivo
                  </Badge>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">{s.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={s.role}
                disabled={!s.active}
                onValueChange={(v) => update.mutate({ userId: s.userId, role: v as Role })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Dueño</SelectItem>
                  <SelectItem value="employee">Empleado</SelectItem>
                </SelectContent>
              </Select>
              {s.userId !== me?.userId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ userId: s.userId, active: !s.active })}
                >
                  {s.active ? "Desactivar" : "Activar"}
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
