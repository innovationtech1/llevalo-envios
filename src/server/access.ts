import 'server-only';
import type { Order, User } from '@/lib/types';
import { requireAdmin } from './auth';

/** ¿Esta petición tiene permisos de administrador? (incluye el modo demo abierto) */
export async function isAdminRequest(req: Request) {
  const g = await requireAdmin(req);
  return !g.res;
}

/** Datos que puede ver un repartidor de un envío que todavía no acepta: sin teléfonos ni foto. */
export const publicJob = (o: Order): Order => ({ ...o, senderPhone: '', recPhone: '', recName: '', notes: o.notes, photo: null });

export function canSee(o: Order, user: User | null, admin: boolean) {
  if (admin) return 'full';
  if (!user) return null;
  if (o.customerId === user.id) return 'full';
  if (o.driver?.id === user.id) return 'full';
  if (o.status === 'pendiente' && (user.driverStatus === 'aprobado' || user.isAdmin)) return 'job';
  return null;
}
