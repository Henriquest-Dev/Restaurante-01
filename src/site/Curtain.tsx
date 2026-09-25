import { useEffect, useState } from 'react'

const loaded = new Set<string>()

function load(url: string) {
  if (loaded.has(url)) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      img.decode().catch(() => {}).finally(() => {
        loaded.add(url)
        resolve()
      })
    }
    img.onerror = () => resolve()
    img.src = url
  })
}

/** Warm the browser cache with images the visitor will need soon. */
export function preloadIdle(urls: string[]) {
  const run = () => urls.reduce((p, u) => p.then(() => load(u)), Promise.resolve())
  const ric = (window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback
  if (ric) ric(run)
  else setTimeout(run, 1200)
}

/**
 * Opening curtain: black, the SALA mark and a thin gold line that fills as
 * the page's essential images and fonts arrive. Lifts when everything is
 * ready (or after a few seconds, so nobody waits on a slow network).
 */
export function Curtain({ urls, onDone }: { urls: string[]; onDone: () => void }) {
  const [progress, setProgress] = useState(0)
  const [lifting, setLifting] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    let done = 0
    let finished = false
    const total = urls.length + 1
    const tick = () => setProgress(++done / total)
    const finish = () => {
      if (finished) return
      finished = true
      setProgress(1)
      setTimeout(() => {
        setLifting(true)
        onDone()
        setTimeout(() => setGone(true), 1400)
      }, 350)
    }
    Promise.all([...urls.map((u) => load(u).then(tick)), document.fonts.ready.then(tick)]).then(finish)
    const t = setTimeout(finish, 6500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (gone) return null
  return (
    <div className={`curtain ${lifting ? 'is-lifting' : ''}`} role="status" aria-label={lifting ? undefined : 'A carregar'}>
      <p className="curtain__mark">SALA</p>
      <span className="curtain__line"><span style={{ transform: `scaleX(${progress})` }} /></span>
      <p className="curtain__pct" aria-hidden="true">{Math.round(progress * 100)}</p>
    </div>
  )
}
