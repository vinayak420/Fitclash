import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Flame, Trophy, CheckCircle2, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import Avatar from '../components/Avatar';

const BADGE_ICONS = {
  full_sweep: CheckCircle2,
  streak_3: Flame,
  streak_5: Flame,
  streak_10: Flame,
  streak_30: Flame,
  weekly_winner: Trophy,
  monthly_winner: Crown,
};

export default function PublicProfilePage() {
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const groupId = searchParams.get('group');
  const numericId = Number(userId);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!Number.isInteger(numericId) || numericId < 1) {
      setProfile(null);
      setError('User not found.');
      return;
    }
    try {
      const data = await api.getUserProfile(numericId, groupId ? Number(groupId) : undefined);
      setProfile(data);
      setError('');
    } catch (err) {
      setProfile(null);
      setError(err.message || 'Could not load this profile.');
    }
  }, [numericId, groupId]);

  useEffect(() => {
    if (user && numericId === user.id) {
      navigate('/profile', { replace: true });
      return;
    }
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load, navigate, numericId, user]);

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate('/communities');
  }

  if (user && numericId === user.id) {
    return null;
  }

  if (loading) {
    return <div className="fc-text-dim text-sm py-10 text-center">Loading profile…</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          className="fc-focus p-1 rounded-full"
          aria-label="Back"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="fc-display text-2xl truncate flex-1">
          {profile ? `${profile.name}` : 'Profile'}
        </h1>
      </header>

      {error ? (
        <div className="fc-card p-4">
          <p className="text-sm fc-ember">{error}</p>
          <button type="button" onClick={load} className="fc-btn-ghost fc-focus px-3 py-1.5 text-xs mt-2">Retry</button>
        </div>
      ) : profile ? (
        <>
          <div className="fc-card p-4">
            <div className="flex items-center gap-4">
              <Avatar name={profile.name} size={72} src={profile.avatar_url} />
              <div className="min-w-0">
                <div className="font-bold text-xl truncate">{profile.name}</div>
              </div>
            </div>
          </div>

          <div className="fc-card p-4">
            <div className="fc-text-dim text-xs font-semibold uppercase tracking-wide mb-3">This week’s grind</div>
            <div className="grid grid-cols-2 gap-2">
              <StatTile value={profile.weekly_points} label="Points" className="fc-signal" />
              <StatTile
                value={profile.streak}
                label="Streak"
                className="fc-ember"
                icon={profile.streak > 0 ? <Flame size={14} className="fc-ember fc-flame-pulse" /> : null}
              />
              <StatTile value={profile.badge_count} label="Badges" />
              <StatTile value={profile.challenges_won} label="Won" className="fc-turf" />
            </div>
          </div>

          <div className="fc-card p-4">
            <div className="fc-text-dim text-xs font-semibold uppercase tracking-wide mb-3">Badges</div>
            {profile.badges.length === 0 ? (
              <p className="fc-text-dim text-sm">No badges earned yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {profile.badges.map((b) => {
                  const Icon = BADGE_ICONS[b.code] || Trophy;
                  return (
                    <div
                      key={b.code}
                      className="fc-bg-ink3 rounded-lg p-4 flex items-start gap-3"
                      style={{ border: '1px solid var(--signal)' }}
                    >
                      <Icon size={22} className="fc-signal" />
                      <div>
                        <div className="font-semibold text-sm">{b.name}</div>
                        <div className="fc-text-dim text-xs">{b.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}
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
