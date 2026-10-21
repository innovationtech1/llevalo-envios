# Llévalo — mensajería local

App web instalable (PWA) para mensajería local en San Antonio, con tres modos: **cliente**, **repartidor** y **administrador**.

**Tecnología:** Next.js 16 (App Router) · React 19 · TypeScript · Redux Toolkit + RTK Query · Zod · Postgres (Neon).

## Cómo funciona

| Parte | Dónde vive |
|---|---|
| Pantallas | `src/app/**/page.tsx` |
| Estado global (sesión, formulario, avisos) | `src/store/*Slice.ts` |
| Datos del servidor (pedidos, tarifas, zonas) | `src/store/api.ts` (RTK Query, se actualiza solo) |
| API | `src/app/api/**/route.ts` |
| Reglas de negocio | `src/lib/pricing.ts` (precio), `src/app/api/orders/[id]/route.ts` (estados del envío) |
| Base de datos | `src/server/repo.ts` (Postgres o memoria) |
| Mapas | `src/server/geo.ts` (Google Maps u OpenStreetMap) |

**Reglas importantes:**
- El precio **siempre lo calcula el servidor** con las tarifas guardadas; el celular solo lo muestra.
- Un envío pasa por `pendiente → asignado → recogido → entregado` (o `cancelado`). El cambio es atómico: dos repartidores no pueden tomar el mismo envío.
- El cliente solo cancela mientras nadie ha aceptado; el administrador, hasta antes de que se recoja.

## Variables de entorno

Ver `.env.example`. Cada servicio se activa al poner su clave; sin ella, esa parte funciona en modo prueba:

| Variable | Sin ella |
|---|---|
| `DATABASE_URL` (Neon) | Datos temporales en memoria |
| `ADMIN_PHONES` | Panel abierto en modo demo; cerrado con base de datos real |
| `GOOGLE_MAPS_API_KEY` | Búsqueda con OpenStreetMap (sin autocompletar) |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | Pago en efectivo al entregar |
| `TWILIO_*` | Código de prueba `123456` (admin: `ADMIN_PIN`) |

## Cuentas y permisos

- Todos entran con su teléfono y un código por SMS (Twilio Verify). La sesión es una cookie firmada de 30 días.
- Cualquier cuenta puede pedir envíos. Para repartir, la persona lo solicita y el administrador la aprueba en **Admin → Repartidores**.
- Administrador = teléfono incluido en `ADMIN_PHONES`.

## Pagos

- **Cliente:** Stripe Checkout. El pedido se crea como `por_pagar` y pasa a `pendiente` (visible para repartidores) cuando Stripe confirma el pago (webhook o al volver a la app).
- **Repartidor:** Stripe Connect con cuentas **Express** (Stripe verifica identidad, guarda datos fiscales y emite 1099). Al entregar se hace una transferencia con `source_transaction` = el cobro del cliente y, si `instantPayouts` está activo, un **Instant Payout** a su tarjeta de débito (~30 min, Stripe cobra 1%). Si no se puede, le llega en su depósito diario. El admin puede reintentar pagos fallidos.
- **Cancelación:** gratis antes de que un repartidor acepte (reembolso total). Después, el cliente paga `cancelFee`, que se transfiere al repartidor, y se reembolsa el resto.
- **Disputas:** el webhook `charge.dispute.created` marca el pedido y el panel avisa.
- Los repartidores deben aceptar el acuerdo de contratista y tener su cuenta de cobros activa para aceptar envíos pagados con tarjeta.
- Los clientes aceptan Términos (versión guardada en cada pedido), confirman que no envían artículos prohibidos y declaran el valor del paquete.

## Comandos

```bash
npm install
npm run dev        # desarrollo en http://localhost:3000
npm run build      # compilación de producción
npm test           # pruebas del cálculo de precios y zonas
npm run typecheck
```

## Publicar en Vercel

1. Sube este proyecto a un repositorio de GitHub.
2. En Vercel: **Add New → Project**, importa el repositorio y presiona **Deploy** (detecta Next.js solo).
3. Base de datos: en el proyecto de Vercel → **Storage → Create Database → Neon (Postgres)**. Vercel agrega `DATABASE_URL` automáticamente. Las tablas se crean solas en la primera petición.
4. En **Settings → Environment Variables** agrega `ADMIN_PIN` (y `GOOGLE_MAPS_API_KEY` cuando la tengas). Vuelve a desplegar.

## Siguiente fase

- Cuentas con inicio de sesión (clientes y repartidores verificados).
- Cobro con tarjeta (Stripe).
- Ubicación del repartidor en vivo en un mapa.
- Paquetería nacional y comida a domicilio.
