import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarClock,
  Eye,
  EyeOff,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Sparkles,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { APP_NAME, APP_TAGLINE, type Role } from "@/lib/constants";
import type { EstudioFlags } from "@/lib/fn/types";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { usePrivacy } from "@/lib/privacy";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSessionStaff } from "@/components/auth-gate";

type NavItem = {
  to: string;
  label: string;
  short: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
  mobileBar?: boolean;
  flag?: keyof EstudioFlags;
};

const NAV: NavItem[] = [
  { to: "/", label: "Inicio", short: "Inicio", icon: LayoutDashboard, roles: ["owner"], mobileBar: true },
  { to: "/caja", label: "Caja", short: "Caja", icon: Wallet, roles: ["owner", "employee"], mobileBar: true, flag: "caja" },
  {
    to: "/cuenta-corriente",
    label: "Cuenta corriente",
    short: "Cuenta",
    icon: Search,
    roles: ["owner", "employee"],
    mobileBar: true,
    flag: "cuentaCorriente",
  },
  { to: "/clientes", label: "Clientes", short: "Clientes", icon: Users, roles: ["owner"], mobileBar: true },
  { to: "/cobranzas", label: "Cobranzas", short: "Bancos", icon: Landmark, roles: ["owner"], flag: "caja" },
  {
    to: "/extraordinarios",
    label: "Extraordinarios",
    short: "Extra",
    icon: Sparkles,
    roles: ["owner"],
    flag: "honorariosExtraordinarios",
  },
  {
    to: "/vencimientos",
    label: "Vencimientos",
    short: "Vence",
    icon: CalendarClock,
    roles: ["owner"],
    flag: "vencimientos",
  },
  {
    to: "/libro-mayor",
    label: "Libro mayor",
    short: "Mayor",
    icon: BookOpen,
    roles: ["owner"],
    flag: "cuentaCorriente",
  },
  { to: "/equipo", label: "Equipo", short: "Equipo", icon: UserCog, roles: ["owner"] },
  { to: "/ajustes", label: "Ajustes", short: "Ajustes", icon: Settings, roles: ["owner"] },
];

function NavLinks({
  role,
  flags,
  onNavigate,
  compact,
}: {
  role: Role;
  flags: EstudioFlags | null;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV.filter(
    (i) =>
      i.roles.includes(role) &&
      (!compact || i.mobileBar) &&
      (!i.flag || !flags || flags[i.flag]),
  );
  return (
    <nav className={cn("flex flex-col gap-1", compact && "flex-row")}>
      {items.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              compact && "min-h-12 flex-1 flex-col justify-center gap-0.5 px-1 py-2 text-xs",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {compact ? item.short : item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AccountChip() {
  const { user } = useCurrentUserState();
  const { staff } = useSessionStaff();
  const [signingOut, setSigningOut] = useState(false);
  if (!user) return null;
  const name = user.displayName?.trim() || null;
  const email = user.primaryEmail?.trim() || null;
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name || email || "Cuenta"}</p>
        <p className="truncate text-xs text-muted-foreground">
          {email && name ? `${email} · ` : ""}
          {staff?.role === "owner" ? "Dueño" : "Empleado"}
        </p>
      </div>
      {authEnabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Cerrar sesión"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true);
            void signOut().catch(() => setSigningOut(false));
          }}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function PrivacyToggle() {
  const { hidden, toggle } = usePrivacy();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={hidden ? "Mostrar saldos y nombres" : "Ocultar saldos y nombres"}
      aria-pressed={hidden}
      title={hidden ? "Mostrar saldos y nombres" : "Ocultar saldos y nombres"}
      className={hidden ? "bg-muted" : undefined}
      onClick={toggle}
    >
      {hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </Button>
  );
}

export function AppShell({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const { staff, estudio } = useSessionStaff();
  const role: Role = staff?.role ?? "employee";
  const [open, setOpen] = useState(false);
  const firm = estudio?.displayName || APP_TAGLINE;
  const accent = estudio?.accentColor?.replace("#", "");
  const accentStyle = accent
    ? ({
        ["--primary"]: `#${accent}`,
        ["--ring"]: `#${accent}`,
        ["--accent"]: `#${accent}`,
      } as CSSProperties)
    : undefined;

  return (
    <div className="min-h-dvh bg-background" style={accentStyle}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card md:flex">
        <div className="px-5 py-6">
          <Link to={role === "owner" ? "/" : "/caja"} className="flex items-start gap-3">
            <BrandMark className="mt-0.5 h-9 w-9" />
            <span>
              <p className="font-display text-2xl tracking-tight">{APP_NAME}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{firm}</p>
            </span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <NavLinks role={role} flags={estudio?.flags ?? null} />
        </div>
        <div className="border-t border-border p-4">
          <AccountChip />
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-sm md:px-8">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menú">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3 font-display text-2xl">
                  <BrandMark className="h-8 w-8" />
                  {APP_NAME}
                </SheetTitle>
              </SheetHeader>
              <p className="mb-3 px-1 text-xs text-muted-foreground">{firm}</p>
              <NavLinks role={role} flags={estudio?.flags ?? null} onNavigate={() => setOpen(false)} />
              <div className="mt-auto pt-4">
                <AccountChip />
              </div>
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl tracking-tight md:text-2xl">{title}</h1>
            {description ? (
              <p className="hidden text-sm text-muted-foreground sm:block">{description}</p>
            ) : null}
          </div>
          <PrivacyToggle />
          <ThemeToggle />
          {action}
        </header>

        <main className="px-4 py-6 pb-24 md:px-8 md:pb-10">{children}</main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card p-1 md:hidden">
        <NavLinks role={role} flags={estudio?.flags ?? null} compact />
      </div>
    </div>
  );
}
