import { BELL_AT, buildTimeline, CHAPTERS, frameUrl, type ChapterId, type Manifest, type Segment, type Timeline, type VariantName } from './data'
import { SequenceStore } from './sequence'

export interface PlayerState {
  chapter: ChapterId
  tableMoment: boolean
  end: boolean
  intro: boolean
  degraded: boolean
}

export interface PlayerOptions {
  canvas: HTMLCanvasElement
  track: HTMLElement
  manifest: Manifest
  reducedMotion: boolean
  onState: (s: PlayerState) => void
  onBell: () => void
  onFirstFrame: () => void
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const smooth = (t: number) => t * t * (3 - 2 * t)

/** Frames held decoded behind / ahead of the playhead. */
const DECODE_BEHIND = 8
const DECODE_AHEAD = 20
/** Frames downloaded ahead of / behind the playhead. */
const FETCH_AHEAD = 140
const FETCH_BEHIND = 20

export class Player {
  readonly timeline: Timeline
  readonly store: SequenceStore
  readonly variant: VariantName
  private ctx: CanvasRenderingContext2D
  private unit = 1
  private lastW = 0
  private lastH = 0
  private W = 0
  private H = 0
  private raf = 0
  private last = 0
  /** Displayed scroll position (viewport heights), eased toward the real one. */
  private pos = 0
  private lastTarget = 0
  private direction = 1
  private state: PlayerState | null = null
  private cleanup: (() => void)[] = []
  private firstFrameSent = false
  private prevFrame = -1
  private dirty = true
  private lastDrawn = -1
  /** Draw statistics, read by automated checks. */
  readonly stats = { draws: 0, misses: 0 }

  stageEl: HTMLElement | null = null
  /** Letterbox bars: receives --lb from 0 (open) to 1 (closed). */
  letterboxEl: HTMLElement | null = null
  /** Chapter cards, scrubbed by chapter progress q (0–1). */
  titleScrub = new Map<ChapterId, (q: number, o: number) => void>()
  private titleLast = new Map<ChapterId, string>()
  /** Easing time constant for the displayed scroll position (ms). */
  smoothing = 90
  /** Scrolls the page; replaced when a smooth-scroll library owns scrolling. */
  scroller = (top: number, smooth: boolean) =>
    window.scrollTo({ top, behavior: smooth ? 'smooth' : ('instant' as ScrollBehavior) })

  constructor(private opts: PlayerOptions) {
    this.timeline = buildTimeline(opts.manifest)
    this.ctx = opts.canvas.getContext('2d', { alpha: false })!
    // Portrait screens get the centre crop at full height; everything else the full frame.
    this.variant = window.innerHeight > window.innerWidth * 1.05 ? 'tall' : 'wide'
    const v = this.variant
    this.store = new SequenceStore((i) => frameUrl(v, i), 6)
  }

  /* ------------------------------------------------------------ lifecycle */

