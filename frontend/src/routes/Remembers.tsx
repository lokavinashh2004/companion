// What Companion remembers: the short notes kept for friendly follow-ups. Everything is editable and deletable.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmSheet, FormError } from '@/components/me/common';
import s from '@/components/me/me.module.css';
import { Button, Card, EmptyState, ErrorState, Loading, Muted, Page, Row, TextArea } from '@/components/ui';
import type { Fact } from '@/lib/api';
import { useDeleteFact, useEditFact, useFacts, useMe } from '@/lib/queries';

const CATEGORIES: Fact['category'][] = ['preference', 'person', 'event', 'health', 'other'];

export function Remembers() {
  const { t } = useTranslation();
  const me = useMe();
  const facts = useFacts();
  const del = useDeleteFact();
  const [confirm, setConfirm] = useState<Fact | null>(null);
  const name = me.data?.profile.companion_name || t('common.appName');
  const list = facts.data?.facts ?? [];

  return (
    <Page title={t('remembers.title', { name })}>
      <Muted>{t('remembers.hint')}</Muted>
      {facts.isLoading ? <Loading /> : null}
      {facts.isError ? <ErrorState onRetry={() => void facts.refetch()} /> : null}
      {facts.data && list.length === 0 ? <EmptyState body={t('remembers.empty')} /> : null}

      {CATEGORIES.map((c) => {
        const items = list.filter((f) => f.category === c);
        if (!items.length) return null;
        return (
          <Card key={c} title={t(`remembers.categories.${c}`)}>
            <div>
              {items.map((f) => (
                <FactRow key={f.id} fact={f} onDelete={() => setConfirm(f)} />
              ))}
            </div>
          </Card>
        );
      })}

      <ConfirmSheet
        open={!!confirm}
        title={t('remembers.deleteConfirm')}
        body={confirm?.fact}
        confirmLabel={t('common.delete')}
        busy={del.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) del.mutate(confirm.id, { onSuccess: () => setConfirm(null) });
        }}
      />
    </Page>
  );
}

function FactRow({ fact, onDelete }: { fact: Fact; onDelete: () => void }) {
  const { t } = useTranslation();
  const edit = useEditFact();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(fact.fact);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const v = text.trim();
    if (v.length < 3 || v.length > 300) {
      setError(t('mePage.facts.length'));
      return;
    }
    setError(null);
    if (v === fact.fact) {
      setEditing(false);
      return;
    }
    edit.mutate({ id: fact.id, fact: v }, { onSuccess: () => setEditing(false) });
  };

  if (editing) {
    return (
      <div className={s.factRow}>
        <TextArea label={t('mePage.facts.editLabel')} value={text} maxLength={300} rows={3} onChange={(e) => setText(e.target.value)} />
        {error ? <FormError>{error}</FormError> : null}
        {edit.isError ? <FormError>{t('common.error')}</FormError> : null}
        <Row>
          <Button small busy={edit.isPending} onClick={save}>
            {t('common.save')}
          </Button>
          <Button
            small
            kind="ghost"
            onClick={() => {
              setText(fact.fact);
              setError(null);
              setEditing(false);
            }}
          >
            {t('common.cancel')}
          </Button>
        </Row>
      </div>
    );
  }

  return (
    <div className={s.factRow}>
      <p className={s.factText}>{fact.fact}</p>
      <Row>
        <Button small kind="secondary" onClick={() => setEditing(true)}>
          {t('common.edit')}
        </Button>
        <Button small kind="ghost" onClick={onDelete}>
          {t('common.delete')}
        </Button>
      </Row>
    </div>
  );
}
