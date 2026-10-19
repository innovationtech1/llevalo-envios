import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Place, SizeId } from '@/lib/types';

/** Formulario de "nuevo envío": vive en Redux para no perderse al cambiar de pantalla. */
export interface DraftState {
  pickup: Place | null;
  dropoff: Place | null;
  size: SizeId;
  when: 'ahora' | 'prog';
  scheduledAt: string;
  senderName: string;
  recName: string;
  recPhone: string;
  notes: string;
}

const initialDraft: DraftState = {
  pickup: null, dropoff: null, size: 'pequeno', when: 'ahora', scheduledAt: '',
  senderName: '', recName: '', recPhone: '', notes: ''
};

type TextField = 'scheduledAt' | 'senderName' | 'recName' | 'recPhone' | 'notes';

const draftSlice = createSlice({
  name: 'draft',
  initialState: initialDraft,
  reducers: {
    setPlace: (s, a: PayloadAction<{ field: 'pickup' | 'dropoff'; place: Place | null }>) => { s[a.payload.field] = a.payload.place; },
    setSize: (s, a: PayloadAction<SizeId>) => { s.size = a.payload; },
    setWhen: (s, a: PayloadAction<'ahora' | 'prog'>) => { s.when = a.payload; },
    setField: (s, a: PayloadAction<{ field: TextField; value: string }>) => { s[a.payload.field] = a.payload.value; },
    prefillContact: (s, a: PayloadAction<{ name: string }>) => {
      if (!s.senderName) s.senderName = a.payload.name;
    },
    resetDraft: () => initialDraft
  }
});

export const { setPlace, setSize, setWhen, setField, prefillContact, resetDraft } = draftSlice.actions;
export default draftSlice.reducer;
