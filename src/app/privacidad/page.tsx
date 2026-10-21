import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { legalInfo } from '@/server/legal';
import { TERMS_VERSION } from '@/lib/constants';

export const metadata: Metadata = { title: 'Aviso de privacidad' };
export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  const l = await legalInfo();
  return (
    <LegalPage title="Aviso de privacidad" updated={TERMS_VERSION}>
      <p><b>{l.name}</b> opera Llévalo. Este aviso explica qué datos recopilamos y cómo los usamos.</p>

      <h2>Qué datos recopilamos</h2>
      <ul>
        <li><b>Cuenta:</b> tu número de teléfono y tu nombre.</li>
        <li><b>Pedidos:</b> direcciones de recolección y entrega, nombre y teléfono de quien recibe, notas, tamaño y valor declarado del paquete, y la foto de entrega.</li>
        <li><b>Pagos:</b> los procesa Stripe. Nosotros solo recibimos el resultado del pago (pagado, reembolsado), nunca el número de tu tarjeta.</li>
        <li><b>Repartidores:</b> Stripe recopila su identidad, datos fiscales y cuenta bancaria o tarjeta para pagarles. Nosotros solo vemos si su cuenta está activa.</li>
      </ul>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Para realizar los envíos: el repartidor asignado ve las direcciones y teléfonos necesarios para recoger y entregar.</li>
        <li>Para cobrar, reembolsar y pagar a los repartidores.</li>
        <li>Para enviarte códigos de acceso por mensaje de texto (Twilio).</li>
        <li>Para resolver reclamos, prevenir fraude y cumplir obligaciones legales y fiscales.</li>
      </ul>

      <h2>Con quién los compartimos</h2>
      <p>Solo con los proveedores necesarios para el servicio: Stripe (pagos), Twilio (mensajes), Google Maps (direcciones y distancias), Vercel y Neon (servidores y base de datos), y el repartidor que hace tu envío. <b>No vendemos tus datos.</b></p>

      <h2>Cuánto tiempo los guardamos</h2>
      <p>Guardamos los pedidos y sus registros de pago el tiempo que exige la ley para fines fiscales y de disputas. Puedes pedir que borremos tu cuenta; conservaremos solo lo que la ley nos obligue a guardar.</p>

      <h2>Tus opciones</h2>
      <p>Puedes pedir una copia de tus datos, corregirlos o borrarlos escribiendo a {l.email}.</p>

      <h2>Mensajes de texto</h2>
      <p>Solo enviamos mensajes para códigos de acceso y avisos de tus envíos. Pueden aplicar cargos de tu compañía telefónica.</p>
    </LegalPage>
  );
}
