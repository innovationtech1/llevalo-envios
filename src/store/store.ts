import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { api } from './api';
import session, { SESSION_KEY, setOnline, setRole } from './sessionSlice';
import draft from './draftSlice';
import ui from './uiSlice';

// Guarda la sesión (modo, nombre, teléfono) en el celular cada vez que cambia.
const persist = createListenerMiddleware();
persist.startListening({
  matcher: isAnyOf(setRole, setOnline),
  effect: (_action, api) => {
    const { hydrated, ...rest } = (api.getState() as { session: import('./sessionSlice').SessionState }).session;
    if (!hydrated) return;
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(rest)); } catch { /* almacenamiento bloqueado */ }
  }
});

export const makeStore = () => {
  const store = configureStore({
    reducer: { session, draft, ui, [api.reducerPath]: api.reducer },
    middleware: (gdm) => gdm().prepend(persist.middleware).concat(api.middleware)
  });
  setupListeners(store.dispatch); // refresca datos al volver a la app o recuperar señal
  return store;
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
