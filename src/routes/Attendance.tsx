import { useState } from 'react'
import { useApi, useLoad } from '../lib/apiContext'
import { Button, Card, Empty, Loading, Note, PageHeader } from '../components/Ui'
import { addDays, formatDay, formatLongDay, mondayOf, toIsoDate } from '../lib/time'
import type { AttendanceStatus, Shift } from '../lib/types'

const CHOICES: { status: AttendanceStatus; label: string; tone: string }[] = [
  { status: 'worked', label: 'Worked', tone: 'text-positive border-positive/40 bg-positive/10' },
  { status: 'excused', label: 'Excused', tone: 'text-warning border-warning/40 bg-warning/10' },
  { status: 'absent', label: 'Missed', tone: 'text-danger border-danger/40 bg-danger/10' },
]

export function Attendance({ isAdmin }: { isAdmin: boolean }) {
  const api = useApi()
  const today = toIsoDate(new Date())
  const [monday, setMonday] = useState(() => mondayOf(today))
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({})
  const [saved, setSaved] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const week = useLoad<Shift[]>(() => api.listWeek(monday), [api, monday])

  if (!isAdmin) return <Note tone="danger">Only an administrator can record attendance.</Note>
  if (week.busy) return <Loading what="the week" />
  if (week.error) return <Note tone="danger">{week.error}</Note>

  const done = (week.value ?? []).filter((shift) => shift.date <= today)
  const days = [...new Set(done.map((shift) => shift.date))].sort().reverse()
  const pending = Object.keys(marks).length

  async function save() {
    setProblem(null)
    try {
      await api.markAttendance(
        Object.entries(marks).map(([assignmentId, status]) => ({ assignmentId, status })),
      )
      setMarks({})
      setSaved(true)
      week.reload()
    } catch (failure) {
      setProblem(failure instanceof Error ? failure.message : String(failure))
    }
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        hint="Mark what happened. An excused absence still counts towards the target."
        actions={
          <>
            <Button onClick={() => { setMonday(addDays(monday, -7)); setSaved(false) }}>
              Previous week
            </Button>
            <Button onClick={() => { setMonday(addDays(monday, 7)); setSaved(false) }}>
              Next week
            </Button>
          </>
        }
      />

      {problem ? <div className="mb-4"><Note tone="danger">{problem}</Note></div> : null}
      {saved && pending === 0
        ? <div className="mb-4"><Note tone="positive">Saved. The hours are updated.</Note></div>
        : null}

      {days.length === 0 ? (
        <Empty>Nothing has happened in this week yet.</Empty>
      ) : null}

      {days.map((day) => (
        <section key={day} className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-muted">{formatLongDay(day)}</h2>
          <div className="flex flex-col gap-3">
            {done.filter((shift) => shift.date === day).map((shift) => (
              <Card key={shift.id} className="p-4">
                <h3 className="mb-3 font-medium">{shift.areaName}</h3>
                {shift.assignments.length === 0 ? (
                  <p className="text-sm text-muted">Nobody was assigned.</p>
                ) : null}
                <ul className="flex flex-col gap-2">
                  {shift.assignments.map((assignment) => (
                    <li
                      key={assignment.id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="text-sm">{assignment.personName}</span>
                      <div role="group" aria-label={`Attendance for ${assignment.personName}`}
                        className="flex gap-1">
                        {CHOICES.map((choice) => {
                          const chosen = marks[assignment.id] === choice.status
                          return (
                            <button
                              key={choice.status}
                              aria-pressed={chosen}
                              onClick={() => setMarks({ ...marks, [assignment.id]: choice.status })}
                              className={`min-h-11 rounded-[var(--radius-control)] border px-3
                                text-xs font-medium ${
                                  chosen ? choice.tone : 'border-line text-muted hover:bg-canvas'
                                }`}
                            >
                              {choice.label}
                            </button>
                          )
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      ))}

      {pending > 0 ? (
        <div className="sticky bottom-4 flex justify-end">
          <Button tone="primary" onClick={save}>
            Save {pending} mark{pending > 1 ? 's' : ''}
          </Button>
        </div>
      ) : null}

      <p className="mt-8 text-xs text-muted">
        Showing {formatDay(monday)} to {formatDay(addDays(monday, 6))}.
      </p>
    </>
  )
}
