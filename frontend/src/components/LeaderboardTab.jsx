import React, { useEffect, useState } from 'react';
import { api } from '../api';
import Avatar from './Avatar';

const MODES = [
  { id: 'group', label: 'Community total' },
  { id: 'weekly', label: 'This week' },
  { id: 'overall', label: 'Overall (all communities)' },
];

export default function LeaderboardTab({ group, currentUserId }) {
  const [mode, setMode] = useState('group');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.getLeaderboard(group.id, mode).then((data) => {
      if (mounted) { setRows(data); setLoading(false); }
    }).catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [group.id, mode]);

  return (
    <div>
      <div className="flex gap-2 mb-5 flex-wrap">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`fc-chip fc-focus rounded-full px-3.5 py-1.5 text-xs ${mode === m.id ? 'active' : ''}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="fc-text-dim text-sm py-6 text-center">Loading rankings…</div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => {
            const rankClass =
              row.rank === 1 ? 'fc-rank-1' : row.rank === 2 ? 'fc-rank-2' : row.rank === 3 ? 'fc-rank-3' : 'fc-text-dim';
            return (
              <div
                key={row.user_id}
                className="flex items-center gap-4 px-4 py-3 fc-bg-ink3 rounded-lg"
                style={{ border: row.user_id === currentUserId ? '1px solid var(--signal)' : '1px solid transparent' }}
              >
                <div className={`fc-display text-xl w-7 text-center ${rankClass}`}>{row.rank}</div>
                <Avatar name={row.name} size={32} src={row.avatar_url} />
                <div className="flex-1 text-sm truncate">
                  {row.name}{row.user_id === currentUserId ? ' (you)' : ''}
                </div>
                <div className="fc-mono fc-signal">{row.points}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
