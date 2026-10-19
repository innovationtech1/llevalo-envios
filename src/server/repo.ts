import 'server-only';
import { neon } from '@neondatabase/serverless';
import { DEFAULT_SETTINGS, DEFAULT_ZONES } from '@/lib/constants';
import type { Order, OrderStatus, Settings, Zone } from '@/lib/types';

/**
 * Acceso a datos. Dos implementaciones con la misma interfaz:
 *  - Postgres (Neon) cuando existe DATABASE_URL: datos permanentes y compartidos.
 *  - Memoria cuando no existe: "modo demo", se borra al reiniciar el servidor.
 */
export interface OrderFilter {
  status?: OrderStatus[];
  phone?: string;
  driver?: string;
  limit?: number;
}

export type NewOrder = Omit<Order, 'id' | 'num' | 'createdAt' | 'status' | 'history' | 'driver' | 'photo'>;

export interface Repo {
  readonly demo: boolean;
  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<Settings>;
  getZones(): Promise<Zone[]>;
  saveZones(z: Zone[]): Promise<Zone[]>;
  listOrders(f?: OrderFilter): Promise<Order[]>;
  getOrder(id: string): Promise<Order | null>;
  createOrder(o: NewOrder): Promise<Order>;
  /** Cambia el estado solo si el pedido sigue en `from` (evita que dos repartidores tomen el mismo). */
  transition(id: string, from: OrderStatus[], to: OrderStatus, patch?: Partial<Order>): Promise<Order | null>;
  patchOrder(id: string, patch: Partial<Order>): Promise<Order | null>;
  clearOrders(): Promise<void>;
}

const newId = () => 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function matches(o: Order, f: OrderFilter) {
  if (f.status && !f.status.includes(o.status)) return false;
  if (f.phone && o.senderPhone.replace(/\D/g, '') !== f.phone.replace(/\D/g, '')) return false;
  if (f.driver && o.driver?.name.toLowerCase() !== f.driver.toLowerCase()) return false;
  return true;
}

/* ---------------- memoria (modo demo) ---------------- */
interface MemState { settings: Settings; zones: Zone[]; orders: Order[]; counter: number }
const g = globalThis as unknown as { __llevaloMem?: MemState };

class MemoryRepo implements Repo {
  readonly demo = true;
  private get s(): MemState {
    if (!g.__llevaloMem) g.__llevaloMem = { settings: structuredClone(DEFAULT_SETTINGS), zones: structuredClone(DEFAULT_ZONES), orders: [], counter: 1000 };
    return g.__llevaloMem;
  }
  async getSettings() { return structuredClone(this.s.settings); }
  async saveSettings(v: Settings) { this.s.settings = structuredClone(v); return this.getSettings(); }
  async getZones() { return structuredClone(this.s.zones); }
  async saveZones(z: Zone[]) { this.s.zones = structuredClone(z); return this.getZones(); }
  async listOrders(f: OrderFilter = {}) {
    return structuredClone(this.s.orders.filter((o) => matches(o, f)).slice(0, f.limit ?? 200));
  }
  async getOrder(id: string) { const o = this.s.orders.find((x) => x.id === id); return o ? structuredClone(o) : null; }
  async createOrder(o: NewOrder) {
    const now = Date.now();
    const order: Order = { ...o, id: newId(), num: ++this.s.counter, createdAt: now, status: 'pendiente', history: [{ status: 'pendiente', at: now }], driver: null, photo: null };
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
        await this.q`CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status)`;
        await this.q`CREATE INDEX IF NOT EXISTS orders_phone_idx ON orders (sender_phone)`;
        await this.q`CREATE INDEX IF NOT EXISTS orders_driver_idx ON orders (lower(driver_name))`;
      })().catch((e) => { this.ready = null; throw e; });
    }
    return this.ready;
  }

  private toOrder(r: Row): Order {
    const d = r.data as Order;
    return { ...d, id: String(r.id), num: Number(r.num), status: r.status as OrderStatus, createdAt: new Date(r.created_at as string).getTime() };
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

  async listOrders(f: OrderFilter = {}) {
    await this.init();
    const statuses = f.status ?? null;
    const phone = f.phone ? f.phone.replace(/\D/g, '') : null;
    const driver = f.driver ? f.driver.toLowerCase() : null;
    const limit = f.limit ?? 200;
    const rows = await this.q`SELECT * FROM orders
      WHERE (${statuses}::text[] IS NULL OR status = ANY(${statuses}::text[]))
        AND (${phone}::text IS NULL OR sender_phone = ${phone})
        AND (${driver}::text IS NULL OR lower(driver_name) = ${driver})
      ORDER BY created_at DESC LIMIT ${limit}`;
    return rows.map((r) => this.toOrder(r));
  }

  async getOrder(id: string) {
    await this.init();
    const rows = await this.q`SELECT * FROM orders WHERE id = ${id}`;
    return rows.length ? this.toOrder(rows[0]) : null;
  }

  async createOrder(o: NewOrder) {
    await this.init();
    const id = newId();
    const now = Date.now();
    const data = { ...o, history: [{ status: 'pendiente', at: now }], driver: null, photo: null };
    const rows = await this.q`INSERT INTO orders (id, status, sender_phone, data)
      VALUES (${id}, 'pendiente', ${o.senderPhone.replace(/\D/g, '')}, ${JSON.stringify(data)}::jsonb) RETURNING *`;
    return this.toOrder(rows[0]);
  }

  async transition(id: string, from: OrderStatus[], to: OrderStatus, patch: Partial<Order> = {}) {
    await this.init();
    const entry = JSON.stringify([{ status: to, at: Date.now() }]);
    const { id: _i, num: _n, status: _s, createdAt: _c, history: _h, ...rest } = patch;
    const driverName = patch.driver?.name ?? null;
    // Actualización atómica: solo cambia si el estado actual está en `from`.
    const rows = await this.q`UPDATE orders SET
        status = ${to},
        driver_name = COALESCE(${driverName}, driver_name),
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

let repo: Repo | null = null;
export function getRepo(): Repo {
  if (!repo) repo = process.env.DATABASE_URL ? new PostgresRepo(process.env.DATABASE_URL) : new MemoryRepo();
  return repo;
}
