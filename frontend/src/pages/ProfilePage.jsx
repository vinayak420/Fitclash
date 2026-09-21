import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame, Pencil, Camera, KeyRound, LogOut, ShieldCheck, CircleAlert, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api';
import Avatar from '../components/Avatar';
import EmailVerificationBanner from '../components/EmailVerificationBanner';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState('none');
  const [resetState, setResetState] = useState('idle');
  const [resetDevUrl, setResetDevUrl] = useState(null);
  const [resetError, setResetError] = useState('');

  const load = useCallback(async () => {
    try {
      setStats(await api.myStats());
      setStatsError('');
    } catch (err) {
      setStats(null);
      setStatsError(err.message || 'Could not load stats.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([load(), refreshUser()]);
      setLoading(false);
    })();
  }, [load, refreshUser]);

  async function handlePasswordReset() {
    if (!user) return;
    setResetError('');
    setResetState('sending');
    try {
      const res = await api.forgotPassword(user.email);
      setResetDevUrl(res.dev_url || null);
      setResetState('sent');
      notify(res.message || 'Reset link sent');
    } catch (err) {
      setResetState('idle');
      setResetError(err.message);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  if (loading || !user) {
    return <div className="fc-text-dim text-sm py-10 text-center">Loading profile…</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="fc-display text-2xl">Profile</h1>

      {!user.is_email_verified && <EmailVerificationBanner />}

      <div className="fc-card p-4">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} size={72} src={user.avatar_url} />
          <div className="min-w-0">
            <div className="font-bold text-xl truncate">{user.name}</div>
            <div className="fc-text-dim text-sm truncate">{user.email}</div>
            <div className="flex items-center gap-1 mt-2 text-xs">
              {user.is_email_verified ? (
                <>
                  <ShieldCheck size={14} className="fc-turf" />
                  <span className="fc-turf">Email verified</span>
                </>
              ) : (
                <>
                  <CircleAlert size={14} className="fc-ember" />
                  <span className="fc-ember">Email not verified</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="fc-card p-4">
        <div className="fc-text-dim text-xs font-semibold uppercase tracking-wide mb-3">This week’s grind</div>
        {statsError ? (
          <div>
            <p className="text-sm fc-ember">{statsError}</p>
            <button type="button" onClick={load} className="fc-btn-ghost fc-focus px-3 py-1.5 text-xs mt-2">Retry</button>
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-2">
            <StatTile value={stats.overall_points} label="Points" className="fc-signal" />
            <StatTile
              value={stats.streak}
              label="Streak"
              className="fc-ember"
              icon={stats.streak > 0 ? <Flame size={14} className="fc-ember fc-flame-pulse" /> : null}
            />
            <StatTile value={stats.badge_count} label="Badges" />
            <StatTile value={stats.challenges_won} label="Won" className="fc-turf" />
          </div>
        ) : (
          <p className="fc-text-dim text-sm">No stats yet.</p>
        )}
      </div>

      <div className="fc-card p-4">
        <div className="fc-text-dim text-xs font-semibold uppercase tracking-wide mb-1">Account</div>
        <ActionRow
          icon={<Pencil size={18} className="fc-signal" />}
          label="Edit profile"
          onClick={() => setPanel(panel === 'edit' ? 'none' : 'edit')}
        />
        {panel === 'edit' && (
          <p className="fc-text-dim text-xs leading-5 mb-2">
            Name and email are set at signup. Updating them needs a backend endpoint that does not exist yet
            (for example PATCH /auth/me).
          </p>
        )}
        <ActionRow
          icon={<Camera size={18} className="fc-signal" />}
          label="Update photo"
          onClick={() => setPanel(panel === 'photo' ? 'none' : 'photo')}
        />
        {panel === 'photo' && (
          <PhotoEditor
            user={user}
            onSaved={async () => {
              await refreshUser();
              notify('Profile photo updated');
            }}
            onRemoved={async () => {
              await refreshUser();
              notify('Profile photo removed');
            }}
            onError={(msg) => notify(msg)}
          />
        )}
        <ActionRow
          icon={<KeyRound size={18} className="fc-signal" />}
          label={resetState === 'sending' ? 'Sending reset email…' : resetState === 'sent' ? 'Reset email sent' : 'Reset password'}
          onClick={handlePasswordReset}
          disabled={resetState !== 'idle'}
        />
        {resetError && <p className="text-sm fc-ember mt-2">{resetError}</p>}
        {resetState === 'sent' && (
          <p className="fc-text-dim text-xs leading-5 mt-2">
            Check {user.email} for a reset link.
          </p>
        )}
        {resetDevUrl && (
          <a href={resetDevUrl} className="text-xs fc-signal break-all mt-2 inline-block">Open reset link</a>
        )}
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="fc-btn-ghost fc-focus px-4 py-2.5 text-sm flex items-center justify-center gap-2"
        style={{ borderColor: 'var(--ember)', color: 'var(--ember)' }}
      >
        <LogOut size={16} /> Sign out
      </button>
    </div>
  );
}

function PhotoEditor({ user, onSaved, onRemoved, onError }) {
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function onPick(e) {
    const next = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!next) return;
    if (!ALLOWED_TYPES.includes(next.type)) {
      setError('Use a JPG, PNG, or WebP image.');
      return;
    }
    if (next.size > MAX_BYTES) {
      setError('Keep the photo under 5 MB.');
      return;
    }
    setError('');
    setFile(next);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(next);
    });
  }

  async function handleSave() {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await api.uploadAvatar(file);
      setFile(null);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      await onSaved();
    } catch (err) {
      setError(err.message);
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError('');
    try {
      await api.deleteAvatar();
      setFile(null);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      await onRemoved();
    } catch (err) {
      setError(err.message);
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fc-bg-ink3 rounded-[20px] p-4 mb-2 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar name={user.name} size={88} src={preview || user.avatar_url} />
        <div className="text-xs fc-text-dim leading-5">
          JPG, PNG, or WebP. Max 5 MB. We’ll crop it to a round avatar.
        </div>
      </div>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onPick}
        className="text-xs"
      />
      {error && <p className="text-sm fc-ember">{error}</p>}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          disabled={!file || busy}
          onClick={handleSave}
          className="fc-btn-primary fc-focus px-4 py-2 text-sm"
        >
          {busy ? 'Saving…' : 'Save photo'}
        </button>
        {user.avatar_url && (
          <button
            type="button"
            disabled={busy}
            onClick={handleRemove}
            className="fc-btn-ghost fc-focus px-4 py-2 text-sm"
            style={{ borderColor: 'var(--ember)', color: 'var(--ember)' }}
          >
            Remove photo
          </button>
        )}
      </div>
    </div>
  );
}

function StatTile({ value, label, className = '', icon }) {
  return (
    <div className="fc-bg-ink3 rounded-[20px] p-3 text-center">
      <div className={`fc-display text-xl flex items-center justify-center gap-1 ${className}`}>
        {icon}
        {value}
      </div>
      <div className="text-[11px] fc-text-dim mt-1">{label}</div>
    </div>
  );
}

function ActionRow({ icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="fc-focus w-full flex items-center gap-3 py-3 border-b text-left disabled:opacity-50"
      style={{ borderColor: 'var(--steel)' }}
    >
      <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--signal-soft)' }}>
        {icon}
      </span>
      <span className="flex-1 font-semibold text-sm">{label}</span>
      <ChevronRight size={18} className="fc-text-dim" />
    </button>
  );
}
