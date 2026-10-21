import 'server-only';
import { neon } from '@neondatabase/serverless';
import { DEFAULT_SETTINGS, DEFAULT_ZONES } from '@/lib/constants';
import type { DriverStatus, Order, OrderStatus, Settings, User, Zone } from '@/lib/types';

/**
 * Acceso a datos. Dos implementaciones con la misma interfaz:
 *  - Postgres (Neon) cuando existe la conexión: datos permanentes y compartidos.
 *  - Memoria cuando no existe: "modo demo", se borra al reiniciar el servidor.
 */
export interface OrderFilter {
  status?: OrderStatus[];
  customerId?: string;
  driverId?: string;
  limit?: number;
}

/** Usuario guardado; `isAdmin` se calcula aparte (depende de ADMIN_PHONES). */
export type StoredUser = Omit<User, 'isAdmin'>;

export type UserPatch = Partial<Pick<StoredUser, 'name' | 'driverStatus' | 'stripeAccountId' | 'payoutsEnabled' | 'driverTermsAt'>>;

export type NewOrder = Omit<Order, 'id' | 'num' | 'createdAt' | 'status' | 'history' | 'driver' | 'photo'>;

export interface Repo {
  readonly demo: boolean;
  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<Settings>;
  getZones(): Promise<Zone[]>;
  saveZones(z: Zone[]): Promise<Zone[]>;

  getUser(id: string): Promise<StoredUser | null>;
  getUserByPhone(phone: string): Promise<StoredUser | null>;
  createUser(phone: string, name: string): Promise<StoredUser>;
  updateUser(id: string, patch: UserPatch): Promise<StoredUser | null>;
  listUsers(driverStatus?: DriverStatus[]): Promise<StoredUser[]>;
  getUserByStripeAccount(accountId: string): Promise<StoredUser | null>;
  getOrderByPaymentIntent(pi: string): Promise<Order | null>;

  listOrders(f?: OrderFilter): Promise<Order[]>;
  getOrder(id: string): Promise<Order | null>;
  createOrder(o: NewOrder, status: OrderStatus): Promise<Order>;
  /** Cambia el estado solo si el pedido sigue en `from` (evita que dos repartidores tomen el mismo). */
  transition(id: string, from: OrderStatus[], to: OrderStatus, patch?: Partial<Order>): Promise<Order | null>;
  patchOrder(id: string, patch: Partial<Order>): Promise<Order | null>;
  clearOrders(): Promise<void>;
}

const newId = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function matches(o: Order, f: OrderFilter) {
  if (f.status && !f.status.includes(o.status)) return false;
  if (f.customerId && o.customerId !== f.customerId) return false;
  if (f.driverId && o.driver?.id !== f.driverId) return false;
  return true;
}

/* ---------------- memoria (modo demo) ---------------- */
interface MemState { settings: Settings; zones: Zone[]; orders: Order[]; users: StoredUser[]; counter: number }
const g = globalThis as unknown as { __llevaloMem?: MemState };

class MemoryRepo implements Repo {
  readonly demo = true;
  private get s(): MemState {
    if (!g.__llevaloMem) g.__llevaloMem = { settings: structuredClone(DEFAULT_SETTINGS), zones: structuredClone(DEFAULT_ZONES), orders: [], users: [], counter: 1000 };
    return g.__llevaloMem;
  }
  async getSettings() { return structuredClone(this.s.settings); }
  async saveSettings(v: Settings) { this.s.settings = structuredClone(v); return this.getSettings(); }
  async getZones() { return structuredClone(this.s.zones); }
  async saveZones(z: Zone[]) { this.s.zones = structuredClone(z); return this.getZones(); }

