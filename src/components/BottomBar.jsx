import React from 'react'

export default function BottomBar({ activeTab, onSwitch }) {
  return (
    <nav className="bottom-nav" role="navigation" aria-label="Bottom navigation">
      <button
        className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => onSwitch('dashboard')}
        aria-pressed={activeTab === 'dashboard'}
      >
        Dashboard
      </button>
      <button
        className={`nav-btn ${activeTab === 'positions' ? 'active' : ''}`}
        onClick={() => onSwitch('positions')}
        aria-pressed={activeTab === 'positions'}
      >
        Open Positions
      </button>
    </nav>
  )
}
