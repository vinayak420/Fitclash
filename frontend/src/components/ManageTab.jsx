import React, { useState } from 'react';
import { Plus, Trash2, Trophy, CalendarDays, Flag } from 'lucide-react';
import { api } from '../api';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(d) {
  if (!d) return 'Open-ended';
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function parseTaskPoints(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < -1000 || n > 1000) return null;
  return n;
}

function StartChallengeForm({ group, onChanged }) {
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
      await api.startChallenge(group.id, name.trim(), endDate || null);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fc-card p-4" style={{ border: '1px dashed var(--steel)' }}>
      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <Flag size={15} className="fc-signal" /> Start a new challenge
      </h4>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="text-xs fc-text-dim uppercase tracking-wide">Challenge name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Daily Basics"
            className="fc-input fc-focus w-full mt-1 px-3 py-2"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs fc-text-dim uppercase tracking-wide">Start date</label>
            <input disabled value={todayStr()} className="fc-input w-full mt-1 px-3 py-2 opacity-60" />
          </div>
          <div>
            <label className="text-xs fc-text-dim uppercase tracking-wide">End date (optional)</label>
            <input
              type="date"
              min={todayStr()}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="fc-input fc-focus w-full mt-1 px-3 py-2"
            />
          </div>
        </div>
        {error && <p className="text-sm fc-ember">{error}</p>}
        <button type="submit" disabled={busy || !name.trim()} className="fc-btn-primary fc-focus rounded-lg py-2.5 font-display">
          {busy ? 'STARTING…' : 'START CHALLENGE'}
        </button>
      </form>
    </div>
  );
}

