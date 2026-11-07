"use strict";
const R = window.Roulette;
const $ = id => document.getElementById(id);
const money = cents => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
let round = null;
let completed = 0;
let removalErrors = 0;
let payoutErrors = 0;

function feedback(text, kind = "") {
  $("feedback").textContent = text;
  $("feedback").className = kind;
}
function updateScore() {
  $("score").textContent = `${completed} rounds completed | ${removalErrors} removal / ${payoutErrors} payout mistakes`;
}
function cell(id, label, number) {
  const div = document.createElement("div");
  div.className = `cell${number !== undefined ? ` ${R.color(number)}` : ""}`;
  div.id = id;
  div.textContent = label;
  if (number !== undefined) div.dataset.number = number;
  return div;
}
function group(className, parent) {
  const div = document.createElement("div");
  div.className = className;
  parent.append(div);
  return div;
}
function highlight(bet, active) {
  document.querySelectorAll("[data-number]").forEach(element => {
    element.classList.toggle("covered", active && bet.numbers.includes(element.dataset.number));
  });
}
function wireHighlight(element, bet) {
  element.addEventListener("mouseenter", () => highlight(bet, true));
  element.addEventListener("mouseleave", () => highlight(bet, false));
  element.addEventListener("focusin", () => highlight(bet, true));
  element.addEventListener("focusout", event => {
    if (!element.contains(event.relatedTarget)) highlight(bet, false);
  });
}
function renderTable() {
  $("table").replaceChildren();
  const layout = group("number-layout", $("table"));
  const zeros = group("zeros", layout);
  for (const number of round?.wheel === "european" ? ["0"] : ["00", "0"]) zeros.append(cell(`n-${number}`, number, number));
  const grid = group("number-grid", layout);
  for (let row = 2; row >= 0; row--) {
    for (let col = 0; col < 12; col++) {
      const number = String(col * 3 + row + 1);
      grid.append(cell(`n-${number}`, number, number));
    }
  }
  const columns = group("columns", layout);
  for (let i = 2; i >= 0; i--) columns.append(cell(`column-${i}`, `Col ${i + 1}`));
  const outside = group("outside", $("table"));
  const dozens = group("dozens", outside);
  for (let i = 0; i < 3; i++) dozens.append(cell(`dozen-${i}`, `${["1st", "2nd", "3rd"][i]} 12`));
  const evens = group("evens", outside);
  for (const [key, label] of [["low", "1-18"], ["even", "EVEN"], ["red", "RED"], ["black", "BLACK"], ["odd", "ODD"], ["high", "19-36"]]) evens.append(cell(key, label));
  if (!round) return;
  for (const bet of round.bets.filter(b => !b.removed)) {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = bet.id;
    chip.title = `#${bet.id} ${bet.name}: ${money(bet.stake)}`;
    chip.setAttribute("aria-label", `${chip.title}. ${round.phase === "clear" ? "Remove bet" : "Bet on table"}`);
    chip.disabled = round.phase !== "clear";
    if (bet.position.cell) $(bet.position.cell).append(chip);
    else {
      chip.style.left = `${bet.position.x * 100}%`;
      chip.style.top = `${bet.position.y * 100}%`;
      grid.append(chip);
    }
    chip.addEventListener("click", () => removeBet(bet));
    wireHighlight(chip, bet);
  }
  if (round.number !== null) $(`n-${round.number}`).classList.add("landed");
}
function renderBets() {
  $("bets").replaceChildren();
  const remaining = round.bets.filter(bet => !bet.removed);
  $("bets-heading").textContent = round.phase === "payout" || round.phase === "done" ? "Winning bets - payouts" : `Bets on the table (${remaining.length})`;
  for (const bet of remaining) {
    const card = document.createElement("article");
    card.className = `bet-card${bet.flagged ? " flagged" : ""}${bet.paid ? " paid" : ""}`;
    const top = group("bet-top", card);
    const text = document.createElement("div");
    const name = document.createElement("div");
    name.className = "bet-name";
    const id = document.createElement("span");
    id.className = "bet-id";
    id.textContent = `#${bet.id} `;
    name.append(id, bet.name);
    const meta = document.createElement("p");
    meta.className = "bet-meta";
    meta.textContent = `${money(bet.stake)} stake / ${bet.stake / round.unit} chips`;
    text.append(name, meta);
    top.append(text);
    if (round.phase === "clear") {
      const button = document.createElement("button");
      button.className = "remove";
      button.textContent = "Remove";
      button.setAttribute("aria-label", `Remove bet ${bet.id}: ${bet.name}`);
      button.addEventListener("click", () => removeBet(bet));
      top.append(button);
    }
    if ((round.phase === "payout" || round.phase === "done") && !bet.paid) {
      const controls = group("payout", card);
      const select = document.createElement("select");
      select.setAttribute("aria-label", `Payout for bet ${bet.id}, ${bet.name}`);
      const placeholder = new Option("Select payout...", "");
      select.add(placeholder);
      for (const amount of bet.choices) select.add(new Option(money(amount), String(amount)));
      select.value = bet.selected || "";
      select.addEventListener("change", () => { bet.selected = select.value; });
      const pay = document.createElement("button");
      pay.textContent = "Pay";
      pay.addEventListener("click", () => payBet(bet, select.value));
      controls.append(select, pay);
    }
    if (bet.paid) {
      const note = document.createElement("p");
      note.className = "answer-note";
      note.textContent = `${money(R.payout(bet, round.mode))} paid. ${money(bet.stake)} x ${bet.odds}${round.mode === "total" ? " + stake" : ""}.`;
      card.append(note);
    }
    wireHighlight(card, bet);
    $("bets").append(card);
  }
  if (!remaining.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No bets remain on the table.";
    $("bets").append(empty);
  }
}
function render() {
  const instructions = {
    spin: ["1 / SPIN", "Bets are placed. Spin the wheel."],
    clear: ["2 / CLEAR LOSERS", "Remove losing bets. Leave every winner."],
    payout: ["3 / PAY WINNERS", round.mode === "profit" ? "Select winnings only. Leave the original stake." : "Select total return, including the original stake."],
    done: ["ROUND COMPLETE", "Table settled. Deal another round to keep practicing."]
  };
  const [step, instruction] = instructions[round.phase];
  $("step").textContent = step;
  $("instruction").textContent = instruction;
  $("spin").disabled = round.phase !== "spin";
  $("check").disabled = round.phase !== "clear";
  $("deal").textContent = round.phase === "done" ? "Deal next round" : "Deal / restart round";
  $("round-info").textContent = `${round.wheel === "american" ? "American / 0 + 00" : "European / 0"} | ${money(round.unit)} chips | ${round.mode === "profit" ? "Winnings only; stake stays" : "Total return; stake included"} | Standard zero rules`;
  $("result").textContent = round.number ?? "?";
  $("result").className = `ball${round.number !== null ? ` ${R.color(round.number)}` : ""}`;
  $("result").setAttribute("aria-label", round.number === null ? "No winning number yet" : `Winning number ${round.number}, ${R.color(round.number)}`);
  renderTable();
  renderBets();
  updateScore();
}
function removeBet(bet) {
  if (round.phase !== "clear" || bet.removed) return;
  if (R.wins(bet, round.number)) {
    removalErrors++;
    feedback(`Keep #${bet.id}: ${bet.name} covers ${round.number} and is a winner.`, "error");
    updateScore();
    return;
  }
  bet.removed = true;
  feedback(`Collected #${bet.id} (${money(bet.stake)}).`);
  render();
}
function finish() {
  round.phase = "done";
  completed++;
  feedback(round.bets.some(b => !b.removed) ? "All winning bets paid correctly. Nice work!" : "No winners this spin. All losing bets collected correctly.", "success");
}
function payBet(bet, value) {
  if (round.phase !== "payout" || bet.paid) return;
  if (!value) { feedback("Select a payout first.", "error"); return; }
  if (Number(value) !== R.payout(bet, round.mode)) {
    payoutErrors++;
    feedback(`Not quite for #${bet.id}. Try again; ${round.mode === "profit" ? "pay winnings only, not the original stake" : "include the original stake in the return"}.`, "error");
    updateScore();
    return;
  }
  bet.paid = true;
  bet.flagged = false;
  feedback(`Correct: #${bet.id} pays ${money(Number(value))}.`, "success");
  if (round.bets.every(b => b.removed || b.paid)) finish();
  render();
}
$("deal").addEventListener("click", () => {
  const wheel = $("wheel").value;
  const unit = Number($("unit").value);
  round = { wheel, unit: Math.round(unit * 100), mode: $("mode").value, phase: "spin", number: null, bets: R.deal(wheel, Number($("count").value), unit) };
  feedback("Review the chip positions and stakes, then spin.");
  render();
});
$("spin").addEventListener("click", () => {
  if (!round || round.phase !== "spin") return;
  const pockets = R.pockets(round.wheel);
  round.number = pockets[Math.floor(Math.random() * pockets.length)];
  round.phase = "clear";
  feedback(`Winning number: ${round.number} (${R.color(round.number)}). Collect the losers.`);
  render();
});
$("check").addEventListener("click", () => {
  if (!round || round.phase !== "clear") return;
  const losers = round.bets.filter(b => !b.removed && !R.wins(b, round.number));
  if (losers.length) {
    removalErrors++;
    for (const bet of losers) bet.flagged = true;
    feedback(`${losers.length} losing bet${losers.length === 1 ? " is" : "s are"} still on the table (outlined). Collect them before paying.`, "error");
  } else {
    round.phase = "payout";
    for (const bet of round.bets.filter(b => !b.removed)) bet.choices = R.choices(bet, round.mode);
    feedback("Table cleared correctly. Now pay each winning bet.", "success");
    if (round.bets.every(b => b.removed)) finish();
  }
  render();
});
renderTable();
