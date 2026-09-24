/**
 * Reservation integration boundary.
 *
 * The photographs say nothing about availability, so the UI never shows a
 * table number or an "available" state on its own. It only reports what the
 * active service actually returns.
 *
 * - With VITE_RESERVATION_ENDPOINT set, requests are POSTed there as JSON.
 *   The endpoint is expected to answer:
 *     201 { status: "confirmed" | "pending", reference?: string, table?: string }
 *     409 when the slot was taken in the meantime (double booking)
 *     422 { message } for rejected input
 * - Without it, the local prototype stores the request in this browser only
 *   and says so plainly. Nothing is sent to the restaurant.
 */

export interface ReservationRequest {
  date: string // YYYY-MM-DD
  time: string // HH:MM
  partySize: number
  name: string
  phone: string
  email: string
  notes: string
  featuredTable: boolean
}

export type ReservationResult =
  | { kind: 'confirmed'; reference?: string; table?: string }
  | { kind: 'pending'; reference?: string }
  | { kind: 'prototype'; reference: string }

export class ReservationError extends Error {
  constructor(
    public code: 'conflict' | 'invalid' | 'network' | 'server',
    message: string,
  ) {
    super(message)
  }
}

export interface ReservationService {
  /** Describes the mode to the visitor before they submit. */
  readonly mode: 'remote' | 'prototype'
  submit(req: ReservationRequest, idempotencyKey: string): Promise<ReservationResult>
}

class HttpReservationService implements ReservationService {
  readonly mode = 'remote' as const
  constructor(private endpoint: string) {}

  async submit(req: ReservationRequest, idempotencyKey: string): Promise<ReservationResult> {
    let res: Response
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(15000),
      })
    } catch {
      throw new ReservationError('network', 'Não foi possível contactar o serviço de reservas.')
    }
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (res.status === 409) {
      throw new ReservationError('conflict', 'Este horário acabou de ficar indisponível. Escolha outra hora.')
    }
    if (res.status === 422 || res.status === 400) {
      throw new ReservationError('invalid', typeof body.message === 'string' ? body.message : 'Verifique os dados do pedido.')
    }
    if (!res.ok) throw new ReservationError('server', 'O serviço de reservas não respondeu como esperado.')
    const reference = typeof body.reference === 'string' ? body.reference : undefined
    if (body.status === 'confirmed') {
      return { kind: 'confirmed', reference, table: typeof body.table === 'string' ? body.table : undefined }
    }
    return { kind: 'pending', reference }
  }
}

const STORAGE_KEY = 'sala.reservation-requests'

class LocalPrototypeService implements ReservationService {
  readonly mode = 'prototype' as const

  async submit(req: ReservationRequest, idempotencyKey: string): Promise<ReservationResult> {
    await new Promise((r) => setTimeout(r, 450))
    let list: { id: string; createdAt: string; request: ReservationRequest }[] = []
    try {
      list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    } catch {
      list = []
    }
    // The same submission retried is not stored twice.
    if (!list.some((r) => r.id === idempotencyKey)) {
      list.push({ id: idempotencyKey, createdAt: new Date().toISOString(), request: req })
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
      } catch {
        // Storage can be unavailable (private mode); the result still says
        // honestly that nothing was sent.
      }
    }
    return { kind: 'prototype', reference: idempotencyKey.slice(0, 8).toUpperCase() }
  }
}

export function createReservationService(): ReservationService {
  const endpoint = import.meta.env.VITE_RESERVATION_ENDPOINT as string | undefined
  return endpoint ? new HttpReservationService(endpoint) : new LocalPrototypeService()
}
