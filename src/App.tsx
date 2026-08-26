import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ApiProvider } from './components/ApiProvider'
import type { ScheduleApi } from './lib/api'
import { Shell } from './components/Shell'

export function App({ api, isDemo }: { api: ScheduleApi; isDemo: boolean }) {
  return (
    <ApiProvider api={api}>
      <BrowserRouter>
        <Shell isDemo={isDemo} />
      </BrowserRouter>
    </ApiProvider>
  )
}

/** Used by the tests, which need to start on a chosen path. */
export function TestApp({ api, path = '/' }: { api: ScheduleApi; path?: string }): ReactNode {
  return (
    <ApiProvider api={api}>
      <MemoryRouter initialEntries={[path]}>
        <Shell isDemo />
      </MemoryRouter>
    </ApiProvider>
  )
}
