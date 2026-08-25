const nf2 = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const nfInt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export function formatMoney(value) {
  return `$${nf2.format(Number(value ?? 0))}`;
}

export function formatVol(value) {
  return nf2.format(Number(value ?? 0));
}

export function formatCant(value) {
  return nfInt.format(Number(value ?? 0));
}
