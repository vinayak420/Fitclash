import React from 'react';

export default function Avatar({ name, size = 36 }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <div
      className="fc-bg-ink3 flex items-center justify-center rounded-full font-display fc-signal shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.42, border: '1px solid var(--steel)' }}
    >
      {initial}
    </div>
  );
}
