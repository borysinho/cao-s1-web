import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from './api.ts';
import { idPattern } from './api.ts';
import { Auth, Orders, Restricted, Tickets } from './account.tsx';
import { Catalogue, EventDetail } from './browse.tsx';
import { Organizer } from './organizer.tsx';
import { Gate } from './gate.tsx';
import { Notice, Title } from './ui.tsx';
import './style.css';

const storageKey = 'entradasya.session';
function readSession(): Session | null {
  try {
    const session: Session | null = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (!session || !expiration(session.token) || expiration(session.token) <= Date.now()) return null;
    return session;
  } catch { return null; }
}
function expiration(token: string): number {
  const encoded = token.split('.')[1];
  return Number(JSON.parse(atob(encoded.replaceAll('-', '+').replaceAll('_', '/'))).exp) * 1000;
}

function App() {
  const [session, setSession] = useState(readSession);
  const [expired, setExpired] = useState(false);
  const path = location.pathname.replace(/\/$/, '') || '/';
  const [section, id] = path.split('/').slice(1);
  function save(value: Session | null) {
    if (value) localStorage.setItem(storageKey, JSON.stringify(value));
    else localStorage.removeItem(storageKey);
    setSession(value);
  }
  useEffect(() => {
    if (!session) return;
    function expire() { save(null); setExpired(true); }
    const apiExpiry = (error: Event) => {
      if ((error as CustomEvent).detail === session.token) expire();
    };
    const timeout = setTimeout(expire, Math.max(0, expiration(session.token) - Date.now()));
    window.addEventListener('session-expired', apiExpiry);
    return () => { clearTimeout(timeout); window.removeEventListener('session-expired', apiExpiry); };
  }, [session]);
  useEffect(() => {
    const update = (event: StorageEvent) => { if (event.key === storageKey) setSession(readSession()); };
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, []);
  const role = session?.user.role;
  const guarded = (required: Session['user']['role'], view: (user: Session) => React.ReactNode) =>
    session && role === required ? view(session) : <Restricted session={session} />;
  let view;
  if (path === '/') view = <Catalogue />;
  else if (path === '/ingresar' || path === '/registro') view = <Auth register={path === '/registro'} onSession={save} />;
  else if (id && idPattern.test(id) && path === '/eventos/' + id) view = <EventDetail id={id} session={session} />;
  else if (path === '/mis-entradas') view = guarded('cliente', (user) => <Tickets session={user} />);
  else if (path === '/mis-compras' || (id && idPattern.test(id) && path === '/mis-compras/' + id)) {
    view = guarded('cliente', (user) => <Orders session={user} orderId={id} />);
  } else if (path === '/organizar' || (id && (id === 'nuevo' || idPattern.test(id)) && path === '/organizar/' + id)) {
    view = guarded('organizador', (user) => <Organizer session={user} eventId={id} />);
  } else if (path === '/ingreso') view = guarded('portero', (user) => <Gate session={user} />);
  else view = <main className="wrap content"><Title title="Página no encontrada" /><a href="/">Volver a la cartelera ↗</a></main>;

  return <div className="app">
    <header className="site-header"><div className="wrap header-inner">
      <a className="brand" href="/" aria-label="EntradasYa, inicio"><span className="brand-mark" aria-hidden="true">↗</span>Entradas<span>Ya</span></a>
      <nav aria-label="Navegación principal">
        <a href="/" aria-current={path === '/' ? 'page' : undefined}>Cartelera</a>
        {role === 'cliente' && <><a href="/mis-compras" aria-current={section === 'mis-compras' ? 'page' : undefined}>Mis compras</a><a href="/mis-entradas" aria-current={section === 'mis-entradas' ? 'page' : undefined}>Mis entradas</a></>}
        {role === 'organizador' && <a href="/organizar" aria-current={section === 'organizar' ? 'page' : undefined}>Mis eventos</a>}
        {role === 'portero' && <a href="/ingreso" aria-current={section === 'ingreso' ? 'page' : undefined}>Control de ingreso</a>}
      </nav>
      {session ? <button className="button header-button" onClick={() => { save(null); location.assign('/'); }}>Cerrar sesión</button>
        : <a className="button header-button" href="/ingresar">Iniciar sesión <span aria-hidden="true">↗</span></a>}
    </div></header>
    {expired && <div className="wrap"><Notice tone="error">Tu sesión expiró. Vuelve a iniciar sesión.</Notice></div>}
    <div className="main-area">{view}</div>
    <footer><div className="wrap footer-inner"><a className="brand" href="/">Entradas<span>Ya</span></a><a href="/">Cartelera ↗</a></div></footer>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
