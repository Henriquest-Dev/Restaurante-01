import { useEffect, useState } from 'react'
import { NAV, SITE } from './content'

/** Site header: logo, links, and a full-screen menu on small screens. */
export function Nav({ current, theme = 'dark' }: { current: string; theme?: 'dark' | 'light' }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    document.documentElement.classList.toggle('nav-open', open)
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  useEffect(() => () => document.documentElement.classList.remove('nav-open'), [])
  return (
    <header className={`nav nav--${theme} ${open ? 'is-open' : ''}`}>
      <a className="nav__logo" href="#/" aria-label={`${SITE.name} — início`}>
        {SITE.name}
      </a>
      <nav className="nav__links" aria-label="Principal">
        {NAV.map((l) => (
          <a key={l.href} href={l.href} aria-current={current === l.href ? 'page' : undefined} onClick={() => setOpen(false)}>
            {l.label}
          </a>
        ))}
      </nav>
      <button className="nav__burger" aria-expanded={open} aria-label={open ? 'Fechar menu' : 'Abrir menu'} onClick={() => setOpen(!open)}>
        <span />
        <span />
      </button>
    </header>
  )
}
