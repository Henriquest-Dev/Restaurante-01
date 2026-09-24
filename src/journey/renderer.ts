/** Canvas drawing helpers for the frame player. */

export interface Layer {
  img: HTMLImageElement
  alpha: number
  /** Digital scale on top of the fit (1 = none). */
  scale: number
  focalX: number
}

export interface Placement {
  x: number
  y: number
  w: number
  h: number
  contain: boolean
}

/**
 * Portrait frames on a landscape screen would lose most of their height if
 * cropped, so they are shown whole over a blurred copy of themselves. In
 * every other case the photograph covers the viewport.
 */
export function place(img: HTMLImageElement, W: number, H: number, scale: number, focalX: number): Placement {
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  const contain = ih > iw * 1.15 && W > H * 1.1
  const s = (contain ? Math.min(W / iw, H / ih) : Math.max(W / iw, H / ih)) * scale
  const w = iw * s
  const h = ih * s
  let x = W / 2 - focalX * w
  if (!contain) x = Math.min(0, Math.max(W - w, x))
  else x = (W - w) / 2
  const y = (H - h) / 2
  return { x, y, w, h, contain }
}

const blurCache = new WeakMap<HTMLImageElement, HTMLCanvasElement>()

/** A tiny copy of the frame; upscaling it gives a cheap, soft blur. */
function blurred(img: HTMLImageElement) {
  let c = blurCache.get(img)
  if (!c) {
    c = document.createElement('canvas')
    c.width = 16
    c.height = Math.max(1, Math.round((16 * img.naturalHeight) / img.naturalWidth))
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    blurCache.set(img, c)
  }
  return c
}

export function drawLayers(ctx: CanvasRenderingContext2D, W: number, H: number, layers: Layer[], dipping = false) {
  ctx.globalAlpha = 1
  ctx.fillStyle = '#120d09'
  ctx.fillRect(0, 0, W, H)
  if (!layers.length && !dipping) {
    // No frame could be shown (still loading or failed): warm, calm fallback.
    const g = ctx.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, Math.max(W, H) * 0.7)
    g.addColorStop(0, '#5a3a1c')
    g.addColorStop(1, '#120d09')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    return
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  for (const l of layers) {
    if (l.alpha <= 0.001) continue
    const p = place(l.img, W, H, l.scale, l.focalX)
    ctx.globalAlpha = l.alpha
    if (p.contain) {
      const b = blurred(l.img)
      const s = Math.max(W / b.width, H / b.height)
      ctx.drawImage(b, (W - b.width * s) / 2, (H - b.height * s) / 2, b.width * s, b.height * s)
      ctx.fillStyle = 'rgba(18,13,9,0.55)'
      ctx.fillRect(0, 0, W, H)
    }
    ctx.drawImage(l.img, p.x, p.y, p.w, p.h)
  }
  ctx.globalAlpha = 1
}

/** Linear position (0–1) inside a transition window. */
export function windowPos(f: number, center: number, width: number) {
  if (width <= 0) return f >= center ? 1 : 0
  return Math.min(1, Math.max(0, (f - (center - width / 2)) / width))
}

/** 0 before the window, 1 after it, eased in between. Width 0 = hard cut. */
export function dissolve(f: number, center: number, width: number) {
  if (width <= 0) return f >= center ? 1 : 0
  const t = Math.min(1, Math.max(0, (f - (center - width / 2)) / width))
  return t * t * (3 - 2 * t)
}
