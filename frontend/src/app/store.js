import { configureStore } from '@reduxjs/toolkit';
import formReducer from '../features/form/formSlice';
import chatReducer from '../features/chat/chatSlice';
import interactionReducer from '../features/interaction/interactionSlice';

export const store = configureStore({
  reducer: {
    form: formReducer,
    chat: chatReducer,
    interaction: interactionReducer,
  },
});

export default store;
