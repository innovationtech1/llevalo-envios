import Link from 'next/link';
import type { ReactNode } from 'react';

/** Marco simple para páginas legales (se pueden leer sin iniciar sesión). */
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/">Llévalo<span>.</span></Link>
      </header>
      <main className="legal">
        <h1>{title}</h1>
        <p className="small muted">Última actualización: {updated}</p>
        {children}
        <nav className="row small" style={{ flexWrap: 'wrap', gap: 16, marginTop: 24 }} aria-label="Documentos legales">
          <Link href="/terminos">Términos</Link>
          <Link href="/privacidad">Privacidad</Link>
          <Link href="/acuerdo-repartidor">Acuerdo de repartidor</Link>
        </nav>
      </main>
    </div>
  );
}
