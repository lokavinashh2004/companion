/// <reference lib="webworker" />
// Service worker: offline app shell (precache), Web Push display, and notification clicks.
// Medicine reminders carry a short-lived signed token, so "Taken" / "Snooze" work without opening the app.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING') void self.skipWaiting();
});

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  kind?: string;
  actions?: { action: string; title: string }[];
  data?: { token?: string; api?: string };
}

self.addEventListener('push', (event) => {
  let p: PushPayload;
  try {
    p = event.data?.json() as PushPayload;
  } catch {
    p = { title: 'Companion', body: event.data?.text() ?? '' };
  }
  const options: NotificationOptions & { actions?: { action: string; title: string }[] } = {
    body: p.body,
    tag: p.tag,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: p.url ?? '/', kind: p.kind, ...p.data },
    actions: p.actions,
  };
  event.waitUntil(self.registration.showNotification(p.title, options));
});

self.addEventListener('notificationclick', (event) => {
  const n = event.notification;
  const data = (n.data ?? {}) as { url?: string; token?: string; api?: string };
  n.close();
  if ((event.action === 'taken' || event.action === 'snooze') && data.token && data.api) {
    // Needs internet; if offline the dose simply stays "not yet" on the Today page.
    event.waitUntil(
      fetch(`${data.api}/med-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.token, action: event.action }),
      }).catch(() => undefined),
    );
    return;
  }
  const url = new URL(data.url ?? '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = wins.find((w) => w.url.startsWith(self.location.origin));
      if (existing) {
        await existing.focus();
        await (existing as WindowClient).navigate(url).catch(() => undefined);
      } else {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
