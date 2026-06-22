import React from 'react';

export default function Spinner({ label = '載入中，請稍候...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
      <p className="text-slate-500 font-medium">{label}</p>
    </div>
  );
}

export function FullScreenSpinner({ label = '系統載入中...' }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
      <p className="text-slate-500 font-medium tracking-wide">{label}</p>
    </div>
  );
}
