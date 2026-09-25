import { gsap } from 'gsap'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DISHES } from './content'
import { Dust, reducedMotion } from './fx'
import { Icon } from './icons'
import { Nav } from './Nav'
import './home.css'
import './menu.css'

const pad = (n: number) => String(n + 1).padStart(2, '0')

/**
 * Animated menu, after the reference: the plate swings out along an arc
 * while the next one swings in turning, the title wipes out and back in,
 * and the accent arc behind the plate turns and changes colour.
 */
export default function MenuPage() {
  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState(0)
  const [tab, setTab] = useState<'overview' | 'ingredients'>('overview')
  const [liked, setLiked] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('sala.likes') || '{}')
    } catch {
      return {}
    }
  })
  const busy = useRef(false)
  const root = useRef<HTMLDivElement>(null)
  const arcTurn = useRef(0)
  const dish = DISHES[shown]

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Initial state: first plate in place, the others waiting off-stage.
  useLayoutEffect(() => {
    const plates = root.current!.querySelectorAll<HTMLElement>('.mn-plate')
    plates.forEach((p, i) => gsap.set(p, i === 0 ? { x: 0, y: 0, rotate: 0, autoAlpha: 1 } : { autoAlpha: 0 }))
    if (!reducedMotion()) {
      gsap.fromTo(plates[0], { xPercent: 80, yPercent: -90, rotate: 160 }, { xPercent: 0, yPercent: 0, rotate: 0, duration: 1.4, ease: 'power3.out', delay: 0.2 })
      gsap.fromTo('.mn-line', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.9, stagger: 0.12, ease: 'power3.out', delay: 0.6 })
      gsap.fromTo('.mn-card, .mn-thumbs, .mn-dock, .mn-actions', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.08, ease: 'power3.out', delay: 0.8 })
    }
  }, [])

  const go = useCallback((next: number) => {
    const n = (next + DISHES.length) % DISHES.length
    if (busy.current || n === index) return
    const dir = next > index || (index === DISHES.length - 1 && n === 0) ? 1 : -1
    const el = root.current!
    const plates = el.querySelectorAll<HTMLElement>('.mn-plate')
    const out = plates[index]
    const inn = plates[n]
    setIndex(n)
    if (reducedMotion()) {
      gsap.set(out, { autoAlpha: 0 })
      gsap.set(inn, { autoAlpha: 1, x: 0, y: 0, rotate: 0 })
      setShown(n)
      return
    }
    busy.current = true
    const stage = el.querySelector<HTMLElement>('.mn-stage')!
    const W = stage.offsetWidth
    const H = window.innerHeight
    arcTurn.current += 55 * dir
    const tl = gsap.timeline({ onComplete: () => void (busy.current = false) })
    // Out: title wipes away, card copy fades, plate swings off along an arc.
    tl.to('.mn-line', { clipPath: 'inset(0 0 0 100%)', duration: 0.4, stagger: 0.07, ease: 'power2.in' }, 0)
      .to('.mn-card__body, .mn-kicker', { autoAlpha: 0, y: -8, duration: 0.25 }, 0)
      .to(out, { x: -dir * W * 0.9, y: -H * 0.55, rotate: -dir * 160, duration: 0.95, ease: 'power2.in' }, 0.05)
      .set(out, { autoAlpha: 0 })
      .to('.mn-arc', { rotate: arcTurn.current, duration: 1.4, ease: 'power3.inOut' }, 0)
      // In: next plate swings down from the opposite corner, turning.
      .fromTo(inn, { autoAlpha: 1, x: dir * W * 0.9, y: -H * 0.6, rotate: dir * 170 }, { x: 0, y: 0, rotate: 0, duration: 1.15, ease: 'power3.out' }, 0.38)
      .call(() => setShown(n), [], 0.45)
      .fromTo('.mn-line', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.75, stagger: 0.1, ease: 'power3.out', immediateRender: false }, 0.75)
      .fromTo('.mn-card__body, .mn-kicker', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.05, immediateRender: false }, 0.95)
  }, [index])

  // Keyboard and swipe.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return
      if (e.key === 'ArrowRight') go(index + 1)
      if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, index])
  const swipe = useRef<{ x: number; y: number } | null>(null)

  const toggleLike = () => {
    const next = { ...liked, [dish.id]: !liked[dish.id] }
    setLiked(next)
    try {
      localStorage.setItem('sala.likes', JSON.stringify(next))
    } catch { /* storage unavailable */ }
  }

  return (
    <div className="mn" ref={root} style={{ ['--accent' as string]: DISHES[index].accent }}>
      <Dust className="mn-dust" density={0.7} />
      <Nav current="#/menu" />

      <main
        className="mn-main"
        onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const s = swipe.current
          swipe.current = null
          if (!s || e.pointerType === 'mouse') return
          const dx = e.clientX - s.x
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.3) go(index + (dx < 0 ? 1 : -1))
        }}
      >
        <ol className="mn-dots" aria-hidden="true">
          {DISHES.map((d, i) => <li key={d.id} className={i === index ? 'is-on' : ''} />)}
        </ol>

        <div className="mn-stage" aria-live="polite">
          <span className="mn-arc" aria-hidden="true" />
          <img className="mn-splash" src={`${import.meta.env.BASE_URL}assets/site/splash.webp`} alt="" aria-hidden="true" />
          {DISHES.map((d, i) => (
            <img key={d.id} className="mn-plate" src={d.image} alt={i === shown ? `${d.line1} ${d.line2}` : ''} aria-hidden={i !== shown} />
          ))}
        </div>

        <div className="mn-head">
          <p className="mn-kicker">#{pad(shown)} · {dish.category}</p>
          <h1 className="mn-title">
            <span className="mn-line mn-line--thin">{dish.line1}</span>
            <span className="mn-line mn-line--bold">{dish.line2}</span>
          </h1>
          <p className="mn-actions">
            <a href="#/sobre"><Icon name="play" size={16} /> Ver a sala</a>
            <a href="#/reservar"><Icon name="calendar" size={18} /> Reservar mesa</a>
          </p>
        </div>

        <aside className="mn-card" aria-label="Detalhes do prato">
          <div className="mn-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'overview'} onClick={() => setTab('overview')}>Visão geral</button>
            <button role="tab" aria-selected={tab === 'ingredients'} onClick={() => setTab('ingredients')}>Ingredientes</button>
          </div>
          <div className="mn-card__body">
            <p className="mn-badge"><span>{pad(shown)}</span><Icon name="fork" size={14} /></p>
            {tab === 'overview' ? (
              <>
                <p className="mn-chef">Cozinha SALA</p>
                <p className="mn-sub">{dish.category}</p>
                <p className="mn-text">{dish.text}</p>
              </>
            ) : (
              <ul className="mn-ingredients">{dish.ingredients.map((x) => <li key={x}>{x}</li>)}</ul>
            )}
            <p className="mn-like">
              <button onClick={toggleLike} aria-pressed={!!liked[dish.id]}>
                <Icon name="like" size={18} /> {liked[dish.id] ? 'Gostei' : 'Gosto'}
              </button>
            </p>
          </div>
        </aside>

        <nav className="mn-thumbs" aria-label="Pratos">
          <button className="mn-arrow" onClick={() => go(index - 1)} aria-label="Prato anterior">‹</button>
          <ul>
            {DISHES.map((d, i) => (
              <li key={d.id}>
                <button className={i === index ? 'is-on' : ''} onClick={() => go(i)} aria-current={i === index ? 'true' : undefined}>
                  <img src={d.image} alt="" loading="lazy" />
                  <span>{d.line1} {d.line2}</span>
                </button>
              </li>
            ))}
          </ul>
          <button className="mn-arrow" onClick={() => go(index + 1)} aria-label="Prato seguinte">›</button>
        </nav>

        <nav className="mn-dock" aria-label="Atalhos">
          <a className="is-on" href="#/menu" aria-label="Pratos"><Icon name="fork" /></a>
          <a href="#/reservar" aria-label="Reservar"><Icon name="calendar" /></a>
          <a href="#/sobre" aria-label="Sobre"><Icon name="book" /></a>
          <a className="mn-dock__round" href="#/" aria-label="Início"><Icon name="home" /></a>
        </nav>
      </main>
    </div>
  )
}
