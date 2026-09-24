import { frameUrl, type ChapterId } from './data'

/**
 * Downloads and decodes image-sequence frames around the playhead.
 *
 * Compressed bytes (Blobs) are kept for the neighbouring chapters; only a
 * small window of frames is held decoded (ImageBitmap), so drawing any
 * frame in that window is instant and memory stays bounded on phones.
 */

type Job = { id: ChapterId; i: number; priority: number }

export class SequenceStore {
  private blobs = new Map<string, Blob>()
  private bitmaps = new Map<string, ImageBitmap>()
  private decoding = new Set<string>()
  private fetching = new Set<string>()
  private failed = new Set<string>()
  private queue: Job[] = []
  private active = 0
  private listeners = new Set<() => void>()
  /** Frames wanted decoded right now, by key. */
  private keep = new Set<string>()

  constructor(private concurrency = 6) {}

  static key(id: ChapterId, i: number) {
    return `${id}:${i}`
  }

  onChange(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private changed() {
    this.listeners.forEach((f) => f())
  }

  get(id: ChapterId, i: number) {
    return this.bitmaps.get(SequenceStore.key(id, i)) ?? null
  }

  hasFailed(id: ChapterId, i: number) {
    return this.failed.has(SequenceStore.key(id, i))
  }

  anyFailed() {
    return this.failed.size > 0
  }

  /**
   * Declare what is needed: `fetch` lists frames to download (in priority
   * order), `decode` the frames to hold decoded. Everything else decoded is
   * released.
   */
  plan(fetch: { id: ChapterId; i: number }[], decode: { id: ChapterId; i: number }[]) {
    this.queue = []
    fetch.forEach((f, n) => {
      const k = SequenceStore.key(f.id, f.i)
      if (!this.blobs.has(k) && !this.fetching.has(k) && !this.failed.has(k)) this.queue.push({ ...f, priority: n })
    })
    this.keep = new Set(decode.map((d) => SequenceStore.key(d.id, d.i)))
    for (const [k, bmp] of this.bitmaps) {
      if (!this.keep.has(k)) {
        bmp.close()
        this.bitmaps.delete(k)
      }
    }
    for (const d of decode) this.decode(d.id, d.i)
    this.pump()
  }

  /** Drop downloaded bytes of chapters that are far away. */
  forget(keepChapters: Set<ChapterId>) {
    for (const k of this.blobs.keys()) {
      if (!keepChapters.has(k.slice(0, 2) as ChapterId)) this.blobs.delete(k)
    }
  }

  private decode(id: ChapterId, i: number) {
    const k = SequenceStore.key(id, i)
    if (this.bitmaps.has(k) || this.decoding.has(k)) return
    const blob = this.blobs.get(k)
    if (!blob) return
    this.decoding.add(k)
    createImageBitmap(blob).then(
      (bmp) => {
        this.decoding.delete(k)
        if (this.keep.has(k)) {
          this.bitmaps.set(k, bmp)
          this.changed()
        } else bmp.close()
      },
      () => {
        this.decoding.delete(k)
        this.failed.add(k)
        this.changed()
      },
    )
  }

  private pump() {
    while (this.active < this.concurrency && this.queue.length) {
      const job = this.queue.shift()!
      const k = SequenceStore.key(job.id, job.i)
      if (this.blobs.has(k) || this.fetching.has(k)) continue
      this.fetching.add(k)
      this.active++
      fetch(frameUrl(job.id, job.i))
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then(
          (b) => {
            this.blobs.set(k, b)
            if (this.keep.has(k)) this.decode(job.id, job.i)
          },
          () => this.failed.add(k),
        )
        .finally(() => {
          this.fetching.delete(k)
          this.active--
          this.changed()
          this.pump()
        })
    }
  }

  /** Resolves once a frame is decoded (or has failed), or after `ms`. */
  whenReady(id: ChapterId, i: number, ms: number) {
    return new Promise<void>((resolve) => {
      const done = () => {
        off()
        clearTimeout(t)
        resolve()
      }
      const check = () => {
        if (this.get(id, i) || this.hasFailed(id, i)) done()
      }
      const off = this.onChange(check)
      const t = setTimeout(done, ms)
      check()
    })
  }

  destroy() {
    this.bitmaps.forEach((b) => b.close())
    this.bitmaps.clear()
    this.blobs.clear()
    this.queue = []
  }
}
