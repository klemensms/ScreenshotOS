import React from 'react';

export function MenuBar() {
  const menuItems = [
    { label: 'FILE', active: false },
    { label: 'DRAW', active: false },
    { label: 'IMAGE', active: false },
    { label: 'CAPTURE', active: true }
  ];

  return (
    <div className="bg-gray-100 border-b border-gray-300 px-2 py-1">
      <div className="flex items-center gap-1">
        {menuItems.map((item, index) => (
          <button
            key={index}
            className={`px-3 py-1 text-sm hover:bg-gray-200 ${
              item.active ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}