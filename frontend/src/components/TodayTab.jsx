import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Lock } from 'lucide-react';
import { api } from '../api';

function todayLabel() {
  return new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function TodayTab({ group, onChanged, notify }) {
  const [todaySub, setTodaySub] = useState(undefined); // undefined = loading, null = none yet
  const [checked, setChecked] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    if (!group.challenge) {
      setTodaySub(null);
      return () => { mounted = false; };
    }
    setTodaySub(undefined);
    setChecked(new Set());
    api.getTodaySubmission(group.id).then((sub) => {
      if (mounted) setTodaySub(sub);
    }).catch(() => {
      if (mounted) setTodaySub(null);
    });
    return () => { mounted = false; };
  }, [group.id, group.challenge]);

  if (!group.challenge) {
    return (
      <div className="py-6 text-center">
        <p className="fc-text-dim text-sm mb-3">This community has no active challenge yet.</p>
      </div>
    );
  }

  const items = group.challenge ? group.challenge.items : [];
  const isLocked = !!todaySub;
  const activeChecked = isLocked ? new Set(todaySub.completed_item_ids) : checked;
  const pointsSoFar = items
    .filter((i) => activeChecked.has(i.id))
    .reduce((sum, i) => sum + i.points, 0);

  function toggle(id) {
    if (isLocked) return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      const sub = await api.submitChecklist(group.id, Array.from(checked));
      setTodaySub(sub);
      notify(`Checked in — ${sub.points_earned > 0 ? '+' : ''}${sub.points_earned} points`);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (todaySub === undefined) {
    return <div className="fc-text-dim text-sm py-6 text-center">Loading today's checklist…</div>;
  }

  if (items.length === 0) {
    return <div className="fc-text-dim text-sm py-6 text-center">This community's admin hasn't added checklist items yet.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="font-semibold">{group.challenge.name}</h3>
          <p className="fc-text-dim text-xs">{todayLabel()}</p>
        </div>
        <div className="fc-display text-2xl fc-signal">{pointsSoFar} pts</div>
      </div>

      <div className="grid gap-2.5 mb-5">
        {items.map((item) => {
          const isChecked = activeChecked.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              disabled={isLocked}
              onClick={() => toggle(item.id)}
              className={`fc-item-tile fc-focus flex items-center justify-between px-4 py-3 text-left ${isChecked ? 'checked' : ''}`}
            >
              <span className="flex items-center gap-3">
                {isChecked ? <CheckCircle2 size={20} className="fc-turf" /> : <Circle size={20} className="fc-text-dim" />}
                <span>{item.name}</span>
              </span>
              <span className="fc-mono text-xs fc-text-dim">{item.points > 0 ? `+${item.points}` : item.points}</span>
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm fc-ember mb-3">{error}</p>}

      {isLocked ? (
        <div className="flex items-center gap-2 fc-turf text-sm">
          <Lock size={14} /> Checked in for today — come back tomorrow.
        </div>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={checked.size === 0 || submitting}
          className="fc-btn-primary fc-focus px-5 py-2.5 w-full sm:w-auto"
        >
          {submitting ? 'Submitting…' : 'Check in'}
        </button>
      )}
    </div>
  );
}
