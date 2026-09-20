import React, { useCallback, useEffect, useState } from 'react';
import { Flame, LogOut, ShieldCheck, FolderPlus, UserPlus, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import GroupView from '../components/GroupView';
import CreateGroupModal from '../components/CreateGroupModal';
import JoinGroupModal from '../components/JoinGroupModal';
import EmailVerificationBanner from '../components/EmailVerificationBanner';

export default function DashboardPage() {
  const { user, logout } = useAuth();

  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [topTab, setTopTab] = useState('challenge');
  const [challengeTab, setChallengeTab] = useState('today');
  const [stats, setStats] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [badgesRefreshKey, setBadgesRefreshKey] = useState(0);
  const [loadingGroups, setLoadingGroups] = useState(true);

  const notify = useCallback((msg) => setToast(msg), []);

  const refreshGroups = useCallback(async () => {
    try {
      const list = await api.myGroups();
      setGroups(list);
      return list;
    } catch (err) {
      setError(err.message);
      return [];
    }
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const s = await api.myStats();
      setStats(s);
    } catch (err) {
      // non-fatal
    }
  }, []);

  const refreshSelectedGroup = useCallback(async (groupId) => {
    if (!groupId) { setSelectedGroup(null); return; }
    try {
      const detail = await api.getGroup(groupId);
      setSelectedGroup(detail);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingGroups(true);
      const list = await refreshGroups();
      await refreshStats();
      if (list.length > 0) {
        setSelectedGroupId(list[0].id);
      }
      setLoadingGroups(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshSelectedGroup(selectedGroupId);
  }, [selectedGroupId, refreshSelectedGroup]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleCreateGroup(name) {
    const group = await api.createGroup(name);
    await refreshGroups();
    setSelectedGroupId(group.id);
    setTopTab('challenge');
    setChallengeTab('manage');
    setShowCreate(false);
    notify(`Community "${group.name}" created`);
  }

  async function handleJoinGroup(code) {
    const group = await api.joinGroup(code);
    await refreshGroups();
    setSelectedGroupId(group.id);
    setTopTab('challenge');
    setChallengeTab('today');
    setShowJoin(false);
    notify(`Joined "${group.name}"`);
  }

  async function handleGroupChanged() {
    await refreshSelectedGroup(selectedGroupId);
    await refreshGroups();
    await refreshStats();
    setBadgesRefreshKey((k) => k + 1);
  }

  async function handleGroupDeleted() {
    const list = await refreshGroups();
    setSelectedGroupId(list.length > 0 ? list[0].id : null);
    await refreshStats();
    notify('Community deleted');
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {toast && (
        <div className="fixed top-4 right-4 z-50 fc-card px-4 py-3 flex items-center gap-2 shadow-lg">
          <Check size={16} className="fc-turf" />
          <span className="text-sm">{toast}</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-4">
        {!user.is_email_verified && <EmailVerificationBanner />}
      </div>

      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 px-4 pb-4">
        <aside className="md:w-72 shrink-0 flex flex-col gap-4">
          <div className="fc-card p-4">
            <div className="flex items-center gap-3">
              <Avatar name={user.name} size={44} />
              <div className="min-w-0">
                <div className="font-semibold truncate">{user.name}</div>
                <button onClick={logout} className="fc-text-dim text-xs flex items-center gap-1 hover:text-signal fc-focus">
                  <LogOut size={12} /> Sign out
                </button>
              </div>
            </div>
            {stats && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="fc-bg-ink3 rounded-lg p-2 text-center">
                  <div className="fc-display text-xl fc-signal">{stats.overall_points}</div>
                  <div className="text-[10px] fc-text-dim uppercase tracking-wide">Points</div>
                </div>
                <div className="fc-bg-ink3 rounded-lg p-2 text-center">
                  <div className="fc-display text-xl fc-ember flex items-center justify-center gap-1">
                    {stats.streak > 0 && <Flame size={16} className="fc-flame-pulse" />}
                    {stats.streak}
                  </div>
                  <div className="text-[10px] fc-text-dim uppercase tracking-wide">Streak</div>
                </div>
                <div className="fc-bg-ink3 rounded-lg p-2 text-center">
                  <div className="fc-display text-xl">{stats.badge_count}</div>
                  <div className="text-[10px] fc-text-dim uppercase tracking-wide">Badges</div>
                </div>
                <div className="fc-bg-ink3 rounded-lg p-2 text-center">
                  <div className="fc-display text-xl fc-turf">{stats.challenges_won}</div>
                  <div className="text-[10px] fc-text-dim uppercase tracking-wide">Challenges Won</div>
                </div>
              </div>
            )}
          </div>

          <div className="fc-card p-4">
            <h4 className="fc-text-dim text-xs uppercase tracking-wide font-semibold mb-3">Your communities</h4>
            <div className="flex flex-col gap-1 mb-3 max-h-64 overflow-y-auto fc-scroll">
              {loadingGroups && <div className="text-sm fc-text-dim py-2">Loading…</div>}
              {!loadingGroups && groups.length === 0 && (
                <div className="text-sm fc-text-dim py-2">No communities yet. Create or join one below.</div>
              )}
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => { setSelectedGroupId(g.id); setTopTab('challenge'); setChallengeTab('today'); }}
                  className={`fc-focus flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                    selectedGroupId === g.id ? 'fc-bg-ink3' : 'hover:fc-bg-ink3'
                  }`}
                  style={{ border: selectedGroupId === g.id ? '1px solid var(--signal)' : '1px solid transparent' }}
                >
                  <span className="truncate text-sm">{g.name}</span>
                  {g.is_admin && <ShieldCheck size={14} className="fc-signal shrink-0 ml-2" />}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(true)} className="fc-btn-ghost fc-focus flex-1 rounded-lg py-2 text-xs flex items-center justify-center gap-1">
                <FolderPlus size={14} /> New
              </button>
              <button onClick={() => setShowJoin(true)} className="fc-btn-ghost fc-focus flex-1 rounded-lg py-2 text-xs flex items-center justify-center gap-1">
                <UserPlus size={14} /> Join
              </button>
            </div>
          </div>

          {error && (
            <div className="fc-card p-3 flex items-center gap-2 text-xs fc-ember">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </aside>

        <main className="flex-1 min-w-0">
          {!loadingGroups && !selectedGroup && (
            <EmptyState onCreate={() => setShowCreate(true)} onJoin={() => setShowJoin(true)} />
          )}
          {selectedGroup && (
            <GroupView
              group={selectedGroup}
              currentUserId={user.id}
              topTab={topTab}
              setTopTab={setTopTab}
              challengeTab={challengeTab}
              setChallengeTab={setChallengeTab}
              onChanged={handleGroupChanged}
              onDeleted={handleGroupDeleted}
              notify={notify}
              badgesRefreshKey={badgesRefreshKey}
            />
          )}
        </main>
      </div>

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} onCreate={handleCreateGroup} />}
      {showJoin && <JoinGroupModal onClose={() => setShowJoin(false)} onJoin={handleJoinGroup} />}
    </div>
  );
}
