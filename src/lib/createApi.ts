import type { ScheduleApi } from './api'
import { DemoApi } from './demoApi'
import { SupabaseApi, createSupabaseClient } from './supabaseApi'

/**
 * With a Supabase project configured the app talks to it. With nothing
 * configured it runs the demo store, so the app can be opened and clicked
 * before anybody has an account. The banner in the shell says which one is live.
 */
export function createApi(): { api: ScheduleApi; isDemo: boolean } {
  if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
    return { api: new SupabaseApi(createSupabaseClient()), isDemo: false }
  }
  return { api: new DemoApi(), isDemo: true }
}
