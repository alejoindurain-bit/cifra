import { getSql } from "@/lib/db";
import { DEMO_ACCOUNTS, ORIGINAL_ESTUDIO_ID, type Role } from "@/lib/constants";
import { seedPreviewData } from "./seed";
import type { EstudioInfo, SessionInfo, StaffMember } from "@/lib/fn/types";
import { createEmptyEstudio, fetchEstudio } from "./estudio";
import { asBool } from "@/lib/utils";

type UserRow = { name: string | null; email: string | null };

async function lookupUser(userId: string): Promise<UserRow> {
  const sql = await getSql();
  const rows = await sql<UserRow>`
    select name, email from "user" where id = ${userId} limit 1
  `;
  return rows[0] ?? { name: null, email: null };
}

function demoEstudioForEmail(email: string | null): string | null {
  if (!email) return null;
  const hit = DEMO_ACCOUNTS.find((d) => d.email.toLowerCase() === email.toLowerCase());
  return hit?.estudioId ?? null;
}

const REAL_OWNER_EMAIL = "alejo.indurain1@gmail.com";

export async function ensureStaff(userId: string): Promise<SessionInfo> {
  await seedPreviewData();
  const sql = await getSql();
  const existing = await sql<{
    role: Role;
    name: string | null;
    email: string | null;
    estudio_id: string;
    active: unknown;
  }>`select role, name, email, estudio_id, active from staff where user_id = ${userId}`;
  if (existing[0]) {
    if (!asBool(existing[0].active)) {
      throw new Error("Esta cuenta está desactivada. Pedile al dueño que la active.");
    }
    return {
      userId,
      role: existing[0].role,
      name: existing[0].name,
      email: existing[0].email,
      estudioId: existing[0].estudio_id,
    };
  }

  const identity = await lookupUser(userId);
  const demoId = demoEstudioForEmail(identity.email);
  let estudioId: string;
  let role: Role;
  if (demoId) {
    estudioId = demoId;
    role = "owner";
  } else if (identity.email?.trim().toLowerCase() === REAL_OWNER_EMAIL) {
    estudioId = ORIGINAL_ESTUDIO_ID;
    role = "owner";
  } else {
    // "Crear cuenta del estudio" — own empty firm, never the toy seed.
    estudioId = await createEmptyEstudio(identity.name || "Estudio");
    role = "owner";
  }
  await sql`
    insert into staff (user_id, role, name, email, estudio_id)
    values (${userId}, ${role}, ${identity.name}, ${identity.email}, ${estudioId})
  `;
  if (!demoId) {
    const { importRespaldoIfNeeded } = await import("./import-respaldo");
    await importRespaldoIfNeeded();
  }
  return { userId, role, name: identity.name, email: identity.email, estudioId };
}

export async function requireOwner(userId: string): Promise<SessionInfo> {
  const staff = await ensureStaff(userId);
  if (staff.role !== "owner") {
    throw new Error("Solo el dueño puede realizar esta acción");
  }
  return staff;
}

export async function estudioContext(userId: string): Promise<{
  staff: SessionInfo;
  estudio: EstudioInfo;
}> {
  const staff = await ensureStaff(userId);
  const estudio = await fetchEstudio(staff.estudioId);
  return { staff, estudio };
}

export async function bootstrapSessionImpl(userId: string) {
  const { staff, estudio } = await estudioContext(userId);
  let billing = null;
  if (estudio.flags.honorariosMensuales) {
    const { runMonthlyBillingIfDue } = await import("./billing");
    billing = await runMonthlyBillingIfDue(staff.estudioId, false);
  }
  return { staff, estudio, billing };
}

export async function listStaffImpl(estudioId: string): Promise<StaffMember[]> {
  const sql = await getSql();
  const rows = await sql<{
    user_id: string;
    role: Role;
    name: string | null;
    email: string | null;
    created_at: string;
    estudio_id: string;
    active: unknown;
  }>`
    select user_id, role, name, email, created_at::text, estudio_id, active
    from staff
    where estudio_id = ${estudioId}
    order by active desc, created_at
  `;
  return rows.map((r) => ({
    userId: r.user_id,
    role: r.role,
    name: r.name,
    email: r.email,
    createdAt: r.created_at,
    estudioId: r.estudio_id,
    active: asBool(r.active),
  }));
}

