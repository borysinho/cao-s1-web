import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { data, errorText, eventTime, items, money } from './api.ts';
import type { Event, EventInput, Sector, SectorInput, Session } from './api.ts';
import { Notice, Title, useLoad } from './ui.tsx';

const statuses = { draft: 'Borrador', published: 'Publicado', cancelled: 'Cancelado' };
const localDate = (value: string) => new Date(Date.parse(value) - 4 * 3600_000).toISOString().slice(0, 16);

function EventForm({ event, token, save }: { event?: Event; token: string; save: (body: EventInput) => Promise<void> }) {
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState('');
  const [imageUrl, setImageUrl] = useState(event?.imageUrl ?? '');
  const [uploaded, setUploaded] = useState<{ file: File; url: string }>();
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function submit(form: FormEvent<HTMLFormElement>) {
    form.preventDefault();
    const fields = new FormData(form.currentTarget);
    const value = (name: string) => String(fields.get(name));
    setProblem('');
    setBusy(true);
    try {
      let cover = imageUrl;
      if (file) {
        if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          throw new Error('Elige una imagen JPEG, PNG o WebP de hasta 5 MB.');
        }
        if (uploaded?.file === file) cover = uploaded.url;
        else {
          const content = await new Promise<string>((accept, reject) => {
            const reader = new FileReader();
            reader.onload = () => accept(String(reader.result).split(',')[1]);
            reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
            reader.readAsDataURL(file);
          });
          const { imagePath } = await data<{ imagePath: string }>('/api/events/images', {
            token, method: 'POST', body: { content },
          });
          cover = new URL(imagePath, location.origin).href;
          setUploaded({ file, url: cover });
          setImageUrl(cover);
        }
      }
      await save({ name: value('name'), date: value('date') + ':00-04:00',
        venue: value('venue'), imageUrl: cover, description: value('description') });
    } catch (error) { setProblem(errorText(error)); }
    finally { setBusy(false); }
  }
  return <form className="stack" onSubmit={(form) => void submit(form)}>
    <label>Nombre del evento<input name="name" required defaultValue={event?.name} /></label>
    <div className="form-grid">
      <label>Fecha y hora (Bolivia)<input name="date" type="datetime-local" required defaultValue={event ? localDate(event.date) : undefined} /></label>
      <label>Lugar<input name="venue" required defaultValue={event?.venue} /></label>
    </div>
    <div className="stack image-upload">
      <label>Subir imagen<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
        onChange={(change) => { setFile(change.target.files?.[0]); setUploaded(undefined); setProblem(''); }} /></label>
      <small>JPEG, PNG o WebP. Máximo 5 MB. También puedes indicar una URL.</small>
      {preview && <img className="upload-preview" src={preview} alt="Vista previa de la imagen seleccionada" />}
      <label>URL de la imagen<input name="imageUrl" type="url" required={!file} disabled={Boolean(file) || busy}
        value={imageUrl} onChange={(change) => setImageUrl(change.target.value)} /></label>
    </div>
    <label>Descripción<textarea name="description" rows={4} required defaultValue={event?.description} /></label>
    <button className="button primary" disabled={busy}>{event ? 'Guardar cambios' : 'Crear borrador'}</button>
    {problem && <Notice tone="error">{problem}</Notice>}
  </form>;
}

function SectorForm({ sector, save, close }: { sector?: Sector; save: (body: SectorInput) => Promise<void>; close: () => void }) {
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(form: FormEvent<HTMLFormElement>) {
    form.preventDefault();
    const fields = new FormData(form.currentTarget);
    const [whole, decimals = ''] = String(fields.get('price')).split('.');
    const amount = Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
    setProblem('');
    setBusy(true);
    try { await save({ name: String(fields.get('name')), unitPriceMinor: amount, capacity: Number(fields.get('capacity')) }); }
    catch (error) { setProblem(errorText(error)); }
    finally { setBusy(false); }
  }
  return <form className="stack sector-form" onSubmit={(form) => void submit(form)}>
    <div className="form-grid sector-grid">
      <label>Nombre del sector<input name="name" required defaultValue={sector?.name} /></label>
      <label>Precio en Bs<input name="price" type="number" min="0.01" step="0.01" required defaultValue={sector && (sector.unitPriceMinor / 100).toFixed(2)} /></label>
      <label>Cupo<input name="capacity" type="number" min="1" step="1" required defaultValue={sector?.capacity} /></label>
    </div>
    <div className="actions"><button className="button primary" disabled={busy}>Guardar sector</button><button type="button" className="button secondary" onClick={close} disabled={busy}>Cerrar</button></div>
    {problem && <Notice tone="error">{problem}</Notice>}
  </form>;
}

