import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ShieldCheck } from 'lucide-react';
import Avatar from './Avatar';
import { api } from '../api';
import { playerProfilePath } from '../playerProfile';

export default function MembersTab({ group, currentUserId, isAdmin, onChanged }) {
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  async function handleRemove(userId) {
    setBusyId(userId);
    setError('');
    try {
      await api.removeMember(group.id, userId);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm fc-ember mb-1">{error}</p>}
      {group.members.map((m) => {
        const isGroupAdmin = m.user_id === group.admin_id;
        return (
          <div key={m.user_id} className="flex items-center gap-3 px-4 py-3 fc-bg-ink3 rounded-lg">
            <button
              type="button"
              onClick={() => navigate(playerProfilePath(currentUserId, m.user_id, group.id))}
              className="flex items-center gap-3 flex-1 min-w-0 text-left fc-focus rounded-lg"
              aria-label={`View ${m.name}'s profile`}
            >
              <Avatar name={m.name} size={34} src={m.avatar_url} />
              <div className="flex-1 text-sm truncate">
                {m.name}{m.user_id === currentUserId ? ' (you)' : ''}
              </div>
            </button>
            {isGroupAdmin && (
              <span className="text-[10px] fc-signal uppercase tracking-wide flex items-center gap-1">
                <ShieldCheck size={12} /> Admin
              </span>
            )}
            {isAdmin && !isGroupAdmin && (
              <button
                onClick={() => handleRemove(m.user_id)}
                disabled={busyId === m.user_id}
                className="fc-text-dim hover:fc-ember fc-focus"
                aria-label={`Remove ${m.name}`}
              >
                <X size={16} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
