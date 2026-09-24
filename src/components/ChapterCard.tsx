import { gsap } from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { useLayoutEffect, useRef } from 'react'
import type { Chapter, ChapterId } from '../journey/data'

gsap.registerPlugin(SplitText)

interface Props {
  chapter: Chapter
  register: (id: ChapterId, scrub: ((q: number, o: number) => void) | null) => void
}

/**
 * A film chapter card: numeral, a title revealed letter by letter behind a
 * mask, and a subtitle. The timeline never plays by itself; it is scrubbed
 * by the chapter's scroll progress.
 */
export function ChapterCard({ chapter, register }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const kicker = useRef<HTMLParagraphElement>(null)
  const sub = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    const split = SplitText.create(title.current!, { type: 'chars', mask: 'chars', charsClass: 'char' })
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } })
    tl.fromTo(kicker.current, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.07, ease: 'power2.out' }, 0.02)
      .fromTo(split.chars, { yPercent: 115 }, { yPercent: 0, duration: 0.12, stagger: 0.012, ease: 'power3.out' }, 0.03)
    if (sub.current) {
      tl.fromTo(sub.current, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.08, ease: 'power2.out' }, 0.3)
        .to(sub.current, { autoAlpha: 0, duration: 0.06 }, 0.64)
    }
    tl.to(split.chars, { yPercent: -115, duration: 0.12, stagger: 0.01, ease: 'power3.in' }, 0.74)
      .to(kicker.current, { autoAlpha: 0, duration: 0.06 }, 0.8)
      .set({}, {}, 1)
    const el = root.current!
    register(chapter.id, (q, o) => {
      tl.progress(q)
      el.style.opacity = String(o)
      el.style.visibility = o > 0.01 && q > 0.02 && q < 0.99 ? 'visible' : 'hidden'
    })
    return () => {
      register(chapter.id, null)
      tl.kill()
      split.revert()
    }
  }, [chapter.id, register])

  return (
    <div className="chapter" ref={root} style={{ visibility: 'hidden' }}>
      <p className="chapter__kicker" ref={kicker}>
        Capítulo {chapter.numeral}
      </p>
      <h2 className="chapter__title" ref={title}>
        {chapter.title}
      </h2>
      {chapter.subtitle && (
        <p className="chapter__subtitle" ref={sub}>
          {chapter.subtitle}
        </p>
      )}
    </div>
  )
}
