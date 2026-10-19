export type Role = 'cliente' | 'repartidor' | 'admin';

export type SizeId = 'sobre' | 'pequeno' | 'mediano' | 'grande';

export type OrderStatus = 'pendiente' | 'asignado' | 'recogido' | 'entregado' | 'cancelado';

export interface Place {
  label: string;
  lat: number;
  lon: number;
  zip: string;
}

export interface Settings {
  base: number;
  perMile: number;
  minimum: number;
  extras: Record<SizeId, number>;
  driverBase: number;
  driverPerMile: number;
  maxMiles: number;
  edited: boolean;
}

export interface Zone {
  id: string;
  name: string;
  prefixes: string[];
  local: boolean;
}

export interface Driver {
  name: string;
  phone: string;
}

export interface HistoryEntry {
  status: OrderStatus;
  at: number;
}

export interface Order {
  id: string;
  num: number;
  createdAt: number;
  status: OrderStatus;
  history: HistoryEntry[];
  pickup: Place;
  dropoff: Place;
  size: SizeId;
  when: 'ahora' | 'prog';
  scheduledAt: string;
  senderName: string;
  senderPhone: string;
  recName: string;
  recPhone: string;
  notes: string;
  miles: number;
  minutes: number;
  price: number;
  driverPay: number;
  driver: Driver | null;
  photo: string | null;
}

export interface RouteInfo {
  miles: number;
  minutes: number;
  approx: boolean;
}

export interface Quote {
  base: number;
  byMiles: number;
  extra: number;
  minimumApplied: boolean;
  total: number;
  driverPay: number;
}

export interface QuoteResponse {
  route: RouteInfo;
  quote: Quote;
  problems: string[];
}

export interface AppInfo {
  demo: boolean;
  maps: 'google' | 'osm';
  adminPin: boolean;
}
