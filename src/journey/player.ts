import {
  buildTimeline,
  CHAPTERS,
  HANDOVER,
  LOOK,
  stillUrl,
  videoUrl,
  type ChapterId,
  type Manifest,
  type Segment,
  type Timeline,
} from './data'

export interface PlayerState {
  chapter: ChapterId
  lookActive: boolean
  tableMoment: boolean
  end: boolean
  intro: boolean
  degraded: boolean
}

export interface PlayerOptions {
  media: HTMLElement
  track: HTMLElement
  manifest: Manifest
  reducedMotion: boolean
  onState: (s: PlayerState) => void
  onBell: () => void
  onFirstFrame: () => void
}

interface Layer {
  id: ChapterId
  el: HTMLDivElement
  video: HTMLVideoElement
  poster: HTMLImageElement
  backdrop: HTMLImageElement
  ready: boolean
  failed: boolean
  loaded: boolean
  shownFrame: number
  posterSrc: string
}

const mod = (n: number, m: number) => ((n % m) + m) % m
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const smooth = (t: number) => t * t * (3 - 2 * t)

export class Player {
  readonly timeline: Timeline
  private layers = new Map<ChapterId, Layer>()
  private unit = 1
  private lastW = 0
  private lastH = 0
  private raf = 0
  private last = 0
  /** Displayed scroll position (viewport heights), eased toward the real one. */
  private pos = 0
  private state: PlayerState | null = null
  private cleanup: (() => void)[] = []
  private firstFrameSent = false
  private prevBellFrame = -1

  /** Look-around angle, in source photographs (0 = photo 1). */
  private angle = 0
  private angleTarget = 0
  private dragging = false
  private velocity = 0
  lookInteracted = false

  hotspotEl: HTMLElement | null = null
  progressEl: HTMLElement | null = null
  stageEl: HTMLElement | null = null
  titleEls = new Map<ChapterId, HTMLElement>()

  constructor(private opts: PlayerOptions) {
    this.timeline = buildTimeline(opts.manifest)
  }

  /* ------------------------------------------------------------ lifecycle */

