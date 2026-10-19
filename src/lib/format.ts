export const money = (n: number | undefined | null) => '$' + Number(n || 0).toFixed(2);

export const fmtTime = (t: number) =>
  new Date(t).toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit' });

export const fmtDate = (t: number | string) =>
  new Date(t).toLocaleString('es-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const isToday = (t: number) => new Date(t).toDateString() === new Date().toDateString();
