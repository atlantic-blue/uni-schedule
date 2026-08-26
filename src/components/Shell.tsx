import { NavLink, Route, Routes } from 'react-router-dom'
import { usePerson, useApi } from '../lib/apiContext'
import { Button, Loading, Note } from './Ui'
import { Login } from '../routes/Login'
import { MySchedule } from '../routes/MySchedule'
import { AdminWeek } from '../routes/AdminWeek'
import { Attendance } from '../routes/Attendance'
import { Hours } from '../routes/Hours'
import { PrintWeek } from '../routes/PrintWeek'

const LINK_BASE = `rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium
  transition-colors`

function Nav({ isAdmin }: { isAdmin: boolean }) {
  const style = ({ isActive }: { isActive: boolean }) =>
    `${LINK_BASE} ${isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'}`
  return (
    <nav className="flex flex-wrap gap-1" aria-label="Main">
      <NavLink to="/" end className={style}>My schedule</NavLink>
      {isAdmin ? <NavLink to="/week" className={style}>Assign</NavLink> : null}
      {isAdmin ? <NavLink to="/attendance" className={style}>Attendance</NavLink> : null}
      <NavLink to="/hours" className={style}>Hours</NavLink>
      <NavLink to="/print" className={style}>Print</NavLink>
    </nav>
  )
}

export function Shell({ isDemo }: { isDemo: boolean }) {
  const api = useApi()
  const { value: person, busy, error, reload } = usePerson()

  if (busy) return <Loading what="your account" />
  if (error) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <Note tone="danger">{error}</Note>
      </main>
    )
  }
  if (!person) return <Login onSignedIn={reload} isDemo={isDemo} />

  const isAdmin = person.role === 'admin'

  return (
    <div className="min-h-screen">
      <header className="no-print border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold tracking-tight">Work schedule</span>
            <Nav isAdmin={isAdmin} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">{person.fullName}</span>
            <Button
              onClick={async () => {
                await api.signOut()
                reload()
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
        {isDemo ? (
          <p className="bg-warning/10 px-4 py-2 text-center text-xs text-warning">
            Demo data, held in memory. Nothing is saved and a reload starts again.
          </p>
        ) : null}
      </header>

      <main className="mx-auto max-w-5xl p-4 sm:p-6 print-sheet">
        <Routes>
          <Route path="/" element={<MySchedule person={person} />} />
          <Route path="/week" element={<AdminWeek isAdmin={isAdmin} />} />
          <Route path="/attendance" element={<Attendance isAdmin={isAdmin} />} />
          <Route path="/hours" element={<Hours isAdmin={isAdmin} />} />
          <Route path="/print" element={<PrintWeek />} />
        </Routes>
      </main>
    </div>
  )
}