function EventEditor({ event, session, changed }: { event: Event; session: Session; changed: () => void }) {
  const [sector, setSector] = useState<Sector | 'new'>();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [success, setSuccess] = useState('');
  const [salesVersion, reloadSales] = useState(0);
  const token = session.token;
  const path = '/api/events/' + event.id;
  const sales = useLoad(() => data<{ ticketsSold: number; revenueMinor: number }>('/api/orders/sales/' + event.id, { token }), event.id + '/' + salesVersion);
  async function status(next: 'published' | 'cancelled') {
    setBusy(true);
    setProblem('');
    setSuccess('');
    try {
      await data(path + '/status', { token, method: 'PUT', body: { status: next } });
      changed();
      setConfirm(false);
      setSuccess(next === 'published' ? 'Evento publicado.' : 'Evento cancelado.');
    } catch (error) { setProblem(errorText(error)); }
    finally { setBusy(false); }
  }
  return <main className="wrap content"><a className="back" href="/organizar">← Mis eventos</a>
    <div className="section-head align-start"><Title title={event.name} note={eventTime(event.date)} /><span className={'badge ' + event.status}>{statuses[event.status]}</span></div>
    <div className="split"><div className="stack">
      {event.status !== 'cancelled' && <section className="panel"><h2>Datos del evento</h2>
        <EventForm event={event} token={token} save={async (body) => {
          await data(path, { token, method: 'PUT', body });
          setSuccess('Cambios guardados.');
          changed();
        }} />
      </section>}
      <section className="panel"><div className="section-head"><h2>Sectores</h2>
        {event.status !== 'cancelled' && <button className="button secondary" onClick={() => setSector('new')}>Agregar sector</button>}
      </div>
        {!event.sectors.length && <p>Agrega un sector con precio y cupo para publicar.</p>}
        <ul className="clean">{event.sectors.map((entry) => <li className="data-row" key={entry.id}><div><strong>{entry.name}</strong><small>{entry.available} de {entry.capacity} disponibles · {money(entry.unitPriceMinor)}</small></div>
          {event.status !== 'cancelled' && <button className="button secondary" aria-label={'Editar sector ' + entry.name} onClick={() => setSector(entry)}>Editar</button>}</li>)}</ul>
        {sector && event.status !== 'cancelled' && <SectorForm key={sector === 'new' ? 'new' : sector.id}
          sector={sector === 'new' ? undefined : sector} close={() => setSector(undefined)}
          save={async (body) => {
            await data(path + '/sectors' + (sector === 'new' ? '' : '/' + sector.id), { token, method: sector === 'new' ? 'POST' : 'PUT', body });
            setSector(undefined);
            setSuccess('Sector guardado.');
            changed();
          }} />}
      </section>
    </div><aside className="stack">
      <section className="panel"><h2>Publicación</h2>
        {event.status === 'published' && <a className="back" href={'/eventos/' + event.id}>Ver evento publicado ↗</a>}
        <div className="stack">
          {event.status === 'draft' && <button className="button primary" disabled={busy || !event.sectors.length} onClick={() => void status('published')}>Publicar evento</button>}
          {event.status !== 'cancelled' && (confirm ? <>
            <p>El evento saldrá de la cartelera y se cerrarán las ventas.</p>
            <button className="button danger" disabled={busy} onClick={() => void status('cancelled')}>Confirmar cancelación</button>
            <button className="button secondary" disabled={busy} onClick={() => setConfirm(false)}>Volver</button>
          </> : <button className="button secondary" onClick={() => setConfirm(true)}>Cancelar evento</button>)}
          {event.status === 'cancelled' && <p>El evento está fuera de la cartelera.</p>}
        </div>
        {problem && <Notice tone="error">{problem}</Notice>}
        {success && <Notice tone="success">{success}</Notice>}
      </section>
      <section className="panel"><div className="section-head"><h2>Ventas</h2><button className="button secondary" onClick={() => reloadSales((value) => value + 1)}>Actualizar</button></div>
        {sales?.error ? <Notice tone="error">{sales.error}</Notice> : <dl className="metrics">
          <div><dt>Entradas vendidas</dt><dd>{sales?.value?.ticketsSold ?? '—'}</dd></div>
          <div><dt>Ingresos</dt><dd>{sales?.value ? money(sales.value.revenueMinor) : '—'}</dd></div>
        </dl>}
      </section>
    </aside></div>
  </main>;
}

export function Organizer({ session, eventId }: { session: Session; eventId?: string }) {
  const [version, setVersion] = useState(0);
  const state = useLoad(() => items<Event>('/api/events/mine', session.token), session.token + '/' + version, true);
  const event = state?.value?.find((entry) => entry.id === eventId);
  if (eventId === 'nuevo') return <main className="wrap content narrow"><a className="back" href="/organizar">← Mis eventos</a><Title title="Nuevo evento" />
    <section className="panel"><EventForm token={session.token} save={async (body) => {
      const created = await data<Event>('/api/events', { token: session.token, method: 'POST', body });
      location.assign('/organizar/' + created.id);
    }} /></section></main>;
  if (eventId && event) return <EventEditor event={event} session={session} changed={() => setVersion((value) => value + 1)} />;
  return <main className="wrap content"><div className="section-head align-start"><Title title={eventId ? 'Evento' : 'Mis eventos'} /><a className="button primary" href="/organizar/nuevo">Nuevo evento +</a></div>
    {!state && <Notice>Cargando eventos…</Notice>}
    {state?.error && <Notice tone="error">{state.error}</Notice>}
    {eventId && state?.value && <Notice tone="error">El evento no está disponible en tu cuenta.</Notice>}
    {!eventId && state?.value?.length === 0 && <div className="empty"><h2>Empieza con un borrador</h2><p>Agrega tu evento y define sus sectores para publicarlo.</p></div>}
    {!eventId && <div className="stack">{state?.value?.map((entry) => <a className="organizer-row" href={'/organizar/' + entry.id} key={entry.id}>
      <div><h2>{entry.name}</h2><p>{eventTime(entry.date)} · {entry.venue}</p></div>
      <span className={'badge ' + entry.status}>{statuses[entry.status]}</span><span aria-hidden="true">↗</span>
    </a>)}</div>}
  </main>;
}
