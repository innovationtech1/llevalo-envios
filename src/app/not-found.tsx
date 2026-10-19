import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="shell">
      <main style={{ paddingTop: 80 }}>
        <h1>No encontramos esta página</h1>
        <p className="muted">Puede que el enlace esté mal escrito o que la página ya no exista.</p>
        <Link className="btn primary" href="/">Volver al inicio</Link>
      </main>
    </div>
  );
}
