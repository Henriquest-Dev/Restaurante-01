import {
  buildTimeline,
  CHAPTERS,
  HANDOVER,
  LOOK,
  type ChapterId,
  type Manifest,
  type Segment,
  type Timeline,
} from './data'
import { SequenceStore } from './sequence'

export interface PlayerState {
  chapter: ChapterId
  lookActive: boolean
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

const mod = (n: number, m: number) => ((n % m) + m) % m
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const smooth = (t: number) => t * t * (3 - 2 * t)

/** Frames held decoded behind / ahead of the playhead. */
const DECODE_BEHIND = 6
const DECODE_AHEAD = 16
/** Frames downloaded ahead of the playhead in the current chapter. */
const FETCH_AHEAD = 80

interface Draw {
  id: ChapterId
  frame: number
  alpha: number
  focalX: number
}

export class Player {
  readonly timeline: Timeline
  readonly store = new SequenceStore(6)
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
  private prevBellFrame = -1
  private dirty = true
  private lastKey = ''
  private tiny = document.createElement('canvas')

  /** Look-around angle, in source photographs (0 = photo 1). */
  private angle = 0
  private angleTarget = 0
  private dragging = false
  private velocity = 0
  lookInteracted = false

  hotspotEl: HTMLElement | null = null
  stageEl: HTMLElement | null = null
  /** Letterbox bars: receives --lb from 0 (open) to 1 (closed). */
  letterboxEl: HTMLElement | null = null
  /** Chapter cards, scrubbed by chapter progress q (0–1) at opacity o. */
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
    this.tiny.width = 32
    this.tiny.height = 32
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
    this.lastKey = ''
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

  /** Frame index (float) of a segment at a local scroll position. */
  private frameAt(s: Segment, local: number) {
    const v = this.opts.manifest[s.id]
    if (s.id === '09') return mod(this.angle, LOOK.count) * v.step
    return clamp(local / s.move) * (v.frames - 1)
  }

  private focalFor(id: ChapterId) {
    if (id === '09') {
      const a = mod(this.angle, LOOK.count)
      const n0 = Math.floor(a)
      const u = a - n0
      const fx = (n: number) => LOOK.focalByFrame[mod(n, LOOK.count) + 1] ?? LOOK.focalX
      return fx(n0) * (1 - u) + fx(n0 + 1) * u
    }
    return CHAPTERS.find((c) => c.id === id)?.focalX ?? 0.5
  }

  /* ------------------------------------------------------------ loading */

  private plan(i: number, frameA: number, handoverNear: boolean) {
    const segs = this.timeline.segments
    const A = segs[i]
    const B = segs[i + 1]
    const P = segs[i - 1]
    const vA = this.opts.manifest[A.id]
    const fetch: { id: ChapterId; i: number }[] = []
    const decode: { id: ChapterId; i: number }[] = []
    const f = Math.round(frameA)
    const wrap = A.id === '09'
    const push = (list: typeof fetch, id: ChapterId, n: number, frames: number, w: boolean) => {
      const idx = w ? mod(n, frames) : n
      if (idx >= 0 && idx < frames) list.push({ id, i: idx })
    }
    // Decode around the playhead, biased toward the scroll direction.
    const fwd = this.direction >= 0 ? 1 : -1
    for (let d = 0; d <= DECODE_AHEAD; d++) push(decode, A.id, f + d * fwd, vA.frames, wrap)
    for (let d = 1; d <= DECODE_BEHIND; d++) push(decode, A.id, f - d * fwd, vA.frames, wrap)
    if (B) for (let d = 0; d < (handoverNear ? 6 : 2); d++) push(decode, B.id, d, this.opts.manifest[B.id].frames, false)
    // Downloads: nearest first, then the rest of this chapter, then the start of the next.
    for (let d = 0; d <= FETCH_AHEAD; d++) {
      push(fetch, A.id, f + d * fwd, vA.frames, wrap)
      if (d > 0 && d <= 12) push(fetch, A.id, f - d * fwd, vA.frames, wrap)
    }
    if (B) {
      const vB = this.opts.manifest[B.id]
      for (let d = 0; d < Math.min(vB.frames, 40); d++) push(fetch, B.id, d, vB.frames, false)
    }
    if (P) {
      const vP = this.opts.manifest[P.id]
      for (let d = 1; d <= 8; d++) push(fetch, P.id, vP.frames - d, vP.frames, false)
    }
    this.store.plan(fetch, decode)
    const keep = new Set<ChapterId>([A.id])
    if (B) keep.add(B.id)
    if (P) keep.add(P.id)
    if (segs[i + 2]) keep.add(segs[i + 2].id)
    this.store.forget(keep)
  }

  /** Draw statistics, read by automated checks. */
  readonly stats = { draws: 0, misses: 0 }

