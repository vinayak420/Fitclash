import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronLeft } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';

function timeAgo(iso) {
  const then = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
  const seconds = Math.max(0, Math.round((Date.now() - then.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pushState, setPushState] = useState('idle');
  const [pushConfigured, setPushConfigured] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.listNotifications();
      setItems(data.items || []);
      setUnreadCount(data.unread_count || 0);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      try {
        const cfg = await api.pushConfig();
        setPushConfigured(Boolean(cfg.configured && cfg.public_key));
      } catch {
        setPushConfigured(false);
      }
      setLoading(false);
    })();
  }, [load]);

  async function handleOpen(item) {
    try {
      await api.markNotificationRead(item.id);
    } catch {
      /* still navigate */
    }
    navigate(item.link_path || '/notifications');
  }

  async function handleMarkAll() {
    await api.markAllNotificationsRead();
    await load();
  }

  async function enablePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      notify('This browser does not support push notifications.');
      return;
    }
    setPushState('working');
    try {
      const cfg = await api.pushConfig();
      const publicKey = cfg.public_key || import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        notify('Push is not configured on the server yet.');
        setPushState('idle');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        notify('Notification permission was not granted.');
        setPushState('idle');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      await api.subscribePush({
        endpoint: json.endpoint,
        keys: json.keys,
        user_agent: navigator.userAgent,
      });
      setPushState('on');
      notify('Notifications enabled');
    } catch (err) {
      setPushState('idle');
      notify(err.message || 'Could not enable notifications.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <button type="button" onClick={() => navigate(-1)} className="fc-focus p-1 rounded-full" aria-label="Back">
          <ChevronLeft size={22} />
        </button>
        <h1 className="fc-display text-2xl flex-1">Notifications</h1>
      </header>

      {pushConfigured && pushState !== 'on' && (
        <button type="button" onClick={enablePush} className="fc-btn-primary fc-focus px-4 py-2.5 text-sm">
          {pushState === 'working' ? 'Enabling…' : 'Enable notifications'}
        </button>
      )}

      {unreadCount > 0 && (
        <button type="button" onClick={handleMarkAll} className="fc-btn-ghost fc-focus px-4 py-2 text-sm self-start">
          Mark all as read
        </button>
      )}

      {loading ? (
        <p className="fc-text-dim text-sm py-8 text-center">Loading notifications…</p>
      ) : error ? (
        <p className="text-sm fc-ember">{error}</p>
      ) : items.length === 0 ? (
        <div className="fc-card p-6 text-center">
          <Bell size={22} className="fc-text-dim mx-auto mb-2" />
          <p className="fc-text-dim text-sm">No notifications yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleOpen(item)}
              className="fc-card p-4 text-left fc-focus w-full"
              style={{ border: item.read_at ? '1px solid transparent' : '1px solid var(--signal)' }}
            >
              <div className="font-semibold text-sm">{item.title}</div>
              <div className="text-sm mt-1">{item.body}</div>
              <div className="fc-text-dim text-xs mt-2">{timeAgo(item.created_at)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
