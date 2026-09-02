import type { ReactNode } from "react";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { BrandMark } from "@/components/brand-mark";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";

export function LoginShell({ children }: { children: ReactNode }) {
  return (
    <main
      className="relative min-h-dvh overflow-hidden bg-background"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to bottom, transparent, transparent 31px, color-mix(in oklab, var(--foreground) 6%, transparent) 32px)",
      }}
    >
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <div className="relative mx-auto grid min-h-dvh max-w-5xl items-center gap-10 px-5 py-12 lg:grid-cols-2">
        <div className="hidden lg:block">
          <BrandMark className="mb-6 h-12 w-12" />
          <p className="font-display text-6xl tracking-tight">{APP_NAME}</p>
          <p className="mt-3 max-w-sm text-lg text-muted-foreground">{APP_TAGLINE}</p>
          <p className="mt-8 max-w-md text-sm leading-relaxed text-muted-foreground">
            Caja, cuenta corriente y honorarios del módulo CPCEBA. El primer usuario
            que ingresa queda como dueño del estudio.
          </p>
        </div>
        <div className="mx-auto w-full max-w-sm rounded-3xl bg-card p-6 shadow-[var(--shadow-border)]">
          {children}
        </div>
      </div>
    </main>
  );
}

export function LoginCardHeader() {
  return (
    <>
      <div className="mb-5 lg:hidden">
        <BrandMark className="mb-3 h-9 w-9" />
        <p className="font-display text-3xl">{APP_NAME}</p>
        <p className="text-sm text-muted-foreground">{APP_TAGLINE}</p>
      </div>
      <h1 className="font-display text-2xl">Ingresar</h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">
        Empleados y dueño usan la misma puerta, con permisos distintos.
      </p>
    </>
  );
}

export function LoginPending() {
  return (
    <LoginShell>
      <LoginCardHeader />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="mt-3 h-10 w-full" />
      <Skeleton className="mt-3 h-10 w-full" />
    </LoginShell>
  );
}
