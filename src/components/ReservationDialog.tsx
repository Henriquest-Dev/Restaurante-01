import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { stillUrl } from '../journey/data'
import {
  createReservationService,
  ReservationError,
  type ReservationRequest,
  type ReservationResult,
} from '../reservations/service'

type Errors = Partial<Record<keyof ReservationRequest | 'contact', string>>

const today = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

const empty = (): ReservationRequest => ({
  date: '',
  time: '',
  partySize: 2,
  name: '',
  phone: '',
  email: '',
  notes: '',
  featuredTable: false,
})

function validate(r: ReservationRequest): Errors {
  const e: Errors = {}
  if (!r.date) e.date = 'Indique a data.'
  else if (r.date < today()) e.date = 'Escolha uma data a partir de hoje.'
  if (!r.time) e.time = 'Indique a hora.'
  else if (r.date === today()) {
    const now = new Date()
    const [h, m] = r.time.split(':').map(Number)
    if (h * 60 + m <= now.getHours() * 60 + now.getMinutes()) e.time = 'Escolha uma hora posterior à atual.'
  }
  if (!(r.partySize >= 1 && r.partySize <= 12)) e.partySize = 'Entre 1 e 12 pessoas.'
  if (r.name.trim().length < 2) e.name = 'Indique o seu nome.'
  const phone = r.phone.replace(/[\s()-]/g, '')
  if (!phone && !r.email.trim()) e.contact = 'Indique um telefone ou um e-mail.'
  if (phone && !/^\+?\d{7,15}$/.test(phone)) e.phone = 'Número de telefone inválido.'
  if (r.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim())) e.email = 'Endereço de e-mail inválido.'
  return e
}

interface Props {
  open: boolean
  featured: boolean
  onClose: () => void
}

