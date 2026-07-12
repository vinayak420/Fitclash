import React, { useState } from 'react';
import Modal from './Modal';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function CreateGroupModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onCreate(name.trim(), endDate || null);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Create a group" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs fc-text-dim uppercase tracking-wide">Group name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning Grind Crew"
            className="fc-input fc-focus w-full mt-1 px-3 py-2.5"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs fc-text-dim uppercase tracking-wide">Start date</label>
            <input
              disabled
              value={todayStr()}
              className="fc-input w-full mt-1 px-3 py-2.5 opacity-60"
            />
          </div>
          <div>
            <label className="text-xs fc-text-dim uppercase tracking-wide">End date (optional)</label>
            <input
              type="date"
              min={todayStr()}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="fc-input fc-focus w-full mt-1 px-3 py-2.5"
            />
          </div>
        </div>

        <p className="text-xs fc-text-dim">
          Leave the end date blank to run the challenge indefinitely — you can end it anytime from Manage.
          You'll be the admin, with a starter checklist you can edit anytime.
        </p>
        {error && <p className="text-sm fc-ember">{error}</p>}
        <button type="submit" disabled={!name.trim() || busy} className="fc-btn-primary fc-focus rounded-lg py-2.5 font-display">
          {busy ? 'CREATING…' : 'CREATE GROUP'}
        </button>
      </form>
    </Modal>
  );
}
