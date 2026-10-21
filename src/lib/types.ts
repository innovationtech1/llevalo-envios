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
  /** Cuenta de cobros en Stripe Connect (solo repartidores). */
  stripeAccountId: string | null;
  payoutsEnabled: boolean;
  /** Fecha en que aceptó el acuerdo de contratista independiente. */
  driverTermsAt: number | null;
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
  /** Cargo si el cliente cancela después de que un repartidor aceptó (se le paga al repartidor). */
  cancelFee: number;
  /** Máximo que cubrimos por paquete perdido o dañado. */
  coverageMax: number;
  /** Pagar al repartidor al instante al entregar (Stripe cobra 1%). */
  instantPayouts: boolean;
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
  status: 'pendiente' | 'pagado' | 'reembolsado' | 'reembolso_parcial';
  sessionId?: string;
  paymentIntent?: string;
  chargeId?: string;
  refunded?: number;
  disputed?: boolean;
}

/** Pago al repartidor por un envío. */
export interface DriverPayout {
  status: 'no_aplica' | 'pendiente' | 'transferido' | 'instantaneo' | 'estandar' | 'fallido';
  amount: number;
  transferId?: string;
  payoutId?: string;
  error?: string;
  at?: number;
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
  payout?: DriverPayout;
  /** Valor que el cliente declaró del contenido (para la cobertura). */
  declaredValue: number;
  /** Versión de los términos que aceptó el cliente y cuándo. */
  termsVersion: string;
  termsAt: number;
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
  legalConfigured: boolean;
}

export interface DriverPayoutsInfo {
  enabled: boolean;       // Stripe activado en la app
  hasAccount: boolean;
  payoutsEnabled: boolean;
  termsAccepted: boolean;
  balance: { available: number; pending: number; instant: number } | null;
  instantCapable: boolean; // tiene tarjeta de débito o banco que acepta pagos instantáneos
}
