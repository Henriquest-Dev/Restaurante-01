import { useEffect, useRef } from 'react'

/**
 * A quiet cursor for the look-around on precise pointers: a ring labelled
 * "Arrastar" that trails the mouse. Elsewhere the system cursor is kept.
 */
export function Cursor({ active, label }: { active: boolean; label: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    const el = ref.current!
    let x = -100
    let y = -100
    let cx = x
    let cy = y
    let raf = 0
    const move = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
    }
    const down = () => el.classList.add('is-down')
    const up = () => el.classList.remove('is-down')
    const tick = () => {
      cx += (x - cx) * 0.2
      cy += (y - cy) * 0.2
      el.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
    }
  }, [])

  return (
    <div className={`cursor ${active ? 'is-active' : ''}`} ref={ref} aria-hidden="true">
      <span className="cursor__ring" />
      <span className="cursor__label">{label}</span>
    </div>
  )
}
