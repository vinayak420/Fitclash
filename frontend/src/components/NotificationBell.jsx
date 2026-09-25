import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { api } from '../api';

export default function NotificationBell() {
  const { pathname } = useLocation();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await api.unreadNotificationCount();
        if (mounted) setCount(data.unread_count || 0);
      } catch {
        if (mounted) setCount(0);
      }
    }
    load();
    const id = setInterval(load, 30000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [pathname]);

  return (
    <NavLink
      to="/notifications"
      className="fc-focus relative p-2 rounded-full"
      aria-label={count ? `${count} unread notifications` : 'Notifications'}
    >
      <Bell size={20} />
      {count > 0 && (
        <span className="fc-notif-badge">{count > 9 ? '9+' : count}</span>
      )}
    </NavLink>
  );
}
