import React, { useEffect, useState } from 'react';

export function resolveMediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://localhost:8000';
  return `${base}${path}`;
}

export default function Avatar({ name, size = 36, src }) {
  const [failed, setFailed] = useState(false);
  const imageSrc = resolveMediaUrl(src);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const showImage = Boolean(imageSrc) && !failed;
  const initial = (name || '?').trim().charAt(0).toUpperCase();

  return (
    <div
      className="fc-bg-ink3 flex items-center justify-center rounded-full font-display fc-signal shrink-0 overflow-hidden"
      style={{ width: size, height: size, fontSize: size * 0.42, border: '1px solid var(--steel)' }}
    >
      {showImage ? (
        <img
          src={imageSrc}
          alt=""
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        initial
      )}
    </div>
  );
}
