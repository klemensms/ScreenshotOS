import React from 'react';

export function ScreenshotList() {
  const screenshots = [
    { id: 1, name: 'activexsyncmain', date: '2008-08-24 23:00:30.000000', size: '2048 x 1536 24.00' },
    { id: 2, name: 'activexsyncmain', date: '2008-08-24 23:00:30.000000', size: '2048 x 1536 24.00' },
    { id: 3, name: 'sdiVirginesFouras', date: '2008-08-24 23:00:30.000000', size: '2048 x 1536 24.00' },
    { id: 4, name: 'sutillinecbursani', date: '2008-08-24 23:00:30.000000', size: '2048 x 1536 24.00' },
    { id: 5, name: 'sdiVirginesFouras', date: '2008-08-24 23:00:30.000000', size: '2048 x 1536 24.00' },
    { id: 6, name: 'sdiVirginesFouras', date: '2008-08-24 23:00:30.000000', size: '2048 x 1536 24.00' },
    { id: 7, name: 'sutillinecbursani', date: '2008-08-24 23:00:30.000000', size: 'NULL' },
    { id: 8, name: 'Michia 1', date: '2008-08-24 23:00:30.000000', size: 'NULL' },
    { id: 9, name: 'Michia 2', date: '2008-08-24 23:00:30.000000', size: '2048 x 1536 24.00' },
    { id: 10, name: 'zyronx', date: '2008-08-24 23:00:30.000000', size: 'NULL' },
    { id: 11, name: 'michia1', date: '2008-08-24 23:00:30.000000', size: 'NULL' }
  ];

  return (
    <div className="bg-white border-r border-gray-300 w-80 h-full">
      {/* Column Headers */}
      <div className="bg-gray-50 border-b border-gray-300 px-3 py-1">
        <div className="grid grid-cols-12 gap-2 text-xs text-gray-600">
          <div className="col-span-1">#</div>
          <div className="col-span-4">Name</div>
          <div className="col-span-4">Date</div>
          <div className="col-span-3">Size</div>
        </div>
      </div>

      {/* Screenshot List */}
      <div className="h-full overflow-auto">
        {screenshots.map((screenshot) => (
          <div
            key={screenshot.id}
            className="grid grid-cols-12 gap-2 px-3 py-1 text-xs border-b border-gray-100 hover:bg-blue-50 cursor-pointer"
          >
            <div className="col-span-1 text-gray-500">{screenshot.id}</div>
            <div className="col-span-4 text-gray-800 truncate">{screenshot.name}</div>
            <div className="col-span-4 text-gray-600 truncate">{screenshot.date}</div>
            <div className="col-span-3 text-gray-600 truncate">{screenshot.size}</div>
          </div>
        ))}
      </div>
    </div>
  );
}