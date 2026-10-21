import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { legalInfo } from '@/server/legal';
import { DRIVER_TERMS_VERSION, PROHIBITED_ITEMS } from '@/lib/constants';

export const metadata: Metadata = { title: 'Acuerdo de repartidor independiente' };
export const dynamic = 'force-dynamic';

export default async function DriverAgreementPage() {
  const l = await legalInfo();
  return (
    <LegalPage title="Acuerdo de repartidor independiente" updated={DRIVER_TERMS_VERSION}>
      <p>Este acuerdo es entre <b>{l.name}</b> (“Llévalo”) y tú, como repartidor. Al aceptarlo en la app confirmas que lo leíste y estás de acuerdo.</p>

      <h2>1. Eres contratista independiente</h2>
      <ul>
        <li>No eres empleado de Llévalo. Tú decides cuándo conectarte, qué envíos aceptas y qué ruta tomar.</li>
        <li>Usas tu propio vehículo, teléfono y equipo, y cubres sus gastos (gasolina, mantenimiento, plan de datos).</li>
        <li>Puedes trabajar para otras empresas, incluso de la competencia.</li>
        <li>No hay horario mínimo ni exclusividad.</li>
      </ul>

      <h2>2. Pagos</h2>
      <ul>
        <li>Por cada envío entregado recibes el monto que la app te muestra <b>antes</b> de aceptarlo.</li>
        <li>Los pagos se hacen a través de Stripe. Para recibirlos debes crear tu cuenta de cobros en Stripe y darle tus datos de identidad, datos fiscales y una cuenta bancaria o tarjeta de débito.</li>
        <li>Cuando el pago instantáneo está activo, el dinero se envía a tu tarjeta de débito al marcar el envío como entregado y normalmente llega en unos 30 minutos. Si tu tarjeta o banco no lo permiten, llega en el depósito normal (1–2 días hábiles).</li>
        <li>Si un cliente cancela después de que aceptaste y antes de recoger, recibes el cargo de cancelación.</li>
      </ul>

      <h2>3. Impuestos</h2>
      <p>Eres responsable de declarar y pagar tus propios impuestos. Llévalo no te retiene impuestos. Stripe puede emitirte un formulario 1099 cuando la ley lo requiera.</p>

      <h2>4. Seguro y vehículo</h2>
      <ul>
        <li>Debes tener licencia de manejo vigente y el seguro de auto que exige Texas.</li>
        <li>Muchos seguros personales <b>no cubren</b> hacer entregas por pago. Es tu responsabilidad confirmar con tu aseguradora que estás cubierto o contratar la cobertura adecuada.</li>
        <li>Debes respetar las leyes de tránsito en todo momento.</li>
      </ul>

      <h2>5. Cuidado de los paquetes</h2>
      <ul>
        <li>Debes tratar los paquetes con cuidado, entregarlos sin abrirlos y tomar la foto de entrega cuando sea posible.</li>
        <li>Puedes rechazar un paquete si sospechas que contiene algo prohibido o si está mal empacado:</li>
      </ul>
      <ul>{PROHIBITED_ITEMS.map((x) => <li key={x}>{x}</li>)}</ul>

      <h2>6. Datos de clientes</h2>
      <p>Solo puedes usar los nombres, direcciones y teléfonos de los clientes para completar el envío. No puedes guardarlos, compartirlos ni contactar a los clientes para otros fines.</p>

      <h2>7. Conducta y desactivación</h2>
      <p>Podemos desactivar tu cuenta por fraude, robo, maltrato a clientes, manejo peligroso, entregas falsas o incumplimiento de este acuerdo. Tú puedes dejar de usar la app en cualquier momento.</p>

      <h2>8. Ley aplicable</h2>
      <p>Este acuerdo se rige por las leyes de Texas. Dudas: {l.email}.</p>
    </LegalPage>
  );
}
