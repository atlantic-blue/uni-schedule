import type { ReactNode } from 'react'
import { ApiContext } from '../lib/apiContext'
import type { ScheduleApi } from '../lib/api'

export function ApiProvider({ api, children }: { api: ScheduleApi; children: ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>
}
