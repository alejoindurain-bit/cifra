import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import {
  authClient,
  authEnabled,
  clearSignedOutFlag,
  dropLocalSession,
  markSignedOut,
  readSignedOutFlag,
} from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LoginCardHeader, LoginPending, LoginShell } from "@/components/login-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_ACCOUNTS, DEMO_LOGIN_HIDE_KEY } from "@/lib/constants";
import { ensurePreview } from "@/lib/fn/staff";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/login")({ component: Login });

function subscribeSignedOut() {
  return () => {};
}

function Login() {
  const { user, isPending } = useCurrentUserState();
  const justSignedOut = useSyncExternalStore(
    subscribeSignedOut,
    readSignedOutFlag,
    () => false,
  );
  useQuery({ queryKey: ["preview-seed"], queryFn: () => ensurePreview() });
  // After "Cerrar sesión" stay on this page even if a leftover cookie still
  // resolves. Demo / form clicks are the only way in.
  if (justSignedOut) return <LoginForm />;
  if (isPending) return <LoginPending />;
  if (user) return <Navigate to="/" />;

  return <LoginForm />;
}

function LoginForm() {
  return (
    <LoginShell>
      <LoginCardHeader />
      {authEnabled ? (
        <>
          <EmailAuth />
          <DemoAccountsBox />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">El ingreso está deshabilitado.</p>
      )}
    </LoginShell>
  );
}

async function enterWithEmail(opts: {
  email: string;
  password: string;
  signupName?: string;
}) {
  const email = opts.email.trim().toLowerCase();
  await dropLocalSession();
  if (opts.signupName != null) {
    const { error } = await authClient.signUp.email({
      email,
      password: opts.password,
      name: opts.signupName.trim() || email.split("@")[0],
    });
    if (error) {
      const msg = error.message ?? "";
      if (/exist/i.test(msg)) {
        throw new Error("Ese correo ya tiene cuenta. Entrá con tu clave.");
      }
      throw new Error(msg || "No se pudo crear la cuenta");
    }
  } else {
    const { error } = await authClient.signIn.email({ email, password: opts.password });
    if (error) throw new Error("Correo o contraseña incorrectos");
  }
  // The Set-Cookie from signIn can take a tick to land in the browser's
  // cookie jar before the next request — if we navigate immediately the
  // server's get-session check on "/" sees no cookie and bounces us back
  // here. A short delay + session revalidation makes the first login stick.
  await new Promise((r) => setTimeout(r, 50));
  try {
    await authClient.getSession({ query: { disableCookieCache: true } });
  } catch {
    /* fall through — the cookie is already set; getSession is just our warm-up */
  }
  clearSignedOutFlag();
  window.location.assign("/");
}

function DemoAccountsBox() {
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    try {
      const force = new URLSearchParams(window.location.search).get("demo") === "1";
      if (force) {
        localStorage.removeItem(DEMO_LOGIN_HIDE_KEY);
        setHidden(false);
        return;
      }
      if (localStorage.getItem(DEMO_LOGIN_HIDE_KEY) === "1") setHidden(true);
    } catch {
      /* ignore */
    }
  }, []);

  function show() {
    try {
      localStorage.removeItem(DEMO_LOGIN_HIDE_KEY);
    } catch {
      /* ignore */
    }
    setHidden(false);
  }

  function hide() {
    try {
      localStorage.setItem(DEMO_LOGIN_HIDE_KEY, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  }

  async function enter(email: string, password: string) {
    setBusy(email);
    try {
      await ensurePreview();
      await enterWithEmail({ email, password });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al ingresar");
      setBusy(null);
    }
  }

  if (hidden) {
    return (
      <button
        type="button"
        className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        onClick={show}
      >
        Cuentas de muestra
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Cuentas de muestra</p>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={hide}
        >
          Ocultar
        </button>
      </div>
      <div className="space-y-1.5">
        {DEMO_ACCOUNTS.map((d) => (
          <button
            key={d.email}
            type="button"
            disabled={busy !== null}
            onClick={() => enter(d.email, d.password)}
            className="flex w-full flex-col rounded-xl px-3 py-2 text-left hover:bg-muted disabled:opacity-60"
          >
            <span className="text-sm font-medium">{busy === d.email ? "Ingresando…" : d.label}</span>
            <span className="text-xs text-muted-foreground">{d.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}


function EmailAuth() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await enterWithEmail({
        email,
        password,
        signupName: mode === "signup" ? name.trim() || email.split("@")[0] : undefined,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al ingresar");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 pt-2">
      {mode === "signup" ? (
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Ingresando…" : mode === "signup" ? "Crear cuenta" : "Entrar"}
      </Button>
      <button
        type="button"
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
        onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
      >
        {mode === "signup" ? "Ya tengo cuenta" : "Crear cuenta del estudio"}
      </button>
    </form>
  );
}