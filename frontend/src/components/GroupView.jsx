import React from 'react';
import { ClipboardList, Trophy, Award, Users, Settings, Copy } from 'lucide-react';
import TodayTab from './TodayTab';
import LeaderboardTab from './LeaderboardTab';
import BadgesTab from './BadgesTab';
import MembersTab from './MembersTab';
import ManageTab from './ManageTab';

export default function GroupView({
  group, currentUserId, activeTab, setActiveTab, onChanged, onDeleted, notify, badgesRefreshKey,
}) {
  const isAdmin = group.admin_id === currentUserId;
  const tabs = [
    { id: 'today', label: 'Today', icon: ClipboardList },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'badges', label: 'Badges', icon: Award },
    { id: 'members', label: 'Members', icon: Users },
  ];
  if (isAdmin) tabs.push({ id: 'manage', label: 'Manage', icon: Settings });

  return (
    <div className="fc-card p-5 md:p-6">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-xs fc-text-dim uppercase tracking-wide mb-1">{group.members.length} members</div>
          <h2 className="fc-display text-2xl md:text-3xl">{group.name}</h2>
        </div>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(group.invite_code).catch(() => {});
            notify('Invite code copied');
          }}
          className="fc-btn-ghost fc-focus rounded-lg px-3 py-2 text-xs flex items-center gap-2 fc-mono"
        >
          <Copy size={13} /> {group.invite_code}
        </button>
      </div>

      <div className="flex gap-5 border-b mb-5 overflow-x-auto fc-scroll" style={{ borderColor: 'var(--steel)' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`fc-tab fc-focus flex items-center gap-1.5 pb-2.5 text-sm whitespace-nowrap ${activeTab === t.id ? 'active' : ''}`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'today' && <TodayTab group={group} onChanged={onChanged} notify={notify} />}
      {activeTab === 'leaderboard' && <LeaderboardTab group={group} currentUserId={currentUserId} />}
      {activeTab === 'badges' && <BadgesTab refreshKey={badgesRefreshKey} />}
      {activeTab === 'members' && (
        <MembersTab group={group} currentUserId={currentUserId} isAdmin={isAdmin} onChanged={onChanged} />
      )}
      {activeTab === 'manage' && isAdmin && <ManageTab group={group} onChanged={onChanged} onDeleted={onDeleted} />}
    </div>
  );
}
