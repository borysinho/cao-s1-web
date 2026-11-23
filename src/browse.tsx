import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { data, errorText, eventTime, items, money } from './api.ts';
import type { Event, Order, Session } from './api.ts';
import { EventArtwork, Notice, Title, useLoad } from './ui.tsx';
import { loadAttempt, storeAttempt, submitAttempt, terminalPurchaseError } from './purchase.ts';
import type { Attempt } from './purchase.ts';
import { editorialById } from './editorial-events.ts';

function eventDate(event: Event, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('es-BO', {
    ...options,
    timeZone: editorialById.get(event.id)?.timeZone ?? 'America/La_Paz',
  }).format(new Date(event.date));
}

function eventPrice(event: Event) {
  const available = event.sectors.filter((sector) => sector.available > 0);
  return available.length ? Math.min(...available.map((sector) => sector.unitPriceMinor)) : undefined;
}

function Featured({ events }: { events: Event[] }) {
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const current = selected % events.length;
  const event = events[current];
  const editorial = editorialById.get(event.id)!;
  const go = (direction: number) => setSelected((current + direction + events.length) % events.length);
  const price = eventPrice(event);
  useEffect(() => {
    if (paused || hovered || focused || events.length < 2) return;
    const interval = window.setInterval(() => {
      if (!document.hidden) setSelected((value) => (value + 1) % events.length);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [paused, hovered, focused, selected, events.length]);
  return <section className="featured wrap" aria-label="Eventos destacados" aria-roledescription="carrusel"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <article className="featured-panel" aria-live={paused || focused ? 'polite' : 'off'}>
      <img key={event.imageUrl} className="featured-photo" src={event.imageUrl} alt="" fetchPriority="high" />
      <div className="featured-copy">
        <span className="featured-label">{editorial.category} · Demostración</span>
        <h1>{editorial.artist}<em>{editorial.headline}</em></h1>
        <p><time dateTime={event.date}>{eventDate(event, { day: 'numeric', month: 'long' })}</time>
          <span aria-hidden="true"> · </span>{event.venue}</p>
        <div className="featured-action">
          <a className="button accent" href={'/eventos/' + event.id}>Ver entradas <span aria-hidden="true">↗</span></a>
          {price !== undefined && <span>Desde <strong>{money(price)}</strong></span>}
        </div>
      </div>
    </article>
    {events.length > 1 && <div className="carousel-controls">
      <button type="button" aria-label="Evento destacado anterior" onClick={() => go(-1)}>←</button>
      <div className="carousel-dots">{events.map((entry, index) =>
        <button type="button" key={entry.id} aria-label={'Mostrar ' + entry.name}
          aria-current={index === current ? 'true' : undefined} onClick={() => setSelected(index)} />)}</div>
      <button type="button" aria-label="Siguiente evento destacado" onClick={() => go(1)}>→</button>
      <button type="button" className="carousel-play" aria-label={paused ? 'Reanudar carrusel' : 'Pausar carrusel'}
        onClick={() => setPaused((value) => !value)}>{paused ? '▶' : 'Ⅱ'}</button>
    </div>}
  </section>;
}

function EventCard({ event }: { event: Event }) {
  const editorial = editorialById.get(event.id);
  const price = eventPrice(event);
  return <a href={'/eventos/' + event.id} className="event-card">
    <div className="card-cover">
      <EventArtwork event={event} />
      {editorial && <span className="card-category">{editorial.category}</span>}
    </div>
    <div className="card-body">
      <div className="card-event">
        <time className="card-date" dateTime={event.date}>
          <strong>{eventDate(event, { day: '2-digit' })}</strong><span>{eventDate(event, { month: 'short' })}</span>
        </time>
        <div><h3>{event.name}</h3><p>{event.venue}</p></div>
      </div>
      <div className="card-bottom">
        <div>{price !== undefined ? <><small>Desde</small><strong>{money(price)}</strong></> : <strong>Agotado</strong>}</div>
        <span className="card-action">Ver entradas <span aria-hidden="true">↗</span></span>
      </div>
    </div>
  </a>;
}

function searchable(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase().trim();
}

export function Catalogue() {
  const state = useLoad(() => items<Event>('/api/events'), 'catalogue');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const categoryFor = (event: Event) => editorialById.get(event.id)?.category ?? 'Otros';
  const events = state?.value ?? [];
  const categories = [...new Set(events.map(categoryFor))];
  const featured = events.filter((event) => editorialById.get(event.id)?.featured)
    .sort((first, second) => editorialById.get(first.id)!.featured! - editorialById.get(second.id)!.featured!);
  const list = events.filter((event) => (category === 'Todos' || category === categoryFor(event))
    && searchable(event.name + ' ' + event.venue).includes(searchable(search)));
  return <main>
    {featured.length ? <Featured events={featured} /> : <section className="hero">
      <div className="wrap hero-content">
        <h1>Hay noches que<br /><em>se quedan.</em></h1>
        <p>Encuentra tu próximo concierto, encuentro o espectáculo.</p>
        <a className="button accent" href="#cartelera">Ver cartelera <span aria-hidden="true">↘</span></a>
      </div>
    </section>}
    <section className="wrap catalogue" id="cartelera">
      <div className="section-head">
        <h2>Próximos eventos</h2>
        <label className="search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Buscar eventos" placeholder="Buscar evento o ciudad" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      </div>
      {categories.length > 1 && <div className="category-filters" aria-label="Filtrar por categoría">
        {['Todos', ...categories].map((entry) =>
          <button key={entry} type="button" aria-pressed={entry === category} onClick={() => setCategory(entry)}>{entry}</button>)}
      </div>}
      {featured.length > 0 && <p className="demo-notice">Cartelera de demostración. Las fechas y las ventas son simuladas.</p>}
      {!state && <Notice>Cargando la cartelera…</Notice>}
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state?.value && list.length === 0 && <div className="empty"><h3>{events.length ? 'Ningún evento coincide' : 'La cartelera está por abrir'}</h3><p>{events.length ? 'Prueba con otro nombre, ciudad o categoría.' : 'Aquí aparecerán los eventos cuando se publiquen.'}</p></div>}
      <div className="event-grid">{list.map((event) => <EventCard event={event} key={event.id} />)}</div>
    </section>
  </main>;
}

const orderLabels = { pending: 'Compra pendiente', paid: 'Compra pagada', rejected: 'Pago rechazado', cancelled: 'Orden cancelada' };
export const ticketLabels = { not_started: 'Sin emitir', pending: 'Emisión pendiente', ready: 'Entradas listas' };
export const mailLabels = { not_started: 'Sin enviar', unknown: 'Envío sin confirmar', sent: 'Correo enviado', failed: 'Correo no enviado' };

export function OrderState({ order }: { order: Order }) {
  return <div className="order-state"><strong>{orderLabels[order.status]}</strong>
    <span>{ticketLabels[order.ticketStatus]} · {mailLabels[order.notificationStatus]}</span>
    {order.failureCode === 'SOLD_OUT' && <span>Agotado</span>}
  </div>;
}

function Checkout({ event, session }: { event: Event; session: Session }) {
  const [sectorId, setSector] = useState(event.sectors.find((sector) => sector.available > 0)?.id ?? event.sectors[0]?.id ?? '');
  const [quantity, setQuantity] = useState('1');
  const [email, setEmail] = useState(session.user.email);
  const [code, setCode] = useState('');
  const [attempt, setAttempt] = useState(() => loadAttempt(session, event.id));
  const [order, setOrder] = useState<Order>();
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const sector = event.sectors.find((entry) => entry.id === (attempt?.body.sectorId ?? sectorId));
  const saveAttempt = (value: Attempt | null) => {
    storeAttempt(session, event.id, value);
    setAttempt(value);
  };
  async function buy(value: Attempt) {
    setBusy(true);
    setProblem('');
    try {
      const { order: updated, next } = await submitAttempt(session, value);
      setOrder(updated);
      saveAttempt(next);
    } catch (error) {
      if (terminalPurchaseError(error)) saveAttempt(null);
      setProblem(errorText(error));
    } finally { setBusy(false); }
  }
  const submit = (form: FormEvent) => {
    form.preventDefault();
    const value = { key: crypto.randomUUID(), body: { eventId: event.id, sectorId, quantity: Number(quantity), recipientEmail: email, paymentCode: code } };
    saveAttempt(value);
    void buy(value);
  };
  async function refresh() {
    if (!attempt?.orderId) return;
    setProblem('');
    setBusy(true);
    try {
      const latest = await data<Order>('/api/orders/' + attempt.orderId, { token: session.token });
      setOrder(latest);
      if (latest.status === 'cancelled' || latest.status === 'rejected' || latest.ticketStatus === 'ready') saveAttempt(null);
    } catch (error) { setProblem(errorText(error)); }
    finally { setBusy(false); }
  }
  return <section className="panel checkout"><h2>Compra tus entradas</h2>
    {order && <OrderState order={order} />}
    {order?.ticketStatus === 'ready' ? <a className="button primary" href={'/mis-entradas?orderId=' + order.id}>Ver mis entradas ↗</a>
      : attempt ? <div className="stack">
        {!order && <Notice>Hay una compra pendiente para este evento.</Notice>}
        <button className="button primary" disabled={busy} onClick={() => void buy(attempt)}>Reanudar compra</button>
        {attempt.orderId && <button className="button secondary" disabled={busy} onClick={() => void refresh()}>Consultar estado</button>}
      </div> : <form className="stack" onSubmit={submit}>
        <label>Sector<select aria-label="Sector" value={sectorId} onChange={(change) => { setSector(change.target.value); setQuantity('1'); }} required>
          {event.sectors.map((entry) => <option value={entry.id} key={entry.id} disabled={!entry.available}>{entry.name} · {entry.available ? money(entry.unitPriceMinor) : 'Agotado'}</option>)}
        </select></label>
        <label>Cantidad<input type="number" min="1" max={Math.max(1, Math.min(6, sector?.available ?? 0))} step="1" value={quantity} onChange={(change) => setQuantity(change.target.value)} required /></label>
        <label>Correo de confirmación<input type="email" required value={email} onChange={(change) => setEmail(change.target.value)} /></label>
        <label>Código de pago de prueba<input required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="1234" value={code} onChange={(change) => setCode(change.target.value)} /></label>
        <small>Usa cuatro dígitos ficticios. 0000 simula un rechazo.</small>
        <div className="checkout-total"><span>Total estimado</span><strong>{money((sector?.unitPriceMinor ?? 0) * (Number(quantity) || 0))}</strong></div>
        <button className="button primary" disabled={busy || !sector?.available}>{busy ? 'Procesando…' : 'Confirmar compra'}</button>
      </form>}
    {problem && <Notice tone="error">{problem}</Notice>}
  </section>;
}

export function EventDetail({ id, session }: { id: string; session: Session | null }) {
  const state = useLoad(() => data<Event>('/api/events/' + id), id);
  if (!state?.value) return <main className="wrap content"><a href="/">← Cartelera</a><Notice tone={state?.error ? 'error' : 'neutral'}>{state?.error ?? 'Cargando el evento…'}</Notice></main>;
  const event = state.value;
  const editorial = editorialById.get(event.id);
  const creditedPhoto = editorial && event.imageUrl.endsWith('/eventos-demo/' + editorial.image) ? editorial.photo : undefined;
  return <main className="wrap content">
    <a className="back" href="/">← Cartelera</a>
    <Title title={event.name} note={eventTime(event.date, editorial?.timeZone) + ' · ' + event.venue} />
    {editorial && <Notice>Evento de demostración. La fecha y la compra son simuladas.</Notice>}
    <div className="split"><div className="stack">
      <EventArtwork key={event.imageUrl} event={event} />
      {creditedPhoto && <small className="photo-credit">Foto de <a href={creditedPhoto.source}>{creditedPhoto.author}</a> en Wikimedia Commons · <a href={creditedPhoto.licenseUrl}>{creditedPhoto.license}</a> · Adaptada a WebP</small>}
      <p className="description">{event.description}</p>
      <section className="panel"><h2>Sectores</h2><ul className="clean">
        {event.sectors.map((sector) => <li className="data-row" key={sector.id}><div><strong>{sector.name}</strong><small>{sector.available ? `${sector.available} disponibles` : 'Agotado'}</small></div><strong>{money(sector.unitPriceMinor)}</strong></li>)}
      </ul></section>
    </div>{session?.user.role === 'cliente' ? <Checkout key={session.user.id + id} event={event} session={session} />
      : <section className="panel"><h2>Entradas</h2>{session ? <p>Las compras se realizan con una cuenta de cliente.</p> : <a className="button primary" href={'/ingresar?next=' + encodeURIComponent('/eventos/' + id)}>Ingresa para comprar</a>}</section>}
    </div>
  </main>;
}
