import React from 'react';
import GroupsDropdown from './GroupsDropdown';

interface Props {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

export default function Header({ theme, onToggleTheme, selectedCategory, onCategoryChange }: Props) {
  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <header className="header">
      <img
        className="header-logo"
        src="/moffajotto.png"
        alt="logo"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <span className="header-title">📻 Radioportalen</span>
      <div className="header-controls">
        <GroupsDropdown selected={selectedCategory} onChange={onCategoryChange} />
        <button className="header-btn" onClick={onToggleTheme} title="Bytt tema">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className="header-btn" onClick={handleFullscreen} title="Fullskjerm">
          ⛶
        </button>
      </div>
    </header>
  );
}