export async function updateStaffRoleImpl(
  actorId: string,
  userId: string,
  role: Role,
) {
  const actor = await requireOwner(actorId);
  const sql = await getSql();
  const target = await sql<{ user_id: string; estudio_id: string }>`
    select user_id, estudio_id from staff
    where user_id = ${userId} and estudio_id = ${actor.estudioId}
  `;
  if (!target[0]) throw new Error("Persona no encontrada");
  if (userId === actorId && role !== "owner") {
    const owners = await sql<{ c: number }>`
      select count(*)::int as c from staff
      where estudio_id = ${actor.estudioId} and role = 'owner'
    `;
    if ((owners[0]?.c ?? 0) <= 1) {
      throw new Error("Debe quedar al menos un dueño");
    }
  }
  await sql`
    update staff set role = ${role}
    where user_id = ${userId} and estudio_id = ${actor.estudioId}
  `;
  return { ok: true };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function createCredentialUser(params: {
  email: string;
  name: string;
  password: string;
}): Promise<string> {
  const { auth } = await import("@/lib/auth/server");
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(params.password);
  const created = await ctx.internalAdapter.createUser({
    email: params.email,
    name: params.name,
    emailVerified: true,
  });
  await ctx.internalAdapter.linkAccount({
    userId: created.id,
    providerId: "credential",
    accountId: created.id,
    password: hash,
  });
  const sql = await getSql();
  await sql`delete from "session" where "userId" = ${created.id}`;
  return created.id;
}

export async function createStaffMemberImpl(
  actorId: string,
  data: { name: string; email: string; password: string; role: Role },
): Promise<{ userId: string }> {
  const actor = await requireOwner(actorId);
  const name = data.name.trim();
  const email = normalizeEmail(data.email);
  const password = data.password;
  if (name.length < 2) throw new Error("Ingresá el nombre");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Ingresá un correo válido");
  if (password.length < 8) throw new Error("La clave tiene que tener al menos 8 caracteres");

  const sql = await getSql();
  const users = await sql<{ id: string }>`
    select id from "user" where lower(email) = ${email} limit 1
  `;
  if (users[0]) {
    const st = await sql<{ estudio_id: string }>`
      select estudio_id from staff where user_id = ${users[0].id} limit 1
    `;
    if (st[0]?.estudio_id === actor.estudioId) {
      throw new Error("Ese correo ya está en este estudio");
    }
    if (st[0]) {
      throw new Error("Ese correo ya pertenece a otro estudio");
    }
    throw new Error("Ese correo ya tiene una cuenta");
  }

  const userId = await createCredentialUser({ email, name, password });
  await sql`
    insert into staff (user_id, role, name, email, estudio_id, active)
    values (${userId}, ${data.role}, ${name}, ${email}, ${actor.estudioId}, true)
  `;
  return { userId };
}

export async function setStaffActiveImpl(
  actorId: string,
  userId: string,
  active: boolean,
): Promise<{ ok: true }> {
  const actor = await requireOwner(actorId);
  const sql = await getSql();
  const target = await sql<{ user_id: string; role: Role }>`
    select user_id, role from staff
    where user_id = ${userId} and estudio_id = ${actor.estudioId}
  `;
  if (!target[0]) throw new Error("Persona no encontrada");
  if (!active && target[0].role === "owner") {
    const owners = await sql<{ c: number }>`
      select count(*)::int as c from staff
      where estudio_id = ${actor.estudioId} and role = 'owner' and active = true
    `;
    if ((owners[0]?.c ?? 0) <= 1) {
      throw new Error("Debe quedar al menos un dueño activo");
    }
  }
  await sql`
    update staff set active = ${active}
    where user_id = ${userId} and estudio_id = ${actor.estudioId}
  `;
  if (!active) {
    await sql`delete from "session" where "userId" = ${userId}`;
  }
  return { ok: true };
}
