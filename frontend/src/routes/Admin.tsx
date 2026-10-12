// Owner-only: AI requests used and left today, tokens, a 14-day history, the OpenRouter key and each model's
// health. Signed in with Firebase as usual; the backend answers 403 for anyone who isn't an admin.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { BarChart } from '@/components/Charts';
import { Button, Card, cx, ErrorState, Loading, Muted, Page, Row } from '@/components/ui';
import { ApiError, type AdminUsage } from '@/lib/api';
import { signOut } from '@/lib/firebase';
import { useAdminUsage } from '@/lib/queries';
import s from './Admin.module.css';

const n = (v: number) => v.toLocaleString();
/** Day of the month only: 14 full dates don't fit under the bars. */
const dayLabel = (day: string) => String(Number(day.slice(8, 10)));

export function Admin() {
  const { t } = useTranslation();
  const usage = useAdminUsage();
  const forbidden = usage.error instanceof ApiError && usage.error.status === 403;

  const actions = (
    <Row>
      <Button kind="ghost" small busy={usage.isFetching} onClick={() => void usage.refetch()}>
        {t('admin.refresh')}
      </Button>
      <Button kind="secondary" small onClick={() => void signOut()}>
        {t('auth.signOut')}
      </Button>
    </Row>
  );

  return (
    <Page title={t('admin.title')} actions={actions} wide>
      <Link className={s.back} to="/">
        ‹ {t('admin.backToApp')}
      </Link>
      {usage.isLoading ? <Loading /> : null}
      {forbidden ? (
        <Card tone="alt" title={t('admin.forbiddenTitle')}>
          <Muted>{t('admin.forbiddenBody')}</Muted>
        </Card>
      ) : null}
      {usage.isError && !forbidden ? <ErrorState onRetry={() => void usage.refetch()} /> : null}
      {usage.data ? <Dashboard data={usage.data} /> : null}
    </Page>
  );
}

function Dashboard({ data }: { data: AdminUsage }) {
  const { t } = useTranslation();
  const pct = data.budget > 0 ? Math.min(100, Math.round((data.used / data.budget) * 100)) : 0;
  const resets = new Date(data.resets_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const k = data.key;

  return (
    <>
      <div className={s.grid}>
        <Card title={t('admin.requestsTitle')}>
          <p className={s.big}>
            {n(data.used)}
            <span className={s.of}> / {n(data.budget)}</span>
          </p>
          <div className={s.meter} role="meter" aria-valuemin={0} aria-valuemax={data.budget} aria-valuenow={data.used} aria-label={t('admin.requestsTitle')}>
            <span className={cx(s.fill, pct >= 90 && s.fillHot)} style={{ width: `${pct}%` }} />
          </div>
          <Muted small>{t('admin.requestsLeft', { left: n(data.remaining), time: resets })}</Muted>
        </Card>

        <Card title={t('admin.tokensTitle')}>
          <p className={s.big}>{n(data.tokens.total)}</p>
          <dl className={s.pairs}>
            <div>
              <dt>{t('admin.promptTokens')}</dt>
              <dd>{n(data.tokens.prompt)}</dd>
            </div>
            <div>
              <dt>{t('admin.replyTokens')}</dt>
              <dd>{n(data.tokens.completion)}</dd>
            </div>
          </dl>
          <Muted small>{t('admin.tokensNote')}</Muted>
        </Card>

        <Card title={t('admin.keyTitle')}>
          <p className={cx(s.status, k.status === 'ok' ? s.ok : s.bad)}>{t(`admin.keyStatus.${k.status}`)}</p>
          {k.status === 'ok' ? (
            <dl className={s.pairs}>
              <div>
                <dt>{t('admin.credits')}</dt>
                <dd>{k.usage === null ? '–' : `$${k.usage.toFixed(2)}`}</dd>
              </div>
              <div>
                <dt>{t('admin.creditLimit')}</dt>
                <dd>{k.limit === null ? t('admin.noLimit') : `$${k.limit}`}</dd>
              </div>
              <div>
                <dt>{t('admin.tier')}</dt>
                <dd>{k.free_tier === null ? '–' : k.free_tier ? t('admin.freeTier') : t('admin.paidTier')}</dd>
              </div>
            </dl>
          ) : k.error ? (
            <Muted small>{k.error}</Muted>
          ) : null}
        </Card>
      </div>

      <div className={s.grid}>
        <Card title={t('admin.historyRequests')}>
          <BarChart title={t('admin.historyRequests')} data={data.history.map((h) => ({ label: dayLabel(h.day), value: h.requests }))} />
        </Card>
        <Card title={t('admin.historyTokens')}>
          <BarChart title={t('admin.historyTokens')} data={data.history.map((h) => ({ label: dayLabel(h.day), value: h.prompt_tokens + h.completion_tokens }))} />
        </Card>
      </div>

      <Card title={t('admin.modelsTitle')}>
        <div className={s.tableBox}>
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">{t('admin.model')}</th>
                <th scope="col">{t('admin.state')}</th>
                <th scope="col">{t('admin.answered')}</th>
                <th scope="col">{t('admin.failed')}</th>
                <th scope="col">{t('admin.avgTime')}</th>
                <th scope="col">{t('admin.lastError')}</th>
              </tr>
            </thead>
            <tbody>
              {data.models.map((m) => {
                const state = !m.enabled ? 'off' : m.health_disabled ? 'gone' : m.cooling_until ? 'cooling' : 'on';
                return (
                  <tr key={m.model_id}>
                    <td>{m.priority}</td>
                    <td className={s.mono}>{m.model_id}</td>
                    <td>
                      <span className={cx(s.pill, s[`pill_${state}`])}>{t(`admin.states.${state}`)}</span>
                    </td>
                    <td>{n(m.success_count)}</td>
                    <td>{n(m.fail_count)}</td>
                    <td>{m.avg_latency_ms === null ? '–' : `${(m.avg_latency_ms / 1000).toFixed(1)} s`}</td>
                    <td className={s.error}>{m.last_error ?? '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
