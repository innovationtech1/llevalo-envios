import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Role } from '@/lib/types';

export interface SessionState {
  hydrated: boolean;
  role: Role | null;
  name: string;
  phone: string;
  online: boolean;
  adminPin: string;
}

export const initialSession: SessionState = { hydrated: false, role: null, name: '', phone: '', online: false, adminPin: '' };

export const SESSION_KEY = 'llevalo:session:v2';

const sessionSlice = createSlice({
  name: 'session',
  initialState: initialSession,
  reducers: {
    hydrate: (s, a: PayloadAction<Partial<SessionState>>) => ({ ...s, ...a.payload, hydrated: true }),
    setRole: (s, a: PayloadAction<Role>) => { s.role = a.payload; },
    setProfile: (s, a: PayloadAction<{ name?: string; phone?: string }>) => {
      if (a.payload.name !== undefined) s.name = a.payload.name.trim();
      if (a.payload.phone !== undefined) s.phone = a.payload.phone.trim();
    },
    setOnline: (s, a: PayloadAction<boolean>) => { s.online = a.payload; },
    setAdminPin: (s, a: PayloadAction<string>) => { s.adminPin = a.payload; }
  }
});

export const { hydrate, setRole, setProfile, setOnline, setAdminPin } = sessionSlice.actions;
export default sessionSlice.reducer;
