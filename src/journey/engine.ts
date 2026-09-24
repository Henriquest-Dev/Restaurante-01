import { buildTimeline, frameKey, frameUrl, LOOK, type ChapterId, type Step, type Timeline } from './data'
import { FrameStore } from './frames'
import { dissolve, drawLayers, place, windowPos, type Layer } from './renderer'

export interface EngineState {
  chapter: ChapterId
  /** The look-around view is the dominant image. */
  lookActive: boolean
  /** Resting on the featured table (last frame of chapter 10). */
  tableMoment: boolean
  /** Resting on the final wide view. */
  end: boolean
  /** At the very start, before the first step dissolves. */
  intro: boolean
  /** Some frame failed to load. */
  degraded: boolean
}

export interface EngineOptions {
  canvas: HTMLCanvasElement
  track: HTMLElement
  reducedMotion: boolean
  onState: (s: EngineState) => void
  onBell: () => void
  /** Test hook: frame keys whose URL is deliberately broken. */
  failKeys?: Set<string>
}

type Weighted = { key: string; w: number; focalX: number; zoom: number }

const mod = (n: number, m: number) => ((n % m) + m) % m

export class JourneyEngine {
  readonly timeline: Timeline = buildTimeline()
  readonly store = new FrameStore(4)
  private ctx: CanvasRenderingContext2D
  private unit = 1
  private lastW = 0
  private lastH = 0
  private W = 0
  private H = 0
  private raf = 0
  private dirty = true
  private lastTime = 0
  private state: EngineState | null = null
  private lastDominant = ''
  private lastDrawn: Layer[] = []

  /** Look-around angle in frames (0 = frame 1). */
  private angle = 0
  private velocity = 0
  private dragging = false
  private snapTarget: number | null = null
  lookInteracted = false
  /** Until the opening frames are shown, only they are downloaded. */
  prefetchEnabled = false

  hotspotEl: HTMLElement | null = null
  progressEl: HTMLElement | null = null
  stageEl: HTMLElement | null = null

  private cleanup: (() => void)[] = []

  constructor(private opts: EngineOptions) {
    this.ctx = opts.canvas.getContext('2d', { alpha: false })!
  }

  /* ------------------------------------------------------------ lifecycle */

