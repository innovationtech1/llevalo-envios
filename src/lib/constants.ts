import type { OrderStatus, Settings, SizeId, Zone } from './types';

export const SIZES: { id: SizeId; label: string; hint: string }[] = [
  { id: 'sobre', label: 'Sobre', hint: 'Documentos, llaves' },
  { id: 'pequeno', label: 'Pequeño', hint: 'Cabe en una mochila' },
  { id: 'mediano', label: 'Mediano', hint: 'Caja de zapatos' },
  { id: 'grande', label: 'Grande', hint: 'Requiere auto' }
];

export const sizeLabel = (id: SizeId) => SIZES.find((s) => s.id === id)?.label ?? id;

export const STATUS: Record<OrderStatus, { label: string; badge: string }> = {
  pendiente: { label: 'Buscando repartidor', badge: 'b-warn' },
  asignado: { label: 'Repartidor en camino a recoger', badge: 'b-info' },
  recogido: { label: 'En camino a entregar', badge: 'b-acc' },
  entregado: { label: 'Entregado', badge: 'b-ok' },
  cancelado: { label: 'Cancelado', badge: 'b-off' }
};

export const ACTIVE_STATUSES: OrderStatus[] = ['pendiente', 'asignado', 'recogido'];

// Tarifas de ejemplo: Hector las ajusta en el panel de administrador.
export const DEFAULT_SETTINGS: Settings = {
  base: 6,
  perMile: 1.75,
  minimum: 8,
  extras: { sobre: 0, pequeno: 0, mediano: 3, grande: 8 },
  driverBase: 3,
  driverPerMile: 1.1,
  maxMiles: 30,
  edited: false
};

export const DEFAULT_ZONES: Zone[] = [
  { id: 'z1', name: 'San Antonio centro', prefixes: ['782'], local: true },
  { id: 'z2', name: 'Área metropolitana', prefixes: ['781', '780'], local: true }
];

// Tamaño máximo de la foto de entrega (ya comprimida en el celular).
export const MAX_PHOTO_BYTES = 400_000;
