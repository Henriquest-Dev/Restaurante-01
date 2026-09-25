import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { useEffect, useRef, type ElementType, type ReactNode } from 'react'

gsap.registerPlugin(ScrollTrigger)

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Inertial scrolling synced with ScrollTrigger (not for touch or reduced motion). */
export function useSmoothScroll() {
  useEffect(() => {
    if (reducedMotion() || !window.matchMedia('(pointer: fine)').matches) return
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true })
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (t: number) => lenis.raf(t * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    ;(window as unknown as { __lenis?: Lenis }).__lenis = lenis
    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
      delete (window as unknown as { __lenis?: Lenis }).__lenis
    }
  }, [])
}

export function scrollToEl(el: Element | null, offset = -20) {
  if (!el) return
  const lenis = (window as unknown as { __lenis?: Lenis }).__lenis
  if (lenis) lenis.scrollTo(el as HTMLElement, { offset, duration: 1.4 })
  else window.scrollTo({ top: (el as HTMLElement).getBoundingClientRect().top + scrollY + offset, behavior: reducedMotion() ? 'auto' : 'smooth' })
}

/**
 * Heading that rolls into place: two stretched "ghost" copies slide up
 * through a one-line window before the real text settles (as in the
 * reference). Plays once when it enters the viewport.
 */
export function Roll({ as: Tag = 'span', children, className = '', delay = 0, onLoad = false }: {
  as?: ElementType
  children: string
  className?: string
  delay?: number
  /** Play on mount instead of on scroll. */
  onLoad?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current!
    const track = el.querySelector('.roll__track')!
    // The window is exactly one copy tall, so long headings may wrap.
    const main = el.querySelector<HTMLElement>('.roll__main')!
    const fit = () => (el.style.height = `${main.offsetHeight}px`)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(main)
    if (reducedMotion()) {
      gsap.set(track, { yPercent: -66.666 })
      return () => ro.disconnect()
    }
    const tween = gsap.fromTo(
      track,
      { yPercent: 0 },
      {
        yPercent: -66.666,
        duration: 1.5,
        delay,
        ease: 'expo.out',
        paused: true,
      },
    )
    if (onLoad) {
      tween.play()
      return () => {
        ro.disconnect()
        tween.kill()
      }
    }
    const st = ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => tween.play() })
    return () => {
      ro.disconnect()
      st.kill()
      tween.kill()
    }
  }, [delay, onLoad])
  return (
    <Tag ref={ref} className={`roll ${className}`} aria-label={children}>
      <span className="roll__track" aria-hidden="true">
        <span className="roll__ghost">{children}</span>
        <span className="roll__ghost">{children}</span>
        <span className="roll__main">{children}</span>
      </span>
    </Tag>
  )
}

/** Fades and lifts children into view once. */
export function Reveal({ children, className = '', delay = 0, y = 34, as: Tag = 'div' }: {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
  as?: ElementType
}) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (reducedMotion()) return
    const el = ref.current!
    const t = gsap.fromTo(el, { autoAlpha: 0, y }, {
      autoAlpha: 1, y: 0, duration: 1.3, delay, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    })
    return () => {
      t.scrollTrigger?.kill()
      t.kill()
    }
  }, [delay, y])
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  )
}

/** Drifting golden dust, drawn on a canvas that fills its parent. */
export function Dust({ density = 1, className = '' }: { density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    const ctx = c.getContext('2d')!
    const reduced = reducedMotion()
    let W = 0
    let H = 0
    let raf = 0
    let visible = true
    type P = { x: number; y: number; r: number; vx: number; vy: number; a: number; t: number }
    let ps: P[] = []
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      W = c.clientWidth
      H = c.clientHeight
      c.width = W * dpr
      c.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const n = Math.round(((W * H) / 9000) * density)
      ps = Array.from({ length: n }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.3 + 0.3,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -Math.random() * 0.18 - 0.03,
        a: Math.random() * 0.7 + 0.2,
        t: Math.random() * Math.PI * 2,
      }))
    }
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      for (const p of ps) {
        if (!reduced) {
          p.x += p.vx
          p.y += p.vy
          p.t += 0.02
          if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W }
          if (p.x < -4) p.x = W + 4
          if (p.x > W + 4) p.x = -4
        }
        ctx.globalAlpha = p.a * (0.6 + 0.4 * Math.sin(p.t))
        ctx.fillStyle = p.r > 1.1 ? '#f3dca8' : '#ffffff'
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      if (!reduced && visible) raf = requestAnimationFrame(draw)
    }
    resize()
    draw()
    const ro = new ResizeObserver(() => {
      resize()
      if (reduced) draw()
    })
    ro.observe(c)
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      cancelAnimationFrame(raf)
      if (visible && !reduced) raf = requestAnimationFrame(draw)
    })
    io.observe(c)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
    }
  }, [density])
  return <canvas ref={ref} className={`dust ${className}`} aria-hidden="true" />
}