  start() {
    this.measure(true)
    const onResize = () => this.measure(false)
    const unlock = () => this.unlockIOS()
    window.addEventListener('resize', onResize)
    window.addEventListener('touchstart', unlock, { once: true, passive: true })
    this.cleanup.push(
      () => window.removeEventListener('resize', onResize),
      () => window.removeEventListener('touchstart', unlock),
    )
    this.pos = this.target()
    this.ensureLayers(0)
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
    this.layers.forEach((l) => {
      l.video.removeAttribute('src')
      l.video.load()
      l.el.remove()
    })
    this.layers.clear()
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
        window.scrollTo(0, p * this.unit)
        this.pos = p
      }
    }
    this.layers.forEach((l) => this.fit(l))
  }

  /** Portrait videos on a landscape screen are shown whole over a blurred copy. */
  private fit(l: Layer) {
    const v = this.opts.manifest[l.id]
    const contain = v.height > v.width * 1.15 && window.innerWidth > window.innerHeight * 1.1
    l.el.classList.toggle('is-contain', contain)
  }

  private target() {
    return clamp(window.scrollY / this.unit, 0, this.timeline.total)
  }

  /* --------------------------------------------------------------- layers */

  private layer(id: ChapterId): Layer {
    let l = this.layers.get(id)
    if (l) return l
    const el = document.createElement('div')
    el.className = 'layer'
    el.dataset.chapter = id
    const backdrop = document.createElement('img')
    backdrop.className = 'layer__backdrop'
    backdrop.alt = ''
    const poster = document.createElement('img')
    poster.className = 'layer__poster'
    poster.alt = ''
    poster.decoding = 'async'
    const video = document.createElement('video')
    video.className = 'layer__video'
    video.muted = true
    video.playsInline = true
    video.setAttribute('playsinline', '')
    video.setAttribute('muted', '')
    video.preload = 'auto'
    video.disablePictureInPicture = true
    video.setAttribute('aria-hidden', 'true')
    el.append(backdrop, poster, video)
    this.opts.media.appendChild(el)
    const focal = CHAPTERS.find((c) => c.id === id)?.focalX ?? 0.5
    const op = `${focal * 100}% 50%`
    video.style.objectPosition = op
    poster.style.objectPosition = op
    l = {
      id, el, video, poster, backdrop,
      ready: false, failed: false, loaded: false,
      shownFrame: -1, posterSrc: '',
    }
    const layer = l
    video.addEventListener('loadeddata', () => {
      layer.ready = true
      layer.shownFrame = -1
    })
    video.addEventListener('seeked', () => {
      if (layer.ready) el.classList.add('has-video')
      if (layer.id === '01' && !this.firstFrameSent) {
        this.firstFrameSent = true
        this.opts.onFirstFrame()
      }
    })
    video.addEventListener('error', () => {
      layer.failed = true
      el.classList.remove('has-video')
    })
    poster.addEventListener('error', () => {
      if (layer.failed) el.classList.add('is-broken')
    })
    this.fit(l)
    this.layers.set(id, l)
    return l
  }

  private load(l: Layer) {
    if (l.loaded) return
    l.loaded = true
    l.video.src = videoUrl(l.id)
    l.video.load()
  }

  private unload(l: Layer) {
    if (!l.loaded) return
    l.loaded = false
    l.ready = false
    l.shownFrame = -1
    l.el.classList.remove('has-video')
    l.video.removeAttribute('src')
    l.video.load()
  }

  /** Keep the current chapter and its neighbours loaded; release the rest. */
  private ensureLayers(i: number) {
    const segs = this.timeline.segments
    segs.forEach((s, j) => {
      const near = j >= i - 1 && j <= i + 2
      if (near) this.load(this.layer(s.id))
      else {
        const l = this.layers.get(s.id)
        if (l) this.unload(l)
      }
    })
  }

  /** iOS only paints a paused video's frames after it has played once. */
  private unlockIOS() {
    this.layers.forEach((l) => {
      if (!l.loaded) return
      const p = l.video.play()
      if (p) p.then(() => l.video.pause(), () => {})
    })
  }

  /** Show video frame `f` (float) of a layer, falling back to the photograph. */
  private show(l: Layer, f: number) {
    const v = this.opts.manifest[l.id]
    const frame = Math.round(clamp(f, 0, v.frames - 1))
    // The nearest source photograph: shown until the video paints, if the
    // video fails, and (blurred) behind portrait videos on wide screens.
    const photo = v.sources[Math.min(v.sources.length - 1, Math.round(frame / v.step))]
    const src = stillUrl(l.id, photo)
    const needPoster = !l.el.classList.contains('has-video') || l.failed
    if (needPoster && src !== l.posterSrc) {
      l.posterSrc = src
      l.poster.src = src
    }
    if (l.el.classList.contains('is-contain') && l.backdrop.getAttribute('src') !== src) l.backdrop.src = src
    if (!l.ready || l.failed || frame === l.shownFrame || l.video.seeking) return
    l.shownFrame = frame
    // Aim at the middle of the frame so rounding never lands on its neighbour.
    l.video.currentTime = (frame + 0.5) / v.fps
  }

  /* ------------------------------------------------------------ per frame */

  private locate(p: number) {
    const segs = this.timeline.segments
    let i = 0
    while (i < segs.length - 1 && segs[i + 1].start <= p) i++
    return i
  }

  private frame(dt: number) {
    const reduced = this.opts.reducedMotion
    const target = this.target()
    // Critically damped easing toward the scroll position: the image keeps
    // gliding a moment after a swipe instead of stopping in steps.
    const k = reduced ? 1 : 1 - Math.exp(-dt / 110)
    this.pos += (target - this.pos) * k
    if (Math.abs(target - this.pos) < 0.0004) this.pos = target
    this.animateLook(dt)

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
        // Dip through dark: the two chapters never overlap.
        oA = 1 - smooth(clamp(hand * 2))
        oB = smooth(clamp(hand * 2 - 1))
      }
    }

    this.ensureLayers(i)
    this.layers.forEach((l) => {
      const o = l.id === A.id ? oA : B && l.id === B.id ? oB : 0
      if (l.el.style.opacity !== String(o)) l.el.style.opacity = String(o)
    })

    this.drive(A, local)
    if (B && oB > 0) this.drive(B, 0)
    // Pre-seek the next chapter to its first frame so the hand-over is instant.
    else if (B && local > A.len - HANDOVER * 3) this.drive(B, 0)

    // Hotspot and titles.
    const lookWeight = A.id === '09' ? oA : B?.id === '09' ? oB : 0
    this.updateHotspot(lookWeight)
    this.updateTitles(A, local, oA, B, oB)
    if (this.progressEl) this.progressEl.style.transform = `scaleX(${this.pos / this.timeline.total})`

    const tableSeg = segs.find((s) => s.id === '10')!
    const onTable = A.id === '10' && local > tableSeg.move - 0.05 && hand === 0
    this.emit({
      chapter: hand > 0.5 && B ? B.id : A.id,
      lookActive: lookWeight > 0.5,
      tableMoment: onTable,
      end: i === segs.length - 1 && local > A.move * 0.9,
      intro: i === 0 && local < 0.3,
      degraded: [...this.layers.values()].some((l) => l.failed),
    })
  }

  /** Put a segment's video at the frame for its local scroll position. */
  private drive(s: Segment, local: number) {
    const l = this.layer(s.id)
    const v = this.opts.manifest[s.id]
    if (s.id === '09') {
      const f = mod(this.angle, LOOK.count) * v.step
      this.show(l, f)
      const a = mod(this.angle, LOOK.count)
      const n0 = Math.floor(a)
      const u = a - n0
      const fx = (n: number) => LOOK.focalByFrame[mod(n, LOOK.count) + 1] ?? LOOK.focalX
      const focal = fx(n0) * (1 - u) + fx(n0 + 1) * u
      const op = `${(focal * 100).toFixed(2)}% 50%`
      if (l.video.style.objectPosition !== op) {
        l.video.style.objectPosition = op
        l.poster.style.objectPosition = op
      }
      return
    }
    const p = clamp(local / s.move)
    const f = p * (v.frames - 1)
    this.show(l, f)
    if (s.id === '06') {
      // The finger meets the bell on source photo 5 (the 4th in this video).
      const hit = 3 * v.step
      if (this.prevBellFrame >= 0 && this.prevBellFrame < hit && f >= hit) this.opts.onBell()
      this.prevBellFrame = f
    }
  }

  private emit(s: PlayerState) {
    const p = this.state
    if (p && p.chapter === s.chapter && p.lookActive === s.lookActive && p.tableMoment === s.tableMoment &&
      p.end === s.end && p.intro === s.intro && p.degraded === s.degraded) return
    this.state = s
    this.opts.onState(s)
  }

  /** Titles rise in with the chapter and drift up as it plays, like credits. */
  private updateTitles(A: Segment, local: number, oA: number, B: Segment | undefined, oB: number) {
    this.titleEls.forEach((el, id) => {
      let o = 0
      let y = 0
      if (id === A.id || (B && id === B.id)) {
        const seg = id === A.id ? A : B!
        const l = id === A.id ? local : 0
        const q = clamp(l / Math.max(0.4, seg.move))
        const fadeIn = clamp((l - 0.04) / 0.22)
        const fadeOut = 1 - clamp((q - 0.55) / 0.3)
        o = Math.min(fadeIn, fadeOut) * (id === A.id ? oA : oB)
        y = (0.35 - q) * 60
      }
      const op = o.toFixed(3)
      if (el.style.opacity !== op) {
        el.style.opacity = op
        el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`
        el.style.visibility = o > 0.01 ? 'visible' : 'hidden'
      }
    })
  }

  private updateHotspot(lookWeight: number) {
    const el = this.hotspotEl
    if (!el) return
    const a = mod(this.angle, LOOK.count)
    const n = Math.round(a)
    const photo = mod(n, LOOK.count) + 1
    const spot = LOOK.hotspots[photo]
    const l = this.layers.get('09')
    const settled = Math.abs(a - n) < 0.2 || Math.abs(a - n - LOOK.count) < 0.2
    if (lookWeight > 0.9 && spot && settled && l && !this.dragging) {
      const v = this.opts.manifest['09']
      const W = window.innerWidth
      const H = window.innerHeight
      const s = Math.max(W / v.width, H / v.height)
      const w = v.width * s
      const h = v.height * s
      const focal = LOOK.focalByFrame[photo] ?? LOOK.focalX
      const x0 = (W - w) * focal
      const y0 = (H - h) / 2
      const x = x0 + spot.x * w
      const y = y0 + spot.y * h
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

  private animateLook(dt: number) {
    if (this.opts.reducedMotion) {
      this.angle = this.dragging ? this.angleTarget : Math.round(this.angleTarget)
      return
    }
    const k = 1 - Math.exp(-dt / (this.dragging ? 60 : 180))
    this.angle += (this.angleTarget - this.angle) * k
    if (Math.abs(this.angleTarget - this.angle) < 0.001) this.angle = this.angleTarget
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
      window.scrollTo({ top: target, behavior: 'smooth' })
      return
    }
    const stage = this.stageEl
    if (stage && !reduced) {
      stage.classList.add('is-cutting')
      await new Promise((r) => setTimeout(r, 280))
    }
    window.scrollTo({ top: target, behavior: 'instant' as ScrollBehavior })
    this.pos = target / this.unit
    const i = this.locate(this.pos)
    this.ensureLayers(i)
    const l = this.layer(this.timeline.segments[i].id)
    if (!l.ready && !l.failed) {
      await Promise.race([
        new Promise((r) => l.video.addEventListener('loadeddata', r, { once: true })),
        new Promise((r) => setTimeout(r, 1500)),
      ])
    }
    if (stage && !reduced) requestAnimationFrame(() => stage.classList.remove('is-cutting'))
  }
}
