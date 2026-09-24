import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ringBell, unlockAudio } from './audio/bell'
import { ReservationDialog } from './components/ReservationDialog'
import { CHAPTERS, type ChapterId } from './journey/data'
import { JourneyEngine, type EngineState } from './journey/engine'

const CAPTIONS: Partial<Record<ChapterId, string>> = {
  '02': 'A entrada',
  '03': 'Continue a descer para abrir a porta',
  '04': 'Seja bem-vindo',
  '05': 'Receção',
  '07': 'Por aqui',
  '08': 'A sala',
  '10': 'A mesa em destaque',
}

const initialState: EngineState = {
  chapter: '01',
  lookActive: false,
  tableMoment: false,
  end: false,
  intro: true,
  degraded: false,
}

function useReducedMotion() {
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  return reduced
}

export default function App() {
  const reduced = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const hotspotRef = useRef<HTMLButtonElement>(null)
  const progressRef = useRef<HTMLSpanElement>(null)
  const engineRef = useRef<JourneyEngine | null>(null)

  const [state, setState] = useState<EngineState>(initialState)
  const [ready, setReady] = useState(false)
  const [sound, setSound] = useState(false)
  const [reserveOpen, setReserveOpen] = useState(false)
  const [featured, setFeatured] = useState(false)
  const [lookHint, setLookHint] = useState(true)
  const soundRef = useRef(false)
  soundRef.current = sound

  const failKeys = useMemo(() => {
    const q = new URLSearchParams(location.search).get('falha')
    return q ? new Set(q.split(',')) : undefined
  }, [])

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
    const engine = new JourneyEngine({
      canvas: canvasRef.current!,
      track: trackRef.current!,
      reducedMotion: reduced,
      failKeys,
      onState: setState,
      onBell: () => {
        if (soundRef.current) ringBell()
      },
    })
    engine.hotspotEl = hotspotRef.current
    engine.progressEl = progressRef.current
    engine.stageEl = stageRef.current
    engineRef.current = engine
    // Test hook for automated checks: ?debug exposes the engine.
    if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __sala: JourneyEngine }).__sala = engine
    engine.start()
    const essential = engine.essentialKeys()
    essential.forEach((k, i) => engine.load(k, -10 + i))
    let done = false
    const reveal = () => {
      if (done) return
      done = true
      engine.prefetchEnabled = true
      setReady(true)
      engine.invalidate()
    }
    engine.store.whenSettled(essential).then(reveal)
    // Never hold the visitor on the loader: reveal with the fallback if slow.
    const t = setTimeout(reveal, 9000)
    return () => {
      clearTimeout(t)
      engine.destroy()
    }
  }, [reduced, failKeys])

  /* ------------------------------------------------------ look-around input */

  const drag = useRef<{ id: number; x: number; y: number; t: number; locked: boolean } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    if (!state.lookActive || e.button !== 0) return
    if ((e.target as HTMLElement).closest('button')) return
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, locked: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    const engine = engineRef.current
    if (!d || d.id !== e.pointerId || !engine) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.locked) {
      // Horizontal intent must be clear before the view turns; vertical
      // gestures are left to the browser, which keeps scrolling the page.
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2) return
      d.locked = true
      d.x = e.clientX
      d.t = e.timeStamp
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      engine.dragStart()
      setLookHint(false)
      return
    }
    engine.dragMove(dx, e.timeStamp - d.t)
    d.x = e.clientX
    d.y = e.clientY
    d.t = e.timeStamp
  }
  const onPointerEnd = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    if (d.locked) engineRef.current?.dragEnd()
    drag.current = null
  }

  // Trackpads and shift+wheel turn the view; vertical wheel still scrolls.
  useEffect(() => {
    const el = stageRef.current
    if (!el || !state.lookActive) return
    let acc = 0
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      e.preventDefault()
      acc += e.deltaX
      if (Math.abs(acc) > 60) {
        engineRef.current?.nudge(Math.sign(acc))
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
      if (reserveOpen || (e.target as HTMLElement).closest('input, textarea, select')) return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        engineRef.current?.nudge(e.key === 'ArrowLeft' ? -1 : 1)
        setLookHint(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.lookActive, reserveOpen])

  /* ------------------------------------------------------------- actions */

  const goChapter = useCallback((id: ChapterId) => {
    const e = engineRef.current
    if (!e) return
    void e.goTo(id === '09' ? e.offsetOfLook() : e.offsetOfChapter(id) + 2)
  }, [])

  const goTable = () => {
    const e = engineRef.current
    if (!e) return
    setLookHint(false)
    void e.goTo(e.offsetOfTable(), true)
  }

  const toggleSound = () => {
    if (!sound) unlockAudio()
    setSound(!sound)
  }

  const openReserve = (fromTable: boolean) => {
    setFeatured(fromTable)
    setReserveOpen(true)
  }

  const bell = () => {
    if (!sound) return
    ringBell()
  }

  const chapterIndex = CHAPTERS.findIndex((c) => c.id === state.chapter)
  const caption = CAPTIONS[state.chapter]

  return (
    <>
      <div className={`loader ${ready ? 'is-done' : ''}`} aria-hidden={ready} role="status">
        <span className="wordmark wordmark--large">SALA</span>
        <span className="loader__line" />
        <span className="sr-only">A carregar</span>
      </div>

      <header className="bar">
        <button className="wordmark" onClick={() => goChapter('01')} aria-label="SALA — voltar ao início">
          SALA
        </button>
        <div className="bar__actions">
          <button className="icon-btn" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Desligar som' : 'Ligar som'}>
            {sound ? (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
                <path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" stroke="currentColor" strokeWidth="1.4" fill="none" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
                <path d="M16.5 9.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            )}
          </button>
          <button className="btn btn--ghost" onClick={() => openReserve(false)}>
            Reservar
          </button>
        </div>
      </header>

      <nav className="progress" aria-label="Percurso">
        <span className="progress__rail" aria-hidden="true">
          <span className="progress__fill" ref={progressRef} />
        </span>
        <ol>
          {CHAPTERS.map((c, i) => (
            <li key={c.id}>
              <button
                className={i === chapterIndex ? 'is-current' : i < chapterIndex ? 'is-past' : ''}
                aria-current={i === chapterIndex ? 'step' : undefined}
                onClick={() => goChapter(c.id)}
                aria-label={`${c.id} — ${c.label}`}
                title={c.label}
              >
                <span aria-hidden="true" />
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
            <canvas ref={canvasRef} className="stage__canvas" role="img" aria-label={`SALA — ${CHAPTERS[chapterIndex]?.label ?? ''}`} />
            <div className="stage__shade" aria-hidden="true" />

            <button ref={hotspotRef} className="hotspot" data-visible="false" onClick={goTable} aria-label="Ver a mesa em destaque" tabIndex={state.lookActive ? 0 : -1}>
              <span aria-hidden="true" />
            </button>

            <div className={`intro ${state.intro && ready ? 'is-on' : ''}`} aria-hidden={!state.intro}>
              <h1 className="intro__title">SALA</h1>
              <p className="intro__sub">Restaurante · Maputo</p>
              <p className="intro__hint">Desça para entrar</p>
            </div>

            {caption && !state.tableMoment && (
              <p className="caption" key={state.chapter}>
                <span className="caption__num">{state.chapter}</span>
                {caption}
              </p>
            )}

            {state.chapter === '06' && (
              <div className="bell">
                <p className="caption caption--static">
                  <span className="caption__num">06</span>Anuncie a sua chegada
                </p>
                <button className="btn btn--ghost" onClick={sound ? bell : toggleSound}>
                  {sound ? 'Tocar a campainha' : 'Ligar som para a campainha'}
                </button>
              </div>
            )}

            {state.lookActive && (
              <div className="look">
                {lookHint && (
                  <p className="look__hint" aria-live="polite">
                    <span className="look__gesture" aria-hidden="true" />
                    Deslize para explorar
                  </p>
                )}
                <div className="look__controls">
                  <button className="icon-btn" onClick={() => { engineRef.current?.nudge(-1); setLookHint(false) }} aria-label="Olhar para a esquerda">
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M14.5 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.4" fill="none" /></svg>
                  </button>
                  <button className="look__table" onClick={goTable}>Ir para a mesa em destaque</button>
                  <button className="icon-btn" onClick={() => { engineRef.current?.nudge(1); setLookHint(false) }} aria-label="Olhar para a direita">
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9.5 6l6 6-6 6" stroke="currentColor" strokeWidth="1.4" fill="none" /></svg>
                  </button>
                </div>
                <p className="look__down">Ou continue a descer</p>
              </div>
            )}

            {state.tableMoment && (
              <div className="panel" role="region" aria-label="Mesa em destaque">
                <p className="panel__eyebrow">A mesa em destaque</p>
                <p className="panel__text">Reserve o seu lugar na SALA.</p>
                <button className="btn btn--solid" onClick={() => openReserve(true)}>
                  Pedir reserva
                </button>
              </div>
            )}

            {state.end && (
              <div className="panel panel--end" role="region" aria-label="Fim do percurso">
                <p className="panel__title">SALA</p>
                <p className="panel__text">Restaurante · Maputo</p>
                <div className="panel__actions">
                  <button className="btn btn--solid" onClick={() => openReserve(false)}>
                    Reservar mesa
                  </button>
                  <button className="btn btn--ghost" onClick={() => goChapter('01')}>
                    Voltar ao início
                  </button>
                </div>
              </div>
            )}

            {state.degraded && (
              <p className="notice" role="status">
                Algumas imagens não carregaram. Pode continuar o percurso ou reservar.
              </p>
            )}
          </div>
        </div>
      </main>

      <ReservationDialog open={reserveOpen} featured={featured} onClose={() => setReserveOpen(false)} />
    </>
  )
}
