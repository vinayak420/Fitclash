import React from 'react';
import { ClipboardList, Plus, UserPlus } from 'lucide-react';

export default function EmptyState({ onCreate, onJoin }) {
  return (
    <div className="fc-card p-10 flex flex-col items-center text-center gap-4">
      <ClipboardList size={40} className="fc-signal" />
      <div>
        <h3 className="fc-display text-2xl mb-1">No community selected</h3>
        <p className="fc-text-dim text-sm max-w-xs">
          Create a community for your crew, or join one with an invite code from a friend.
        </p>
      </div>
      <div className="flex gap-3 mt-2">
        <button onClick={onCreate} className="fc-btn-primary fc-focus rounded-lg px-4 py-2 text-sm flex items-center gap-2">
          <Plus size={16} /> Create community
        </button>
        <button onClick={onJoin} className="fc-btn-ghost fc-focus rounded-lg px-4 py-2 text-sm flex items-center gap-2">
          <UserPlus size={16} /> Join community
        </button>
      </div>
    </div>
  );
}
