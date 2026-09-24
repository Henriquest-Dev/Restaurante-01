/**
 * The photographic journey, described as data.
 *
 * Each chapter maps to one storyboard sheet (public/assets/sala/section-XX).
 * `frames` lists which cropped frames the scroll timeline plays, in order.
 * Some sheets restart the camera further back than where the previous sheet
 * ended; those regressing frames are left out of the timeline (they are still
 * exported) so that scrolling forward always moves the camera forward.
 */

export type ChapterId = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11'

export interface Chapter {
  id: ChapterId
  /** Short label used by the progress navigation (pt-PT). */
  label: string
  /** Frame numbers played by the timeline, in order. */
  frames: number[]
  /** Scroll distance per frame, in viewport heights. */
  step: number
  /**
   * Width of the cross-dissolve window inside each step (0–1). Narrow values
   * keep a single frame on screen most of the time, which avoids visible
   * double images where adjacent generated frames differ (hands, objects).
   */
  blend: number
  /** Digital push-in per step (fraction). Kept very small. */
  zoom: number
  /** Horizontal focal point (0–1) used when the frame is cropped to cover. */
  focalX?: number
  /** Per-frame overrides of the focal point. */
  focalByFrame?: Record<number, number>
  /** Extra scroll distance to linger on the last frame (viewport heights). */
  hold?: number
  /**
   * How the last frame hands over to the next chapter. Sheets whose first
   * frame is framed differently from where the previous one ended would
   * show a double image in a crossfade, so they dip briefly through dark.
   */
  exit?: Transition
}

export type Transition = 'dissolve' | 'dip'

export const CHAPTERS: Chapter[] = [
  // 01-05…08 and 02-05…08 reach the closed glass before the door is opened in
  // section 03, so they would make the camera pass through the door and back.
  { id: '01', label: 'Exterior', frames: [1, 2, 3, 4], step: 0.42, blend: 0.6, zoom: 0.012, hold: 0.5, exit: 'dissolve' },
  { id: '02', label: 'Entrada', frames: [1, 2, 3, 4], step: 0.36, blend: 0.55, zoom: 0.012 },
  { id: '03', label: 'A porta', frames: [1, 2, 3, 4, 5, 6, 7, 8], step: 0.3, blend: 0.3, zoom: 0, focalX: 0.6 },
  { id: '04', label: 'Interior', frames: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], step: 0.28, blend: 0.45, zoom: 0.01 },
  // 05-01…03 restart behind the point reached at 04-10.
  { id: '05', label: 'Receção', frames: [4, 5, 6, 7, 8], step: 0.3, blend: 0.45, zoom: 0.01, focalX: 0.6 },
  // 06-01 is a wide reception view that steps back before the bell close-ups.
  { id: '06', label: 'Campainha', frames: [2, 3, 4, 5, 6], step: 0.34, blend: 0.3, zoom: 0, focalX: 0.5, hold: 0.4 },
  { id: '07', label: 'Passagem', frames: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], step: 0.28, blend: 0.45, zoom: 0.01 },
  { id: '08', label: 'A sala', frames: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], step: 0.28, blend: 0.45, zoom: 0.01, exit: 'dissolve' },
  // Section 09 is the look-around; it is not scrubbed by vertical scroll.
  { id: '09', label: 'Explorar', frames: [], step: 0, blend: 0.5, zoom: 0 },
  { id: '10', label: 'A mesa', frames: [1, 2, 3, 4, 5, 6, 7], step: 0.34, blend: 0.45, zoom: 0.008, hold: 1.1 },
  { id: '11', label: 'A sala à noite', frames: [1, 2, 3, 4, 5], step: 0.4, blend: 0.5, zoom: 0, hold: 0.9 },
]

/** Look-around (section 09): 16 viewing directions from about one point. */
export const LOOK = {
  count: 16,
  /**
   * Frame 16 faces almost the same way as frame 1 (tree centred, shelving on
   * the right), so the rotation wraps instead of stopping at the ends.
   */
  wrap: true,
  /** Scroll distance during which the view stays in look-around mode. */
  hold: 1.6,
  focalX: 0.5,
  focalByFrame: { 1: 0.7, 2: 0.7, 15: 0.7, 16: 0.7 } as Record<number, number>,
  /**
   * Featured-table hotspot, in normalised source-image coordinates. Only on
   * the frames where the table later approached in section 10 is clearly
   * visible (right of the central planter).
   */
  hotspots: {
    1: { x: 0.74, y: 0.64 },
    2: { x: 0.71, y: 0.63 },
    15: { x: 0.73, y: 0.62 },
    16: { x: 0.71, y: 0.63 },
  } as Record<number, { x: number; y: number }>,
}

export const frameUrl = (chapter: string, frame: number) =>
  `${import.meta.env.BASE_URL}assets/sala/section-${chapter}/frame-${String(frame).padStart(2, '0')}.webp`

export const frameKey = (chapter: string, frame: number) => `${chapter}-${frame}`

/* ------------------------------------------------------------------------ */
/* Timeline                                                                  */
/* ------------------------------------------------------------------------ */

export type Step =
  | {
      kind: 'frame'
      chapter: ChapterId
      frame: number
      key: string
      /** Scroll length of this step, in viewport heights. */
      len: number
      /** Centre and width of the dissolve toward the next step (0–1). */
      blendAt: number
      blend: number
      transition: Transition
      zoom: number
      focalX: number
    }
  | { kind: 'look'; chapter: '09'; len: number; blendAt: number; blend: number; transition: Transition }

export interface Timeline {
  steps: Step[]
  /** Start offset of every step, in viewport heights. */
  starts: number[]
  total: number
  /** Chapter start offsets (viewport heights). */
  chapterStart: Record<ChapterId, number>
  /** Index of the look-around step. */
  lookIndex: number
  /** Index of the last step of chapter 10 (reservation moment). */
  tableIndex: number
}

export function buildTimeline(): Timeline {
  const steps: Step[] = []
  for (const ch of CHAPTERS) {
    if (ch.id === '09') {
      steps.push({ kind: 'look', chapter: '09', len: LOOK.hold, blendAt: 0.86, blend: 0.26, transition: 'dip' })
      continue
    }
    ch.frames.forEach((frame, i) => {
      const last = i === ch.frames.length - 1
      const len = ch.step + (last ? ch.hold ?? 0 : 0)
      // On a lingering step, dissolve only at its end.
      const blendAt = last && ch.hold ? 1 - (ch.step * 0.5) / len : 0.5
      steps.push({
        kind: 'frame',
        chapter: ch.id,
        frame,
        key: frameKey(ch.id, frame),
        len,
        blendAt,
        blend: last ? (ch.step * 0.8) / len : ch.blend,
        transition: last ? ch.exit ?? 'dip' : 'dissolve',
        zoom: ch.zoom,
        focalX: ch.focalByFrame?.[frame] ?? ch.focalX ?? 0.5,
      })
    })
  }
  const starts: number[] = []
  let acc = 0
  for (const s of steps) {
    starts.push(acc)
    acc += s.len
  }
  const chapterStart = {} as Record<ChapterId, number>
  steps.forEach((s, i) => {
    if (!(s.chapter in chapterStart)) chapterStart[s.chapter] = starts[i]
  })
  const lookIndex = steps.findIndex((s) => s.kind === 'look')
  let tableIndex = -1
  steps.forEach((s, i) => {
    if (s.chapter === '10') tableIndex = i
  })
  return { steps, starts, total: acc, chapterStart, lookIndex, tableIndex }
}
