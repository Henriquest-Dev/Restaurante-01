/**
 * Loads and decodes frames on demand with a small concurrency limit.
 * Frames are requested around the current scroll position, so the full set
 * is never fetched up front.
 */

type Entry = { img: HTMLImageElement; state: 'loading' | 'ready' | 'failed'; priority: number }

export class FrameStore {
  private entries = new Map<string, Entry>()
  private queue: { key: string; url: string; priority: number }[] = []
  private active = 0
  private listeners = new Set<(key: string) => void>()

  constructor(private concurrency = 4) {}

  onChange(fn: (key: string) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  get(key: string): HTMLImageElement | null {
    const e = this.entries.get(key)
    return e && e.state === 'ready' ? e.img : null
  }

  failed(key: string) {
    return this.entries.get(key)?.state === 'failed'
  }

  settled(key: string) {
    const s = this.entries.get(key)?.state
    return s === 'ready' || s === 'failed'
  }

  /** Lower priority values load first. Re-requesting raises priority. */
  request(key: string, url: string, priority = 10) {
    if (this.entries.has(key)) return
    const queued = this.queue.find((q) => q.key === key)
    if (queued) {
      queued.priority = Math.min(queued.priority, priority)
    } else {
      this.queue.push({ key, url, priority })
    }
    this.pump()
  }

  /** Resolves once every key has loaded or failed. */
  whenSettled(keys: string[]): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (keys.every((k) => this.settled(k))) {
          off()
          resolve()
        }
      }
      const off = this.onChange(check)
      check()
    })
  }

  private pump() {
    while (this.active < this.concurrency && this.queue.length) {
      this.queue.sort((a, b) => a.priority - b.priority)
      const { key, url, priority } = this.queue.shift()!
      const img = new Image()
      img.decoding = 'async'
      const entry: Entry = { img, state: 'loading', priority }
      this.entries.set(key, entry)
      this.active++
      const done = (ok: boolean) => {
        entry.state = ok ? 'ready' : 'failed'
        this.active--
        this.listeners.forEach((fn) => fn(key))
        this.pump()
      }
      img.onload = () => {
        // decode() keeps the first paint of a new frame off the scroll path.
        img.decode().then(
          () => done(true),
          () => done(img.naturalWidth > 0),
        )
      }
      img.onerror = () => done(false)
      img.src = url
    }
  }
}
