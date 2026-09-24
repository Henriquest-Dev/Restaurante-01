/**
 * A short, quiet service-bell tone synthesised with Web Audio, so no audio
 * file has to be downloaded. The AudioContext is only created after the
 * visitor explicitly enables sound.
 */

let ctx: AudioContext | null = null
let lastRing = 0

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
}

export function ringBell() {
  if (!ctx || ctx.state !== 'running') return
  const now = ctx.currentTime
  if (now - lastRing < 0.6) return
  lastRing = now

  const master = ctx.createGain()
  master.gain.value = 0.16
  master.connect(ctx.destination)

  // Inharmonic partials of a small brass bell.
  const partials: [number, number, number][] = [
    [1760, 1, 1.6],
    [2350, 0.45, 1.1],
    [4180, 0.25, 0.6],
    [5870, 0.12, 0.35],
  ]
  for (const [freq, amp, decay] of partials) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(amp, now + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, now + decay)
    osc.connect(g).connect(master)
    osc.start(now)
    osc.stop(now + decay + 0.05)
  }
}
