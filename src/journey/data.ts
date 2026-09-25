/**
 * The journey is one continuous film (media/sala.webm), exported as WebP
 * frames (public/assets/sala/film/{wide,tall}/NNNN.webp) that the scroll
 * position scrubs on a canvas. Chapters are frame ranges of that film; the
 * film already fades through black between its scenes.
 */

export type ChapterId = '01' | '02' | '03' | '04' | '05' | '06'

export interface Chapter {
  id: ChapterId
  numeral: string
  label: string
  /** Chapter card title and film-style subtitle (pt-PT). */
  title?: string
  subtitle?: string
  /** Film time range, in seconds. */
  from: number
  to: number
  /** Scroll distance per second of film, in viewport heights. */
  pace: number
  /** Extra scroll resting on the last frame, in viewport heights. */
  hold?: number
  /** Horizontal focal point (0–1) when the frame is cropped to cover. */
  focalX?: number
}

export const CHAPTERS: Chapter[] = [
  { id: '01', numeral: 'I', label: 'A porta', from: 0, to: 5.05, pace: 0.42 },
  { id: '02', numeral: 'II', label: 'A entrada', title: 'Bem-vindo', subtitle: 'Madeira, pedra e luz quente.', from: 5.05, to: 11.9, pace: 0.34 },
  { id: '03', numeral: 'III', label: 'A campainha', title: 'A receção', subtitle: 'Anuncie a sua chegada.', from: 11.9, to: 15.5, pace: 0.42, hold: 0.2 },
  { id: '04', numeral: 'IV', label: 'A sala', title: 'A sala', subtitle: 'Uma árvore ao centro, a noite à volta.', from: 15.5, to: 23.37, pace: 0.34 },
  { id: '05', numeral: 'V', label: 'A mesa', title: 'A sua mesa', from: 23.37, to: 29.0, pace: 0.34 },
  { id: '06', numeral: 'VI', label: 'Sentar', from: 29.0, to: 39.0, pace: 0.3, hold: 1.1 },
]

/** The moment the hand presses the bell (seconds into the film). */
export const BELL_AT = 12.75

export interface Variant {
  frames: number
  width: number
  height: number
  bytes: number
}

export interface Manifest {
  fps: number
  frames: number
  variants: { wide: Variant; tall: Variant; xl?: Variant }
}

export type VariantName = keyof Manifest['variants']

const BASE = import.meta.env.BASE_URL

export const frameUrl = (variant: VariantName, i: number) =>
  `${BASE}assets/sala/film/${variant}/${String(i).padStart(4, '0')}.webp`
export const manifestUrl = `${BASE}assets/sala/film/manifest.json`

/* ------------------------------------------------------------------------ */

export interface Segment {
  id: ChapterId
  start: number
  /** Scroll length of the moving part (viewport heights). */
  move: number
  /** Total scroll length including the hold. */
  len: number
  /** Film frame range. */
  f0: number
  f1: number
}

export interface Timeline {
  segments: Segment[]
  total: number
}

export function buildTimeline(manifest: Manifest): Timeline {
  let acc = 0
  const last = manifest.frames - 1
  const segments = CHAPTERS.map((c) => {
    const move = (c.to - c.from) * c.pace
    const len = move + (c.hold ?? 0)
    const seg: Segment = {
      id: c.id,
      start: acc,
      move,
      len,
      f0: Math.min(last, Math.round(c.from * manifest.fps)),
      f1: Math.min(last, Math.round(c.to * manifest.fps) - 1),
    }
    acc += len
    return seg
  })
  segments[segments.length - 1].f1 = last
  return { segments, total: acc }
}

/** A still of the table, used behind the reservation sheet. */
export const stillUrl = () => `${BASE}assets/sala/film/table.webp`
