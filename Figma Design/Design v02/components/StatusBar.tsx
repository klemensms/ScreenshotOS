import React from 'react';

export function StatusBar() {
  return (
    <div className="bg-blue-600 text-white px-4 py-1 flex items-center justify-between text-sm">
      <div className="flex items-center gap-4">
        <span>⧰ 646, 108</span>
        <span>⟐ 256 x 275</span>
        <span className="bg-blue-500 px-2 py-0.5 rounded">■■■■■■ - 255,255,255</span>
      </div>
      
      <div className="flex items-center gap-4">
        <span>100%</span>
        <button className="hover:bg-blue-500 px-1 rounded">−</button>
        <button className="hover:bg-blue-500 px-1 rounded">🗑</button>
        <button className="hover:bg-blue-500 px-1 rounded">+</button>
      </div>
    </div>
  );
}