  start() {
    this.measure(true)
    const onScroll = () => this.invalidate()
    const onResize = () => this.measure(false)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    this.cleanup.push(
      () => window.removeEventListener('scroll', onScroll),
      () => window.removeEventListener('resize', onResize),
      this.store.onChange((key) => {
        if (this.store.failed(key)) this.anyFailed = true
        this.invalidate()
      }),
    )
    const tick = (t: number) => {
      const dt = this.lastTime ? Math.min(64, t - this.lastTime) : 16
      this.lastTime = t
      this.animateLook(dt)
      if (this.dirty) {
        this.dirty = false
        this.render()
      }
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.cleanup.forEach((f) => f())
  }

  invalidate() {
    this.dirty = true
  }

  /** Keys that must be ready before the experience is revealed. */
  essentialKeys() {
    return this.timeline.steps.slice(0, 3).flatMap((s) => (s.kind === 'frame' ? [s.key] : []))
  }

  private url(key: string) {
    const [ch, f] = key.split('-')
    const u = frameUrl(ch, Number(f))
    return this.opts.failKeys?.has(key) ? u.replace('.webp', '.missing.webp') : u
  }

  load(key: string, priority: number) {
    this.store.request(key, this.url(key), priority)
  }

  /* --------------------------------------------------------------- layout */

  private measure(initial: boolean) {
    const w = window.innerWidth
    const h = window.innerHeight
    // Mobile browsers resize the viewport as their toolbars show and hide.
    // Only re-derive the scroll unit for real layout changes, so the page
    // does not jump while the visitor is scrolling.
    const relayout = initial || w !== this.lastW || Math.abs(h - this.lastH) > this.lastH * 0.25
    if (relayout) {
      const p = initial ? 0 : this.position()
      this.lastW = w
      this.lastH = h
      this.unit = h
      this.opts.track.style.height = `${Math.ceil(this.timeline.total * this.unit + h)}px`
      if (!initial) window.scrollTo(0, p * this.unit)
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const c = this.opts.canvas
    this.W = c.clientWidth || w
    this.H = c.clientHeight || h
    c.width = Math.round(this.W * dpr)
    c.height = Math.round(this.H * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.invalidate()
  }

  /** Scroll position in viewport heights. */
  position() {
    return Math.max(0, Math.min(this.timeline.total, window.scrollY / this.unit))
  }

  private locate(p: number) {
    const { starts, steps } = this.timeline
    let i = 0
    while (i < steps.length - 1 && starts[i + 1] <= p) i++
    const f = Math.min(1, (p - starts[i]) / steps[i].len)
    return { i, f }
  }

  /* ------------------------------------------------------------ rendering */

  private lookFrames(): Weighted[] {
    const a = Math.floor(this.angle)
    const u = LOOK.wrap ? this.angle - a : 0
    const t = this.opts.reducedMotion ? (u >= 0.5 ? 1 : 0) : dissolve(u, 0.5, 0.5)
    const fa = mod(a, LOOK.count) + 1
    const fb = mod(a + 1, LOOK.count) + 1
    const focal = (f: number) => LOOK.focalByFrame[f] ?? LOOK.focalX
    return [
      { key: frameKey('09', fa), w: 1 - t, focalX: focal(fa), zoom: 0 },
      { key: frameKey('09', fb), w: t, focalX: focal(fb), zoom: 0 },
    ]
  }

  private stepFrames(s: Step): Weighted[] {
    return s.kind === 'look' ? this.lookFrames() : [{ key: s.key, w: 1, focalX: s.focalX, zoom: s.zoom }]
  }

  /** Nearest already-decoded frame of the timeline, for fast scrolling. */
  private nearestReady(i: number): HTMLImageElement | null {
    const { steps } = this.timeline
    for (let d = 0; d < 8; d++) {
      for (const j of [i - d, i + d]) {
        const s = steps[j]
        if (!s) continue
        for (const wf of this.stepFrames(s)) {
          const img = this.store.get(wf.key)
          if (img) return img
        }
      }
    }
    return null
  }

  private prefetch(i: number) {
    const { steps } = this.timeline
    for (let d = -3; d <= 10; d++) {
      const s = steps[i + d]
      if (!s) continue
      const pr = d < 0 ? -d * 2 : d
      if (s.kind === 'frame') this.load(s.key, pr)
      else {
        for (let k = 0; k < LOOK.count; k++) {
          const dist = Math.min(mod(k - this.angle, LOOK.count), mod(this.angle - k, LOOK.count))
          this.load(frameKey('09', k + 1), pr + dist)
        }
      }
    }
  }

  private render() {
    const { steps } = this.timeline
    const reduced = this.opts.reducedMotion
    const p = this.position()
    const { i, f } = this.locate(p)
    const A = steps[i]
    const B = steps[i + 1]
    if (this.prefetchEnabled) this.prefetch(i)

    const t = B ? (reduced ? (f >= A.blendAt ? 1 : 0) : dissolve(f, A.blendAt, A.blend)) : 0
    const z = (s: Weighted) => (reduced ? 0 : s.zoom)
    // Opacity of the outgoing and incoming step.
    let aA = 1
    let aB = t
    if (B && !reduced && A.transition === 'dip') {
      // Never overlap: fade the outgoing frame down, then the next one up.
      const u = windowPos(f, A.blendAt, A.blend)
      aA = u < 0.5 ? 1 - u * 1.7 : 0
      aB = u < 0.5 ? 0 : 0.15 + (u - 0.5) * 1.7
    }

    const layers: Layer[] = []
    const push = (w: Weighted, alpha: number, scale: number) => {
      const img = this.store.get(w.key)
      if (img && alpha > 0) layers.push({ img, alpha, scale, focalX: w.focalX })
    }
    // Outgoing step: push in slightly from 1+z to 1+2z.
    const fa = this.stepFrames(A)
    fa.forEach((w, k) => push(w, aA * (k === 0 ? 1 : w.w), 1 + z(w) + z(w) * f))
    if (!layers.length && aA > 0) {
      const img = this.nearestReady(i)
      if (img) layers.push({ img, alpha: 1, scale: 1, focalX: 0.5 })
      else if (this.lastDrawn.length) layers.push(...this.lastDrawn.slice(0, 1).map((l) => ({ ...l, alpha: 1 })))
    }
    // Incoming step: from 1 to 1+z, so it continues seamlessly as step A.
    if (B && aB > 0) {
      const fb = this.stepFrames(B)
      fb.forEach((w, k) => push(w, k === 0 ? aB : aB * w.w, 1 + z(w) * f))
    }

    drawLayers(this.ctx, this.W, this.H, layers, aA < 1 && aB < 1)
    if (layers.length && aA === 1) this.lastDrawn = layers

    // Which single frame dominates the screen right now.
    const dominantStep = t >= 0.5 && B ? B : A
    const dominantFrames = this.stepFrames(dominantStep)
    const dom = dominantFrames.reduce((a, b) => (b.w > a.w ? b : a))
    if (this.lastDominant === '06-4' && dom.key === '06-5') this.opts.onBell()
    this.lastDominant = dom.key

    // Look-around presence and hotspot.
    const lookWeight = A.kind === 'look' ? 1 - t : B?.kind === 'look' ? t : 0
    this.updateHotspot(lookWeight)

    if (this.progressEl) this.progressEl.style.transform = `scaleY(${p / this.timeline.total})`

    const failedAny = this.anyFailed
    this.emit({
      chapter: dominantStep.chapter,
      lookActive: lookWeight > 0.5,
      tableMoment: i === this.timeline.tableIndex && t < 0.3,
      end: i === steps.length - 1 && f > 0.25,
      intro: i === 0 && f < 0.45,
      degraded: failedAny,
    })
  }

  private anyFailed = false

  private updateHotspot(lookWeight: number) {
    const el = this.hotspotEl
    if (!el) return
    const frames = this.lookFrames()
    const dom = frames[0].w >= frames[1].w ? frames[0] : frames[1]
    const n = Number(dom.key.split('-')[1])
    const spot = LOOK.hotspots[n]
    const img = this.store.get(dom.key)
    const visible = lookWeight > 0.85 && dom.w > 0.85 && spot && img && !this.dragging
    if (visible) {
      const pl = place(img, this.W, this.H, 1, dom.focalX)
      const x = pl.x + spot.x * pl.w
      const y = pl.y + spot.y * pl.h
      if (x > 28 && x < this.W - 28 && y > 80 && y < this.H - 80) {
        el.style.transform = `translate(${x}px, ${y}px)`
        el.dataset.visible = 'true'
        return
      }
    }
    el.dataset.visible = 'false'
  }

  private emit(s: EngineState) {
    const prev = this.state
    if (
      prev &&
      prev.chapter === s.chapter &&
      prev.lookActive === s.lookActive &&
      prev.tableMoment === s.tableMoment &&
      prev.end === s.end &&
      prev.intro === s.intro &&
      prev.degraded === s.degraded
    )
      return
    this.state = s
    this.opts.onState(s)
  }

  /* --------------------------------------------------------- look-around */

  /** px of horizontal drag per viewing direction. */
  private pxPerFrame() {
    return Math.max(56, Math.min(150, this.W * 0.2))
  }

  dragStart() {
    this.dragging = true
    this.velocity = 0
    this.snapTarget = null
  }

  dragMove(dx: number, dt: number) {
    const d = -dx / this.pxPerFrame()
    this.setAngle(this.angle + d)
    if (dt > 0) this.velocity = this.velocity * 0.6 + (d / dt) * 0.4
    this.lookInteracted = true
  }

  dragEnd() {
    this.dragging = false
    if (this.opts.reducedMotion) {
      this.velocity = 0
      this.snapTarget = Math.round(this.angle)
    }
    this.invalidate()
  }

  /** Step the view by whole directions (keyboard / buttons). */
  nudge(dir: number) {
    this.lookInteracted = true
    const base = this.snapTarget ?? Math.round(this.angle)
    this.velocity = 0
    this.snapTarget = this.clampAngle(base + dir)
    if (this.opts.reducedMotion) this.setAngle(this.snapTarget)
    this.invalidate()
  }

  private clampAngle(a: number) {
    return LOOK.wrap ? a : Math.max(0, Math.min(LOOK.count - 1, a))
  }

  private setAngle(a: number) {
    this.angle = this.clampAngle(a)
    if (LOOK.wrap && Math.abs(this.angle) > LOOK.count * 4) {
      const m = mod(this.angle, LOOK.count)
      if (this.snapTarget !== null) this.snapTarget += m - this.angle
      this.angle = m
    }
    this.invalidate()
  }

  private animateLook(dt: number) {
    if (this.dragging) return
    if (Math.abs(this.velocity) > 0.0004) {
      this.setAngle(this.angle + this.velocity * dt)
      this.velocity *= Math.pow(0.9, dt / 16)
      if (Math.abs(this.velocity) <= 0.0004) {
        this.velocity = 0
        this.snapTarget = Math.round(this.angle)
      }
      return
    }
    if (this.snapTarget === null) {
      // Never rest between two directions: that would show a double image.
      if (Math.abs(this.angle - Math.round(this.angle)) > 0.001) this.snapTarget = Math.round(this.angle)
      else return
    }
    const d = this.snapTarget - this.angle
    if (Math.abs(d) < 0.002) {
      this.setAngle(this.snapTarget)
      this.snapTarget = null
    } else {
      this.setAngle(this.angle + d * Math.min(1, dt / 110))
    }
  }

  /* ----------------------------------------------------------- navigation */

  offsetOfChapter(id: ChapterId) {
    return this.timeline.chapterStart[id] * this.unit
  }

  offsetOfTable() {
    const i = this.timeline.tableIndex
    return (this.timeline.starts[i] + 0.2 * this.timeline.steps[i].len) * this.unit
  }

  offsetOfLook() {
    const i = this.timeline.lookIndex
    return (this.timeline.starts[i] + 0.15 * this.timeline.steps[i].len) * this.unit
  }

  /**
   * Short distances are scrolled so the frames play; long jumps preload
   * the destination, fade briefly and jump, instead of flashing through
   * dozens of frames.
   */
  async goTo(top: number, play = false) {
    const target = Math.max(0, top)
    const distance = Math.abs(target - window.scrollY) / this.unit
    const reduced = this.opts.reducedMotion
    if ((play || distance < 3.2) && !reduced) {
      window.scrollTo({ top: target, behavior: 'smooth' })
      return
    }
    const { i } = this.locate(target / this.unit)
    const keys: string[] = []
    for (let d = 0; d <= 2; d++) {
      const s = this.timeline.steps[i + d]
      if (s) this.stepFrames(s).forEach((w) => keys.push(w.key))
    }
    keys.forEach((k) => this.load(k, -1))
    await Promise.race([this.store.whenSettled(keys), new Promise((r) => setTimeout(r, 1500))])
    const stage = this.stageEl
    if (stage && !reduced) {
      stage.classList.add('is-cutting')
      await new Promise((r) => setTimeout(r, 180))
    }
    window.scrollTo({ top: target, behavior: 'instant' as ScrollBehavior })
    this.invalidate()
    if (stage && !reduced) requestAnimationFrame(() => stage.classList.remove('is-cutting'))
  }
}
