// TanStack Query hooks for every backend endpoint. Pages use these; they never call fetch directly.
// The cache lives in memory only (no health data is persisted in the browser).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  api,
  unwrap,
  type ChatMessage,
  type LabInput,
  type Me,
  type Meal,
  type MedInput,
  type Onboarding,
  type ProfilePatch,
  type QuickLog,
  type SendResult,
} from './api';
import { useAuth } from './auth';

export const keys = {
  me: ['me'] as const,
  messages: ['messages'] as const,
  today: (day?: string) => ['today', day ?? 'current'] as const,
  cycle: ['cycle'] as const,
  meds: ['meds'] as const,
  labs: ['labs'] as const,
  facts: ['facts'] as const,
  insights: ['insights'] as const,
};

/** After logging anything, these views may change. */
const LOG_VIEWS = [['today'], keys.cycle, keys.insights, keys.messages] as const;

function useInvalidate() {
  const qc = useQueryClient();
  return (...ks: readonly (readonly unknown[])[]) => Promise.all(ks.map((k) => qc.invalidateQueries({ queryKey: k })));
}

// ---------------------------------------------------------------- profile

export function useMe() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...keys.me, user?.uid],
    enabled: !!user,
    queryFn: async (): Promise<Me> => unwrap(await api.GET('/me')),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ProfilePatch) => unwrap(await api.PATCH('/me', { body: patch })),
    onSuccess: (profile) => {
      qc.setQueriesData({ queryKey: keys.me }, (old: Me | undefined) => (old ? { ...old, profile } : old));
      void qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useOnboarding() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (body: Onboarding) => unwrap(await api.POST('/me/onboarding', { body })),
    onSuccess: () => inv(keys.me, ...LOG_VIEWS, keys.meds),
  });
}

// ---------------------------------------------------------------- chat

export function useMessages() {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.messages,
    enabled: !!user,
    refetchInterval: 60_000, // picks up queued replies and check-ins
    queryFn: async () => unwrap(await api.GET('/chat/messages', { params: { query: { limit: 60 } } })),
  });
}

export async function loadOlderMessages(before: string) {
  return unwrap(await api.GET('/chat/messages', { params: { query: { before, limit: 40 } } }));
}

export function useSendMessage() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (body: { text: string; client_id: string }): Promise<SendResult> => unwrap(await api.POST('/chat/messages', { body })),
    onSuccess: (r) => {
      // Logs from chat (food, symptoms…) change other views too.
      if (r.reply?.meta.logs?.length || r.reply?.meta.pending?.length) void inv(['today'], keys.insights);
      void inv(keys.messages);
    },
  });
}

function useMessageAction(path: '/chat/undo' | '/chat/confirm-period' | '/chat/undo-period') {
  const qc = useQueryClient();
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (body: { message_id: string; log_id?: string; index?: number }) =>
      unwrap(await api.POST(path, { body: body as never })) as { message: ChatMessage },
    onSuccess: ({ message }) => {
      qc.setQueryData(keys.messages, (old: { messages: ChatMessage[]; has_more: boolean } | undefined) =>
        old ? { ...old, messages: old.messages.map((m) => (m.id === message.id ? message : m)) } : old,
      );
      void inv(['today'], keys.cycle, keys.insights);
    },
  });
}
export const useUndoLog = () => useMessageAction('/chat/undo');
export const useConfirmPeriod = () => useMessageAction('/chat/confirm-period');
export const useUndoPeriod = () => useMessageAction('/chat/undo-period');

// ---------------------------------------------------------------- food

export function usePhotoDetect() {
  return useMutation({
    mutationFn: async (body: { image_base64: string; meal: Meal | null }) => unwrap(await api.POST('/food/photo', { body })),
  });
}

export function useLogFoods() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (body: { items: { name: string; quantity: number | null; unit: string | null; grams?: number | null }[]; meal: Meal; day: string; source: 'photo' | 'manual' }) =>
      unwrap(await api.POST('/food/logs', { body: { ...body, items: body.items.map((i) => ({ ...i, grams: i.grams ?? null })) } })),
    onSuccess: () => inv(['today'], keys.insights),
  });
}

export function useDeleteFood() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await api.DELETE('/food/logs/{id}', { params: { path: { id } } })),
    onSuccess: () => inv(['today'], keys.insights),
  });
}

// ---------------------------------------------------------------- today

