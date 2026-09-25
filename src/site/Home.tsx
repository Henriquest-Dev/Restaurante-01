import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { createReservationService, ReservationError } from '../reservations/service'
import { BOOKING, EVENTS, HERO, MENU_INTRO, POPULAR, REVIEWS, SERVICES, SITE, SPACE, STORY } from './content'
import { Dust, reducedMotion, Reveal, Roll, scrollToEl, useSmoothScroll } from './fx'
import { Icon } from './icons'
import { Nav } from './Nav'
import './home.css'

gsap.registerPlugin(ScrollTrigger, SplitText)

const BASE = import.meta.env.BASE_URL
const cloud = (n: number) => `${BASE}assets/site/clouds/cloud-${n}.webp`

export default function Home({ section }: { section: string }) {
  useSmoothScroll()
  const root = useRef<HTMLDivElement>(null)

  // #/sobre and #/eventos scroll to their section.
  useEffect(() => {
    const id = section === 'sobre' ? 'sobre' : section === 'eventos' ? 'eventos' : ''
    if (id) setTimeout(() => scrollToEl(document.getElementById(id)), 60)
    else window.scrollTo(0, 0)
  }, [section])

  useEffect(() => {
    if (reducedMotion()) return
    const ctx = gsap.context(() => {
      // Hero: the text drifts up and the pan turns as the page moves.
      gsap.to('.h-hero__text', { yPercent: -40, autoAlpha: 0, ease: 'none', scrollTrigger: { trigger: '.h-hero', start: 'top top', end: 'bottom top', scrub: true } })
      gsap.to('.h-hero__plate', { rotate: 40, yPercent: -18, ease: 'none', scrollTrigger: { trigger: '.h-hero', start: 'top top', end: 'bottom top', scrub: true } })

      // Sky: drifting clouds, the SALA mark between them, then the camera
      // passes through the clouds and comes down to the entrance.
      const sky = gsap.timeline({ scrollTrigger: { trigger: '.h-sky', start: 'top top', end: 'bottom bottom', scrub: 0.8 } })
      sky
        .fromTo('.h-sky__back', { yPercent: 0 }, { yPercent: -18, ease: 'none', duration: 0.6 }, 0)
        .fromTo('.h-cl--f1', { xPercent: 0, yPercent: 0, scale: 1 }, { xPercent: -70, yPercent: 10, scale: 1.25, ease: 'power1.inOut', duration: 0.45 }, 0)
        .fromTo('.h-cl--f2', { xPercent: 0, yPercent: 0, scale: 1 }, { xPercent: 70, yPercent: -10, scale: 1.3, ease: 'power1.inOut', duration: 0.45 }, 0)
        .fromTo('.h-cl--f3', { xPercent: 0, scale: 1 }, { xPercent: -40, scale: 1.2, ease: 'power1.inOut', duration: 0.5 }, 0)
        .fromTo('.h-cl--f4', { xPercent: 0, scale: 1 }, { xPercent: 45, scale: 1.2, ease: 'power1.inOut', duration: 0.5 }, 0)
        .fromTo('.h-sky__mark', { autoAlpha: 0, letterSpacing: '0.9em', filter: 'blur(14px)' }, { autoAlpha: 1, letterSpacing: '0.3em', filter: 'blur(0px)', ease: 'power2.out', duration: 0.25 }, 0.14)
        .fromTo('.h-sky__sub', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.12 }, 0.3)
        // Through the clouds: everything rushes past and dissolves.
        .to('.h-sky__logo', { scale: 1.6, autoAlpha: 0, ease: 'power2.in', duration: 0.18 }, 0.52)
        .to('.h-sky__front', { scale: 3.2, autoAlpha: 0, ease: 'power2.in', duration: 0.3 }, 0.5)
        .to('.h-sky__back', { scale: 2.4, autoAlpha: 0, ease: 'power2.in', duration: 0.2 }, 0.5)
        .to('.h-sky__air, .h-sky__stars', { autoAlpha: 0, duration: 0.2 }, 0.62)
        .fromTo('.h-sky__door', { autoAlpha: 0, scale: 1.35, filter: 'blur(10px) brightness(0.7)' }, { autoAlpha: 1, scale: 1, filter: 'blur(0px) brightness(1)', ease: 'power2.out', duration: 0.33 }, 0.64)
        .fromTo('.h-sky__caption', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.12 }, 0.84)

      // Plates turn slowly as they pass.
      gsap.utils.toArray<HTMLElement>('.h-dish__plate').forEach((el, i) => {
        gsap.fromTo(el, { rotate: i % 2 ? 50 : -50 }, { rotate: i % 2 ? -30 : 30, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } })
      })
      // Booking background drifts slower than the page.
      gsap.fromTo('.h-book__photo', { yPercent: -12 }, { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.h-book', start: 'top bottom', end: 'bottom top', scrub: true } })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <div className="h" ref={root}>
      <Dust className="h-dust" density={0.6} />
      <Nav current={section === 'sobre' ? '#/sobre' : section === 'eventos' ? '#/eventos' : '#/'} />

      <main>
        {/* ------------------------------------------------ hero */}
        <section className="h-hero" aria-label="Início">
          <div className="h-hero__text">
            <h1 className="h-hero__title">
              {HERO.lines.map((l, i) => (
                <Roll key={l} className="h-hero__line" delay={0.3 + i * 0.18} onLoad>{l}</Roll>
              ))}
            </h1>
            <Reveal delay={0.9} y={16}>
              <a className="h-btn" href="#/reservar">{HERO.cta}</a>
            </Reveal>
          </div>
          <div className="h-hero__art" aria-hidden="true">
            <img className="h-hero__splash" src={`${BASE}assets/site/splash.webp`} alt="" />
            <img className="h-hero__plate" src={HERO.plate} alt="" />
          </div>
        </section>

        {/* ------------------------------------------------ sky → logo → entrance */}
        <section className="h-sky" aria-label="SALA — a entrada">
          <div className="h-sky__sticky">
            <div className="h-sky__air" aria-hidden="true" />
            <div className="h-sky__stars" aria-hidden="true" />
            <picture className="h-sky__door">
              <source media="(orientation: portrait)" srcSet={SPACE.doorTall} />
              <img src={SPACE.door} alt="A entrada do restaurante SALA" />
            </picture>
            <div className="h-sky__back" aria-hidden="true">
              <img className="h-cl h-cl--b1" src={cloud(2)} alt="" />
              <img className="h-cl h-cl--b2" src={cloud(4)} alt="" />
              <img className="h-cl h-cl--b3" src={cloud(1)} alt="" />
            </div>
            <div className="h-sky__logo">
              <p className="h-sky__mark">SALA</p>
              <p className="h-sky__sub">Restaurante · Maputo</p>
            </div>
            <div className="h-sky__front" aria-hidden="true">
              <img className="h-cl h-cl--f1" src={cloud(3)} alt="" />
              <img className="h-cl h-cl--f2" src={cloud(1)} alt="" />
              <img className="h-cl h-cl--f3" src={cloud(4)} alt="" />
              <img className="h-cl h-cl--f4" src={cloud(2)} alt="" />
            </div>
            <p className="h-sky__caption">{SPACE.title}</p>
          </div>
        </section>

        {/* ------------------------------------------------ story */}
        <section className="h-story h-wrap" id="sobre">
          <div className="h-story__text">
            <Reveal as="p" className="h-kicker">{STORY.kicker}</Reveal>
            <Roll as="h2" className="h-title">{STORY.title}</Roll>
            <Reveal as="p" className="h-body" delay={0.15}>{STORY.text}</Reveal>
            <Reveal delay={0.25}>
              <a className="h-underline" href="#/reservar">{STORY.link}</a>
            </Reveal>
          </div>
          <Reveal className="h-story__photo" delay={0.1}>
            <img src={STORY.image} alt="Mesas junto às janelas da SALA" loading="lazy" />
          </Reveal>
          <Reveal className="h-info" delay={0.1}>
            <div className="h-info__item">
              <Icon name="pin" />
              <div><p className="h-info__label">Onde estamos</p><p className="h-info__value">{SITE.city}</p></div>
            </div>
            <div className="h-info__item">
              <Icon name="clock" />
              <div><p className="h-info__label">Horário</p><p className="h-info__value">{SITE.hours}</p></div>
            </div>
            <a className="h-info__item" href="#/reservar">
              <Icon name="book" />
              <div><p className="h-info__label">Reservas</p><p className="h-info__value">{SITE.phone}</p></div>
            </a>
          </Reveal>
        </section>

        {/* ------------------------------------------------ menu */}
        <section className="h-menu h-wrap" aria-labelledby="h-menu-title">
          <div className="h-menu__head">
            <div>
              <Reveal as="p" className="h-kicker">{MENU_INTRO.kicker}</Reveal>
              <Roll as="h2" className="h-title">{MENU_INTRO.title}</Roll>
            </div>
            <Reveal as="p" className="h-body h-menu__intro" delay={0.15}>{MENU_INTRO.text}</Reveal>
          </div>
          {MENU_INTRO.groups.map((g, i) => (
            <div key={g.title} className={`h-dish ${i % 2 ? 'h-dish--flip' : ''}`}>
              <div className="h-dish__art" aria-hidden="true">
                <img className="h-dish__splash" src={`${BASE}assets/site/splash.webp`} alt="" loading="lazy" />
                <img className="h-dish__plate" src={g.image} alt="" loading="lazy" />
              </div>
              <div className="h-dish__text">
                <Roll as="h3" className="h-subtitle">{g.title}</Roll>
                <Reveal as="p" className="h-small" delay={0.1}>{g.text}</Reveal>
                <Reveal delay={0.2}>
                  <a className="h-btn" href="#/menu">{MENU_INTRO.cta}</a>
                </Reveal>
              </div>
            </div>
          ))}
        </section>

        {/* ------------------------------------------------ popular */}
        <section className="h-popular h-wrap" aria-labelledby="h-pop">
          <div className="h-panel">
            <Reveal as="p" className="h-kicker">{POPULAR.kicker}</Reveal>
            <Roll as="h2" className="h-title h-title--sans">{POPULAR.title}</Roll>
            <div className="h-cards">
              {POPULAR.dishes.map((d, i) => (
                <Reveal key={d.name} className="h-card" delay={i * 0.12}>
                  <div className="h-card__img"><img src={d.image} alt={d.name} loading="lazy" /></div>
                  <div className="h-card__row">
                    <h3>{d.name}</h3>
                    {d.price && <span>{d.price}</span>}
                  </div>
                  <p>{d.text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ services + events */}
        <section className="h-services h-wrap" id="eventos">
          <div className="h-services__head">
            <div>
              <Reveal as="p" className="h-kicker h-kicker--line">{SERVICES.kicker}</Reveal>
              <Roll as="h2" className="h-title">{SERVICES.title}</Roll>
              <Reveal as="p" className="h-small" delay={0.1}>{SERVICES.text}</Reveal>
            </div>
            <ul className="h-services__list">
              {SERVICES.items.map((s, i) => (
                <Reveal as="li" key={s.label} delay={0.1 + i * 0.1}>
                  <span className="h-service">
                    <Icon name={s.icon} />
                    <span>{s.label}</span>
                  </span>
                </Reveal>
              ))}
            </ul>
          </div>
          <Reveal className="h-event">
            <div className="h-event__text">
              <p className="h-kicker">{EVENTS.kicker}</p>
              <Roll as="h3" className="h-title h-title--sans">{EVENTS.title}</Roll>
              <p className="h-small">{EVENTS.text}</p>
              <p className="h-event__meta">
                <span className="h-event__name">{EVENTS.event.name}</span>
                <span>{EVENTS.event.date}</span>
                <span>{EVENTS.event.place}</span>
              </p>
              <p className="h-small">{EVENTS.note}</p>
            </div>
            <div className="h-event__photo"><img src={EVENTS.image} alt="A sala ao anoitecer" loading="lazy" /></div>
          </Reveal>
        </section>

        {/* ------------------------------------------------ reviews */}
        <Reviews />

        {/* ------------------------------------------------ booking */}
        <section className="h-book" aria-labelledby="h-book-title">
          <img className="h-book__photo" src={BOOKING.image} alt="" loading="lazy" />
          <div className="h-book__inner">
            <Reveal as="p" className="h-kicker h-kicker--center">{BOOKING.kicker}</Reveal>
            <Roll as="h2" className="h-title h-title--sans h-title--center">{BOOKING.title}</Roll>
            <BookingForm />
            <a className="h-underline h-book__film" href="#/reservar">{BOOKING.experience} →</a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

/* ================================================================ reviews */

const REEL_MS = 7000
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI']

/**
 * Testimonials as a film sequence: each one is a "shot" with its own
 * photograph (slow push-in), the quote appears word by word like a
 * subtitle, and a reel timeline at the bottom advances on its own.
 */
function Reviews() {
  const root = useRef<HTMLElement>(null)
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)
  const inView = useRef(false)
  const n = REVIEWS.items.length
  const go = useCallback((k: number) => setI(((k % n) + n) % n), [n])

  // Word-by-word entrance of the current quote.
  useLayoutEffect(() => {
    const el = root.current!.querySelector<HTMLElement>('.h-reel__quote')!
    if (reducedMotion()) return
    const split = SplitText.create(el, { type: 'words', wordsClass: 'w' })
    const tl = gsap.timeline()
    tl.fromTo(split.words, { autoAlpha: 0, y: 18, filter: 'blur(8px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.9, stagger: 0.035, ease: 'power3.out' })
      .fromTo('.h-reel__who', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.3)
    return () => {
      tl.kill()
      split.revert()
    }
  }, [i])

  // Auto-advance while visible and not paused.
  useEffect(() => {
    const el = root.current!
    const io = new IntersectionObserver(([e]) => (inView.current = e.isIntersecting), { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!playing || reducedMotion()) return
    const t = setInterval(() => inView.current && go(i + 1), REEL_MS)
    return () => clearInterval(t)
  }, [i, playing, go])

  const swipe = useRef<number | null>(null)
  const photos = [REVIEWS.image, STORY.image, EVENTS.image, BOOKING.image]
  const r = REVIEWS.items[i]

  return (
    <section
      className="h-reel"
      ref={root}
      aria-roledescription="carrossel"
      aria-label={REVIEWS.title}
      onMouseEnter={() => setPlaying(false)}
      onMouseLeave={() => setPlaying(true)}
      onFocus={() => setPlaying(false)}
      onPointerDown={(e) => (swipe.current = e.clientX)}
      onPointerUp={(e) => {
        const x = swipe.current
        swipe.current = null
        if (x !== null && Math.abs(e.clientX - x) > 50) go(i + (e.clientX < x ? 1 : -1))
      }}
    >
      <div className="h-reel__shots" aria-hidden="true">
        {REVIEWS.items.map((it, k) => (
          <img key={it.name} className={`h-reel__shot ${k === i ? 'is-on' : ''}`} src={photos[k % photos.length]} alt="" loading="lazy" />
        ))}
      </div>
      <div className="h-reel__shade" aria-hidden="true" />
      <div className="h-reel__bars" aria-hidden="true"><span /><span /></div>

      <div className="h-reel__head h-wrap">
        <p className="h-kicker h-kicker--line">{REVIEWS.kicker}</p>
        <Roll as="h2" className="h-title h-title--sans">{REVIEWS.title}</Roll>
      </div>

      <figure className="h-reel__frame h-wrap" aria-live="polite">
        <blockquote className="h-reel__quote" key={i}>“{r.text}”</blockquote>
        <figcaption className="h-reel__who" key={`w${i}`}>
          <span className="h-reel__name">{r.name}</span>
          <span className="h-stars" aria-label={`${r.stars} de 5 estrelas`}>{'★★★★★'.slice(0, r.stars)}<i>{'★★★★★'.slice(r.stars)}</i></span>
        </figcaption>
      </figure>

      <div className="h-reel__timeline h-wrap">
        <p className="h-note">{REVIEWS.note}</p>
        <ol>
          {REVIEWS.items.map((it, k) => (
            <li key={it.name}>
              <button className={k === i ? 'is-on' : k < i ? 'is-past' : ''} onClick={() => go(k)} aria-label={`Testemunho ${k + 1}: ${it.name}`} aria-current={k === i ? 'true' : undefined}>
                <span className="h-reel__num">{NUMERALS[k]}</span>
                <span className="h-reel__track"><span style={{ animationDuration: `${REEL_MS}ms`, animationPlayState: playing ? 'running' : 'paused' }} key={`${k}-${i}`} /></span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ================================================================ booking */

function BookingForm() {
  const service = useRef(createReservationService()).current
  const [f, setF] = useState({ name: '', persons: '2', time: '', date: '', contact: '' })
  const [err, setErr] = useState<string>('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle')
  const [result, setResult] = useState('')
  const idem = useRef(crypto.randomUUID())
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const today = new Date().toISOString().slice(0, 10)
    const email = /@/.test(f.contact)
    if (f.name.trim().length < 2) return setErr('Indique o seu nome.')
    if (!f.date || f.date < today) return setErr('Escolha uma data a partir de hoje.')
    if (!f.time) return setErr('Indique a hora.')
    if (!f.contact.trim() || (email ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contact) : !/^\+?[\d\s()-]{7,20}$/.test(f.contact)))
      return setErr('Indique um telefone ou e-mail válido.')
    setErr('')
    setStatus('sending')
    try {
      const r = await service.submit(
        {
          name: f.name.trim(), partySize: Number(f.persons), date: f.date, time: f.time,
          phone: email ? '' : f.contact.trim(), email: email ? f.contact.trim() : '', notes: '', featuredTable: false,
        },
        idem.current,
      )
      setStatus('done')
      setResult(
        r.kind === 'confirmed' ? 'Reserva confirmada.' :
        r.kind === 'pending' ? 'Pedido enviado. O restaurante vai contactá-lo para confirmar.' :
        'Pedido guardado apenas neste dispositivo: o serviço de reservas ainda não está ligado, por isso não foi enviado nem confirmado.',
      )
    } catch (x) {
      setStatus('idle')
      setErr(x instanceof ReservationError ? x.message : 'Não foi possível enviar. Tente novamente.')
    }
  }

  if (status === 'done') return <p className="h-book__done" role="status">{result}</p>
  return (
    <form className="h-form" onSubmit={submit} noValidate>
      <label><span className="sr-only">Nome</span><input placeholder="Nome" autoComplete="name" value={f.name} onChange={set('name')} /></label>
      <label>
        <span className="sr-only">Pessoas</span>
        <select value={f.persons} onChange={set('persons')} aria-label="Pessoas">
          {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1} {i ? 'pessoas' : 'pessoa'}</option>)}
        </select>
      </label>
      <label><span className="sr-only">Hora</span><input type="time" step={900} value={f.time} onChange={set('time')} aria-label="Hora" /></label>
      <label><span className="sr-only">Data</span><input type="date" value={f.date} onChange={set('date')} aria-label="Data" /></label>
      <label className="h-form__wide"><span className="sr-only">Telefone ou e-mail</span><input placeholder="Telefone ou e-mail" value={f.contact} onChange={set('contact')} /></label>
      <p className="h-form__err" role="alert">{err}</p>
      {service.mode === 'prototype' && <p className="h-form__note">Demonstração: o pedido fica guardado neste dispositivo.</p>}
      <button className="h-btn h-form__submit" disabled={status === 'sending'}>{status === 'sending' ? 'A enviar…' : 'Reservar mesa'}</button>
    </form>
  )
}

/* ================================================================ footer */

function Footer() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const subscribe = (e: FormEvent) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMsg('Indique um e-mail válido.')
    try {
      const list = JSON.parse(localStorage.getItem('sala.newsletter') || '[]') as string[]
      if (!list.includes(email)) localStorage.setItem('sala.newsletter', JSON.stringify([...list, email]))
    } catch { /* storage unavailable */ }
    setMsg('Guardado neste dispositivo (demonstração: a lista de correio ainda não está ligada).')
    setEmail('')
  }
  return (
    <footer className="h-foot h-wrap">
      <nav className="h-foot__links" aria-label="Rodapé">
        <a href="#/">Início</a>
        <a href="#/sobre">Sobre</a>
        <a href="#/menu">Menu</a>
        <a href="#/eventos">Eventos</a>
      </nav>
      <form className="h-foot__news" onSubmit={subscribe} noValidate>
        <p>Subscreva a nossa lista de correio.</p>
        <p>Novidades e eventos.</p>
        <div className="h-foot__field">
          <input type="email" placeholder="E-mail" aria-label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button>Subscrever</button>
        </div>
        <p className="h-foot__msg" role="status">{msg}</p>
      </form>
      <div className="h-foot__contacts">
        <p className="h-kicker h-kicker--line">Contactos</p>
        <p>{SITE.phone}</p>
        <p>{SITE.city}</p>
        <p>{SITE.email}</p>
        <p className="h-foot__social">
          <a href={SITE.social.instagram} aria-label="Instagram"><Icon name="instagram" /></a>
          <a href={SITE.social.facebook} aria-label="Facebook"><Icon name="facebook" /></a>
          <a href={SITE.social.twitter} aria-label="Twitter"><Icon name="twitter" /></a>
        </p>
      </div>
    </footer>
  )
}
