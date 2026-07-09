import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  hcpName: '',
  interactionType: '', // 'Meeting', 'Call', 'Email', 'Video Conference'
  date: '',
  time: '',
  attendees: '',
  topicsDiscussed: '',
  materialsShared: '',
  samplesDistributed: '',
  sentiment: '', // 'Positive', 'Neutral', 'Negative'
  outcomes: '',
  followUpActions: '',
  suggestions: [],
  hcpId: null,
  currentInteractionId: null,
};

const formSlice = createSlice({
  name: 'form',
  initialState,
  reducers: {
    updateFormField: (state, action) => {
      const { field, value } = action.payload;
      state[field] = value;
    },
    setCurrentInteractionId: (state, action) => {
      state.currentInteractionId = action.payload;
    },
    setFormData: (state, action) => {
      const data = action.payload;
      if (data.hcpName !== undefined) state.hcpName = data.hcpName;
      if (data.interactionType !== undefined) state.interactionType = data.interactionType;
      if (data.date !== undefined) state.date = data.date;
      if (data.time !== undefined) state.time = data.time;
      if (data.attendees !== undefined) state.attendees = data.attendees;
      if (data.topicsDiscussed !== undefined) state.topicsDiscussed = data.topicsDiscussed;
      if (data.materialsShared !== undefined) state.materialsShared = data.materialsShared;
      if (data.samplesDistributed !== undefined) state.samplesDistributed = data.samplesDistributed;
      if (data.sentiment !== undefined) state.sentiment = data.sentiment;
      if (data.outcomes !== undefined) state.outcomes = data.outcomes;
      if (data.followUpActions !== undefined) state.followUpActions = data.followUpActions;
      if (data.suggestions !== undefined) state.suggestions = data.suggestions;
      if (data.hcpId !== undefined) state.hcpId = data.hcpId;
      if (data.currentInteractionId !== undefined) state.currentInteractionId = data.currentInteractionId;
    },
    appendSuggestion: (state, action) => {
      const suggestion = action.payload;
      const current = state.followUpActions ? state.followUpActions.trim() : '';
      if (current) {
        // If there's already content, append with a comma and space
        state.followUpActions = `${current}, ${suggestion}`;
      } else {
        state.followUpActions = suggestion;
      }
    },
    clearForm: () => initialState,
  },
});

export const { updateFormField, setCurrentInteractionId, setFormData, appendSuggestion, clearForm } = formSlice.actions;
export default formSlice.reducer;
