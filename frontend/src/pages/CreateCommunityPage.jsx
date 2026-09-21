import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../context/ToastContext';

function validateName(value) {
  const name = value.trim();
  if (!name) return 'Enter a community name.';
  if (name.length < 2) return 'Name must be at least 2 characters.';
  if (name.length > 80) return 'Name must be 80 characters or fewer.';
  return '';
}

export default function CreateCommunityPage() {
  const { notify } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const nameError = validateName(name);
    if (nameError) {
      setError(nameError);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const group = await api.createGroup(name.trim());
      setCreated(group);
      notify(`${group.name} created`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setName('');
    setError('');
    setCreated(null);
  }

  function copyInvite() {
    if (!created) return;
    navigator.clipboard?.writeText(created.invite_code).catch(() => {});
    notify('Invite code copied');
  }

  async function shareInvite() {
    if (!created) return;
    const message = `Join my FitClash community "${created.name}" with invite code ${created.invite_code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'FitClash', text: message });
        return;
      } catch {
        // cancelled
      }
    }
    navigator.clipboard?.writeText(message).catch(() => {});
    notify('Invite message copied');
  }

  return (
    <div>
      <h1 className="fc-display text-2xl mb-4">{created ? 'Invite members' : 'Create a community'}</h1>

      {created ? (
        <div className="fc-card p-5">
          <h2 className="font-bold text-lg mb-2">{created.name}</h2>
          <p className="fc-text-dim text-xs leading-5 mb-4">
            The community is ready. No challenge was started. Invite people with this code, then create a challenge when you want one.
          </p>
          <div className="rounded-[20px] p-5 text-center mb-4" style={{ background: 'var(--signal-soft)' }}>
            <div className="fc-text-dim text-xs mb-1">Invite code</div>
            <div className="fc-mono fc-signal text-3xl tracking-[0.2em]">{created.invite_code}</div>
          </div>
          <div className="flex gap-2 mb-3">
            <button type="button" onClick={copyInvite} className="fc-btn-ghost fc-focus flex-1 py-2 text-sm">Copy code</button>
            <button type="button" onClick={shareInvite} className="fc-btn-ghost fc-focus flex-1 py-2 text-sm">Share code</button>
          </div>
          <button
            type="button"
            className="fc-btn-primary fc-focus w-full py-2.5 text-sm"
            onClick={() => navigate(`/communities/${created.id}?tab=manage`)}
          >
            Create Challenge
          </button>
          <button
            type="button"
            className="fc-btn-ghost fc-focus w-full py-2.5 text-sm mt-2"
            onClick={() => navigate(`/communities/${created.id}`)}
          >
            Open community
          </button>
          <button type="button" className="fc-btn-ghost fc-focus w-full py-2.5 text-sm mt-2" onClick={resetForm}>
            Create another community
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="fc-card p-5 flex flex-col gap-4">
          <div>
            <label className="text-xs fc-text-dim uppercase tracking-wide">Community name</label>
            <input
              autoFocus
              value={name}
              maxLength={80}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. Morning Grind Crew"
              className="fc-input fc-focus w-full mt-1 px-3 py-2.5"
            />
          </div>
          <p className="text-xs fc-text-dim leading-5">
            This only creates the community. You can start a challenge afterward from Manage.
          </p>
          {error && <p className="text-sm fc-ember">{error}</p>}
          <button type="submit" disabled={!name.trim() || busy} className="fc-btn-primary fc-focus py-2.5">
            {busy ? 'Creating…' : 'Create community'}
          </button>
        </form>
      )}
    </div>
  );
}
