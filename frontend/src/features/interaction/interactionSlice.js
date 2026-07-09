import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  interactions: [],
  currentInteraction: null,
};

const interactionSlice = createSlice({
  name: 'interaction',
  initialState,
  reducers: {
    setInteractions: (state, action) => {
      state.interactions = action.payload;
    },
    setCurrentInteraction: (state, action) => {
      state.currentInteraction = action.payload;
    },
    addInteraction: (state, action) => {
      state.interactions.unshift(action.payload); // prepend to keep it sorted (descending by default)
    },
    updateInteractionInList: (state, action) => {
      const updated = action.payload;
      const index = state.interactions.findIndex((i) => i.id === updated.id);
      if (index !== -1) {
        state.interactions[index] = updated;
      }
    },
  },
});

export const { setInteractions, setCurrentInteraction, addInteraction, updateInteractionInList } = interactionSlice.actions;
export default interactionSlice.reducer;
