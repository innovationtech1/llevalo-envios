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

Ver `.env.example`. Ninguna es obligatoria para probar:

- `DATABASE_URL`: sin ella corre en **modo demo** (datos temporales).
- `GOOGLE_MAPS_API_KEY`: sin ella usa OpenStreetMap.
- `ADMIN_PIN`: sin ella el panel queda abierto.

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
