import { useMemo, useState } from 'react'
import { useApi, useLoad } from '../lib/apiContext'
import { Button, Card, Empty, Loading, Note, PageHeader, Pill } from '../components/Ui'
import {
  addDays, formatDay, formatMinutes, formatTime, isoWeekNumber, mondayOf, toIsoDate,
} from '../lib/time'
import type { HoursBalance, Person, Shift } from '../lib/types'

interface Candidate {
  person: Person
  minusMinutes: number
  hasTarget: boolean
}

/**
 * Offers whoever is furthest behind first, because that is the decision the
 * person filling the sheet is actually trying to make.
 */
function rankCandidates(people: Person[], hours: HoursBalance[]): Candidate[] {
  const byPerson = new Map(hours.map((row) => [row.personId, row]))
  return people
    .map((person) => {
      const row = byPerson.get(person.id)
      return {
        person,
        minusMinutes: row?.minusMinutes ?? 0,
        hasTarget: (row?.targetMinutes ?? 0) > 0,
      }
    })
    .sort((a, b) => b.minusMinutes - a.minusMinutes || a.person.fullName.localeCompare(b.person.fullName))
}

function ShiftCard({ shift, candidates, busyOnDay, onAssign, onRemove }: {
  shift: Shift
  candidates: Candidate[]
  busyOnDay: Set<string>
  onAssign: (shiftId: string, personId: string) => void
  onRemove: (assignmentId: string) => void
}) {
  const [picked, setPicked] = useState('')
  const free = candidates.filter((candidate) => !busyOnDay.has(candidate.person.id))
  const short = shift.places - shift.assignments.length

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">{shift.areaName}</h3>
          <p className="text-xs text-muted">
            {formatTime(shift.startsAt)} to {formatTime(shift.endsAt)}
          </p>
        </div>
        {short > 0
          ? <Pill tone="danger">{short} place{short > 1 ? 's' : ''} open</Pill>
          : <Pill tone="positive">Full</Pill>}
      </div>

      <ul className="mb-3 flex flex-col gap-1">
        {shift.assignments.map((assignment) => (
          <li
            key={assignment.id}
            className="flex items-center justify-between gap-2 rounded-[var(--radius-control)]
              bg-canvas px-3 py-2 text-sm"
          >
            <span>{assignment.personName}</span>
            <button
              onClick={() => onRemove(assignment.id)}
              aria-label={`Remove ${assignment.personName} from ${shift.areaName}`}
              className="min-h-0 rounded px-2 py-1 text-xs text-danger hover:bg-danger/10"
            >
              Remove
            </button>
          </li>
        ))}
        {shift.assignments.length === 0 ? (
          <li className="text-sm text-muted">Nobody yet.</li>
        ) : null}
      </ul>

      <div className="flex gap-2">
        <select
          value={picked}
          aria-label={`Add somebody to ${shift.areaName} on ${formatDay(shift.date)}`}
          onChange={(event) => setPicked(event.target.value)}
          className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-line
            bg-canvas px-2 text-sm"
        >
          <option value="">Add somebody...</option>
          {free.map((candidate) => (
            <option key={candidate.person.id} value={candidate.person.id}>
              {candidate.person.fullName}
              {candidate.minusMinutes > 0 ? ` (${formatMinutes(candidate.minusMinutes)} behind)` : ''}
              {candidate.person.role === 'guest' ? ' (guest)' : ''}
            </option>
          ))}
        </select>
        <Button
          tone="primary"
          disabled={!picked}
          onClick={() => {
            onAssign(shift.id, picked)
            setPicked('')
          }}
        >
          Add
        </Button>
      </div>
    </Card>
  )
}

export function AdminWeek({ isAdmin }: { isAdmin: boolean }) {
  const api = useApi()
  const [monday, setMonday] = useState(() => mondayOf(toIsoDate(new Date())))
  const [problem, setProblem] = useState<string | null>(null)

  const week = useLoad<Shift[]>(() => api.listWeek(monday), [api, monday])
  const people = useLoad<Person[]>(() => api.listPeople(), [api])
  const hours = useLoad<HoursBalance[]>(() => api.hoursBalances(), [api])

  const candidates = useMemo(
    () => rankCandidates(people.value ?? [], hours.value ?? []),
    [people.value, hours.value],
  )

  if (!isAdmin) return <Note tone="danger">Only an administrator can assign people.</Note>
  if (week.busy) return <Loading what="the week" />
  if (week.error) return <Note tone="danger">{week.error}</Note>

  const shifts = week.value ?? []
  const days = [...new Set(shifts.map((shift) => shift.date))].sort()

  async function run(action: Promise<unknown>) {
    setProblem(null)
    try {
      await action
      week.reload()
    } catch (failure) {
      setProblem(failure instanceof Error ? failure.message : String(failure))
    }
  }

  return (
    <>
      <PageHeader
        title={`Week ${isoWeekNumber(monday)}`}
        hint={`${formatDay(monday)} to ${formatDay(addDays(monday, 6))}`}
        actions={
          <>
            <Button onClick={() => setMonday(addDays(monday, -7))}>Previous week</Button>
            <Button onClick={() => setMonday(addDays(monday, 7))}>Next week</Button>
          </>
        }
      />

      {problem ? <div className="mb-4"><Note tone="danger">{problem}</Note></div> : null}

      {days.length === 0 ? (
        <Empty>
          <p className="mb-4">This week has no shifts yet.</p>
          <Button tone="primary" onClick={() => run(api.generateWeek(monday))}>
            Create them from the templates
          </Button>
        </Empty>
      ) : null}

      {days.map((day) => {
        const onThisDay = shifts.filter((shift) => shift.date === day)
        const busyOnDay = new Set(
          onThisDay.flatMap((shift) => shift.assignments.map((a) => a.personId)),
        )
        const open = onThisDay.reduce(
          (total, shift) => total + Math.max(0, shift.places - shift.assignments.length), 0,
        )
        return (
          <section key={day} className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted">
              {formatDay(day)}
              {open > 0 ? <Pill tone="danger">{open} open</Pill> : <Pill tone="positive">Complete</Pill>}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {onThisDay.map((shift) => (
                <ShiftCard
                  key={shift.id}
                  shift={shift}
                  candidates={candidates}
                  busyOnDay={busyOnDay}
                  onAssign={(shiftId, personId) => run(api.assign(shiftId, personId))}
                  onRemove={(assignmentId) => run(api.unassign(assignmentId))}
                />
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}
