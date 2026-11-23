import type { Role, EventInput, SectorInput, Purchase } from './contracts.ts';
export type { EventInput, SectorInput, Purchase };
export type Session = { token: string; user: { id: string; name: string; email: string; role: Role } };
export type Sector = SectorInput & { id: string; available: number };
export type Event = EventInput & { id: string; status: 'draft' | 'published' | 'cancelled'; sectors: Sector[] };
export type Order = {
  id: string; eventId: string; sectorId: string; quantity: number; createdAt: string;
  status: 'pending' | 'paid' | 'rejected' | 'cancelled'; ticketStatus: 'not_started' | 'pending' | 'ready';
  notificationStatus: 'not_started' | 'unknown' | 'sent' | 'failed';
  amountMinor?: number; failureCode?: string;
};
export type Ticket = {
  id: string; orderId: string; eventId: string; eventName: string; eventDate: string; eventVenue: string; sectorName: string; pdfUrl: string;
};
export type Scan = { allowed: true; admittedAt: string } | {
  allowed: false; reason: 'INVALID_CODE' | 'WRONG_EVENT' | 'ALREADY_USED'; firstAdmittedAt?: string;
};

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

type Options = { token?: string; method?: string; body?: object; key?: string };
export async function request(path: string, options: Options = {}): Promise<Response> {
  const headers = new Headers();
  if (options.token) headers.set('Authorization', 'Bearer ' + options.token);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (options.key) headers.set('Idempotency-Key', options.key);
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method, headers, body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(22000),
    });
  } catch {
    throw new ApiError(503, 'NETWORK', 'La conexión no está disponible. Intenta de nuevo.');
  }
  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    if (response.status === 401 && options.token) window.dispatchEvent(new CustomEvent('session-expired', { detail: options.token }));
    throw new ApiError(response.status, failure.code ?? 'HTTP_ERROR',
      failure.message ?? 'El servicio no pudo completar la solicitud.');
  }
  return response;
}

export async function data<T>(path: string, options?: Options): Promise<T> {
  return (await request(path, options)).json();
}

export async function items<T>(path: string, token?: string): Promise<T[]> {
  return (await data<{ items: T[] }>(path, { token })).items;
}

export const money = (value: number) => new Intl.NumberFormat('es-BO', {
  style: 'currency', currency: 'BOB', minimumFractionDigits: 2,
}).format(value / 100);
export const eventTime = (value: string, timeZone = 'America/La_Paz') => new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'medium', timeStyle: 'short', timeZone,
}).format(new Date(value));
export const errorText = (error: unknown) => error instanceof Error ? error.message : 'Ocurrió un error.';
export const idPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
