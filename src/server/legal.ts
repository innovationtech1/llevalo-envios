import 'server-only';
import { getRepo } from './repo';
import { DEFAULT_SETTINGS } from '@/lib/constants';

/** Datos de la empresa para los documentos legales (variables en Vercel). */
export async function legalInfo() {
  let settings = DEFAULT_SETTINGS;
  try { settings = await getRepo().getSettings(); } catch { /* sin base de datos: valores por defecto */ }
  return {
    name: process.env.LEGAL_NAME || '[NOMBRE LEGAL DE TU EMPRESA]',
    email: process.env.LEGAL_EMAIL || '[CORREO DE CONTACTO]',
    address: process.env.LEGAL_ADDRESS || '[DIRECCIÓN DEL NEGOCIO], San Antonio, Texas',
    coverageMax: settings.coverageMax,
    cancelFee: settings.cancelFee
  };
}
