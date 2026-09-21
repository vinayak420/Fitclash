import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ChevronRight } from 'lucide-react';
import { api } from '../api';
import Avatar from '../components/Avatar';

export default function CommunitiesPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setGroups(await api.myGroups());
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  if (loading) {
    return <div className="fc-text-dim text-sm py-10 text-center">Loading communities…</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="fc-display text-2xl">Your communities</h1>
        <p className="fc-text-dim text-sm mt-1 leading-5">
          Communities you belong to. Open one to see challenges and activity.
        </p>
      </div>

      {error ? (
        <div className="fc-card p-4">
          <p className="text-sm fc-ember">{error}</p>
          <button type="button" onClick={load} className="fc-btn-ghost fc-focus px-3 py-1.5 text-xs mt-3">Retry</button>
        </div>
      ) : groups.length === 0 ? (
        <div className="fc-card p-5">
          <p className="fc-text-dim text-sm mb-4">You’re not in any communities yet.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigate('/create')} className="fc-btn-primary fc-focus flex-1 py-2 text-sm">
              Create community
            </button>
            <button type="button" onClick={() => navigate('/join')} className="fc-btn-ghost fc-focus flex-1 py-2 text-sm">
              Join
            </button>
          </div>
        </div>
      ) : (
        groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => navigate(`/communities/${g.id}`)}
            className="fc-card fc-focus p-4 flex items-center gap-3 text-left w-full"
          >
            <Avatar name={g.name} size={48} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[15px] truncate">{g.name}</span>
                {g.is_admin && (
                  <span className="fc-invite-chip py-0.5 px-2 shrink-0">
                    <ShieldCheck size={12} /> Admin
                  </span>
                )}
              </div>
              <div className="fc-text-dim text-xs mt-0.5">
                {g.member_count} {g.member_count === 1 ? 'member' : 'members'}
              </div>
              <div className="fc-mono fc-signal text-[11px] mt-0.5">Code {g.invite_code}</div>
            </div>
            <ChevronRight size={20} className="fc-text-dim shrink-0" />
          </button>
        ))
      )}

      {groups.length > 0 && (
        <button type="button" onClick={() => navigate('/join')} className="fc-btn-ghost fc-focus py-2.5 text-sm">
          Join with invite code
        </button>
      )}
    </div>
  );
}
