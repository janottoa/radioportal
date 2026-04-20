import React from 'react';

interface Category {
  id: string;
  label: string;
}

const CATEGORIES: Category[] = [
  { id: 'all', label: 'Alle' },
  { id: 'NRK', label: 'NRK' },
  { id: 'P4', label: 'P4' },
  { id: 'Radio Norge', label: 'Radio Norge' },
  { id: 'Metro', label: 'Metro' },
  { id: 'Lokale', label: 'Norske' },
  { id: 'Internet', label: 'Mix' },
  { id: 'Colombia', label: 'Colombia' },
  { id: '1fm', label: '1fm' },
  { id: '181fm', label: '181fm' },
  { id: 'hotmix', label: 'HotMix' },
  { id: 'radiotunes', label: 'RadioTunes' },
  { id: '100fm', label: '100fm' },
  { id: 'Latinske', label: 'Latinsk' },
  { id: 'utland', label: 'UK/Irland' },
  { id: 'de', label: 'Tyskland' },
  { id: 'se', label: 'Sverige' },
  { id: 'dk', label: 'Danmark' },
  { id: 'us', label: 'USA' },
  { id: 'es', label: 'Spania' },
  { id: 'fr', label: 'Frankrike' },
  { id: 'it', label: 'Italia' },
  { id: 'gr', label: 'Hellas' },
  { id: 'yo', label: 'Balkan' },
  { id: 'pl', label: 'Polen' },
  { id: 'by', label: 'Hvite Russland' },
  { id: 'baltic', label: 'Baltic' },
  { id: 'tjekkia', label: 'Tjekkia' },
  { id: 'hu', label: 'Ungarn' },
  { id: 'Ledig10', label: 'Romania/BUL' },
];

interface Props {
  selected: string;
  onChange: (category: string) => void;
}

export default function GroupsDropdown({ selected, onChange }: Props) {
  return (
    <select
      className="groups-select"
      value={selected}
      onChange={e => onChange(e.target.value)}
    >
      {CATEGORIES.map(cat => (
        <option key={cat.id} value={cat.id}>{cat.label}</option>
      ))}
    </select>
  );
}
