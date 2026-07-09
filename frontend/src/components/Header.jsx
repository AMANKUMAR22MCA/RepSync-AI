import React from 'react';

export default function Header() {
  return (
    <header className="app-header">
      <div className="header-logo-container">
        {/* SVG Logo representing a sync/connection with a medical cross or node */}
        <svg
          className="header-logo"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Outer circle segment */}
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          {/* Inner plus representing pharma/medical */}
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
        <span className="header-title">RepSync AI</span>
      </div>
      <div className="header-tagline">Pharma CRM Smart Assistant</div>
    </header>
  );
}
