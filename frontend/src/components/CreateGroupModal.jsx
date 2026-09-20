import React, { useState } from 'react';
import Modal from './Modal';

export default function CreateGroupModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onCreate(name.trim());
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Create a community" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs fc-text-dim uppercase tracking-wide">Community name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning Grind Crew"
            className="fc-input fc-focus w-full mt-1 px-3 py-2.5"
          />
        </div>

        <p className="text-xs fc-text-dim">
          You'll be the admin. No challenge is created yet — start one from this community when you're ready.
        </p>
        {error && <p className="text-sm fc-ember">{error}</p>}
        <button type="submit" disabled={!name.trim() || busy} className="fc-btn-primary fc-focus rounded-lg py-2.5 font-display">
          {busy ? 'CREATING…' : 'CREATE COMMUNITY'}
        </button>
      </form>
    </Modal>
  );
}