  start() {
    this.measure(true)
    const onResize = () => this.measure(false)
    window.addEventListener('resize', onResize)
    this.cleanup.push(
      () => window.removeEventListener('resize', onResize),
      this.store.onChange(() => {
        this.dirty = true
      }),
    )
    this.pos = this.target()
    const tick = (t: number) => {
      const dt = this.last ? Math.min(64, t - this.last) : 16
      this.last = t
      this.frame(dt)
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.cleanup.forEach((f) => f())
    this.store.destroy()
  }

  /* --------------------------------------------------------------- layout */

  private measure(initial: boolean) {
    const w = window.innerWidth
    const h = window.innerHeight
    // Mobile toolbars resize the viewport while scrolling; only real layout
    // changes re-derive the scroll unit, so the page never jumps.
    if (initial || w !== this.lastW || Math.abs(h - this.lastH) > this.lastH * 0.25) {
      const p = initial ? 0 : this.target()
      this.lastW = w
      this.lastH = h
      this.unit = h
      this.opts.track.style.height = `${Math.ceil(this.timeline.total * this.unit + h)}px`
      if (!initial) {
        this.scroller(p * this.unit, false)
        this.pos = p
      }
    }
    const c = this.opts.canvas
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.W = c.clientWidth || w
    this.H = c.clientHeight || h
    c.width = Math.round(this.W * dpr)
    c.height = Math.round(this.H * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.ctx.imageSmoothingEnabled = true
    this.ctx.imageSmoothingQuality = 'high'
    this.lastDrawn = -1
    this.dirty = true
  }

  private target() {
    return clamp(window.scrollY / this.unit, 0, this.timeline.total)
  }

  private locate(p: number) {
    const segs = this.timeline.segments
    let i = 0
    while (i < segs.length - 1 && segs[i + 1].start <= p) i++
    return i
  }

  /** Film frame (float) at a scroll position. */
  frameAtPos(p: number) {
    const s = this.timeline.segments[this.locate(p)]
    return s.f0 + clamp((p - s.start) / s.move) * (s.f1 - s.f0)
  }

  /* ------------------------------------------------------------ loading */

  private plan(frame: number) {
    const n = this.opts.manifest.frames
    const f = Math.round(frame)
    const fwd = this.direction >= 0 ? 1 : -1
    const decode: number[] = []
    const fetch: number[] = []
    const add = (list: number[], i: number) => {
      if (i >= 0 && i < n) list.push(i)
    }
    for (let d = 0; d <= DECODE_AHEAD; d++) add(decode, f + d * fwd)
    for (let d = 1; d <= DECODE_BEHIND; d++) add(decode, f - d * fwd)
    // Nearest first, then every 4th frame further ahead (coarse coverage for
    // fast swipes), then the rest.
    for (let d = 0; d <= 24; d++) add(fetch, f + d * fwd)
    for (let d = 1; d <= FETCH_BEHIND; d++) add(fetch, f - d * fwd)
    for (let d = 28; d <= FETCH_AHEAD; d += 4) add(fetch, f + d * fwd)
    for (let d = 25; d <= FETCH_AHEAD; d++) if (d % 4) add(fetch, f + d * fwd)
    this.store.plan(fetch, decode)
  }

  /** The decoded frame closest to `f`, searching outward. */
  private nearest(f: number) {
    const n = this.opts.manifest.frames
    const r = Math.round(f)
    for (let d = 0; d < 60; d++) {
      for (const i of d === 0 ? [r] : [r - d, r + d]) {
        if (i < 0 || i >= n) continue
        const bmp = this.store.get(i)
        if (bmp) {
          this.stats.draws++
          if (d > 0) this.stats.misses++
          return { bmp, i }
        }
      }
    }
    return null
  }

  /** Makes sure the first frames are on their way (called before reveal). */
  preload() {
    this.plan(0)
  }

  /* ------------------------------------------------------------ per frame */

  private frame(dt: number) {
    const reduced = this.opts.reducedMotion
    const target = this.target()
    if (Math.abs(target - this.lastTarget) > 1e-4) this.direction = target > this.lastTarget ? 1 : -1
    this.lastTarget = target
    // Ease the displayed position toward the scroll position, so the film
    // glides between scroll events instead of stepping.
    const k = reduced || this.smoothing <= 0 ? 1 : 1 - Math.exp(-dt / this.smoothing)
    const before = this.pos
    this.pos += (target - this.pos) * k
    if (Math.abs(target - this.pos) < 0.0003) this.pos = target
    if (before === this.pos && !this.dirty) return
    this.dirty = false

    const segs = this.timeline.segments
    const i = this.locate(this.pos)
    const A = segs[i]
    const local = this.pos - A.start
    const frame = A.f0 + clamp(local / A.move) * (A.f1 - A.f0)
    this.plan(frame)
    this.render(frame)

    const fps = this.opts.manifest.fps
    const bell = BELL_AT * fps
    if (this.prevFrame >= 0 && this.prevFrame < bell && frame >= bell) this.opts.onBell()
    this.prevFrame = frame

    this.updateTitles(A, local)
    this.updateLetterbox(A, local)

    this.emit({
      chapter: A.id,
      tableMoment: false,
      end: i === segs.length - 1 && local > A.move * 0.97,
      intro: i === 0 && local < 0.12,
      degraded: this.store.anyFailed(),
    })
  }

  private render(frame: number) {
    const got = this.nearest(frame)
    // Keep the last picture rather than flashing black while a frame is on its way.
    if (!got || got.i === this.lastDrawn) return
    this.lastDrawn = got.i
    const { ctx, W, H } = this
    const bmp = got.bmp
    const s = Math.max(W / bmp.width, H / bmp.height)
    const w = bmp.width * s
    const h = bmp.height * s
    const focal = CHAPTERS.find((c) => c.id === this.state?.chapter)?.focalX ?? 0.5
    const x = clamp(W / 2 - focal * w, W - w, 0)
    ctx.drawImage(bmp, x, (H - h) / 2, w, h)
    if (!this.firstFrameSent) {
      this.firstFrameSent = true
      this.opts.onFirstFrame()
    }
  }

  private emit(s: PlayerState) {
    const p = this.state
    if (p && p.chapter === s.chapter && p.tableMoment === s.tableMoment && p.end === s.end && p.intro === s.intro && p.degraded === s.degraded) return
    this.state = s
    this.opts.onState(s)
  }

  /** Chapter cards play through as their chapter is scrolled. */
  private updateTitles(A: Segment, local: number) {
    this.titleScrub.forEach((scrub, id) => {
      const q = id === A.id ? clamp(local / A.len) : 0
      const o = id === A.id ? 1 : 0
      const key = `${q.toFixed(4)}|${o}`
      if (this.titleLast.get(id) === key) return
      this.titleLast.set(id, key)
      scrub(q, o)
    })
  }

  /** Film letterbox: open as the visitor walks in, close for the ending. */
  private updateLetterbox(A: Segment, local: number) {
    const el = this.letterboxEl
    if (!el) return
    let lb = 0
    if (A.id === '01') lb = 1 - smooth(clamp(local / (A.move * 0.6)))
    else if (A.id === '06') lb = smooth(clamp((local - A.move * 0.85) / (A.len - A.move * 0.85)))
    const v = lb.toFixed(4)
    if (el.style.getPropertyValue('--lb') !== v) el.style.setProperty('--lb', v)
  }

  /* ----------------------------------------------------------- navigation */

  offsetOf(id: ChapterId) {
    const s = this.timeline.segments.find((x) => x.id === id)!
    return (s.start + 0.02) * this.unit
  }

  /**
   * Nearby targets are scrolled to so the film plays; distant ones cut
   * through a short fade instead of racing through the whole film.
   */
  async goTo(top: number, play = false) {
    const target = Math.max(0, top)
    const distance = Math.abs(target - window.scrollY) / this.unit
    const reduced = this.opts.reducedMotion
    if ((play || distance < 2.5) && !reduced) {
      this.scroller(target, true)
      return
    }
    const stage = this.stageEl
    if (stage && !reduced) {
      stage.classList.add('is-cutting')
      await new Promise((r) => setTimeout(r, 300))
    }
    const p = target / this.unit
    const f = Math.round(this.frameAtPos(p))
    this.plan(f)
    await this.store.whenReady(f, 2500)
    this.scroller(target, false)
    this.pos = p
    this.dirty = true
    if (stage && !reduced) requestAnimationFrame(() => stage.classList.remove('is-cutting'))
  }
}
