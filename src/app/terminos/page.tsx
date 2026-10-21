import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { legalInfo } from '@/server/legal';
import { PROHIBITED_ITEMS, TERMS_VERSION } from '@/lib/constants';
import { money } from '@/lib/format';

export const metadata: Metadata = { title: 'Términos y condiciones' };
export const dynamic = 'force-dynamic';

export default async function TermsPage() {
  const l = await legalInfo();
  return (
    <LegalPage title="Términos y condiciones" updated={TERMS_VERSION}>
      <p>Estos términos regulan el uso de Llévalo, servicio operado por <b>{l.name}</b> (“nosotros”), con domicilio en {l.address}. Al crear un pedido aceptas estos términos.</p>

      <h2>1. El servicio</h2>
      <p>Llévalo conecta a clientes que necesitan enviar paquetes dentro de nuestras zonas de cobertura con repartidores independientes. Los repartidores no son empleados nuestros; son contratistas independientes que aceptan los envíos que deciden hacer.</p>

      <h2>2. Precio y pago</h2>
      <ul>
        <li>El precio se calcula antes de confirmar el pedido según la distancia en millas, el tamaño del paquete y nuestras tarifas vigentes. El precio mostrado al pagar es el precio final.</li>
        <li>Los pagos con tarjeta se procesan de forma segura con Stripe. Nosotros no guardamos los datos de tu tarjeta.</li>
        <li>Al pagar autorizas el cobro total del envío.</li>
      </ul>

      <h2>3. Cancelaciones y reembolsos</h2>
      <ul>
        <li>Puedes cancelar <b>sin costo</b> mientras ningún repartidor haya aceptado tu pedido. Te devolvemos el total a tu tarjeta.</li>
        <li>Si cancelas <b>después de que un repartidor aceptó</b> y antes de que recoja el paquete, se cobra un cargo de cancelación de <b>{money(l.cancelFee)}</b>, que se le paga al repartidor, y te devolvemos el resto.</li>
        <li>Una vez recogido el paquete, el pedido no se puede cancelar desde la app. Escríbenos a {l.email} y lo revisaremos.</li>
        <li>Los reembolsos se envían el mismo día, pero tu banco puede tardar de 5 a 10 días hábiles en mostrarlos.</li>
      </ul>

      <h2>4. Artículos prohibidos</h2>
      <p>No transportamos:</p>
      <ul>{PROHIBITED_ITEMS.map((x) => <li key={x}>{x}</li>)}</ul>
      <p>El repartidor puede rechazar un paquete si sospecha que contiene algo prohibido o si está mal empacado. En ese caso, podemos cobrar el cargo de cancelación.</p>

      <h2>5. Responsabilidad del cliente</h2>
      <ul>
        <li>Debes dar direcciones y teléfonos correctos, y empacar el paquete de forma adecuada.</li>
        <li>Debe haber alguien para entregar y recibir el paquete, o instrucciones claras en las notas.</li>
        <li>Declaras que tienes derecho a enviar el contenido y que no infringe ninguna ley.</li>
      </ul>

      <h2>6. Pérdida o daño</h2>
      <p>Si un paquete se pierde o se daña mientras está en manos del repartidor, cubrimos hasta el <b>valor declarado</b> al hacer el pedido, con un máximo de <b>{money(l.coverageMax)}</b> por envío, previa revisión del caso. Para reclamar, escríbenos a {l.email} dentro de los 7 días siguientes, con fotos y comprobante del valor. No cubrimos artículos prohibidos, empaque inadecuado ni daños indirectos.</p>

      <h2>7. Prueba de entrega</h2>
      <p>El repartidor puede tomar una foto del paquete entregado. Esa foto, la hora y la ubicación registradas sirven como comprobante de entrega.</p>

      <h2>8. Uso adecuado</h2>
      <p>Podemos suspender cuentas que usen el servicio para fraude, envíos prohibidos, trato abusivo a repartidores o reclamos falsos.</p>

      <h2>9. Limitación de responsabilidad</h2>
      <p>En la medida que lo permita la ley, nuestra responsabilidad total por cualquier reclamo relacionado con un envío se limita al monto que pagaste por ese envío más la cobertura descrita en la sección 6.</p>

      <h2>10. Ley aplicable</h2>
      <p>Estos términos se rigen por las leyes del estado de Texas, EE. UU. Si tienes un problema, contáctanos primero a {l.email}; intentaremos resolverlo de buena fe.</p>

      <h2>11. Cambios</h2>
      <p>Podemos actualizar estos términos. Cada pedido queda sujeto a la versión vigente al momento de crearlo.</p>
    </LegalPage>
  );
}
