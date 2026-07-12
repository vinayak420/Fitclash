import React, { useState } from 'react';
import Modal from './Modal';

export default function JoinGroupModal({ onClose, onJoin }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onJoin(code.trim());
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Join a group" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs fc-text-dim uppercase tracking-wide">Invite code</label>
          <input
            autoFocus
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(''); }}
            placeholder="e.g. 7K2XQP"
            className="fc-input fc-focus fc-mono w-full mt-1 px-3 py-2.5 tracking-widest uppercase"
          />
          {error && <p className="text-xs fc-ember mt-1">{error}</p>}
        </div>
        <button type="submit" disabled={!code.trim() || busy} className="fc-btn-primary fc-focus rounded-lg py-2.5 font-display">
          {busy ? 'JOINING…' : 'JOIN GROUP'}
        </button>
      </form>
    </Modal>
  );
}
