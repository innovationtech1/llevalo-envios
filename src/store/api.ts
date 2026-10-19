import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { AppInfo, Order, Place, QuoteResponse, Settings, SizeId, Suggestion, User, Zone } from '@/lib/types';

export type NewOrderBody = {
  pickup: Place; dropoff: Place; size: SizeId; when: 'ahora' | 'prog'; scheduledAt: string;
  senderName: string; recName: string; recPhone: string; notes: string;
};

export type OrderAction =
  | { action: 'accept' | 'pickup' | 'deliver' | 'cancel' }
  | { action: 'photo'; photo: string };

export type OrdersScope = 'mine' | 'jobs' | 'driver' | 'all';

/** Mensaje de error legible a partir de la respuesta de RTK Query. */
export function errorMessage(err: unknown, fallback = 'Algo salió mal. Intenta de nuevo.'): string {
  const e = err as { data?: { error?: string }; status?: number | string } | undefined;
  if (e?.data?.error) return e.data.error;
  if (e?.status === 'FETCH_ERROR') return 'Sin conexión. Revisa tu internet.';
  return fallback;
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api', credentials: 'same-origin' }),
  tagTypes: ['Order', 'Settings', 'Zones', 'Info', 'Me', 'Drivers'],
  endpoints: (b) => ({
    info: b.query<AppInfo, void>({ query: () => 'info', providesTags: ['Info'] }),

    /* ---- cuenta ---- */
    me: b.query<User | null, void>({ query: () => 'auth/me', providesTags: ['Me'] }),
    startLogin: b.mutation<{ phone: string; mode: 'twilio' | 'prueba' }, string>({
      query: (phone) => ({ url: 'auth/start', method: 'POST', body: { phone } })
    }),
    verifyLogin: b.mutation<User, { phone: string; code: string }>({
      query: (body) => ({ url: 'auth/verify', method: 'POST', body }),
      // Cambió el usuario: guardamos el nuevo y recargamos los datos que dependen de él.
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(api.util.upsertQueryData('me', undefined, data));
          dispatch(api.util.invalidateTags(['Order', 'Drivers']));
        } catch { /* error mostrado en pantalla */ }
      }
    }),
    logout: b.mutation<{ ok: true }, void>({
      query: () => ({ url: 'auth/logout', method: 'POST' }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try { await queryFulfilled; } finally {
          dispatch(api.util.upsertQueryData('me', undefined, null));
          dispatch(api.util.invalidateTags(['Order', 'Drivers']));
        }
      }
    }),
    updateMe: b.mutation<User, { name?: string; applyDriver?: true }>({
      query: (body) => ({ url: 'auth/me', method: 'PATCH', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try { const { data } = await queryFulfilled; dispatch(api.util.upsertQueryData('me', undefined, data)); } catch { /* error en pantalla */ }
      }
    }),

    /* ---- tarifas y zonas ---- */
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

    /* ---- direcciones ---- */
    geocode: b.query<Place[], string>({ query: (q) => ({ url: 'geocode', params: { q } }), keepUnusedDataFor: 300 }),
    autocomplete: b.query<Suggestion[], { q: string; session: string }>({
      query: (params) => ({ url: 'places/autocomplete', params }), keepUnusedDataFor: 120
    }),
    placeDetails: b.query<Place, { id: string; session: string }>({
      query: (params) => ({ url: 'places/details', params }), keepUnusedDataFor: 600
    }),
    quote: b.query<QuoteResponse, { pickup: Place; dropoff: Place; size: SizeId }>({
      query: (body) => ({ url: 'quote', method: 'POST', body }),
      providesTags: ['Settings', 'Zones']
    }),

    /* ---- pedidos ---- */
    orders: b.query<Order[], OrdersScope>({
      query: (scope) => ({ url: 'orders', params: { scope } }),
      providesTags: (res) => [...(res ?? []).map((o) => ({ type: 'Order' as const, id: o.id })), { type: 'Order', id: 'LIST' }]
    }),
    order: b.query<Order, string>({ query: (id) => `orders/${id}`, providesTags: (_r, _e, id) => [{ type: 'Order', id }] }),
    createOrder: b.mutation<{ order: Order; checkoutUrl?: string; error?: string }, NewOrderBody>({
      query: (body) => ({ url: 'orders', method: 'POST', body }),
      invalidatesTags: [{ type: 'Order', id: 'LIST' }]
    }),
    orderAction: b.mutation<Order, { id: string } & OrderAction>({
      query: ({ id, ...body }) => ({ url: `orders/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Order', id }, { type: 'Order', id: 'LIST' }]
    }),
    payOrder: b.mutation<{ checkoutUrl?: string; order?: Order }, string>({
      query: (id) => ({ url: `orders/${id}/pay`, method: 'POST' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Order', id }]
    }),
    confirmPayment: b.mutation<Order, string>({
      query: (id) => `orders/${id}/pay`,
      invalidatesTags: (_r, _e, id) => [{ type: 'Order', id }, { type: 'Order', id: 'LIST' }]
    }),
    clearOrders: b.mutation<{ ok: true }, void>({
      query: () => ({ url: 'orders', method: 'DELETE' }),
      invalidatesTags: [{ type: 'Order', id: 'LIST' }]
    }),

    /* ---- administrador ---- */
    drivers: b.query<User[], void>({ query: () => 'admin/drivers', providesTags: ['Drivers'] }),
    setDriverStatus: b.mutation<User, { id: string; status: 'aprobado' | 'rechazado' | 'pendiente' }>({
      query: (body) => ({ url: 'admin/drivers', method: 'PATCH', body }),
      invalidatesTags: ['Drivers']
    })
  })
});

export const {
  useInfoQuery, useMeQuery, useStartLoginMutation, useVerifyLoginMutation, useLogoutMutation, useUpdateMeMutation,
  useSettingsQuery, useSaveSettingsMutation, useZonesQuery, useSaveZonesMutation,
  useLazyGeocodeQuery, useLazyAutocompleteQuery, useLazyPlaceDetailsQuery, useQuoteQuery,
  useOrdersQuery, useOrderQuery, useCreateOrderMutation, useOrderActionMutation, usePayOrderMutation,
  useConfirmPaymentMutation, useClearOrdersMutation, useDriversQuery, useSetDriverStatusMutation
} = api;