  async getUser(id: string) { const u = this.s.users.find((x) => x.id === id); return u ? { ...u } : null; }
  async getUserByPhone(phone: string) { const u = this.s.users.find((x) => x.phone === phone); return u ? { ...u } : null; }
  async createUser(phone: string, name: string) {
    const u: StoredUser = { id: newId('u'), phone, name, driverStatus: 'ninguno', createdAt: Date.now(), stripeAccountId: null, payoutsEnabled: false, driverTermsAt: null };
    this.s.users.push(u);
    return { ...u };
  }
  async updateUser(id: string, patch: UserPatch) {
    const u = this.s.users.find((x) => x.id === id);
    if (!u) return null;
    Object.assign(u, patch);
    return { ...u };
  }
  async listUsers(driverStatus?: DriverStatus[]) {
    return this.s.users.filter((u) => !driverStatus || driverStatus.includes(u.driverStatus)).map((u) => ({ ...u })).reverse();
  }
  async getUserByStripeAccount(accountId: string) { const u = this.s.users.find((x) => x.stripeAccountId === accountId); return u ? { ...u } : null; }
  async getOrderByPaymentIntent(pi: string) { const o = this.s.orders.find((x) => x.payment.paymentIntent === pi); return o ? structuredClone(o) : null; }

  async listOrders(f: OrderFilter = {}) {
    return structuredClone(this.s.orders.filter((o) => matches(o, f)).slice(0, f.limit ?? 200));
  }
  async getOrder(id: string) { const o = this.s.orders.find((x) => x.id === id); return o ? structuredClone(o) : null; }
  async createOrder(o: NewOrder, status: OrderStatus) {
    const now = Date.now();
    const order: Order = { ...o, id: newId('o'), num: ++this.s.counter, createdAt: now, status, history: [{ status, at: now }], driver: null, photo: null };
    this.s.orders.unshift(order);
    return structuredClone(order);
  }
  async transition(id: string, from: OrderStatus[], to: OrderStatus, patch: Partial<Order> = {}) {
    const o = this.s.orders.find((x) => x.id === id);
    if (!o || !from.includes(o.status)) return null;
    Object.assign(o, patch, { status: to });
    o.history.push({ status: to, at: Date.now() });
    return structuredClone(o);
  }
  async patchOrder(id: string, patch: Partial<Order>) {
    const o = this.s.orders.find((x) => x.id === id);
    if (!o) return null;
    Object.assign(o, patch);
    return structuredClone(o);
  }
  async clearOrders() { this.s.orders = []; }
}

/* ---------------- Postgres (Neon) ---------------- */
type Sql = ReturnType<typeof neon>;
type Row = Record<string, unknown>;

class PostgresRepo implements Repo {
  readonly demo = false;
  private sql: Sql;
  private ready: Promise<void> | null = null;
  constructor(url: string) { this.sql = neon(url); }

  private async q(strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]> {
    return (await this.sql(strings, ...values)) as Row[];
  }

  private init() {
    if (!this.ready) {
      this.ready = (async () => {
        await this.q`CREATE TABLE IF NOT EXISTS app_kv (key text PRIMARY KEY, value jsonb NOT NULL)`;
        await this.q`CREATE SEQUENCE IF NOT EXISTS order_num_seq START 1001`;
        await this.q`CREATE TABLE IF NOT EXISTS orders (
          id text PRIMARY KEY,
          num integer NOT NULL DEFAULT nextval('order_num_seq'),
          status text NOT NULL,
          sender_phone text NOT NULL,
          driver_name text,
          created_at timestamptz NOT NULL DEFAULT now(),
          data jsonb NOT NULL
        )`;
        await this.q`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id text`;
        await this.q`ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id text`;
        await this.q`CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status)`;
        await this.q`CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders (customer_id)`;
        await this.q`CREATE INDEX IF NOT EXISTS orders_driver_id_idx ON orders (driver_id)`;
        await this.q`CREATE TABLE IF NOT EXISTS users (
          id text PRIMARY KEY,
          phone text UNIQUE NOT NULL,
          name text NOT NULL DEFAULT '',
          driver_status text NOT NULL DEFAULT 'ninguno',
          created_at timestamptz NOT NULL DEFAULT now()
        )`;
        await this.q`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_account_id text`;
        await this.q`ALTER TABLE users ADD COLUMN IF NOT EXISTS payouts_enabled boolean NOT NULL DEFAULT false`;
        await this.q`ALTER TABLE users ADD COLUMN IF NOT EXISTS driver_terms_at timestamptz`;
        await this.q`CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_idx ON users (stripe_account_id) WHERE stripe_account_id IS NOT NULL`;
        await this.q`CREATE INDEX IF NOT EXISTS orders_pi_idx ON orders ((data->'payment'->>'paymentIntent'))`;
      })().catch((e) => { this.ready = null; throw e; });
    }
    return this.ready;
  }

