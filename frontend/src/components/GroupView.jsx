import React from 'react';
import { ClipboardList, Trophy, Award, Users, Settings, Copy, Flag, Share2 } from 'lucide-react';
import TodayTab from './TodayTab';
import LeaderboardTab from './LeaderboardTab';
import BadgesTab from './BadgesTab';
import MembersTab from './MembersTab';
import ManageTab, { DeleteCommunitySection } from './ManageTab';

function formatDate(d) {
  if (!d) return 'Open-ended';
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ActiveChallengeCard({ group, isAdmin, onCreateChallenge }) {
  const active = group.challenge;
  return (
    <div className="mb-5">
      <h3 className="font-semibold text-[15px] mb-2">Active challenge</h3>
      <div className="fc-bg-ink3 rounded-[20px] p-4">
        {active ? (
          <>
            <div className="font-bold">{active.name}</div>
            <p className="fc-text-dim text-xs mt-1">
              {formatDate(active.start_date)} – {formatDate(active.end_date)}
            </p>
            <p className="fc-text-dim text-xs mt-1">
              {active.items.length} checklist {active.items.length === 1 ? 'item' : 'items'} · check in on Today
            </p>
          </>
        ) : (
          <>
            <p className="fc-text-dim text-sm">No active challenge.</p>
            {isAdmin ? (
              <button
                type="button"
                onClick={onCreateChallenge}
                className="fc-btn-primary fc-focus px-4 py-2 text-sm mt-3"
              >
                Create Challenge
              </button>
            ) : (
              <p className="fc-text-dim text-xs mt-2">Ask the community admin to create one.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CommunityPanel({ group, isAdmin, currentUserId, onChanged, onDeleted, notify }) {
  const past = group.last_completed_challenge;
  const winnerIds = new Set((past?.winners || []).map((w) => w.user_id));
  const nonWinners = past ? group.members.filter((m) => !winnerIds.has(m.user_id)) : [];

  function copyInvite() {
    navigator.clipboard?.writeText(group.invite_code).catch(() => {});
    notify('Invite code copied');
  }

  async function shareInvite() {
    const message = `Join my FitClash community "${group.name}" with invite code ${group.invite_code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'FitClash', text: message });
        return;
      } catch {
        // fall through to copy
      }
    }
    navigator.clipboard?.writeText(message).catch(() => {});
    notify('Invite message copied');
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs fc-text-dim font-semibold mb-1">
            {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
          </div>
          <h2 className="fc-display text-2xl md:text-3xl">{group.name}</h2>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button type="button" onClick={copyInvite} className="fc-invite-chip fc-focus">
            <Copy size={12} /> {group.invite_code}
          </button>
          <button type="button" onClick={shareInvite} className="fc-invite-chip fc-focus">
            <Share2 size={12} /> Share
          </button>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-[15px] mb-2">Community members</h3>
        <MembersTab group={group} currentUserId={currentUserId} isAdmin={isAdmin} onChanged={onChanged} />
      </div>

      <div>
        <h3 className="font-semibold text-[15px] mb-2">Past challenges</h3>
        {past ? (
          <div className="fc-bg-ink3 rounded-[20px] p-4">
            <div className="text-xs fc-signal font-semibold mb-1">Completed</div>
            <div className="font-bold">{past.name}</div>
            <p className="fc-text-dim text-xs mt-1">
              {formatDate(past.start_date)} – {formatDate(past.end_date)}
            </p>
            {past.winners.length > 0 ? (
              <p className="text-sm font-semibold mt-2">
                Winner{past.winners.length > 1 ? 's' : ''}: {past.winners.map((w) => `${w.name} (${w.points} pts)`).join(', ')}
              </p>
            ) : (
              <p className="fc-text-dim text-sm mt-2">No points were logged, so no winner was crowned.</p>
            )}
            {nonWinners.length > 0 && past.winners.length > 0 && (
              <p className="fc-text-dim text-xs mt-2">
                Current members not among winners: {nonWinners.map((m) => m.name).join(', ')}.
              </p>
            )}
          </div>
        ) : (
          <p className="fc-text-dim text-sm">No past challenges yet.</p>
        )}
      </div>

      {isAdmin && <DeleteCommunitySection group={group} onDeleted={onDeleted} />}
    </div>
  );
}

export default function GroupView({
  group,
  currentUserId,
  topTab,
  setTopTab,
  challengeTab,
  setChallengeTab,
  onChanged,
  onDeleted,
  notify,
  badgesRefreshKey,
}) {
  const isAdmin = group.admin_id === currentUserId;
  const challengeTabs = [
    { id: 'today', label: 'Today', icon: ClipboardList },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'badges', label: 'Badges', icon: Award },
  ];
  if (isAdmin) challengeTabs.push({ id: 'manage', label: 'Manage', icon: Settings });

  return (
    <div className="fc-card p-5 md:p-6">
      <div className="flex border-b mb-5" style={{ borderColor: 'var(--steel)' }}>
        <button
          type="button"
          onClick={() => setTopTab('challenge')}
          className={`fc-tab fc-focus flex-1 flex items-center justify-center gap-1.5 pb-2.5 text-sm ${topTab === 'challenge' ? 'active' : ''}`}
        >
          <Flag size={14} /> Challenge
        </button>
        <button
          type="button"
          onClick={() => setTopTab('community')}
          className={`fc-tab fc-focus flex-1 flex items-center justify-center gap-1.5 pb-2.5 text-sm ${topTab === 'community' ? 'active' : ''}`}
        >
          <Users size={14} /> Community
        </button>
      </div>

      {topTab === 'challenge' ? (
        <div>
          <ActiveChallengeCard
            group={group}
            isAdmin={isAdmin}
            onCreateChallenge={() => {
              setTopTab('challenge');
              setChallengeTab('manage');
            }}
          />

          <div className="flex gap-5 border-b mb-5 overflow-x-auto fc-scroll" style={{ borderColor: 'var(--steel)' }}>
            {challengeTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setChallengeTab(t.id)}
                className={`fc-tab fc-focus flex items-center gap-1.5 pb-2.5 text-sm whitespace-nowrap ${challengeTab === t.id ? 'active' : ''}`}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>

          {challengeTab === 'today' && <TodayTab group={group} onChanged={onChanged} notify={notify} />}
          {challengeTab === 'leaderboard' && <LeaderboardTab group={group} currentUserId={currentUserId} />}
          {challengeTab === 'badges' && <BadgesTab refreshKey={badgesRefreshKey} />}
          {challengeTab === 'manage' && isAdmin && <ManageTab group={group} onChanged={onChanged} />}
        </div>
      ) : (
        <CommunityPanel
          group={group}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          onChanged={onChanged}
          onDeleted={onDeleted}
          notify={notify}
        />
      )}
    </div>
  );
}
