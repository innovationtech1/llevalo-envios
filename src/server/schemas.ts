import { z } from 'zod';
import { MAX_PHOTO_BYTES } from '@/lib/constants';

z.config(z.locales.es()); // mensajes de validación en español

const money = z.coerce.number().min(0).max(1000);
const phone = z.string().trim().min(7, 'Teléfono inválido').max(20).regex(/^[\d\s()+.-]+$/, 'Teléfono inválido');
const text = (max: number) => z.string().trim().max(max);

export const placeSchema = z.object({
  label: text(240).min(3),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  zip: z.string().trim().max(10)
});

export const sizeSchema = z.enum(['sobre', 'pequeno', 'mediano', 'grande']);

export const quoteRequestSchema = z.object({
  pickup: placeSchema,
  dropoff: placeSchema,
  size: sizeSchema
});

export const createOrderSchema = quoteRequestSchema.extend({
  when: z.enum(['ahora', 'prog']),
  scheduledAt: z.string().max(40).default(''),
  senderName: text(80).min(1, 'Escribe tu nombre'),
  recName: text(80).default(''),
  recPhone: z.union([phone, z.literal('')]).default(''),
  notes: text(300).default(''),
  declaredValue: z.coerce.number().min(0).max(10000).default(0),
  acceptTerms: z.literal(true, { error: 'Debes aceptar los términos y confirmar que no envías artículos prohibidos' })
}).refine((o) => o.when === 'ahora' || (o.scheduledAt && !Number.isNaN(Date.parse(o.scheduledAt))), {
  message: 'Elige día y hora', path: ['scheduledAt']
});

export const orderActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('accept') }),
  z.object({ action: z.literal('pickup') }),
  z.object({ action: z.literal('deliver') }),
  z.object({ action: z.literal('photo'), photo: z.string().startsWith('data:image/jpeg;base64,').max(MAX_PHOTO_BYTES) }),
  z.object({ action: z.literal('cancel') })
]);

export const settingsSchema = z.object({
  base: money,
  perMile: money,
  minimum: money,
  extras: z.object({ sobre: money, pequeno: money, mediano: money, grande: money }),
  driverBase: money,
  driverPerMile: money,
  maxMiles: z.coerce.number().min(1).max(200),
  cancelFee: money,
  coverageMax: z.coerce.number().min(0).max(10000),
  instantPayouts: z.boolean()
});

export const zonesSchema = z.array(z.object({
  id: z.string().min(1).max(40),
  name: text(60).min(1),
  prefixes: z.array(z.string().regex(/^\d{1,5}$/, 'Prefijo inválido')).max(50),
  local: z.boolean()
})).max(50);