export function DeleteCommunitySection({ group, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setBusy(true);
    setError('');
    try {
      await api.deleteGroup(group.id);
      onDeleted();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="pt-4" style={{ borderTop: '1px solid var(--steel)' }}>
      <h4 className="text-xs fc-ember uppercase tracking-wide mb-2 font-semibold">Delete community</h4>
      {error && <p className="text-sm fc-ember mb-2">{error}</p>}
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="fc-btn-ghost fc-focus rounded-lg px-4 py-2 text-sm"
          style={{ borderColor: 'var(--ember)', color: 'var(--ember)' }}
        >
          Delete this community
        </button>
      ) : (
        <div className="fc-bg-ink3 rounded-lg p-4">
          <p className="text-sm mb-3">
            This permanently deletes the community <span className="font-semibold">{group.name}</span> — all
            members, challenge history, check-ins, and points. This is not the same as ending a challenge, and it cannot be undone.
            Type the community name to confirm.
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={group.name}
            className="fc-input fc-focus w-full mb-3 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={busy || confirmText !== group.name}
              className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
              style={{ background: 'var(--ember)', color: 'var(--on-primary)' }}
            >
              {busy ? 'DELETING…' : 'Yes, delete permanently'}
            </button>
            <button
              onClick={() => { setConfirming(false); setConfirmText(''); }}
              className="fc-btn-ghost fc-focus rounded-lg px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ManageTab({ group, onChanged }) {
  const challenge = group.challenge;
  const [name, setName] = useState(challenge ? challenge.name : '');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPoints, setNewItemPoints] = useState(5);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [endResult, setEndResult] = useState(null);

  async function handleRename() {
    setBusy(true);
    setError('');
    try {
      await api.renameChallenge(group.id, name);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddItem(e) {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const points = parseTaskPoints(newItemPoints);
    if (points === null) {
      setError('Points must be a whole number from -1000 to 1000.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.addItem(group.id, newItemName.trim(), points);
      setNewItemName('');
      setNewItemPoints(5);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateItemPoints(item, raw) {
    const points = parseTaskPoints(raw);
    if (points === null) {
      setError('Points must be a whole number from -1000 to 1000.');
      return;
    }
    if (points === item.points) return;
    setBusy(true);
    setError('');
    try {
      await api.updateItem(group.id, item.id, item.name, points);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveItem(itemId) {
    setBusy(true);
    setError('');
    try {
      await api.removeItem(group.id, itemId);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleEndChallenge() {
    setBusy(true);
    setError('');
    try {
      const result = await api.endChallenge(group.id);
      setEndResult(result);
      setConfirmingEnd(false);
      onChanged();
    } catch (err) {
      setError(err.message);
      setConfirmingEnd(false);
    } finally {
      setBusy(false);
    }
  }

  if (!challenge) {
    return (
      <div className="flex flex-col gap-4">
        {error && <p className="text-sm fc-ember">{error}</p>}
        {endResult && <EndResultBanner result={endResult} />}
        <StartChallengeForm group={group} onChanged={onChanged} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm fc-ember">{error}</p>}
      {endResult && <EndResultBanner result={endResult} />}

      <div className="fc-bg-ink3 rounded-lg p-4 flex items-center gap-2 text-xs fc-text-dim">
        <CalendarDays size={14} />
        Started {formatDate(challenge.start_date)} · Ends {formatDate(challenge.end_date)}
      </div>

      <div>
        <label className="text-xs fc-text-dim uppercase tracking-wide">Challenge name</label>
        <div className="flex gap-2 mt-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="fc-input fc-focus flex-1 px-3 py-2"
          />
          <button
            onClick={handleRename}
            disabled={busy || !name.trim() || name === challenge.name}
            className="fc-btn-ghost fc-focus rounded-lg px-4 text-sm"
          >
            Save
          </button>
        </div>
      </div>

      <div>
        <h4 className="text-xs fc-text-dim uppercase tracking-wide mb-2">Checklist items</h4>
        <div className="flex flex-col gap-2 mb-3">
          {challenge.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-3 py-2 fc-bg-ink3 rounded-lg">
              <span className="flex-1 text-sm">{item.name}</span>
              <input
                key={`${item.id}-${item.points}`}
                type="text"
                inputMode="numeric"
                defaultValue={item.points}
                disabled={busy}
                aria-label={`Points for ${item.name} (-1000 to +1000)`}
                className="fc-input fc-focus w-20 px-2 py-1 text-sm fc-mono"
                onBlur={(e) => handleUpdateItemPoints(item, e.target.value)}
              />
              <button
                onClick={() => handleRemoveItem(item.id)}
                disabled={busy}
                className="fc-text-dim hover:fc-ember fc-focus"
                aria-label={`Remove ${item.name}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {challenge.items.length === 0 && (
            <p className="fc-text-dim text-sm">No items yet — add your first one below.</p>
          )}
        </div>

        <form onSubmit={handleAddItem} className="flex gap-2 flex-wrap" noValidate>
          <input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="e.g. Stretch for 10 minutes"
            className="fc-input fc-focus flex-1 min-w-[160px] px-3 py-2 text-sm"
          />
          <input
            type="text"
            inputMode="numeric"
            value={newItemPoints}
            onChange={(e) => setNewItemPoints(e.target.value)}
            placeholder="Pts (+/-)"
            aria-label="Points (-1000 to +1000)"
            title="Points (-1000 to +1000)"
            className="fc-input fc-focus w-24 px-3 py-2 text-sm"
          />
          <button type="submit" disabled={busy} className="fc-btn-primary fc-focus rounded-lg px-4 py-2 text-sm flex items-center gap-1">
            <Plus size={14} /> Add
          </button>
        </form>
      </div>

      <div className="pt-4" style={{ borderTop: '1px solid var(--steel)' }}>
        <h4 className="text-xs fc-ember uppercase tracking-wide mb-2 font-semibold">Danger zone</h4>
        {!confirmingEnd ? (
          <button
            onClick={() => setConfirmingEnd(true)}
            className="fc-btn-ghost fc-focus rounded-lg px-4 py-2 text-sm"
            style={{ borderColor: 'var(--ember)', color: 'var(--ember)' }}
          >
            End this challenge
          </button>
        ) : (
          <div className="fc-bg-ink3 rounded-lg p-4">
            <p className="text-sm mb-3">
              This will finalize the challenge as of today, crown whoever has the most points as the winner,
              and members won't be able to check in again until a new challenge is started. This can't be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleEndChallenge}
                disabled={busy}
                className="rounded-lg px-4 py-2 text-sm font-semibold"
                style={{ background: 'var(--ember)', color: 'var(--on-primary)' }}
              >
                {busy ? 'ENDING…' : 'Yes, end it'}
              </button>
              <button onClick={() => setConfirmingEnd(false)} className="fc-btn-ghost fc-focus rounded-lg px-4 py-2 text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EndResultBanner({ result }) {
  const winners = result.challenge.winners;
  return (
    <div className="fc-bg-ink3 rounded-lg p-4" style={{ border: '1px solid var(--signal)' }}>
      <div className="flex items-center gap-2 text-sm font-semibold fc-signal mb-2">
        <Trophy size={16} /> Challenge ended
      </div>
      {winners.length > 0 ? (
        <p className="text-sm mb-2">
          {winners.map((w) => w.name).join(' & ')} won with {winners[0].points} points!
        </p>
      ) : (
        <p className="text-sm mb-2 fc-text-dim">No one logged any points during this challenge.</p>
      )}
      <div className="text-xs fc-text-dim">
        Final standings: {result.final_standings.map((r) => `${r.name} (${r.points})`).join(', ')}
      </div>
    </div>
  );
}
