import { useState } from 'react'
import { useApi, useLoad } from '../lib/apiContext'
import { Button, Card, Empty, Loading, Note, PageHeader, Pill } from '../components/Ui'
import { formatMinutes } from '../lib/time'
import type { HoursBalance } from '../lib/types'

function BalancePill({ row }: { row: HoursBalance }) {
  if (row.targetMinutes === 0) return <Pill>No target</Pill>
  if (row.minusMinutes > 0) {
    return <Pill tone="danger">{formatMinutes(row.minusMinutes)} behind</Pill>
  }
  return <Pill tone="positive">{formatMinutes(row.balanceMinutes)} ahead</Pill>
}

export function Hours({ isAdmin }: { isAdmin: boolean }) {
  const api = useApi()
  const { value, busy, error, reload } = useLoad<HoursBalance[]>(() => api.hoursBalances(), [api])
  const [correcting, setCorrecting] = useState<string | null>(null)
  const [minutes, setMinutes] = useState('60')
  const [reason, setReason] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  if (busy) return <Loading what="the hours" />
  if (error) return <Note tone="danger">{error}</Note>

  const rows = value ?? []
  const behind = rows.filter((row) => row.minusMinutes > 0).length

  async function save(personId: string) {
    setProblem(null)
    const amount = Number(minutes)
    if (!Number.isFinite(amount) || amount === 0) {
      setProblem('Give a number of minutes that is not zero.')
      return
    }
    if (reason.trim().length === 0) {
      setProblem('Say why. The correction is shown to the person it belongs to.')
      return
    }
    try {
      await api.addAdjustment(personId, Math.round(amount), reason.trim())
      setCorrecting(null)
      setReason('')
      reload()
    } catch (failure) {
      setProblem(failure instanceof Error ? failure.message : String(failure))
    }
  }

  return (
    <>
      <PageHeader
        title="Hours"
        hint={isAdmin
          ? `${rows.length} people, ${behind} of them behind their target.`
          : 'Your hours, and every correction made to them.'}
      />

      {rows.length === 0 ? <Empty>No hours recorded yet.</Empty> : null}

      <Card>
        <ul>
          {rows.map((row) => (
            <li key={row.personId} className="border-b border-line px-4 py-4 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{row.fullName}</p>
                  <p className="text-sm text-muted">
                    Worked {formatMinutes(row.creditedMinutes)} of{' '}
                    {formatMinutes(row.targetMinutes)}
                    {row.adjustmentMinutes !== 0
                      ? `, corrected by ${formatMinutes(row.adjustmentMinutes)}`
                      : ''}
                    {row.excusedDays > 0 ? `, ${row.excusedDays} excused` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <BalancePill row={row} />
                  {isAdmin ? (
                    <Button
                      onClick={() => setCorrecting(correcting === row.personId ? null : row.personId)}
                    >
                      Correct
                    </Button>
                  ) : null}
                </div>
              </div>

              {correcting === row.personId ? (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-xs font-medium">
                    Minutes, negative to take away
                    <input
                      type="number"
                      value={minutes}
                      onChange={(event) => setMinutes(event.target.value)}
                      className="w-32 rounded-[var(--radius-control)] border border-line
                        bg-canvas px-3 text-base"
                    />
                  </label>
                  <label className="flex flex-1 flex-col gap-1 text-xs font-medium">
                    Reason
                    <input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Swapped with another area"
                      className="w-full rounded-[var(--radius-control)] border border-line
                        bg-canvas px-3 text-base"
                    />
                  </label>
                  <Button tone="primary" onClick={() => save(row.personId)}>Save</Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
      {problem ? <div className="mt-4"><Note tone="danger">{problem}</Note></div> : null}
    </>
  )
}
