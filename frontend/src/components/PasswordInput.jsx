import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const BULLET = '•';
const PEEK_MS = 900;

function maskPassword(password, peekLast) {
  if (!password) return '';
  if (password.length === 1) return peekLast ? password : BULLET;
  const bullets = BULLET.repeat(password.length - 1);
  return peekLast ? bullets + password[password.length - 1] : BULLET.repeat(password.length);
}

function nextPasswordFromMaskedInput(displayed, previous, peekLast) {
  if (![...displayed].some((ch) => ch === BULLET)) return displayed;

  const previousDisplay = maskPassword(previous, peekLast);
  if (displayed.length >= previousDisplay.length) {
    return previous + displayed.slice(previousDisplay.length);
  }
  const removed = previousDisplay.length - displayed.length;
  return previous.slice(0, Math.max(0, previous.length - removed));
}

export default function PasswordInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  required,
  minLength,
  autoComplete = 'current-password',
  className = 'fc-input fc-focus w-full px-3 py-2.5',
}) {
  const [visible, setVisible] = useState(false);
  const [peekLast, setPeekLast] = useState(false);
  const peekTimer = useRef(null);
  const valueRef = useRef(value);
  const peekRef = useRef(peekLast);
  valueRef.current = value;
  peekRef.current = peekLast;

  useEffect(() => () => {
    if (peekTimer.current) clearTimeout(peekTimer.current);
  }, []);

  function revealLastTyped() {
    setPeekLast(true);
    if (peekTimer.current) clearTimeout(peekTimer.current);
    peekTimer.current = setTimeout(() => setPeekLast(false), PEEK_MS);
  }

  function handleChange(e) {
    const displayed = e.target.value;
    if (visible) {
      onChange(displayed);
      return;
    }
    onChange(nextPasswordFromMaskedInput(displayed, valueRef.current, peekRef.current));
    revealLastTyped();
  }

  return (
    <div className="relative mt-1">
      <input
        type="text"
        autoFocus={autoFocus}
        required={required}
        minLength={minLength}
        autoComplete={visible ? 'off' : autoComplete}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        value={visible ? value : maskPassword(value, peekLast)}
        onChange={handleChange}
        placeholder={placeholder}
        className={className}
        style={{ paddingRight: '2.75rem' }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="fc-focus absolute fc-text-dim"
        style={{ right: 10, top: 0, bottom: 0, display: 'flex', alignItems: 'center' }}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
