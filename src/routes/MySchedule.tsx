import { useApi, useLoad } from '../lib/apiContext'
import { Card, Empty, Loading, Note, PageHeader, Pill } from '../components/Ui'
import { formatLongDay, formatMinutes, formatTime, toIsoDate } from '../lib/time'
import type { HoursBalance, MyShift, Person } from '../lib/types'

function StatusPill({ status }: { status: MyShift['status'] }) {
  if (status === 'worked') return <Pill tone="positive">Worked</Pill>
  if (status === 'excused') return <Pill tone="warning">Excused</Pill>
  if (status === 'absent') return <Pill tone="danger">Missed</Pill>
  return null
}

function ShiftRow({ shift }: { shift: MyShift }) {
  return (
    <li className="flex flex-col gap-1 border-b border-line px-4 py-4 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{formatLongDay(shift.date)}</span>
        <StatusPill status={shift.status} />
      </div>
      <span className="text-sm text-muted">
        {shift.areaName}, {formatTime(shift.startsAt)} to {formatTime(shift.endsAt)}
      </span>
      {shift.colleagues.length > 0 ? (
        <span className="text-sm text-muted">With {shift.colleagues.join(', ')}</span>
      ) : (
        <span className="text-sm text-muted">You are alone on this one.</span>
      )}
    </li>
  )
}

export function MySchedule({ person }: { person: Person }) {
  const api = useApi()
  const today = toIsoDate(new Date())
  const shifts = useLoad<MyShift[]>(() => api.myShifts(), [api])
  const hours = useLoad<HoursBalance[]>(() => api.hoursBalances(), [api])

  if (shifts.busy) return <Loading what="your shifts" />
  if (shifts.error) return <Note tone="danger">{shifts.error}</Note>

  const all = shifts.value ?? []
  const next = all.filter((shift) => shift.date >= today)
  const past = all.filter((shift) => shift.date < today).reverse()
  const mine = (hours.value ?? []).find((row) => row.personId === person.id)

  return (
    <>
      <PageHeader
        title={`Hello ${person.fullName.split(' ')[0]}`}
        hint={next[0]
          ? `Your next shift is ${formatLongDay(next[0].date)}.`
          : 'You have no shifts coming up.'}
      />

      {mine && mine.targetMinutes > 0 ? (
        <Card className="mb-6 flex flex-wrap gap-6 p-4">
          <div>
            <p className="text-xs text-muted">Worked</p>
            <p className="text-xl font-semibold">{formatMinutes(mine.creditedMinutes)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Target</p>
            <p className="text-xl font-semibold">{formatMinutes(mine.targetMinutes)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">
              {mine.minusMinutes > 0 ? 'Minus hours' : 'Ahead by'}
            </p>
            <p
              className={`text-xl font-semibold ${
                mine.minusMinutes > 0 ? 'text-danger' : 'text-positive'
              }`}
            >
              {formatMinutes(Math.abs(mine.balanceMinutes))}
            </p>
          </div>
        </Card>
      ) : null}

      <h2 className="mb-2 text-sm font-semibold text-muted">Coming up</h2>
      {next.length === 0 ? (
        <Empty>Nothing planned yet. The list fills when the week is assigned.</Empty>
      ) : (
        <Card><ul>{next.map((shift) => <ShiftRow key={shift.assignmentId} shift={shift} />)}</ul></Card>
      )}

      {past.length > 0 ? (
        <>
          <h2 className="mt-8 mb-2 text-sm font-semibold text-muted">Already done</h2>
          <Card>
            <ul>{past.slice(0, 10).map((shift) => (
              <ShiftRow key={shift.assignmentId} shift={shift} />
            ))}</ul>
          </Card>
        </>
      ) : null}
    </>
  )
}
