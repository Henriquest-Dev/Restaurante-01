/**
 * The journey, described as data.
 *
 * Each chapter is one storyboard sheet. Its photographs were upscaled and the
 * gaps between them filled with generated in-between frames, then encoded as
 * one image sequence (public/assets/sala/seq/section-XX/NNNN.webp) that the
 * scroll position scrubs on a canvas. Frames that restart the camera behind where the previous
 * sheet ended are left out (see scripts/pipeline/build_media.py VIDEOS).
 */

export type ChapterId = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11'

export interface Chapter {
  id: ChapterId
  /** Roman numeral shown on the chapter card. */
  numeral: string
  label: string
  /** Chapter card title (pt-PT). */
  title?: string
  /** Film-style subtitle shown mid-chapter. */
  subtitle?: string
  /** Scroll distance per source photograph, in viewport heights. */
  step: number
  /** Extra scroll to rest on the last frame, in viewport heights. */
  hold?: number
  /** Horizontal focal point (0–1) when the video is cropped to cover. */
  focalX?: number
  /** Hand-over to the next chapter. */
  exit?: 'dissolve' | 'dip'
}

export const CHAPTERS: Chapter[] = [
  { id: '01', numeral: 'I', label: 'A chegada', step: 0.55, hold: 0.35, exit: 'dissolve' },
  { id: '02', numeral: 'II', label: 'A entrada', title: 'A entrada', subtitle: 'Pedra, madeira e luz quente.', step: 0.5 },
  { id: '03', numeral: 'III', label: 'A porta', title: 'A porta', subtitle: 'Entre.', step: 0.36, focalX: 0.6 },
  { id: '04', numeral: 'IV', label: 'O interior', title: 'Bem-vindo', step: 0.32 },
  { id: '05', numeral: 'V', label: 'A receção', title: 'A receção', subtitle: 'Estamos à sua espera.', step: 0.36, focalX: 0.62 },
  { id: '06', numeral: 'VI', label: 'A campainha', title: 'A campainha', subtitle: 'Anuncie a sua chegada.', step: 0.4, hold: 0.3 },
  { id: '07', numeral: 'VII', label: 'A passagem', title: 'Por aqui', step: 0.32 },
  { id: '08', numeral: 'VIII', label: 'A sala', title: 'A sala', subtitle: 'Árvores, luz baixa e tempo.', step: 0.32, exit: 'dissolve' },
  { id: '09', numeral: 'IX', label: 'Olhar em volta', step: 0 },
  { id: '10', numeral: 'X', label: 'A mesa', title: 'A mesa', step: 0.42, hold: 0.9 },
  { id: '11', numeral: 'XI', label: 'Até breve', step: 0.5, hold: 0.8 },
]

/** Look-around (section 09): 16 viewing directions, looped. */
export const LOOK = {
  count: 16,
  /** Scroll distance during which the look-around holds the screen. */
  hold: 1.8,
  focalX: 0.5,
  focalByFrame: { 1: 0.68, 2: 0.68, 15: 0.68, 16: 0.68 } as Record<number, number>,
  /**
   * Featured-table hotspot in normalised video coordinates, on the source
   * directions where the table approached in section 10 is clearly visible.
   */
  hotspots: {
    1: { x: 0.74, y: 0.64 },
    2: { x: 0.71, y: 0.63 },
    15: { x: 0.73, y: 0.62 },
    16: { x: 0.71, y: 0.63 },
  } as Record<number, { x: number; y: number }>,
}

export interface SequenceInfo {
  frames: number
  width: number
  height: number
  /** Source photograph numbers, one every `step` frames. */
  sources: number[]
  step: number
  bytes: number
}

export type Manifest = Record<ChapterId, SequenceInfo>

const BASE = import.meta.env.BASE_URL

export const frameUrl = (id: ChapterId, i: number) =>
  `${BASE}assets/sala/seq/section-${id}/${String(i).padStart(4, '0')}.webp`
export const stillUrl = (id: ChapterId, frame: number) =>
  `${BASE}assets/sala/section-${id}/frame-${String(frame).padStart(2, '0')}.webp`
export const manifestUrl = `${BASE}assets/sala/seq/manifest.json`

/* ------------------------------------------------------------------------ */

export interface Segment {
  id: ChapterId
  start: number
  /** Length of the moving part (viewport heights). */
  move: number
  /** Total length including the hold. */
  len: number
  exit: 'dissolve' | 'dip'
}

export interface Timeline {
  segments: Segment[]
  total: number
}

/** Hand-over window around a chapter boundary, in viewport heights. */
export const HANDOVER = 0.22

export function buildTimeline(manifest: Manifest): Timeline {
  let acc = 0
  const segments: Segment[] = CHAPTERS.map((c) => {
    let move: number
    if (c.id === '09') move = LOOK.hold
    else {
      const v = manifest[c.id]
      const steps = Math.max(1, v.sources.length - 1)
      move = steps * c.step
    }
    const len = move + (c.hold ?? 0) + HANDOVER
    const seg = { id: c.id, start: acc, move, len, exit: c.exit ?? 'dip' } as Segment
    acc += len
    return seg
  })
  // The last chapter has nothing to hand over to.
  const last = segments[segments.length - 1]
  last.len -= HANDOVER
  return { segments, total: acc - HANDOVER }
}
