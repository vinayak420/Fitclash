import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Check } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState('');

  const notify = useCallback((msg) => setToast(msg), []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      {toast ? (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 fc-card px-4 py-3 flex items-center gap-2 shadow-lg">
          <Check size={16} className="fc-turf" />
          <span className="text-sm">{toast}</span>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