  /** The decoded frame closest to `f` in a chapter, searching outward. */
  private nearest(id: ChapterId, f: number) {
    const v = this.opts.manifest[id]
    const wrap = id === '09'
    const r = Math.round(f)
    for (let d = 0; d < 40; d++) {
      for (const n of d === 0 ? [r] : [r - d, r + d]) {
        const idx = wrap ? mod(n, v.frames) : n
        if (idx < 0 || idx >= v.frames) continue
        const bmp = this.store.get(id, idx)
        if (bmp) {
          this.stats.draws++
          if (d > 0) this.stats.misses++
          return bmp
        }
      }
    }
    return null
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
    const lookMoved = this.animateLook(dt)
    if (before === this.pos && !lookMoved && !this.dirty) return
    this.dirty = false

    const segs = this.timeline.segments
    const i = this.locate(this.pos)
    const A = segs[i]
    const B = segs[i + 1]
    const local = this.pos - A.start
    const hand = B ? clamp((local - (A.len - HANDOVER)) / HANDOVER) : 0
    let oA = 1
    let oB = 0
    if (hand > 0) {
      if (reduced) {
        oA = hand < 0.5 ? 1 : 0
        oB = hand < 0.5 ? 0 : 1
      } else if (A.exit === 'dissolve') {
        oB = smooth(hand)
      } else {
        // Dip through black: the two chapters never overlap.
        oA = 1 - smooth(clamp(hand * 2))
        oB = smooth(clamp(hand * 2 - 1))
      }
    }

    const fA = this.frameAt(A, local)
    this.plan(i, fA, local > A.len - HANDOVER * 3)

    const draws: Draw[] = [{ id: A.id, frame: fA, alpha: oA, focalX: this.focalFor(A.id) }]
    if (B && oB > 0) draws.push({ id: B.id, frame: 0, alpha: oB, focalX: this.focalFor(B.id) })
    this.render(draws)

    if (A.id === '06') {
      // The finger meets the bell on source photo 5 (the 4th in this sequence).
      const hit = 3 * this.opts.manifest['06'].step
      if (this.prevBellFrame >= 0 && this.prevBellFrame < hit && fA >= hit) this.opts.onBell()
      this.prevBellFrame = fA
    }

    const lookWeight = A.id === '09' ? oA : B?.id === '09' ? oB : 0
    this.updateHotspot(lookWeight)
    this.updateTitles(A, local, oA, B, oB)
    this.updateLetterbox(A, local)

    const table = segs.find((s) => s.id === '10')!
    this.emit({
      chapter: hand > 0.5 && B ? B.id : A.id,
      lookActive: lookWeight > 0.5,
      tableMoment: A.id === '10' && local > table.move - 0.05 && hand === 0,
      end: i === segs.length - 1 && local > A.move * 0.9,
      intro: i === 0 && local < 0.3,
      degraded: this.store.anyFailed(),
    })
  }

  private render(draws: Draw[]) {
    const resolved = draws
      .map((d) => ({ ...d, bmp: this.nearest(d.id, d.frame) }))
      .filter((d) => d.bmp && d.alpha > 0.001)
    // Keep the last picture on screen rather than flashing black while a
    // frame is still on its way.
    if (!resolved.length && draws.some((d) => d.alpha > 0.5)) return
    const key =
      resolved.map((d) => `${d.id}${Math.round(d.frame)}:${d.alpha.toFixed(3)}:${d.focalX.toFixed(3)}:${d.bmp!.width}`).join('|')
    if (key === this.lastKey) return
    this.lastKey = key
    const { ctx, W, H } = this
    ctx.globalAlpha = 1
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)
    for (const d of resolved) {
      const bmp = d.bmp!
      const contain = bmp.height > bmp.width * 1.15 && W > H * 1.1
      ctx.globalAlpha = d.alpha
      if (contain) {
        // Portrait frame on a wide screen: whole frame over a soft copy of itself.
        this.tiny.getContext('2d')!.drawImage(bmp, 0, 0, 32, 32)
        const s = Math.max(W, H) * 1.2
        ctx.drawImage(this.tiny, (W - s) / 2, (H - s) / 2, s, s)
        ctx.fillStyle = `rgba(8,5,3,${0.55 * d.alpha})`
        ctx.fillRect(0, 0, W, H)
      }
      const s = contain ? Math.min(W / bmp.width, H / bmp.height) : Math.max(W / bmp.width, H / bmp.height)
      const w = bmp.width * s
      const h = bmp.height * s
      const x = contain ? (W - w) / 2 : clamp(W / 2 - d.focalX * w, W - w, 0)
      ctx.drawImage(bmp, x, (H - h) / 2, w, h)
    }
    ctx.globalAlpha = 1
    if (!this.firstFrameSent && resolved.some((d) => d.id === '01')) {
      this.firstFrameSent = true
      this.opts.onFirstFrame()
    }
  }

  private emit(s: PlayerState) {
    const p = this.state
    if (p && p.chapter === s.chapter && p.lookActive === s.lookActive && p.tableMoment === s.tableMoment &&
      p.end === s.end && p.intro === s.intro && p.degraded === s.degraded) return
    this.state = s
    this.opts.onState(s)
  }

