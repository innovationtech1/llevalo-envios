'use client';

import { useInfoQuery } from '@/store/api';

export default function DemoBanner() {
  const { data } = useInfoQuery();
  if (!data?.demo) return null;
  return (
    <div className="banner" role="note">
      <b>Modo demo:</b> los pedidos se guardan temporalmente. Conecta la base de datos para guardarlos de forma permanente.
    </div>
  );
}
