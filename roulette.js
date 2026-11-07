(function (root) {
  "use strict";
  const reds = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const range = (start, end) => Array.from({ length: end - start + 1 }, (_, i) => String(start + i));
  const color = number => number === "0" || number === "00" ? "green" : reds.has(Number(number)) ? "red" : "black";
  const pockets = wheel => [...(wheel === "american" ? ["0", "00"] : ["0"]), ...range(1, 36)];
  function catalog(wheel) {
    const bets = [];
    const add = (key, name, numbers, odds, position) => bets.push({ key, name, numbers: numbers.map(String), odds, position });
    for (const number of pockets(wheel)) {
      const n = Number(number);
      add(`straight-${number}`, `Straight ${number}`, [number], 35,
        n === 0 ? { cell: `n-${number}` } : { x: (Math.ceil(n / 3) - .5) / 12, y: (3 - ((n - 1) % 3) - .5) / 3 });
    }
    for (let col = 0; col < 12; col++) {
      const first = col * 3 + 1;
      add(`street-${first}`, `Street ${first}-${first + 2}`, range(first, first + 2), 11, { x: (col + .5) / 12, y: 1 });
      for (let row = 0; row < 3; row++) {
        const n = first + row;
        if (row < 2) add(`split-${n}-${n + 1}`, `Split ${n} / ${n + 1}`, [n, n + 1], 17, { x: (col + .5) / 12, y: (2 - row) / 3 });
        if (col < 11) add(`split-${n}-${n + 3}`, `Split ${n} / ${n + 3}`, [n, n + 3], 17, { x: (col + 1) / 12, y: (2.5 - row) / 3 });
        if (col < 11 && row < 2) add(`corner-${n}`, `Corner ${n} / ${n + 1} / ${n + 3} / ${n + 4}`, [n, n + 1, n + 3, n + 4], 8, { x: (col + 1) / 12, y: (2 - row) / 3 });
      }
      if (col < 11) add(`line-${first}`, `Six line ${first}-${first + 5}`, range(first, first + 5), 5, { x: (col + 1) / 12, y: 1 });
    }
    for (let i = 0; i < 3; i++) {
      add(`dozen-${i}`, `${["1st", "2nd", "3rd"][i]} dozen`, range(i * 12 + 1, i * 12 + 12), 2, { cell: `dozen-${i}` });
      add(`column-${i}`, `Column ${i + 1} (${i + 1}, ${i + 4}, ... ${i + 34})`, range(1, 36).filter(n => (Number(n) - 1) % 3 === i), 2, { cell: `column-${i}` });
    }
    for (const [key, name, numbers] of [
      ["low", "Low (1-18)", range(1, 18)], ["even", "Even", range(1, 36).filter(n => Number(n) % 2 === 0)],
      ["red", "Red", range(1, 36).filter(n => color(n) === "red")],
      ["black", "Black", range(1, 36).filter(n => color(n) === "black")],
      ["odd", "Odd", range(1, 36).filter(n => Number(n) % 2 === 1)], ["high", "High (19-36)", range(19, 36)]
    ]) add(key, name, numbers, 1, { cell: key });
    if (wheel === "american") add("basket", "Five-number basket (0 / 00 / 1 / 2 / 3)", ["0", "00", "1", "2", "3"], 6, { x: 0, y: 1 });
    return bets;
  }
  function shuffle(items, random = Math.random) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  function deal(wheel, count, unit, random = Math.random) {
    const all = catalog(wheel);
    const inside = all.filter(bet => !bet.position.cell || bet.key.startsWith("straight"));
    const outside = all.filter(bet => bet.position.cell && !bet.key.startsWith("straight"));
    const outsideCount = Math.min(Math.ceil(count / 3), outside.length);
    return shuffle([...shuffle(outside, random).slice(0, outsideCount), ...shuffle(inside, random).slice(0, count - outsideCount)], random)
      .map((bet, i) => ({ ...bet, id: i + 1, stake: Math.round(unit * 100) * (1 + Math.floor(random() * 5)), removed: false, paid: false, flagged: false }));
  }
  const wins = (bet, number) => bet.numbers.includes(String(number));
  const payout = (bet, mode) => bet.stake * (bet.odds + (mode === "total" ? 1 : 0));
  function choices(bet, mode, random = Math.random) {
    const correct = payout(bet, mode);
    const amounts = new Set([correct, bet.stake * bet.odds, bet.stake * (bet.odds + 1)]);
    for (const multiplier of shuffle([1, 2, 3, 5, 6, 8, 9, 11, 12, 17, 18, 35, 36], random)) {
      if (amounts.size >= 6) break;
      amounts.add(bet.stake * multiplier);
    }
    return [...amounts].sort((a, b) => a - b);
  }
  const api = { color, pockets, catalog, shuffle, deal, wins, payout, choices };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Roulette = api;
})(globalThis);
