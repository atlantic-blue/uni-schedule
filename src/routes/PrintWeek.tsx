import { useState } from 'react'
import { useApi, useLoad } from '../lib/apiContext'
import { Button, Empty, Loading, Note, PageHeader } from '../components/Ui'
import { addDays, formatDay, formatTime, isoWeekNumber, mondayOf, toIsoDate } from '../lib/time'
import type { Shift } from '../lib/types'

/**
 * The sheet that goes on the wall. It carries names and places and nothing else,
 * because a printed page has no access control and absence is private.
 */
export function PrintWeek() {
  const api = useApi()
  const [monday, setMonday] = useState(() => mondayOf(toIsoDate(new Date())))
  const week = useLoad<Shift[]>(() => api.listWeek(monday), [api, monday])

  if (week.busy) return <Loading what="the week" />
  if (week.error) return <Note tone="danger">{week.error}</Note>

  const shifts = week.value ?? []
  const days = [...new Set(shifts.map((shift) => shift.date))].sort()

  return (
    <>
      <div className="no-print">
        <PageHeader
          title={`Week ${isoWeekNumber(monday)}`}
          hint="Print this and put it on the wall. It shows names only."
          actions={
            <>
              <Button onClick={() => setMonday(addDays(monday, -7))}>Previous</Button>
              <Button onClick={() => setMonday(addDays(monday, 7))}>Next</Button>
              <Button tone="primary" onClick={() => window.print()}>Print</Button>
            </>
          }
        />
      </div>

      <h1 className="hidden text-xl font-semibold print:block">
        Work schedule, week {isoWeekNumber(monday)}
      </h1>

      {days.length === 0 ? <Empty>This week has no shifts yet.</Empty> : null}

      {days.map((day) => (
        <section key={day} className="mb-6 break-inside-avoid">
          <h2 className="mb-2 border-b border-line pb-1 text-base font-semibold">
            {formatDay(day)}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shifts.filter((shift) => shift.date === day).map((shift) => (
              <div key={shift.id}>
                <p className="text-sm font-medium">
                  {shift.areaName}
                  <span className="ml-2 font-normal text-muted">
                    {formatTime(shift.startsAt)} to {formatTime(shift.endsAt)}
                  </span>
                </p>
                <ol className="mt-1 text-sm">
                  {Array.from({ length: shift.places }, (_, place) => (
                    <li key={place} className="border-b border-dotted border-line py-1">
                      {shift.assignments[place]?.personName ?? (
                        <span className="text-muted">.....................</span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
