// Chat tab: the conversation as a full page.
import { ChatPanel } from '@/components/chat/ChatPanel';

export function Chat() {
  return (
    <main id="main" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ChatPanel variant="page" />
    </main>
  );
}
