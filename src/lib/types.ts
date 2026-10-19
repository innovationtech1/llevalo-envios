export type Role = 'cliente' | 'repartidor' | 'admin';

export type SizeId = 'sobre' | 'pequeno' | 'mediano' | 'grande';

/** `por_pagar`: creado pero el cliente aún no termina de pagar con tarjeta (no lo ven los repartidores). */
export type OrderStatus = 'por_pagar' | 'pendiente' | 'asignado' | 'recogido' | 'entregado' | 'cancelado';

export type DriverStatus = 'ninguno' | 'pendiente' | 'aprobado' | 'rechazado';

export interface User {
  id: string;
  phone: string; // formato +1XXXXXXXXXX
  name: string;
  driverStatus: DriverStatus;
  isAdmin: boolean;
  createdAt: number;
}

export interface Place {
  label: string;
  lat: number;
  lon: number;
  zip: string;
}

export interface Suggestion {
  id: string;
  main: string;
  secondary: string;
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
  id: string;
  name: string;
  phone: string;
}

export interface Payment {
  method: 'tarjeta' | 'efectivo';
  status: 'pendiente' | 'pagado' | 'reembolsado';
  sessionId?: string;
  paymentIntent?: string;
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
  customerId: string;
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
  payment: Payment;
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
  payments: 'stripe' | 'efectivo';
  sms: 'twilio' | 'prueba';
  adminConfigured: boolean;
}
