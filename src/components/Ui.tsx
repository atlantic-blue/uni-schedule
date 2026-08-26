import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonTone = 'primary' | 'quiet' | 'danger'

const TONES: Record<ButtonTone, string> = {
  primary: 'bg-accent text-white hover:opacity-90 border-transparent',
  quiet: 'bg-surface text-ink border-line hover:bg-accent-soft',
  danger: 'bg-surface text-danger border-line hover:bg-danger/10',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone
}

export function Button({ tone = 'quiet', className = '', ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)]
        border px-4 text-sm font-medium transition-colors disabled:opacity-50
        disabled:cursor-not-allowed ${TONES[tone]} ${className}`}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-[var(--radius-card)] border border-line bg-surface ${className}`}
    >
      {children}
    </section>
  )
}

export function PageHeader({ title, hint, actions }: {
  title: string
  hint?: string
  actions?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  )
}

type PillTone = 'neutral' | 'positive' | 'warning' | 'danger' | 'accent'

const PILLS: Record<PillTone, string> = {
  neutral: 'bg-canvas text-muted border-line',
  positive: 'bg-positive/10 text-positive border-positive/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  danger: 'bg-danger/10 text-danger border-danger/30',
  accent: 'bg-accent-soft text-accent border-accent/30',
}

export function Pill({ tone = 'neutral', children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs
        font-medium whitespace-nowrap ${PILLS[tone]}`}
    >
      {children}
    </span>
  )
}

export function Note({ tone = 'neutral', children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <p
      role={tone === 'danger' ? 'alert' : undefined}
      className={`rounded-[var(--radius-control)] border px-4 py-3 text-sm ${PILLS[tone]}`}
    >
      {children}
    </p>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line px-6 py-10
      text-center text-sm text-muted">
      {children}
    </div>
  )
}

export function Loading({ what }: { what: string }) {
  return <p className="py-10 text-center text-sm text-muted">Loading {what}...</p>
}