  /** Chapter cards play through as their chapter is scrolled. */
  private updateTitles(A: Segment, local: number, oA: number, B: Segment | undefined, oB: number) {
    this.titleScrub.forEach((scrub, id) => {
      let q = 0
      let o = 0
      if (id === A.id) {
        q = clamp(local / (A.len - HANDOVER * 0.5))
        o = oA
      } else if (B && id === B.id) {
        o = oB
      }
      const key = `${q.toFixed(4)}|${o.toFixed(3)}`
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
    if (A.id === '01') lb = 1 - smooth(clamp(local / (A.move * 0.75)))
    else if (A.id === '11') lb = smooth(clamp((local - A.move * 0.5) / (A.len - A.move * 0.5)))
    const v = lb.toFixed(4)
    if (el.style.getPropertyValue('--lb') !== v) el.style.setProperty('--lb', v)
  }

  private updateHotspot(lookWeight: number) {
    const el = this.hotspotEl
    if (!el) return
    const a = mod(this.angle, LOOK.count)
    const n = Math.round(a)
    const photo = mod(n, LOOK.count) + 1
    const spot = LOOK.hotspots[photo]
    const settled = Math.abs(a - n) < 0.2
    if (lookWeight > 0.9 && spot && settled && !this.dragging) {
      const v = this.opts.manifest['09']
      const { W, H } = this
      const s = Math.max(W / v.width, H / v.height)
      const w = v.width * s
      const h = v.height * s
      const x0 = clamp(W / 2 - (LOOK.focalByFrame[photo] ?? LOOK.focalX) * w, W - w, 0)
      const x = x0 + spot.x * w
      const y = (H - h) / 2 + spot.y * h
      if (x > 32 && x < W - 32 && y > 90 && y < H - 150) {
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
        el.dataset.side = x > W * 0.6 ? 'left' : 'right'
        el.dataset.visible = 'true'
        return
      }
    }
    el.dataset.visible = 'false'
  }

  /* --------------------------------------------------------- look-around */

  private pxPerPhoto() {
    return Math.max(70, Math.min(170, window.innerWidth * 0.24))
  }

  dragStart() {
    this.dragging = true
    this.velocity = 0
    this.lookInteracted = true
  }

  dragMove(dx: number, dt: number) {
    const d = -dx / this.pxPerPhoto()
    this.angleTarget += d
    if (dt > 0) this.velocity = this.velocity * 0.5 + (d / dt) * 0.5
  }

  dragEnd() {
    this.dragging = false
    // Glide on with the swipe, then come to rest on a real photograph.
    const carry = this.opts.reducedMotion ? 0 : clamp(this.velocity * 260, -3, 3)
    this.angleTarget = Math.round(this.angleTarget + carry)
    this.velocity = 0
  }

  nudge(dir: number) {
    this.lookInteracted = true
    this.angleTarget = Math.round(this.angleTarget) + dir
  }

  /** Returns whether the angle moved. */
  private animateLook(dt: number) {
    const before = this.angle
    if (this.opts.reducedMotion) {
      this.angle = this.dragging ? this.angleTarget : Math.round(this.angleTarget)
    } else {
      const k = 1 - Math.exp(-dt / (this.dragging ? 60 : 180))
      this.angle += (this.angleTarget - this.angle) * k
      if (Math.abs(this.angleTarget - this.angle) < 0.001) this.angle = this.angleTarget
    }
    return this.angle !== before
  }

  /* ----------------------------------------------------------- navigation */

  offsetOf(id: ChapterId) {
    const s = this.timeline.segments.find((x) => x.id === id)!
    return (s.start + (id === '09' ? 0.2 : 0.02)) * this.unit
  }

  offsetOfTable() {
    const s = this.timeline.segments.find((x) => x.id === '10')!
    return (s.start + s.move + 0.1) * this.unit
  }

  /**
   * Nearby targets are scrolled to so the film plays; distant ones cut
   * through a short fade instead of racing through every chapter.
   */
  async goTo(top: number, play = false) {
    const target = Math.max(0, top)
    const distance = Math.abs(target - window.scrollY) / this.unit
    const reduced = this.opts.reducedMotion
    if ((play || distance < 3) && !reduced) {
      this.scroller(target, true)
      return
    }
    const stage = this.stageEl
    if (stage && !reduced) {
      stage.classList.add('is-cutting')
      await new Promise((r) => setTimeout(r, 300))
    }
    const p = target / this.unit
    const i = this.locate(p)
    const s = this.timeline.segments[i]
    const f = Math.round(this.frameAt(s, p - s.start))
    this.plan(i, f, false)
    await this.store.whenReady(s.id, f, 2500)
    this.scroller(target, false)
    this.pos = p
    this.dirty = true
    if (stage && !reduced) requestAnimationFrame(() => stage.classList.remove('is-cutting'))
  }
}
