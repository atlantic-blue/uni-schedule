import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ScheduleApi } from './api'
import type { Person } from './types'

export const ApiContext = createContext<ScheduleApi | null>(null)

export function useApi(): ScheduleApi {
  const api = useContext(ApiContext)
  if (!api) throw new Error('useApi was called outside ApiProvider')
  return api
}

/** Loads something once, and again whenever the given keys change. */
export function useLoad<T>(load: () => Promise<T>, keys: unknown[]) {
  const [value, setValue] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)

  const run = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      setValue(await load())
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem))
    } finally {
      setBusy(false)
    }
    // load is rebuilt on every render, so the keys are the real dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, keys)

  useEffect(() => {
    void run()
  }, [run])

  return { value, error, busy, reload: run }
}

export function usePerson() {
  const api = useApi()
  return useLoad<Person | null>(() => api.currentPerson(), [api])
}
