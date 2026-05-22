import ChatSoporteView from '@/components/sistema/ChatSoporteView'

export const metadata = { title: 'Panel de Chat', robots: 'noindex,nofollow' }

export default function ChatAdminPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f1117',
      color: '#e2e8f0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>
        <ChatSoporteView />
      </div>
    </div>
  )
}
