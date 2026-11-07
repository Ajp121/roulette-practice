"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("./roulette.js");

test("wheel pockets and zero rules distinguish 0 and 00", () => {
  assert.equal(R.pockets("american").length, 38);
  assert.equal(R.pockets("european").length, 37);
  const bets = R.catalog("american");
  for (const key of ["low", "high", "even", "odd", "red", "black", "dozen-0", "column-0"]) {
    assert.equal(R.wins(bets.find(b => b.key === key), "0"), false);
    assert.equal(R.wins(bets.find(b => b.key === key), "00"), false);
  }
  assert.equal(R.wins(bets.find(b => b.key === "straight-0"), "00"), false);
  assert.equal(R.wins(bets.find(b => b.key === "straight-00"), "00"), true);
  assert.equal(R.catalog("european").some(b => b.numbers.includes("00")), false);
});

test("all generated bets have valid coverage and standard payouts", () => {
  for (const wheel of ["american", "european"]) {
    const bets = R.catalog(wheel);
    assert.equal(new Set(bets.map(b => b.key)).size, bets.length);
    for (const bet of bets) {
      assert.equal(new Set(bet.numbers).size, bet.numbers.length);
      assert.ok(bet.numbers.every(n => R.pockets(wheel).includes(n)));
      assert.equal(bet.odds, { 1: 35, 2: 17, 3: 11, 4: 8, 5: 6, 6: 5, 12: 2, 18: 1 }[bet.numbers.length]);
      for (const pocket of R.pockets(wheel)) assert.equal(R.wins(bet, pocket), bet.numbers.includes(pocket));
    }
  }
  const bets = R.catalog("american");
  assert.deepEqual(bets.find(b => b.key === "corner-1").numbers, ["1", "2", "4", "5"]);
  assert.deepEqual(bets.find(b => b.key === "line-31").numbers, ["31", "32", "33", "34", "35", "36"]);
  assert.deepEqual(bets.find(b => b.key === "basket").numbers, ["0", "00", "1", "2", "3"]);
});

test("deals use distinct bets, low-value chip stacks and both bet categories", () => {
  for (const wheel of ["american", "european"]) {
    for (const count of [4, 8, 12, 16]) {
      for (const unit of [.25, .5, 1, 5]) {
        const bets = R.deal(wheel, count, unit);
        assert.equal(bets.length, count);
        assert.equal(new Set(bets.map(b => b.key)).size, count);
        assert.ok(bets.every(b => b.stake >= unit * 100 && b.stake <= unit * 500 && b.stake % (unit * 100) === 0));
        assert.ok(bets.some(b => !b.position.cell || b.key.startsWith("straight")));
        assert.ok(bets.some(b => b.position.cell && !b.key.startsWith("straight")));
      }
    }
  }
});

test("payout choices include correct profit and total, with exact fractional-chip amounts", () => {
  for (const template of R.catalog("american")) {
    const bet = { ...template, stake: 75 };
    for (const mode of ["profit", "total"]) {
      assert.equal(R.payout(bet, mode), 75 * (bet.odds + (mode === "total" ? 1 : 0)));
      const choices = R.choices(bet, mode);
      assert.equal(choices.length, 6);
      assert.equal(new Set(choices).size, 6);
      assert.ok(choices.includes(R.payout(bet, mode)));
      assert.ok(choices.every(n => Number.isInteger(n) && n > 0));
    }
  }
});
