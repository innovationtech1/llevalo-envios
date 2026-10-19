import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface UiState { toast: { id: number; text: string } | null }

const uiSlice = createSlice({
  name: 'ui',
  initialState: { toast: null } as UiState,
  reducers: {
    showToast: (s, a: PayloadAction<string>) => { s.toast = { id: Date.now(), text: a.payload }; },
    hideToast: (s) => { s.toast = null; }
  }
});

export const { showToast, hideToast } = uiSlice.actions;
export default uiSlice.reducer;