  private toOrder(r: Row): Order {
    const d = r.data as Partial<Order>;
    return {
      ...(d as Order),
      payment: d.payment ?? { method: 'efectivo', status: 'pendiente' },
      declaredValue: d.declaredValue ?? 0,
      termsVersion: d.termsVersion ?? '',
      termsAt: d.termsAt ?? 0,
      customerId: d.customerId ?? String(r.customer_id ?? ''),
      id: String(r.id), num: Number(r.num), status: r.status as OrderStatus, createdAt: new Date(r.created_at as string).getTime()
    };
  }
  private toUser(r: Row): StoredUser {
    return {
      id: String(r.id), phone: String(r.phone), name: String(r.name ?? ''), driverStatus: r.driver_status as DriverStatus,
      createdAt: new Date(r.created_at as string).getTime(),
      stripeAccountId: r.stripe_account_id ? String(r.stripe_account_id) : null,
      payoutsEnabled: Boolean(r.payouts_enabled),
      driverTermsAt: r.driver_terms_at ? new Date(r.driver_terms_at as string).getTime() : null
    };
  }

  private async getKv<T>(key: string, fallback: T): Promise<T> {
    await this.init();
    const rows = await this.q`SELECT value FROM app_kv WHERE key = ${key}`;
    return rows.length ? (rows[0].value as T) : structuredClone(fallback);
  }
  private async setKv<T>(key: string, value: T): Promise<T> {
    await this.init();
    await this.q`INSERT INTO app_kv (key, value) VALUES (${key}, ${JSON.stringify(value)}::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    return value;
  }

  async getSettings() {
    const s = await this.getKv<Settings>('settings', DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS, ...s, extras: { ...DEFAULT_SETTINGS.extras, ...s.extras } };
  }
  saveSettings(s: Settings) { return this.setKv('settings', s); }
  getZones() { return this.getKv<Zone[]>('zones', DEFAULT_ZONES); }
  saveZones(z: Zone[]) { return this.setKv('zones', z); }

  async getUser(id: string) {
    await this.init();
    const rows = await this.q`SELECT * FROM users WHERE id = ${id}`;
    return rows.length ? this.toUser(rows[0]) : null;
  }
  async getUserByPhone(phone: string) {
    await this.init();
    const rows = await this.q`SELECT * FROM users WHERE phone = ${phone}`;
    return rows.length ? this.toUser(rows[0]) : null;
  }
  async createUser(phone: string, name: string) {
    await this.init();
    const rows = await this.q`INSERT INTO users (id, phone, name) VALUES (${newId('u')}, ${phone}, ${name})
      ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone RETURNING *`;
    return this.toUser(rows[0]);
  }
  async updateUser(id: string, patch: UserPatch) {
    await this.init();
    const terms = patch.driverTermsAt ? new Date(patch.driverTermsAt).toISOString() : null;
    const rows = await this.q`UPDATE users SET
        name = COALESCE(${patch.name ?? null}, name),
        driver_status = COALESCE(${patch.driverStatus ?? null}, driver_status),
        stripe_account_id = COALESCE(${patch.stripeAccountId ?? null}, stripe_account_id),
        payouts_enabled = COALESCE(${patch.payoutsEnabled ?? null}::boolean, payouts_enabled),
        driver_terms_at = COALESCE(${terms}::timestamptz, driver_terms_at)
      WHERE id = ${id} RETURNING *`;
    return rows.length ? this.toUser(rows[0]) : null;
  }
  async listUsers(driverStatus?: DriverStatus[]) {
    await this.init();
    const st = driverStatus ?? null;
    const rows = await this.q`SELECT * FROM users WHERE (${st}::text[] IS NULL OR driver_status = ANY(${st}::text[])) ORDER BY created_at DESC LIMIT 500`;
    return rows.map((r) => this.toUser(r));
  }
  async getUserByStripeAccount(accountId: string) {
    await this.init();
    const rows = await this.q`SELECT * FROM users WHERE stripe_account_id = ${accountId}`;
    return rows.length ? this.toUser(rows[0]) : null;
  }
  async getOrderByPaymentIntent(pi: string) {
    await this.init();
    const rows = await this.q`SELECT * FROM orders WHERE data->'payment'->>'paymentIntent' = ${pi} LIMIT 1`;
    return rows.length ? this.toOrder(rows[0]) : null;
  }

  async listOrders(f: OrderFilter = {}) {
    await this.init();
    const statuses = f.status ?? null;
    const customer = f.customerId ?? null;
    const driver = f.driverId ?? null;
    const limit = f.limit ?? 200;
    const rows = await this.q`SELECT * FROM orders
      WHERE (${statuses}::text[] IS NULL OR status = ANY(${statuses}::text[]))
        AND (${customer}::text IS NULL OR customer_id = ${customer})
        AND (${driver}::text IS NULL OR driver_id = ${driver})
      ORDER BY created_at DESC LIMIT ${limit}`;
    return rows.map((r) => this.toOrder(r));
  }

  async getOrder(id: string) {
    await this.init();
    const rows = await this.q`SELECT * FROM orders WHERE id = ${id}`;
    return rows.length ? this.toOrder(rows[0]) : null;
  }

  async createOrder(o: NewOrder, status: OrderStatus) {
    await this.init();
    const now = Date.now();
    const data = { ...o, history: [{ status, at: now }], driver: null, photo: null };
    const rows = await this.q`INSERT INTO orders (id, status, sender_phone, customer_id, data)
      VALUES (${newId('o')}, ${status}, ${o.senderPhone.replace(/\D/g, '')}, ${o.customerId}, ${JSON.stringify(data)}::jsonb) RETURNING *`;
    return this.toOrder(rows[0]);
  }

  async transition(id: string, from: OrderStatus[], to: OrderStatus, patch: Partial<Order> = {}) {
    await this.init();
    const entry = JSON.stringify([{ status: to, at: Date.now() }]);
    const { id: _i, num: _n, status: _s, createdAt: _c, history: _h, ...rest } = patch;
    const driverName = patch.driver?.name ?? null;
    const driverId = patch.driver?.id ?? null;
    // Actualización atómica: solo cambia si el estado actual está en `from`.
    const rows = await this.q`UPDATE orders SET
        status = ${to},
        driver_name = COALESCE(${driverName}, driver_name),
        driver_id = COALESCE(${driverId}, driver_id),
        data = jsonb_set(data || ${JSON.stringify(rest)}::jsonb, '{history}', (data->'history') || ${entry}::jsonb)
      WHERE id = ${id} AND status = ANY(${from}::text[]) RETURNING *`;
    return rows.length ? this.toOrder(rows[0]) : null;
  }

  async patchOrder(id: string, patch: Partial<Order>) {
    await this.init();
    const { id: _i, num: _n, status: _s, createdAt: _c, history: _h, ...rest } = patch;
    const rows = await this.q`UPDATE orders SET data = data || ${JSON.stringify(rest)}::jsonb WHERE id = ${id} RETURNING *`;
    return rows.length ? this.toOrder(rows[0]) : null;
  }

  async clearOrders() { await this.init(); await this.q`DELETE FROM orders`; }
}

/** Vercel + Neon puede nombrar la conexión de varias formas; usamos la primera que exista. */
export function databaseUrl(): string | undefined {
  const env = process.env;
  return env.DATABASE_URL || env.POSTGRES_URL || env.NEON_DATABASE_URL
    || Object.entries(env).find(([k, v]) => /_(DATABASE_URL|POSTGRES_URL)$/.test(k) && v)?.[1];
}

let repo: Repo | null = null;
export function getRepo(): Repo {
  if (!repo) { const url = databaseUrl(); repo = url ? new PostgresRepo(url) : new MemoryRepo(); }
  return repo;
}
