import { createSlice } from '@reduxjs/toolkit';

// Generate threadId helper with safe fallback
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'thread-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now();
};

const getInitialThreadId = () => {
  const id = localStorage.getItem('repsync_thread_id') || generateUUID();
  localStorage.setItem('repsync_thread_id', id);
  return id;
};

const initialState = {
  messages: [], // Array of { role: 'user'|'assistant'|'tool'|..., content: string }
  isLoading: false,
  threadId: getInitialThreadId(),
  error: null,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage: (state, action) => {
      state.messages.push(action.payload);
    },
    setMessages: (state, action) => {
      state.messages = action.payload;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    clearChat: (state) => {
      state.messages = [];
      state.error = null;
      state.isLoading = false;
    },
    resetThreadId: (state) => {
      const newThreadId = generateUUID();
      localStorage.setItem('repsync_thread_id', newThreadId);
      state.threadId = newThreadId;
    }
  },
});

export const { addMessage, setMessages, setLoading, setError, clearChat, resetThreadId } = chatSlice.actions;
export default chatSlice.reducer;
