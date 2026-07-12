import React, { useEffect, useState } from 'react';
import { CheckCircle2, Flame, Trophy, Crown } from 'lucide-react';
import { api } from '../api';

const ICONS = {
  full_sweep: CheckCircle2,
  streak_3: Flame,
  streak_5: Flame,
  streak_10: Flame,
  streak_30: Flame,
  weekly_winner: Trophy,
  monthly_winner: Crown,
};

export default function BadgesTab({ refreshKey }) {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.myBadges().then((data) => {
      if (mounted) { setBadges(data); setLoading(false); }
    }).catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [refreshKey]);

  if (loading) return <div className="fc-text-dim text-sm py-6 text-center">Loading badges…</div>;

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {badges.map((b) => {
        const Icon = ICONS[b.code] || Trophy;
        return (
          <div
            key={b.code}
            className="fc-bg-ink3 rounded-lg p-4 flex items-start gap-3"
            style={{ opacity: b.earned ? 1 : 0.5, border: b.earned ? '1px solid var(--signal)' : '1px solid transparent' }}
          >
            <Icon size={22} className={b.earned ? 'fc-signal' : 'fc-text-dim'} />
            <div>
              <div className="font-semibold text-sm">{b.name}</div>
              <div className="fc-text-dim text-xs">{b.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
