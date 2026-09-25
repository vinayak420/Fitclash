import { api } from './api';

const DISMISS_KEY = 'fitclash_push_dismissed';

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

export function notificationPermission() {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function getPushPublicKey() {
  const cfg = await api.pushConfig();
  return cfg.public_key || import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
}

export async function registerFitclashWorker() {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return reg;
}

export async function subscribeWebPush() {
  if (!pushSupported()) {
    throw new Error('This browser cannot show system notifications.');
  }
  const publicKey = await getPushPublicKey();
  if (!publicKey) {
    throw new Error('Browser push is not configured on the server yet.');
  }
  let permission = Notification.permission;
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    throw new Error('Allow notifications in the browser prompt to see alerts on this phone.');
  }
  const reg = await registerFitclashWorker();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  const json = sub.toJSON();
  await api.subscribePush({
    endpoint: json.endpoint,
    keys: json.keys,
    user_agent: navigator.userAgent,
  });
  try {
    await api.sendTestPush();
  } catch {
    await reg.showNotification('FitClash alerts are on', {
      body: 'You’ll see FitClash in this device’s notification panel.',
      icon: '/icon-192.png',
      badge: '/icon-32.png',
      data: { url: '/notifications' },
    });
  }
  return true;
}

export async function showSystemNotification(title, body, url) {
  if (notificationPermission() !== 'granted') return;
  try {
    const reg = await registerFitclashWorker();
    await reg.showNotification(title || 'FitClash', {
      body: body || '',
      icon: '/icon-192.png',
      badge: '/icon-32.png',
      vibrate: [120, 80, 120],
      data: { url: url || '/notifications' },
    });
  } catch {
    /* ignore */
  }
}

export function pushPromptDismissed() {
  return window.localStorage.getItem(DISMISS_KEY) === '1';
}

export function dismissPushPrompt() {
  window.localStorage.setItem(DISMISS_KEY, '1');
}
