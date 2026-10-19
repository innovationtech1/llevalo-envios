import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Role } from '@/lib/types';

/** Preferencias del celular. La identidad (nombre, teléfono, permisos) viene del servidor. */
export interface SessionState {
  hydrated: boolean;
  role: Role | null; // modo en el que está usando la app
  online: boolean;   // repartidor disponible
}

export const initialSession: SessionState = { hydrated: false, role: null, online: false };

export const SESSION_KEY = 'llevalo:session:v3';

const sessionSlice = createSlice({
  name: 'session',
  initialState: initialSession,
  reducers: {
    hydrate: (s, a: PayloadAction<Partial<SessionState>>) => ({ ...s, role: a.payload.role ?? s.role, online: a.payload.online ?? s.online, hydrated: true }),
    setRole: (s, a: PayloadAction<Role>) => { s.role = a.payload; },
    setOnline: (s, a: PayloadAction<boolean>) => { s.online = a.payload; }
  }
});

export const { hydrate, setRole, setOnline } = sessionSlice.actions;
export default sessionSlice.reducer;
