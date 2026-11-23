import { editorialById } from './editorial-events.ts';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { data, errorText, eventTime, idPattern, items, money, request } from './api.ts';
import type { Order, Session, Ticket } from './api.ts';
import { Notice, Title, useLoad } from './ui.tsx';
import { OrderState } from './browse.tsx';
import { loadAttempt, storeAttempt, submitAttempt, terminalPurchaseError } from './purchase.ts';

export function signInPath() {
  return '/ingresar?next=' + encodeURIComponent(location.pathname + location.search);
}

function nextPage() {
  const value = new URLSearchParams(location.search).get('next');
  if (!value?.startsWith('/')) return null;
  try {
    const url = new URL(value, location.origin);
    return url.origin === location.origin && !url.pathname.startsWith('//') ? url.pathname + url.search + url.hash : null;
  } catch { return null; }
}

export function Auth({ register, onSession }: { register: boolean; onSession: (session: Session) => void }) {
  const [problem, setProblem] = useState('');
  const [pending, setPending] = useState(false);
  const continuePath = nextPage();
  const query = continuePath ? '?next=' + encodeURIComponent(continuePath) : '';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const email = String(values.get('email'));
    const password = String(values.get('password'));
    setPending(true);
    setProblem('');
    try {
      if (register) await data('/api/auth/register', { method: 'POST', body: { name: values.get('name'), email, password } });
      const session = await data<Session>('/api/auth/login', { method: 'POST', body: { email, password } });
      onSession(session);
      location.assign(continuePath ?? ({ cliente: '/', organizador: '/organizar', portero: '/ingreso' }[session.user.role]));
    } catch (error) { setProblem(errorText(error)); }
    finally { setPending(false); }
  }
  return <main className="wrap content auth-grid">
    <div className="auth-image" aria-hidden="true" />
    <section className="panel auth-panel">
      <Title title={register ? 'Crea tu cuenta' : 'Inicia sesión'} note={register ? 'Guarda tus compras y lleva tus entradas contigo.' : 'Accede a tus compras o a tu espacio de trabajo.'} />
      <form className="stack" onSubmit={(event) => void submit(event)}>
        {register && <label>Nombre<input name="name" autoComplete="name" required /></label>}
        <label>Correo electrónico<input name="email" type="email" autoComplete="email" required /></label>
        <label>Contraseña<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required /></label>
        <button className="button primary" disabled={pending}>{register ? 'Crear cuenta' : 'Ingresar'}</button>
      </form>
      {problem && <Notice tone="error">{problem}</Notice>}
      <a className="back" href={(register ? '/ingresar' : '/registro') + query}>{register ? 'Ya tengo cuenta' : 'Crear una cuenta'} ↗</a>
    </section>
  </main>;
}

export function Restricted({ session }: { session: Session | null }) {
  return <main className="wrap content narrow"><Title title={session ? 'Acceso restringido' : 'Inicia sesión para continuar'} />
    {session ? <Notice tone="error">Tu cuenta no tiene acceso a esta vista.</Notice>
      : <a className="button primary" href={signInPath()}>Iniciar sesión ↗</a>}
  </main>;
}

function ResumeOrder({ session, order, onUpdate }: { session: Session; order: Order; onUpdate: (order: Order) => void }) {
  const attempt = loadAttempt(session, order.eventId);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState('');
  if (attempt?.orderId !== order.id) return <a href={'/eventos/' + order.eventId}>Volver al evento ↗</a>;
  async function resume() {
    if (!attempt) return;
    setPending(true);
    setProblem('');
    try {
      const { order: updated, next } = await submitAttempt(session, attempt);
      storeAttempt(session, order.eventId, next);
      onUpdate(updated);
    } catch (error) {
      if (terminalPurchaseError(error)) {
        storeAttempt(session, order.eventId, null);
        try { onUpdate(await data<Order>('/api/orders/' + order.id, { token: session.token })); }
        catch { setProblem(errorText(error)); }
      } else setProblem(errorText(error));
    } finally { setPending(false); }
  }
  return <>
    <button className="button primary" disabled={pending} onClick={() => void resume()}>Reanudar compra</button>
    {problem && <Notice tone="error">{problem}</Notice>}
  </>;
}