export function useToday(day?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.today(day),
    enabled: !!user,
    queryFn: async () => unwrap(await api.GET('/today', { params: { query: day ? { day } : {} } })),
  });
}

export function useAddWater() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (body: { day: string; ml: number }) => unwrap(await api.POST('/today/water', { body })),
    onSuccess: () => inv(['today']),
  });
}

export function useQuickLog() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (body: QuickLog) => unwrap(await api.POST('/today/quick-log', { body })),
    onSuccess: () => inv(['today'], keys.insights),
  });
}

export function useSaveWeight() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (body: { day: string; weight_kg: number }) => unwrap(await api.POST('/today/weight', { body })),
    onSuccess: () => inv(['today'], keys.insights),
  });
}

// ---------------------------------------------------------------- cycle

export function useCycle() {
  const { user } = useAuth();
  return useQuery({ queryKey: keys.cycle, enabled: !!user, queryFn: async () => unwrap(await api.GET('/cycle')) });
}

export function useLogPeriod() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (body: { kind: 'start' | 'end'; date: string; flow?: 'spotting' | 'light' | 'medium' | 'heavy' | null; pain?: number | null }) =>
      unwrap(await api.POST('/cycle/periods', { body })),
    onSuccess: () => inv(keys.cycle, ['today'], keys.insights),
  });
}

export function useUpdatePeriod() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; end_date?: string | null; flow?: 'spotting' | 'light' | 'medium' | 'heavy' | null; pain?: number | null; auto_closed?: false }) =>
      unwrap(await api.PATCH('/cycle/periods/{id}', { params: { path: { id } }, body })),
    onSuccess: () => inv(keys.cycle, ['today'], keys.insights),
  });
}

export function useDeletePeriod() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await api.DELETE('/cycle/periods/{id}', { params: { path: { id } } })),
    onSuccess: () => inv(keys.cycle, ['today'], keys.insights),
  });
}

// ---------------------------------------------------------------- medicines

export function useMeds() {
  const { user } = useAuth();
  return useQuery({ queryKey: keys.meds, enabled: !!user, queryFn: async () => unwrap(await api.GET('/meds')) });
}

export function useAddMed() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: async (body: MedInput) => unwrap(await api.POST('/meds', { body })), onSuccess: () => inv(keys.meds, ['today']) });
}

export function useUpdateMed() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string } & Partial<MedInput> & { active?: boolean }) => unwrap(await api.PATCH('/meds/{id}', { params: { path: { id } }, body })),
    onSuccess: () => inv(keys.meds, ['today']),
  });
}

export function useSetDose() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; day: string; time: string; taken: boolean }) => unwrap(await api.POST('/meds/{id}/dose', { params: { path: { id } }, body })),
    onSuccess: () => inv(['today']),
  });
}

// ---------------------------------------------------------------- labs, facts, insights

export function useLabs() {
  const { user } = useAuth();
  return useQuery({ queryKey: keys.labs, enabled: !!user, queryFn: async () => unwrap(await api.GET('/labs')) });
}

export function useAddLab() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: async (body: LabInput) => unwrap(await api.POST('/labs', { body })), onSuccess: () => inv(keys.labs) });
}

export function useDeleteLab() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: async (id: string) => unwrap(await api.DELETE('/labs/{id}', { params: { path: { id } } })), onSuccess: () => inv(keys.labs) });
}

export function useFacts() {
  const { user } = useAuth();
  return useQuery({ queryKey: keys.facts, enabled: !!user, queryFn: async () => unwrap(await api.GET('/facts')) });
}

export function useEditFact() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, fact }: { id: string; fact: string }) => unwrap(await api.PATCH('/facts/{id}', { params: { path: { id } }, body: { fact } })),
    onSuccess: () => inv(keys.facts),
  });
}

export function useDeleteFact() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: async (id: string) => unwrap(await api.DELETE('/facts/{id}', { params: { path: { id } } })), onSuccess: () => inv(keys.facts) });
}

export function useInsights() {
  const { user } = useAuth();
  return useQuery({ queryKey: keys.insights, enabled: !!user, queryFn: async () => unwrap(await api.GET('/insights')) });
}

export function useDismissInsight() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await api.POST('/insights/{id}/dismiss', { params: { path: { id } } })),
    onSuccess: () => inv(keys.insights, keys.cycle),
  });
}
