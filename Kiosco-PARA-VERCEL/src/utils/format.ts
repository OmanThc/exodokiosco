export function formatMoney(amount: number, currency: string = '$'): string {
  const val = Number(amount) || 0;
  // Always format cleanly with 2 decimals
  const formatted = val.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${currency}${formatted}`;
}

export function roundMoney(amount: number): number {
  return Math.round((Number(amount) || 0) * 100) / 100;
}
