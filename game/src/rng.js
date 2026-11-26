// Seeded random numbers — one tiny deterministic source for the whole game.
// The world, the clouds and the shot scenes all draw from this, so a given
// seed always builds the same archipelago.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SeededRandom {
  constructor(seed) {
    this.next = mulberry32(seed);
  }

  // Float in [0, 1).
  float() {
    return this.next();
  }

  // Float in [min, max).
  range(min, max) {
    return min + (max - min) * this.next();
  }

  // Integer in [min, max] inclusive.
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  // One element of an array, uniformly.
  pick(items) {
    return items[Math.floor(this.next() * items.length)];
  }

  // True with probability p.
  chance(p) {
    return this.next() < p;
  }

  // A shuffled copy of an array (Fisher-Yates).
  shuffle(items) {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // Approximately normal value around mean with the given spread.
  gaussian(mean = 0, spread = 1) {
    const u = Math.max(1e-9, this.next());
    const v = this.next();
    return mean + spread * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}
