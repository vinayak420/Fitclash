import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import GroupView from '../components/GroupView';

function initialTopTab(tab) {
  return tab === 'community' ? 'community' : 'challenge';
}

function initialChallengeTab(tab) {
  if (tab === 'manage' || tab === 'leaderboard' || tab === 'badges' || tab === 'today') return tab;
  return 'today';
}

export default function CommunityDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') || '';
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notify } = useToast();

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [topTab, setTopTab] = useState(() => initialTopTab(tabParam));
  const [challengeTab, setChallengeTab] = useState(() => initialChallengeTab(tabParam));
  const [badgesRefreshKey, setBadgesRefreshKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const detail = await api.getGroup(Number(id));
      setGroup(detail);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  async function handleChanged() {
    await load();
    setBadgesRefreshKey((k) => k + 1);
  }

  function handleDeleted() {
    notify('Community deleted');
    navigate('/communities', { replace: true });
  }

  if (loading || !user) {
    return <div className="fc-text-dim text-sm py-10 text-center">Loading community…</div>;
  }

  if (error && !group) {
    return (
      <div>
        <button type="button" onClick={() => navigate('/communities')} className="fc-text-dim text-sm flex items-center gap-1 mb-4 fc-focus">
          <ChevronLeft size={18} /> Your communities
        </button>
        <p className="text-sm fc-ember">{error}</p>
      </div>
    );
  }

  if (!group) return null;

  return (
    <div>
      <header className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => navigate('/communities')}
          className="fc-focus p-1 rounded-full"
          aria-label="Back to your communities"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="fc-display text-lg truncate flex-1">{group.name}</h1>
      </header>

      <GroupView
        group={group}
        currentUserId={user.id}
        topTab={topTab}
        setTopTab={setTopTab}
        challengeTab={challengeTab}
        setChallengeTab={setChallengeTab}
        onChanged={handleChanged}
        onDeleted={handleDeleted}
        notify={notify}
        badgesRefreshKey={badgesRefreshKey}
      />
    </div>
  );
}
