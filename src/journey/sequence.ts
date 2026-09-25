
/**
 * Downloads and decodes image-sequence frames around the playhead.
 *
 * Compressed bytes (Blobs) are kept for the neighbouring chapters; only a
 * small window of frames is held decoded (ImageBitmap), so drawing any
 * frame in that window is instant and memory stays bounded on phones.
 */

type Job = { i: number; priority: number }

export class SequenceStore {
  private blobs = new Map<number, Blob>()
  private bitmaps = new Map<number, ImageBitmap>()
  private decoding = new Set<number>()
  private fetching = new Set<number>()
  private failed = new Set<number>()
  private queue: Job[] = []
  private active = 0
  private listeners = new Set<() => void>()
  /** Frames wanted decoded right now, by key. */
  private keep = new Set<number>()

  constructor(
    private url: (i: number) => string,
    private concurrency = 6,
  ) {}

  onChange(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private changed() {
    this.listeners.forEach((f) => f())
  }

  get(i: number) {
    return this.bitmaps.get(i) ?? null
  }

  hasFailed(i: number) {
    return this.failed.has(i)
  }

  /** Whether a frame's bytes are downloaded. */
  has(i: number) {
    return this.blobs.has(i)
  }

  anyFailed() {
    return this.failed.size > 0
  }

  /**
   * Declare what is needed: `fetch` lists frames to download (in priority
   * order), `decode` the frames to hold decoded. Everything else decoded is
   * released. Downloaded bytes are kept (a few MB of WebP).
   */
  plan(fetch: number[], decode: number[]) {
    this.queue = []
    fetch.forEach((i, n) => {
      if (!this.blobs.has(i) && !this.fetching.has(i) && !this.failed.has(i)) this.queue.push({ i, priority: n })
    })
    this.keep = new Set(decode)
    for (const [k, bmp] of this.bitmaps) {
      if (!this.keep.has(k)) {
        bmp.close()
        this.bitmaps.delete(k)
      }
    }
    for (const i of decode) this.decode(i)
    this.pump()
  }

  private decode(i: number) {
    const k = i
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
      const k = job.i
      if (this.blobs.has(k) || this.fetching.has(k)) continue
      this.fetching.add(k)
      this.active++
      fetch(this.url(job.i))
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then(
          (b) => {
            this.blobs.set(k, b)
            if (this.keep.has(k)) this.decode(job.i)
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
  whenReady(i: number, ms: number) {
    return new Promise<void>((resolve) => {
      const done = () => {
        off()
        clearTimeout(t)
        resolve()
      }
      const check = () => {
        if (this.get(i) || this.hasFailed(i)) done()
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
