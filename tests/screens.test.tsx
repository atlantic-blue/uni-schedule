import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TestApp } from '../src/App'
import { NotAllowed } from '../src/lib/api'
import { apiFor, THURSDAY } from './fixture'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-08-25T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('what a student sees', () => {
  it('opens on their own next shift, with the area and who else is on it', async () => {
    render(<TestApp api={apiFor('sam')} />)

    expect(await screen.findByText('Hello Sam')).toBeInTheDocument()
    expect(screen.getByText(/Your next shift is Thursday,? 27 August/)).toBeInTheDocument()

    const comingUp = (await screen.findAllByText(/Kitchen, 16:00 to 20:00/))[0]
    expect(comingUp).toBeInTheDocument()
    expect(screen.getAllByText('You are alone on this one.').length).toBeGreaterThan(0)
  })

  it('does not offer the assign screen', async () => {
    render(<TestApp api={apiFor('sam')} />)
    await screen.findByText('Hello Sam')
    expect(screen.queryByRole('link', { name: 'Assign' })).not.toBeInTheDocument()
  })

  it('is turned away when they reach the assign screen by its address', async () => {
    render(<TestApp api={apiFor('sam')} path="/week" />)
    expect(
      await screen.findByText('Only an administrator can assign people.'),
    ).toBeInTheDocument()
  })
})

describe('assigning somebody', () => {
  it('shows the new name on the card and closes the open place', async () => {
    const user = userEvent.setup()
    render(<TestApp api={apiFor('ada')} />)

    await user.click(await screen.findByRole('link', { name: 'Assign' }))

    const picker = await screen.findByLabelText(/Add somebody to Kitchen on Thu,? 27 Aug/)
    const card = picker.closest('section')
    if (!card) throw new Error('the picker is not inside a card')

    expect(within(card).getByText('1 place open')).toBeInTheDocument()
    expect(within(card).queryByText('Oli Novak')).not.toBeInTheDocument()

    await user.selectOptions(picker, 'oli')
    await user.click(within(card).getByRole('button', { name: 'Add' }))

    expect(await within(card).findByText('Oli Novak')).toBeInTheDocument()
    expect(within(card).getByText('Full')).toBeInTheDocument()
  })

  it('offers whoever is furthest behind first', async () => {
    const user = userEvent.setup()
    const api = apiFor('ada')
    // Sam already worked a shift, so Oli is the one further behind.
    await api.markAttendance([{ assignmentId: 'a1', status: 'worked' }])

    render(<TestApp api={api} />)
    await user.click(await screen.findByRole('link', { name: 'Assign' }))

    const picker = await screen.findByLabelText(/Add somebody to Kitchen on Thu,? 27 Aug/)
    const offered = within(picker).getAllByRole('option').map((option) => option.textContent)
    expect(offered[0]).toBe('Add somebody...')
    expect(offered[1]).toContain('Oli Novak')
    expect(offered[1]).toContain('8 h behind')
  })

  it('does not offer somebody already working elsewhere that day', async () => {
    const user = userEvent.setup()
    render(<TestApp api={apiFor('ada')} />)
    await user.click(await screen.findByRole('link', { name: 'Assign' }))

    const picker = await screen.findByLabelText(/Add somebody to Kitchen on Thu,? 27 Aug/)
    const offered = within(picker).getAllByRole('option').map((option) => option.textContent)
    expect(offered.join(' ')).not.toContain('Sam Weber')
  })
})

describe('attendance reaches the hours screen', () => {
  it('carries a worked shift through to the number the student is judged on', async () => {
    const user = userEvent.setup()
    render(<TestApp api={apiFor('ada')} />)

    await user.click(await screen.findByRole('link', { name: 'Attendance' }))

    const group = await screen.findByRole('group', { name: 'Attendance for Sam Weber' })
    await user.click(within(group).getByRole('button', { name: 'Worked' }))
    await user.click(await screen.findByRole('button', { name: 'Save 1 mark' }))

    expect(await screen.findByText('Saved. The hours are updated.')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Hours' }))

    const row = (await screen.findByText('Sam Weber')).closest('li')
    if (!row) throw new Error('the person has no row')
    expect(within(row).getByText(/Worked 4 h of 8 h/)).toBeInTheDocument()
    expect(within(row).getByText('4 h behind')).toBeInTheDocument()
  })
})

describe('the demo store refuses what the database would refuse', () => {
  it('will not let a student assign anybody', async () => {
    await expect(apiFor('sam').assign('soon', 'oli')).rejects.toBeInstanceOf(NotAllowed)
  })

  it('will not let a student record attendance', async () => {
    await expect(
      apiFor('sam').markAttendance([{ assignmentId: 'a1', status: 'worked' }]),
    ).rejects.toBeInstanceOf(NotAllowed)
  })

  it('shows a student only their own hours', async () => {
    const rows = await apiFor('sam').hoursBalances()
    expect(rows.map((row) => row.fullName)).toEqual(['Sam Weber'])
  })

  it('keeps a shift on its date whatever the clock says', async () => {
    const week = await apiFor('ada').listWeek('2026-08-24')
    expect(week.map((shift) => shift.date)).toEqual(['2026-08-24', THURSDAY])
  })
})
