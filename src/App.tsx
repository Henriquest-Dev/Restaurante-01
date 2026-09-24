import { gsap } from 'gsap'
import { SplitText } from 'gsap/SplitText'
import Lenis from 'lenis'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ringBell, unlockAudio } from './audio/bell'
import { ChapterCard } from './components/ChapterCard'
import { Cursor } from './components/Cursor'
import { ReservationDialog } from './components/ReservationDialog'
import { CHAPTERS, manifestUrl, type ChapterId, type Manifest } from './journey/data'
import { Player, type PlayerState } from './journey/player'

gsap.registerPlugin(SplitText)

const initialState: PlayerState = {
  chapter: '01',
  lookActive: false,
  tableMoment: false,
  end: false,
  intro: true,
  degraded: false,
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function App() {
  const [reduced] = useState(reducedMotion)
  const mediaRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const hotspotRef = useRef<HTMLButtonElement>(null)
  const letterboxRef = useRef<HTMLDivElement>(null)
  const introRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)
  const lenisRef = useRef<Lenis | null>(null)
  const scrubs = useRef(new Map<ChapterId, (q: number, o: number) => void>())

  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [state, setState] = useState<PlayerState>(initialState)
  const [ready, setReady] = useState(false)
  const [sound, setSound] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reserveOpen, setReserveOpen] = useState(false)
  const [featured, setFeatured] = useState(false)
  const [lookHint, setLookHint] = useState(true)
  const soundRef = useRef(false)
  soundRef.current = sound

  useEffect(() => {
    fetch(manifestUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setManifest, () => setLoadError(true))
  }, [])

  const register = useCallback((id: ChapterId, scrub: ((q: number, o: number) => void) | null) => {
    if (scrub) scrubs.current.set(id, scrub)
    else scrubs.current.delete(id)
  }, [])

  useEffect(() => {
    if (!manifest) return
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
    let done = false
    const reveal = () => {
      if (done) return
      done = true
      setReady(true)
    }
    const player = new Player({
      media: mediaRef.current!,
      track: trackRef.current!,
      manifest,
      reducedMotion: reduced,
      onState: setState,
      onBell: () => {
        if (soundRef.current) ringBell()
      },
      onFirstFrame: reveal,
    })
    player.hotspotEl = hotspotRef.current
    player.stageEl = stageRef.current
    player.letterboxEl = letterboxRef.current
    player.titleScrub = scrubs.current

    // Inertial wheel scrolling on desktop; touch keeps the native momentum.
    let lenis: Lenis | null = null
    let lenisRaf = 0
    if (!reduced && window.matchMedia('(pointer: fine)').matches) {
      lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true })
      lenisRef.current = lenis
      const loop = (t: number) => {
        lenis!.raf(t)
        lenisRaf = requestAnimationFrame(loop)
      }
      lenisRaf = requestAnimationFrame(loop)
      player.smoothing = 35
      player.scroller = (top, smooth) =>
        lenis!.scrollTo(top, smooth ? { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 3) } : { immediate: true, force: true })
    }

    playerRef.current = player
    // Test hook for automated checks: ?debug exposes the player.
    if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __sala: Player }).__sala = player
    player.start()
    // Never hold the visitor on black; the photographs stand in.
    const t = setTimeout(reveal, 7000)
    return () => {
      clearTimeout(t)
      cancelAnimationFrame(lenisRaf)
      lenis?.destroy()
      lenisRef.current = null
      player.destroy()
    }
  }, [manifest, reduced])

  useEffect(() => {
    if (loadError) setReady(true)
  }, [loadError])

  // Opening title: the letters of SALA surface from the dark, once.
  useLayoutEffect(() => {
    if (!ready || !introRef.current) return
    const root = introRef.current
    const split = SplitText.create(root.querySelector('.intro__title')!, { type: 'chars', charsClass: 'char' })
    const tl = gsap.timeline({ delay: 0.25 })
    if (reduced) {
      tl.set(root, { autoAlpha: 1 })
    } else {
      tl.set(root, { autoAlpha: 1 })
        .fromTo(split.chars, { autoAlpha: 0, filter: 'blur(14px)', y: 18 }, { autoAlpha: 1, filter: 'blur(0px)', y: 0, duration: 2.2, stagger: 0.18, ease: 'power3.out' })
        .fromTo(root.querySelectorAll('.intro__meta, .intro__hint'), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 1.4, stagger: 0.25, ease: 'power2.out' }, '-=1.2')
    }
    return () => {
      tl.kill()
      split.revert()
    }
  }, [ready, reduced])

  /* ------------------------------------------------------ look-around input */

  const drag = useRef<{ id: number; x: number; y: number; t: number; locked: boolean } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    if (!state.lookActive || e.button !== 0) return
    if ((e.target as HTMLElement).closest('button, a')) return
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, locked: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    const player = playerRef.current
    if (!d || d.id !== e.pointerId || !player) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.locked) {
      // Only a clearly horizontal gesture turns the view; anything else is
      // left to the browser, which keeps scrolling the page.
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2) return
      d.locked = true
      d.x = e.clientX
      d.t = e.timeStamp
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      lenisRef.current?.stop()
      player.dragStart()
      setLookHint(false)
      return
    }
    player.dragMove(dx, e.timeStamp - d.t)
    d.x = e.clientX
    d.t = e.timeStamp
  }
  const onPointerEnd = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    if (d.locked) {
      playerRef.current?.dragEnd()
      lenisRef.current?.start()
    }
    drag.current = null
  }

  useEffect(() => {
    const el = stageRef.current
    if (!el || !state.lookActive) return
    let acc = 0
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      e.preventDefault()
      acc += e.deltaX
      if (Math.abs(acc) > 50) {
        playerRef.current?.nudge(Math.sign(acc))
        setLookHint(false)
        acc = 0
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [state.lookActive])

  useEffect(() => {
    if (!state.lookActive) return
    const onKey = (e: KeyboardEvent) => {
      if (reserveOpen || menuOpen || (e.target as HTMLElement).closest('input, textarea, select')) return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        playerRef.current?.nudge(e.key === 'ArrowLeft' ? -1 : 1)
        setLookHint(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.lookActive, reserveOpen, menuOpen])

  useEffect(() => {
    const l = lenisRef.current
    if (menuOpen || reserveOpen) l?.stop()
    else l?.start()
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen, reserveOpen])

  /* ------------------------------------------------------------- actions */

  const goChapter = useCallback((id: ChapterId) => {
    setMenuOpen(false)
    const p = playerRef.current
    if (p) void p.goTo(p.offsetOf(id))
  }, [])

  const goTable = () => {
    const p = playerRef.current
    if (!p) return
    setLookHint(false)
    void p.goTo(p.offsetOfTable(), true)
  }

  const toggleSound = () => {
    if (!sound) unlockAudio()
    setSound(!sound)
  }

  const openReserve = (fromTable: boolean) => {
    setMenuOpen(false)
    setFeatured(fromTable)
    setReserveOpen(true)
  }

  const chapter = CHAPTERS.find((c) => c.id === state.chapter)

  return (
    <>
      <div className={`blackout ${ready ? 'is-done' : ''}`} aria-hidden={ready}>
        <span className="sr-only" role="status">A carregar</span>
      </div>

      <header className={`bar ${ready ? 'is-on' : ''}`}>
        <button className="bar__mark" onClick={() => goChapter('01')} aria-label="SALA — voltar ao início">
          SALA
        </button>
        <nav className="bar__links" aria-label="Ações">
          <button className="link" onClick={toggleSound} aria-pressed={sound}>
            Som <span className="link__state">{sound ? 'ligado' : 'desligado'}</span>
          </button>
          <button className="link" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="menu">
            {menuOpen ? 'Fechar' : 'Capítulos'}
          </button>
          <button className="link link--accent" onClick={() => openReserve(false)}>
            Reservar
          </button>
        </nav>
      </header>

      <nav id="menu" className={`menu ${menuOpen ? 'is-open' : ''}`} aria-label="Capítulos" aria-hidden={!menuOpen} inert={!menuOpen}>
        <ol>
          {CHAPTERS.map((c, i) => (
            <li key={c.id} style={{ transitionDelay: menuOpen ? `${120 + i * 40}ms` : '0ms' }}>
              <button onClick={() => goChapter(c.id)} aria-current={c.id === state.chapter ? 'step' : undefined}>
                <span className="menu__num">{c.numeral}</span>
                <span className="menu__label">{c.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <main>
        <div className="track" ref={trackRef}>
          <div
            className={`stage ${state.lookActive ? 'is-look' : ''}`}
            ref={stageRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
          >
            <div className="media" ref={mediaRef} role="img" aria-label={`SALA — ${chapter?.label ?? ''}`} />
            <div className="grain" aria-hidden="true" />
            <div className="shade" aria-hidden="true" />

            <div className={`intro ${state.intro ? '' : 'is-gone'}`}>
              <div className="intro__inner" ref={introRef} style={{ visibility: 'hidden' }}>
                <p className="intro__meta">Maputo</p>
                <h1 className="intro__title">SALA</h1>
                <p className="intro__meta">Restaurante</p>
                <p className="intro__hint">Desça para entrar</p>
              </div>
            </div>

            {CHAPTERS.filter((c) => c.title).map((c) => (
              <ChapterCard key={c.id} chapter={c} register={register} />
            ))}

            {state.chapter === '06' && (
              <button className="link link--float bell-link" onClick={sound ? ringBell : toggleSound}>
                {sound ? 'Tocar a campainha' : 'Ligar o som da campainha'}
              </button>
            )}

            <button ref={hotspotRef} className="hotspot" data-visible="false" onClick={goTable} aria-label="Ver a mesa em destaque" tabIndex={state.lookActive ? 0 : -1}>
              <span className="hotspot__dot" aria-hidden="true" />
              <span className="hotspot__label">A mesa em destaque</span>
            </button>

            {state.lookActive && (
              <div className="look">
                <p className="look__kicker">Capítulo IX</p>
                <p className={`look__hint ${lookHint ? '' : 'is-gone'}`}>Deslize para olhar em volta</p>
                <p className="look__after">ou continue a descer</p>
                <button className="look__edge look__edge--l" onClick={() => { playerRef.current?.nudge(-1); setLookHint(false) }} aria-label="Olhar para a esquerda" />
                <button className="look__edge look__edge--r" onClick={() => { playerRef.current?.nudge(1); setLookHint(false) }} aria-label="Olhar para a direita" />
              </div>
            )}

            {state.tableMoment && (
              <div className="cta" role="region" aria-label="Mesa em destaque">
                <button className="cta__link" onClick={() => openReserve(true)}>
                  Pedir esta mesa
                </button>
              </div>
            )}

            {state.end && (
              <div className="credits" role="region" aria-label="Fim">
                <p className="credits__mark">SALA</p>
                <p className="credits__meta">Restaurante · Maputo</p>
                <div className="credits__links">
                  <button className="cta__link" onClick={() => openReserve(false)}>Reservar mesa</button>
                  <button className="link" onClick={() => goChapter('01')}>Recomeçar</button>
                </div>
              </div>
            )}

            {(state.degraded || loadError) && (
              <p className="notice" role="status">Parte da experiência não carregou. Pode continuar ou reservar.</p>
            )}

            <div className="letterbox" ref={letterboxRef} aria-hidden="true">
              <span />
              <span />
            </div>
          </div>
        </div>
      </main>

      <Cursor active={state.lookActive && !reserveOpen && !menuOpen} label="Arrastar" />
      <ReservationDialog open={reserveOpen} featured={featured} onClose={() => setReserveOpen(false)} />
    </>
  )
}
