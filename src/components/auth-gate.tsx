import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { readSignedOutFlag, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { bootstrapSession } from "@/lib/fn/staff";
import { APP_NAME, APP_TAGLINE, type Role } from "@/lib/constants";
import type { EstudioFlags } from "@/lib/fn/types";
import { BrandMark } from "@/components/brand-mark";
import { LoginPending } from "@/components/login-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function useSessionStaff() {
  const { user, isPending } = useCurrentUserState();
  const boot = useQuery({
    queryKey: ["session", user?.id],
    queryFn: () => bootstrapSession(),
    enabled: Boolean(user),
  });
  return {
    user,
    isPending: isPending || (Boolean(user) && boot.isPending),
    staff: boot.data?.staff ?? null,
    estudio: boot.data?.estudio ?? null,
    billing: boot.data?.billing ?? null,
    error: boot.error,
  };
}

function GateSkeleton() {
  return (
    <div className="flex min-h-dvh bg-background">
      <div className="hidden w-60 border-r border-border p-5 md:block">
        <div className="mb-8 flex items-center gap-3">
          <BrandMark className="h-9 w-9" />
          <p className="font-display text-2xl tracking-tight">{APP_NAME}</p>
        </div>
        <p className="mb-6 text-xs text-muted-foreground">{APP_TAGLINE}</p>
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div className="flex-1 p-6">
        <div className="mb-4 flex items-center gap-3 md:hidden">
          <BrandMark className="h-8 w-8" />
          <p className="font-display text-2xl">{APP_NAME}</p>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">{APP_TAGLINE}</p>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-40 w-full rounded-3xl" />
      </div>
    </div>
  );
}

export function AuthGate({
  children,
  role,
  module,
}: {
  children: ReactNode;
  role?: Role;
  module?: keyof EstudioFlags;
}) {
  const { user, isPending, staff, estudio, error } = useSessionStaff();
  const justSignedOut = useSyncExternalStore(
    () => () => {},
    readSignedOutFlag,
    () => false,
  );
  if (justSignedOut) return <RedirectToSignIn />;
  if (isPending && !user) return <LoginPending />;
  if (isPending) return <GateSkeleton />;
  if (!user) return <RedirectToSignIn />;
  if (error) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <h1 className="font-display text-2xl">No se pudo abrir la sesión</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Error inesperado"}
          </p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => void signOut()}
          >
            Cerrar sesión
          </Button>
        </div>
      </div>
    );
  }
  if (!staff) return <GateSkeleton />;
  if (role === "owner" && staff.role !== "owner") {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-2xl">Acceso restringido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta sección es solo para el dueño del estudio.
          </p>
          <Button asChild className="mt-4">
            <Link to="/caja">Ir a caja</Link>
          </Button>
        </div>
      </div>
    );
  }
  if (module && estudio && !estudio.flags[module]) {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-2xl">Módulo desactivado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este estudio no tiene esta sección encendida.
          </p>
          <Button asChild className="mt-4">
            <Link to={staff.role === "owner" ? "/" : "/caja"}>Volver</Link>
          </Button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
