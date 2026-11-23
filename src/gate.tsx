import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import jsQR from 'jsqr';
import { data, errorText, eventTime, items } from './api.ts';
import type { Event, Scan, Session } from './api.ts';
import { Notice, Title, useLoad } from './ui.tsx';

function Camera({ onCode, onProblem, stop }: { onCode: (code: string) => void; onProblem: () => void; stop: () => void }) {
  const preview = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let active = true;
    let stream: MediaStream | undefined;
    let frame = 0;
    const video = preview.current!;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    async function capture() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } });
        if (!active) { stream.getTracks().forEach((track) => track.stop()); return; }
        video.srcObject = stream;
        await video.play();
        if (!active) return;
        if (!context) throw new Error('Canvas no disponible');
        let last = 0;
        const read = (now: number) => {
          if (!active) return;
          if (now - last >= 120 && video.videoWidth) {
            last = now;
            const scale = Math.min(1, 720 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frameData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(frameData.data, canvas.width, canvas.height)?.data;
            if (code) { onCode(code); return; }
          }
          frame = requestAnimationFrame(read);
        };
        frame = requestAnimationFrame(read);
      } catch {
        if (active) onProblem();
      }
    }
    void capture();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  return <div className="camera"><video ref={preview} autoPlay muted playsInline aria-label="Vista de la cámara" />
    <button className="button secondary" onClick={stop}>Cerrar cámara</button></div>;
}

const reasons = {
  INVALID_CODE: 'Código inválido',
  WRONG_EVENT: 'Esta entrada corresponde a otro evento',
  ALREADY_USED: 'Entrada ya utilizada',
};

export function Gate({ session }: { session: Session }) {
  const [eventId, setEventId] = useState('');
  const [code, setCode] = useState('');
  const [camera, setCamera] = useState(false);
  const [cameraProblem, setCameraProblem] = useState(false);
  const [problem, setProblem] = useState('');
  const [result, setResult] = useState<Scan>();
  const [version, update] = useState(0);
  const [busy, setBusy] = useState(false);
  const processing = useRef(false);
  const events = useLoad(() => items<Event>('/api/events'), 'gate-events');
  const attendance = useLoad(() => eventId
    ? data<{ admittedCount: number }>('/api/checkins/' + eventId + '/count', { token: session.token })
    : Promise.resolve({ admittedCount: 0 }), eventId + '/' + version);
  async function verify(value: string) {
    if (!eventId || !value.trim() || processing.current) return;
    processing.current = true;
    setBusy(true);
    setCamera(false);
    setProblem('');
    setResult(undefined);
    try {
      const outcome = await data<Scan>('/api/checkins', {
        method: 'POST', token: session.token, body: { eventId, code: value.trim() },
      });
      setResult(outcome);
      setCode('');
      update((current) => current + 1);
    } catch (error) { setProblem(errorText(error)); }
    finally { processing.current = false; setBusy(false); }
  }
  function submit(form: FormEvent) {
    form.preventDefault();
    void verify(code);
  }
  return <main className="wrap content">
    <Title title="Control de ingreso" note="Selecciona el evento y valida cada entrada al llegar." />
    <div className="split gate-grid">
      <section className="panel stack">
        <label>Evento<select aria-label="Evento" disabled={busy || camera} value={eventId} onChange={(change) => {
          setEventId(change.target.value); setResult(undefined); setProblem('');
        }}><option value="">Selecciona un evento</option>
          {events?.value?.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
        {events?.error && <Notice tone="error">{events.error}</Notice>}
        {events?.value?.length === 0 && <Notice>No hay eventos publicados.</Notice>}
        <form className="stack" onSubmit={submit}>
          <label>Código de entrada<input value={code} onChange={(change) => setCode(change.target.value)} disabled={busy} autoComplete="off" required placeholder="Escribe el código del PDF" /></label>
          <div className="actions">
            <button className="button primary" disabled={!eventId || busy}>Validar entrada</button>
            <button type="button" className="button secondary" disabled={!eventId || busy || camera} onClick={() => { setCameraProblem(false); setCamera(true); }}>Escanear QR</button>
          </div>
        </form>
        {camera && <Camera stop={() => setCamera(false)} onCode={(value) => void verify(value)} onProblem={() => { setCameraProblem(true); setCamera(false); }} />}
        {cameraProblem && <Notice tone="error">No se pudo usar la cámara. Puedes ingresar el código manualmente.</Notice>}
        {problem && <Notice tone="error">{problem}</Notice>}
        {result && <Notice tone={result.allowed ? 'success' : 'error'}>
          <strong>{result.allowed ? 'Ingreso permitido' : reasons[result.reason]}</strong>
          {!result.allowed && result.firstAdmittedAt && <span className="message-line">Primer ingreso · {eventTime(result.firstAdmittedAt)}</span>}
        </Notice>}
      </section>
      <aside className="panel count-panel"><h2>Asistencia</h2><strong className="number">{eventId ? attendance?.value?.admittedCount ?? '—' : '—'}</strong>
        <p>Ingresos registrados</p>{attendance?.error && <Notice tone="error">{attendance.error}</Notice>}</aside>
    </div>
  </main>;
}
