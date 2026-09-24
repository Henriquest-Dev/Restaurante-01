import { useCallback, useEffect, useRef, useState } from 'react'
import { ringBell, unlockAudio } from './audio/bell'
import { ReservationDialog } from './components/ReservationDialog'
import { CHAPTERS, manifestUrl, type ChapterId, type Manifest } from './journey/data'
import { Player, type PlayerState } from './journey/player'

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
  const progressRef = useRef<HTMLSpanElement>(null)
  const titleRefs = useRef(new Map<ChapterId, HTMLElement>())
  const playerRef = useRef<Player | null>(null)

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
    player.progressEl = progressRef.current
    player.stageEl = stageRef.current
    player.titleEls = titleRefs.current
    playerRef.current = player
    // Test hook for automated checks: ?debug exposes the player.
    if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __sala: Player }).__sala = player
    player.start()
    // Never hold the visitor on the loader; the photographs stand in.
    const t = setTimeout(reveal, 7000)
    return () => {
      clearTimeout(t)
      player.destroy()
    }
  }, [manifest, reduced])

  useEffect(() => {
    if (loadError) setReady(true)
  }, [loadError])

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
    if (d.locked) playerRef.current?.dragEnd()
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
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

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

  const chapterIndex = CHAPTERS.findIndex((c) => c.id === state.chapter)
  const chapter = CHAPTERS[chapterIndex]

  return (
    <>
      <div className={`loader ${ready ? 'is-done' : ''}`} aria-hidden={ready}>
        <span className="loader__mark">SALA</span>
        <span className="loader__line" />
        <span className="sr-only" role="status">A carregar</span>
      </div>

      <header className="bar">
        <button className="bar__mark" onClick={() => goChapter('01')} aria-label="SALA — voltar ao início">
          SALA
        </button>
        <div className="bar__actions">
          <button className={`sound ${sound ? 'is-on' : ''}`} onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Desligar som' : 'Ligar som'}>
            <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
          </button>
          <button className="pill" onClick={() => openReserve(false)}>
            Reservar
          </button>
          <button className={`burger ${menuOpen ? 'is-open' : ''}`} onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="menu" aria-label={menuOpen ? 'Fechar percurso' : 'Abrir percurso'}>
            <span aria-hidden="true" /><span aria-hidden="true" />
          </button>
        </div>
      </header>

      <nav id="menu" className={`menu ${menuOpen ? 'is-open' : ''}`} aria-label="Percurso" aria-hidden={!menuOpen} inert={!menuOpen}>
        <ol>
          {CHAPTERS.map((c, i) => (
            <li key={c.id} style={{ transitionDelay: menuOpen ? `${80 + i * 35}ms` : '0ms' }}>
              <button onClick={() => goChapter(c.id)} aria-current={i === chapterIndex ? 'step' : undefined}>
                <span className="menu__num">{c.id}</span>
                <span className="menu__label">{c.label}</span>
              </button>
            </li>
          ))}
        </ol>
        <button className="menu__reserve" onClick={() => openReserve(false)}>Reservar mesa</button>
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

            <div className={`intro ${state.intro && ready ? 'is-on' : ''}`} aria-hidden={!state.intro}>
              <p className="intro__eyebrow">Maputo</p>
              <h1 className="intro__title">SALA</h1>
              <p className="intro__sub">Restaurante</p>
              <p className="intro__hint">
                <span>Deslize para entrar</span>
                <i aria-hidden="true" />
              </p>
            </div>

            {CHAPTERS.filter((c) => c.title).map((c) => (
              <div
                key={c.id}
                className="title"
                ref={(el) => {
                  if (el) titleRefs.current.set(c.id, el)
                  else titleRefs.current.delete(c.id)
                }}
                style={{ opacity: 0, visibility: 'hidden' }}
                aria-hidden={state.chapter !== c.id}
              >
                <span className="title__num">{c.id} <em>/ 11</em></span>
                <h2 className="title__text">{c.title}</h2>
                {c.line && <p className="title__line">{c.line}</p>}
              </div>
            ))}

            {state.chapter === '06' && (
              <button className="pill pill--float bell-btn" onClick={sound ? ringBell : toggleSound}>
                {sound ? 'Tocar a campainha' : 'Ligar o som'}
              </button>
            )}

            <button ref={hotspotRef} className="hotspot" data-visible="false" onClick={goTable} aria-label="Ver a mesa em destaque" tabIndex={state.lookActive ? 0 : -1}>
              <span className="hotspot__dot" aria-hidden="true" />
              <span className="hotspot__label">A mesa</span>
            </button>

            {state.lookActive && (
              <div className="look">
                <p className={`look__hint ${lookHint ? '' : 'is-gone'}`} aria-live="polite">
                  <span className="look__hand" aria-hidden="true" />
                  Deslize para olhar em volta
                </p>
                <div className="look__controls">
                  <button className="round" onClick={() => { playerRef.current?.nudge(-1); setLookHint(false) }} aria-label="Olhar para a esquerda">
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M14.5 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.3" fill="none" /></svg>
                  </button>
                  <button className="pill" onClick={goTable}>A mesa em destaque</button>
                  <button className="round" onClick={() => { playerRef.current?.nudge(1); setLookHint(false) }} aria-label="Olhar para a direita">
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9.5 6l6 6-6 6" stroke="currentColor" strokeWidth="1.3" fill="none" /></svg>
                  </button>
                </div>
              </div>
            )}

            {state.tableMoment && (
              <div className="card" role="region" aria-label="Mesa em destaque">
                <p className="card__eyebrow">10 — A mesa em destaque</p>
                <p className="card__title">O seu lugar<br />na SALA.</p>
                <button className="pill pill--solid" onClick={() => openReserve(true)}>
                  Pedir reserva
                </button>
              </div>
            )}

            {state.end && (
              <div className="finale" role="region" aria-label="Fim do percurso">
                <p className="finale__mark">SALA</p>
                <p className="finale__sub">Restaurante · Maputo</p>
                <div className="finale__actions">
                  <button className="pill pill--solid" onClick={() => openReserve(false)}>
                    Reservar mesa
                  </button>
                  <button className="pill" onClick={() => goChapter('01')}>
                    Voltar ao início
                  </button>
                </div>
              </div>
            )}

            {(state.degraded || loadError) && (
              <p className="notice" role="status">
                Parte da experiência não carregou. Pode continuar ou reservar.
              </p>
            )}

            <div className="foot" aria-hidden="true">
              <span className="foot__label">
                <b>{chapter?.id}</b> {chapter?.label}
              </span>
              <span className="foot__rail"><span ref={progressRef} /></span>
              <span className="foot__total">11</span>
            </div>
          </div>
        </div>
      </main>

      <ReservationDialog open={reserveOpen} featured={featured} onClose={() => setReserveOpen(false)} />
    </>
  )
}
