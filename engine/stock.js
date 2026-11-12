// Turning a needed length into pieces a yard actually stocks.
const EPS = 0.01;

// Longest stock as many times as it fits, then the shortest stock that
// covers what is left. Returns stock lengths in feet.
export function cutStock(lengthIn, stockFt) {
  const stocks = [...stockFt].sort((a, b) => a - b);
  const maxIn = stocks[stocks.length - 1] * 12;
  const pieces = [];
  let left = lengthIn;
  while (left > maxIn + EPS) { pieces.push(stocks[stocks.length - 1]); left -= maxIn; }
  if (left > EPS) pieces.push(stocks.find((s) => s * 12 >= left - EPS));
  return pieces;
}

// The shortest stock length that covers one piece, or null if none does.
export function fitStock(lengthIn, stockFt) {
  return [...stockFt].sort((a, b) => a - b).find((s) => s * 12 >= lengthIn - EPS) ?? null;
}

// Counts pieces by length: add(tally, 16) three times gives { 16: 3 }.
export function add(tally, key, qty = 1) { tally[key] = (tally[key] ?? 0) + qty; return tally; }

// The parts of a wall left over once opening spans are cut out.
export function segments(totalIn, cuts) {
  const out = [];
  let at = 0;
  for (const [s, e] of [...cuts].sort((a, b) => a[0] - b[0])) {
    if (s - at > EPS) out.push(s - at);
    at = Math.max(at, e);
  }
  if (totalIn - at > EPS) out.push(totalIn - at);
  return out;
}

export function feetInches(inches) {
  const whole = Math.round(inches);
  return `${Math.floor(whole / 12)} ft ${whole % 12} in`;
}