export function ReservationDialog({ open, featured, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const service = useMemo(createReservationService, [])
  const [form, setForm] = useState<ReservationRequest>(empty)
  const [errors, setErrors] = useState<Errors>({})
  const [touched, setTouched] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<ReservationResult | null>(null)
  const idem = useRef(crypto.randomUUID())
  const uid = useId()
  const id = (n: string) => `${uid}-${n}`

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      setForm((f) => ({ ...f, featuredTable: featured || f.featuredTable }))
    }
    if (!open && d.open) d.close()
  }, [open, featured])

  const set = <K extends keyof ReservationRequest>(k: K, v: ReservationRequest[K]) => {
    const next = { ...form, [k]: v }
    setForm(next)
    if (touched) setErrors(validate(next))
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (status === 'sending') return
    setTouched(true)
    const e = validate(form)
    setErrors(e)
    if (Object.keys(e).length) {
      const first = ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      first?.focus()
      return
    }
    setStatus('sending')
    setMessage('')
    try {
      const r = await service.submit({ ...form, name: form.name.trim(), email: form.email.trim() }, idem.current)
      setResult(r)
      setStatus('idle')
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof ReservationError ? err.message : 'Ocorreu um erro inesperado. Tente novamente.')
    }
  }

  const reset = () => {
    setForm(empty())
    setErrors({})
    setTouched(false)
    setResult(null)
    setStatus('idle')
    idem.current = crypto.randomUUID()
  }

  const close = () => {
    if (result) reset()
    onClose()
  }

  const field = (k: keyof Errors) =>
    errors[k] ? { 'aria-invalid': true as const, 'aria-describedby': id(`${k}-err`) } : {}

  return (
    <dialog
      ref={ref}
      className="reserve"
      aria-labelledby={id('title')}
      onClose={close}
      onClick={(e) => {
        if (e.target === ref.current) close()
      }}
    >
      <div className="reserve__photo" aria-hidden="true" style={{ backgroundImage: `url(${stillUrl()})` }} />
      <div className="reserve__inner">
        <header className="reserve__head">
          <div>
            <p className="reserve__eyebrow">SALA · Maputo</p>
            <h2 id={id('title')}>Reservar mesa</h2>
          </div>
          <button type="button" className="round" onClick={close} aria-label="Fechar">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </button>
        </header>

        {result ? (
          <div className="reserve__done" role="status">
            {result.kind === 'confirmed' && (
              <>
                <p className="reserve__lead">Reserva confirmada.</p>
                {result.table && <p>Mesa {result.table}.</p>}
                {result.reference && <p>Referência: {result.reference}</p>}
              </>
            )}
            {result.kind === 'pending' && (
              <>
                <p className="reserve__lead">Pedido enviado.</p>
                <p>O restaurante irá contactá-lo para confirmar a disponibilidade. A reserva só fica garantida após essa confirmação.</p>
                {result.reference && <p>Referência: {result.reference}</p>}
              </>
            )}
            {result.kind === 'prototype' && (
              <>
                <p className="reserve__lead">Pedido guardado apenas neste dispositivo.</p>
                <p>
                  Esta é uma demonstração: o serviço de reservas ainda não está ligado, pelo que o pedido não foi
                  enviado ao restaurante e a reserva <strong>não</strong> está confirmada.
                </p>
                <p className="reserve__ref">Referência local: {result.reference}</p>
              </>
            )}
            <button type="button" className="pill pill--solid" onClick={close}>
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            {service.mode === 'prototype' && (
              <p className="reserve__notice">
                Demonstração — o pedido fica guardado neste dispositivo e não é enviado ao restaurante.
              </p>
            )}
            <div className="reserve__row">
              <div className="f">
                <label htmlFor={id('date')}>Data</label>
                <input id={id('date')} type="date" min={today()} value={form.date} onChange={(e) => set('date', e.target.value)} required {...field('date')} />
                {errors.date && <p className="f__err" id={id('date-err')}>{errors.date}</p>}
              </div>
              <div className="f">
                <label htmlFor={id('time')}>Hora</label>
                <input id={id('time')} type="time" step={900} value={form.time} onChange={(e) => set('time', e.target.value)} required {...field('time')} />
                {errors.time && <p className="f__err" id={id('time-err')}>{errors.time}</p>}
              </div>
            </div>
            <div className="f">
              <span className="f__label" id={id('party')}>Pessoas</span>
              <div className="stepper" role="group" aria-labelledby={id('party')}>
                <button type="button" onClick={() => set('partySize', Math.max(1, form.partySize - 1))} disabled={form.partySize <= 1} aria-label="Menos uma pessoa">−</button>
                <output aria-live="polite">{form.partySize} {form.partySize === 1 ? 'pessoa' : 'pessoas'}</output>
                <button type="button" onClick={() => set('partySize', Math.min(12, form.partySize + 1))} disabled={form.partySize >= 12} aria-label="Mais uma pessoa">+</button>
              </div>
              {errors.partySize && <p className="f__err" id={id('partySize-err')}>{errors.partySize}</p>}
            </div>
            <div className="f">
              <label htmlFor={id('name')}>Nome</label>
              <input id={id('name')} autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} required {...field('name')} />
              {errors.name && <p className="f__err" id={id('name-err')}>{errors.name}</p>}
            </div>
            <fieldset className="reserve__contact" aria-describedby={errors.contact ? id('contact-err') : undefined}>
              <legend>Contacto <span className="f__hint">(telefone ou e-mail)</span></legend>
              <div className="reserve__row">
                <div className="f">
                  <label htmlFor={id('phone')}>Telefone</label>
                  <input id={id('phone')} type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} {...field(errors.phone ? 'phone' : 'contact')} />
                  {errors.phone && <p className="f__err" id={id('phone-err')}>{errors.phone}</p>}
                </div>
                <div className="f">
                  <label htmlFor={id('email')}>E-mail</label>
                  <input id={id('email')} type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} {...field(errors.email ? 'email' : 'contact')} />
                  {errors.email && <p className="f__err" id={id('email-err')}>{errors.email}</p>}
                </div>
              </div>
              {errors.contact && <p className="f__err" id={id('contact-err')}>{errors.contact}</p>}
            </fieldset>
            <div className="f">
              <label htmlFor={id('notes')}>Observações <span className="f__hint">(opcional)</span></label>
              <textarea id={id('notes')} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
            <label className="check">
              <input type="checkbox" checked={form.featuredTable} onChange={(e) => set('featuredTable', e.target.checked)} />
              <span>Preferência pela mesa em destaque, se possível</span>
            </label>
            <div aria-live="polite" className="reserve__status">
              {status === 'error' && <p className="f__err">{message}</p>}
            </div>
            <button type="submit" className="pill pill--solid pill--wide" disabled={status === 'sending'} aria-busy={status === 'sending'}>
              {status === 'sending' ? 'A enviar…' : service.mode === 'prototype' ? 'Guardar pedido' : 'Enviar pedido'}
            </button>
          </form>
        )}
      </div>
    </dialog>
  )
}
