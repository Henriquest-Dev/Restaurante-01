import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createReservationService, ReservationError } from '../reservations/service'
import { BOOKING, EVENTS, HERO, MENU_INTRO, POPULAR, REVIEWS, SERVICES, SITE, SPACE, STORY } from './content'
import { Dust, reducedMotion, Reveal, Roll, scrollToEl, useSmoothScroll } from './fx'
import { Icon } from './icons'
import { Nav } from './Nav'
import './home.css'

gsap.registerPlugin(ScrollTrigger)

const BASE = import.meta.env.BASE_URL

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

      // Clouds part to reveal the room.
      const tl = gsap.timeline({ scrollTrigger: { trigger: '.h-space', start: 'top top', end: 'bottom bottom', scrub: 0.6 } })
      tl.fromTo('.h-space__photo', { scale: 1.35, filter: 'brightness(0.55)' }, { scale: 1, filter: 'brightness(1)', ease: 'none', duration: 1 }, 0)
        .fromTo('.h-cloud--l1', { xPercent: 0, yPercent: 0, scale: 1 }, { xPercent: -95, yPercent: -30, scale: 1.5, ease: 'power1.in', duration: 0.8 }, 0)
        .fromTo('.h-cloud--l2', { xPercent: 0, yPercent: 0, scale: 1 }, { xPercent: -110, yPercent: 40, scale: 1.7, ease: 'power1.in', duration: 0.85 }, 0.05)
        .fromTo('.h-cloud--r1', { xPercent: 0, yPercent: 0, scale: 1 }, { xPercent: 100, yPercent: -40, scale: 1.6, ease: 'power1.in', duration: 0.8 }, 0.02)
        .fromTo('.h-cloud--r2', { xPercent: 0, yPercent: 0, scale: 1 }, { xPercent: 115, yPercent: 35, scale: 1.8, ease: 'power1.in', duration: 0.9 }, 0.08)
        .fromTo('.h-cloud--c', { yPercent: 0, scale: 1, autoAlpha: 1 }, { yPercent: 70, scale: 2.2, autoAlpha: 0, ease: 'power1.in', duration: 0.7 }, 0.1)
        .fromTo('.h-space__title', { autoAlpha: 0, y: 40, letterSpacing: '0.3em' }, { autoAlpha: 1, y: 0, letterSpacing: '0.02em', ease: 'power2.out', duration: 0.35 }, 0.45)
        .to('.h-space__title', { autoAlpha: 0, y: -30, duration: 0.2 }, 0.95)
        .fromTo('.h-space__frame', { clipPath: 'inset(0% 0% 0% 0% round 0px)' }, { clipPath: 'inset(6% 5% 6% 5% round 18px)', ease: 'power2.inOut', duration: 0.3 }, 0.9)

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

        {/* ------------------------------------------------ cloud reveal */}
        <section className="h-space" aria-label={SPACE.title}>
          <div className="h-space__sticky">
            <div className="h-space__frame">
              <img className="h-space__photo" src={SPACE.image} alt="A sala do restaurante SALA" />
            </div>
            <h2 className="h-space__title">{SPACE.title}</h2>
            <img className="h-cloud h-cloud--l1" src={`${BASE}assets/site/clouds/cloud-1.webp`} alt="" />
            <img className="h-cloud h-cloud--r1" src={`${BASE}assets/site/clouds/cloud-2.webp`} alt="" />
            <img className="h-cloud h-cloud--c" src={`${BASE}assets/site/clouds/cloud-3.webp`} alt="" />
            <img className="h-cloud h-cloud--l2" src={`${BASE}assets/site/clouds/cloud-4.webp`} alt="" />
            <img className="h-cloud h-cloud--r2" src={`${BASE}assets/site/clouds/cloud-1.webp`} alt="" />
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

function Reviews() {
  const track = useRef<HTMLDivElement>(null)
  const move = (dir: number) => {
    const t = track.current
    if (!t) return
    const card = t.querySelector<HTMLElement>('.h-review')
    t.scrollBy({ left: dir * ((card?.offsetWidth ?? 260) + 16), behavior: reducedMotion() ? 'auto' : 'smooth' })
  }
  return (
    <section className="h-reviews h-wrap" aria-labelledby="h-rev">
      <div className="h-reviews__head">
        <div>
          <Reveal as="p" className="h-kicker h-kicker--line">{REVIEWS.kicker}</Reveal>
          <Roll as="h2" className="h-title h-title--sans">{REVIEWS.title}</Roll>
          <p className="h-note">{REVIEWS.note}</p>
        </div>
        <div className="h-arrows">
          <button onClick={() => move(-1)} aria-label="Anterior"><span className="h-arrow h-arrow--l" /></button>
          <button onClick={() => move(1)} aria-label="Seguinte"><span className="h-arrow" /></button>
        </div>
      </div>
      <div className="h-reviews__track" ref={track} tabIndex={0} aria-label="Testemunhos">
        <div className="h-review h-review--photo"><img src={REVIEWS.image} alt="Receção da SALA" loading="lazy" /></div>
        {REVIEWS.items.map((r) => (
          <article key={r.name} className="h-review">
            <header>
              <span>{r.name}</span>
              <span className="h-stars" aria-label={`${r.stars} de 5 estrelas`}>
                {'★★★★★'.slice(0, r.stars)}
                <i>{'★★★★★'.slice(r.stars)}</i>
              </span>
            </header>
            <p>{r.text}</p>
          </article>
        ))}
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
