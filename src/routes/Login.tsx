import { useState } from 'react'
import { useApi } from '../lib/apiContext'
import { Button, Card, Note } from '../components/Ui'

export function Login({ onSignedIn, isDemo }: { onSignedIn: () => void; isDemo: boolean }) {
  const api = useApi()
  const [email, setEmail] = useState(isDemo ? 'admin@example.edu' : '')
  const [state, setState] = useState<'ready' | 'sending' | 'sent'>('ready')
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setState('sending')
    try {
      await api.signIn(email)
      if (isDemo) {
        onSignedIn()
        return
      }
      setState('sent')
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem))
      setState('ready')
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Work schedule</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Sign in with your address. We send a link, so there is no password to forget.
      </p>

      <Card className="p-6">
        {state === 'sent' ? (
          <Note tone="positive">
            Check {email}. The link signs you in and expires in one hour.
          </Note>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Email address
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-[var(--radius-control)] border border-line bg-canvas px-3
                  text-base text-ink"
              />
            </label>
            {error ? <Note tone="danger">{error}</Note> : null}
            <Button type="submit" tone="primary" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending...' : 'Send me a link'}
            </Button>
          </form>
        )}
      </Card>

      {isDemo ? (
        <p className="mt-4 text-center text-xs text-muted">
          Demo mode. Use admin@example.edu to see the whole app, or any address from the
          people list to see what a student sees.
        </p>
      ) : null}
    </main>
  )
}
