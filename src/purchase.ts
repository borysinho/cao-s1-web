import { ApiError, idPattern, request } from './api.ts';
import type { Order, Purchase, Session } from './api.ts';

export type Attempt = { key: string; body: Purchase; orderId?: string };

function storageKey(session: Session, eventId: string) {
  return `entradasya.purchase.${session.user.id}.${eventId}`;
}

export function loadAttempt(session: Session, eventId: string): Attempt | null {
  try {
    const attempt: Attempt | null = JSON.parse(sessionStorage.getItem(storageKey(session, eventId)) ?? 'null');
    if (attempt?.body?.eventId !== eventId || !idPattern.test(attempt.key)) return null;
    return attempt;
  } catch { return null; }
}

export function storeAttempt(session: Session, eventId: string, attempt: Attempt | null) {
  const key = storageKey(session, eventId);
  if (attempt) sessionStorage.setItem(key, JSON.stringify(attempt));
  else sessionStorage.removeItem(key);
}

export async function submitAttempt(session: Session, attempt: Attempt) {
  const response = await request('/api/orders', {
    token: session.token, method: 'POST', body: attempt.body, key: attempt.key,
  });
  const order: Order = await response.json();
  return { order, next: response.status === 202 ? { ...attempt, orderId: order.id } : null };
}

export function terminalPurchaseError(error: unknown): boolean {
  return error instanceof ApiError && [400, 404, 409, 422].includes(error.status);
}