export function Orders({ session, orderId }: { session: Session; orderId?: string }) {
  const state = useLoad(async () => orderId
    ? [await data<Order>('/api/orders/' + orderId, { token: session.token })]
    : items<Order>('/api/orders', session.token), session.token + (orderId ?? ''));
  const [updated, setUpdated] = useState<Order>();
  return <main className="wrap content narrow">
    {orderId && <a className="back" href="/mis-compras">← Mis compras</a>}
    <Title title={orderId ? 'Detalle de compra' : 'Mis compras'} />
    {!state && <Notice>Cargando compras…</Notice>}
    {state?.error && <Notice tone="error">{state.error}</Notice>}
    {state?.value?.length === 0 && <div className="empty"><h2>Aún no tienes compras</h2><a href="/">Ir a la cartelera ↗</a></div>}
    <div className="stack">{state?.value?.map((entry) => updated?.id === entry.id ? updated : entry).map((order) => <article className="panel order-card" key={order.id}>
      <div className="section-head"><time dateTime={order.createdAt}>{eventTime(order.createdAt)}</time>
        {order.amountMinor !== undefined && <strong>{money(order.amountMinor)}</strong>}</div>
      <OrderState order={order} /><p>{order.quantity} {order.quantity === 1 ? 'entrada' : 'entradas'}</p>
      {orderId && <small>Referencia {order.id}</small>}
      <div className="actions">
        {!orderId && <a className="button secondary" href={'/mis-compras/' + order.id}>Ver detalle</a>}
        {order.ticketStatus === 'ready' && <a className="button primary" href={'/mis-entradas?orderId=' + order.id}>Ver entradas ↗</a>}
        {orderId && ['pending', 'paid'].includes(order.status) && order.ticketStatus !== 'ready'
          && <ResumeOrder session={session} order={order} onUpdate={setUpdated} />}
      </div>
    </article>)}</div>
  </main>;
}

export function Tickets({ session }: { session: Session }) {
  const orderId = new URLSearchParams(location.search).get('orderId');
  const valid = !orderId || idPattern.test(orderId);
  const state = useLoad(() => valid ? items<Ticket>('/api/tickets' + (orderId ? '?orderId=' + encodeURIComponent(orderId) : ''), session.token) : Promise.resolve([]), session.token + (orderId ?? ''));
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState<string>();
  async function download(ticket: Ticket) {
    setBusy(ticket.id);
    setProblem('');
    try {
      const response = await request('/api/tickets/' + ticket.id + '/pdf', { token: session.token });
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `entrada-${ticket.id}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setProblem(errorText(error)); }
    finally { setBusy(undefined); }
  }
  return <main className="wrap content narrow">
    {orderId && <a className="back" href="/mis-entradas">← Todas mis entradas</a>}
    <Title title="Mis entradas" note="Descarga tu PDF y presenta el código QR al ingresar." />
    {!valid && <Notice tone="error">La referencia de la orden es inválida.</Notice>}
    {valid && !state && <Notice>Cargando entradas…</Notice>}
    {valid && state?.value?.length === 0 && <Notice>{orderId ? 'Esta orden no tiene entradas disponibles en tu cuenta.' : 'Aún no tienes entradas.'}</Notice>}
    {(problem || state?.error) && <Notice tone="error">{problem || state?.error}</Notice>}
    <div className="stack">{state?.value?.map((ticket) => <article className="ticket" key={ticket.id}>
      <div><div className="eyebrow">{ticket.sectorName}</div><h2>{ticket.eventName}</h2><p>{eventTime(ticket.eventDate, editorialById.get(ticket.eventId)?.timeZone)} · {ticket.eventVenue}</p></div>
      <button className="button primary" disabled={busy !== undefined} onClick={() => void download(ticket)}>{busy === ticket.id ? 'Preparando…' : 'Descargar PDF ↓'}</button>
    </article>)}</div>
  </main>;
}
