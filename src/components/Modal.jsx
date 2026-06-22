import React from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, icon, onClose, children, footer, maxWidth = 'max-w-lg' }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-slate-900/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} overflow-hidden flex flex-col max-h-[90vh] animate-scale-in`}>
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
            {icon}
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto">{children}</div>

        {footer && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
