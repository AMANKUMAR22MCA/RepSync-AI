import React from 'react';
import Header from './components/Header';
import InteractionForm from './components/InteractionForm';
import ChatPanel from './components/ChatPanel';
import './App.css';

export default function App() {
  return (
    <div className="app-container">
      <Header />
      <main className="main-content">
        <div className="left-column">
          <InteractionForm />
        </div>
        <div className="right-column">
          <ChatPanel />
        </div>
      </main>
    </div>
  );
}
