// Web Push (VAPID). Quiet hours and the 4-a-day cap are enforced here; medicine reminders skip both
// (she chose those times). Expired subscriptions (404/410) are removed.
import webpush from 'web-push';

import { inQuietHours, localMidnight, localTimeIn, todayIn } from '../core/dates.ts';
import type { Store } from '../store/index.ts';
import type { PushSubscriptionDoc } from '../store/types.ts';

export const MAX_NOTIFICATIONS_PER_DAY = 4;

export interface PushMessage {
  kind: 'checkin' | 'water' | 'med' | 'queued_reply' | 'delay' | 'red_flag' | 'soft_nudge' | 'test';
  title: string;
  body: string;
  /** Page to open when tapped, e.g. '/', '/today', '/cycle' */
  url?: string;
  tag?: string;
  /** Medicine reminders: buttons handled by the service worker. */
  actions?: { action: 'taken' | 'snooze'; title: string }[];
  data?: Record<string, unknown>;
}

export type PushResult = 'sent' | 'no_subscription' | 'quiet_hours' | 'cap' | 'error' | 'disabled';

export interface PushSender {
  send(uid: string, msg: PushMessage, opts?: { ref?: string; force?: boolean }): Promise<PushResult>;
}

/** Low-level delivery; returns the HTTP status (201 ok, 404/410 gone). */
export type Transport = (sub: PushSubscriptionDoc, payload: string) => Promise<number>;

export function webPushTransport(vapid: { publicKey: string; privateKey: string; subject: string }): Transport {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  return async (sub, payload) => {
    try {
      const r = await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 6 * 3600 });
      return r.statusCode;
    } catch (e) {
      return (e as { statusCode?: number }).statusCode ?? 500;
    }
  };
}

export function createPushSender(store: Store, transport: Transport | null, now: () => Date = () => new Date()): PushSender {
  return {
    async send(uid, msg, opts = {}) {
      if (!transport) return 'disabled';
      const u = store.user(uid);
      const subs = await u.push_subscriptions.find();
      if (subs.length === 0) return 'no_subscription';
      const profile = await u.profiles.findOne();
      const tz = profile?.timezone ?? 'Asia/Kolkata';
      const exempt = msg.kind === 'med' || opts.force;
      if (!exempt && profile) {
        const { hour, minute } = localTimeIn(tz, now());
        if (inQuietHours(hour * 60 + minute, profile.quiet_start, profile.quiet_end)) return 'quiet_hours';
        const sentToday = await u.push_log.count({ created_at: { $gte: new Date(localMidnight(todayIn(tz, now()), tz)).toISOString() }, kind: { $ne: 'med' } });
        if (sentToday >= MAX_NOTIFICATIONS_PER_DAY) return 'cap';
      }
      const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url ?? '/', tag: msg.tag, kind: msg.kind, actions: msg.actions, data: msg.data });
      let delivered = false;
      for (const s of subs) {
        const status = await transport(s, payload);
        if (status === 404 || status === 410) await u.push_subscriptions.deleteOne({ id: s.id });
        else if (status >= 200 && status < 300) delivered = true;
      }
      if (!delivered) return 'error';
      await u.push_log.insertOne({ kind: msg.kind, ref: opts.ref ?? null });
      return 'sent';
    },
  };
}
