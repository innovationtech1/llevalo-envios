import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { AppInfo, Order, OrderStatus, Place, QuoteResponse, Settings, SizeId, Zone } from '@/lib/types';

interface RootLike { session: { adminPin: string } }

export type NewOrderBody = {
  pickup: Place; dropoff: Place; size: SizeId; when: 'ahora' | 'prog'; scheduledAt: string;
  senderName: string; senderPhone: string; recName: string; recPhone: string; notes: string;
};

export type OrderAction =
  | { action: 'accept' | 'pickup' | 'deliver'; driver: { name: string; phone: string } }
  | { action: 'photo'; driver: { name: string; phone: string }; photo: string }
  | { action: 'cancel'; phone?: string };

export interface OrdersQuery { phone?: string; driver?: string; status?: OrderStatus[] }

/** Mensaje de error legible a partir de la respuesta de RTK Query. */
export function errorMessage(err: unknown, fallback = 'Algo salió mal. Intenta de nuevo.'): string {
  const e = err as { data?: { error?: string }; status?: number | string } | undefined;
  if (e?.data?.error) return e.data.error;
  if (e?.status === 'FETCH_ERROR') return 'Sin conexión. Revisa tu internet.';
  return fallback;
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers, { getState }) => {
      const pin = (getState() as RootLike).session.adminPin;
      if (pin) headers.set('x-admin-pin', pin);
      return headers;
    }
  }),
  tagTypes: ['Order', 'Settings', 'Zones', 'Info'],
  endpoints: (b) => ({
    info: b.query<AppInfo, void>({ query: () => 'info', providesTags: ['Info'] }),

    settings: b.query<Settings, void>({ query: () => 'settings', providesTags: ['Settings'] }),
    saveSettings: b.mutation<Settings, Omit<Settings, 'edited'>>({
      query: (body) => ({ url: 'settings', method: 'PUT', body }),
      invalidatesTags: ['Settings']
    }),

    zones: b.query<Zone[], void>({ query: () => 'zones', providesTags: ['Zones'] }),
    saveZones: b.mutation<Zone[], Zone[]>({
      query: (body) => ({ url: 'zones', method: 'PUT', body }),
      invalidatesTags: ['Zones']
    }),

    geocode: b.query<Place[], string>({ query: (q) => ({ url: 'geocode', params: { q } }), keepUnusedDataFor: 300 }),
    quote: b.query<QuoteResponse, { pickup: Place; dropoff: Place; size: SizeId }>({
      query: (body) => ({ url: 'quote', method: 'POST', body }),
      providesTags: ['Settings', 'Zones']
    }),

    orders: b.query<Order[], OrdersQuery>({
      query: ({ phone, driver, status }) => ({
        url: 'orders',
        params: { ...(phone ? { phone } : {}), ...(driver ? { driver } : {}), ...(status?.length ? { status: status.join(',') } : {}) }
      }),
      providesTags: (res) => [...(res ?? []).map((o) => ({ type: 'Order' as const, id: o.id })), { type: 'Order', id: 'LIST' }]
    }),
    order: b.query<Order, string>({ query: (id) => `orders/${id}`, providesTags: (_r, _e, id) => [{ type: 'Order', id }] }),
    createOrder: b.mutation<Order, NewOrderBody>({
      query: (body) => ({ url: 'orders', method: 'POST', body }),
      invalidatesTags: [{ type: 'Order', id: 'LIST' }]
    }),
    orderAction: b.mutation<Order, { id: string } & OrderAction>({
      query: ({ id, ...body }) => ({ url: `orders/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Order', id }, { type: 'Order', id: 'LIST' }]
    }),
    clearOrders: b.mutation<{ ok: true }, void>({
      query: () => ({ url: 'orders', method: 'DELETE' }),
      invalidatesTags: [{ type: 'Order', id: 'LIST' }]
    }),

    checkAdmin: b.mutation<{ ok: true }, string>({
      query: (pin) => ({ url: 'admin/check', method: 'POST', headers: { 'x-admin-pin': pin } })
    })
  })
});

export const {
  useInfoQuery, useSettingsQuery, useSaveSettingsMutation, useZonesQuery, useSaveZonesMutation,
  useLazyGeocodeQuery, useQuoteQuery, useOrdersQuery, useOrderQuery, useCreateOrderMutation,
  useOrderActionMutation, useClearOrdersMutation, useCheckAdminMutation
} = api;
