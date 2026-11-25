const byId = id => document.getElementById(id);
const graph = byId("graph");
const input = byId("input");
const stepButton = byId("step");
const playButton = byId("play");
const tape = byId("tape");
const traceList = byId("trace-list");
const symbols = () => Array.from(input.value);
const unique = list => [...new Set(list)];
const splitList = value => value.split(",").map(item => item.trim()).filter(Boolean);
const ownRecord = () => Object.create(null);
const describeWord = word => word === "" ? "ε" : word;

let model;
let activeExample = null;
let errors = [];
let result = null;
let cursor = 0;
let evaluated = false;
let playing = false;
let timer;
let tab = "trace";
let zoom = 1;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text, onClick, className) {
  const node = element("button", text, className);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

function option(value, label = value) {
  const node = element("option", label);
  node.value = value;
  return node;
}

function setBadge(target, label, status = "") {
  target.textContent = label;
  target.className = ["badge", status].filter(Boolean).join(" ");
}

function selectTab(name) {
  tab = name;
  for (const item of byId("tabs").querySelectorAll("button")) {
    const active = item.dataset.tab === name;
    item.setAttribute("aria-pressed", String(active));
    byId(item.dataset.tab + "-pane").hidden = !active;
  }
}

function stopPlayback() {
  clearTimeout(timer);
  playing = false;
}

function prepareRun() {
  stopPlayback();
  cursor = 0;
  evaluated = false;
  result = errors.length ? null : simulate(model, input.value);
  renderRun();
}

function loadExample(example) {
  activeExample = example;
  model = structuredClone(example);
  byId("states").value = model.states.join(", ");
  byId("alphabet").value = model.alphabet.join(", ");
  input.value = example.input;
  zoom = 1;
  renderEditorChoices();
  refreshDefinition();
  selectTab("trace");
}

function newDfa() {
  activeExample = null;
  model = {states: ["q0"], alphabet: ["0", "1"], start: "q0", accepting: [], transitions: ownRecord()};
  byId("states").value = "q0";
  byId("alphabet").value = "0, 1";
  input.value = "";
  zoom = 1;
  renderEditorChoices();
  refreshDefinition();
  selectTab("editor");
  byId("states").focus();
  byId("states").select();
}

function refreshDefinition() {
  errors = validate(model);
  byId("machine-name").textContent = activeExample?.name ?? "Custom DFA";
  setBadge(byId("validity"), errors.length ? "Needs edits" : "Valid DFA", errors.length ? "bad" : "good");
  byId("validation").replaceChildren(element("strong", errors.length ? "Fix these before running" : "All transitions are valid."));
  if (errors.length) {
    const list = element("ul");
    list.append(...errors.map(error => element("li", error)));
    byId("validation").append(list);
  }
  byId("check").disabled = !activeExample;
  byId("check-results").textContent = activeExample ? "Compare this example with four known cases." : "Load an example to compare with known cases.";
  prepareRun();
}

function onDefinitionChange() {
  activeExample = null;
  refreshDefinition();
}

function editSets() {
  const states = splitList(byId("states").value);
  const alphabet = splitList(byId("alphabet").value);
  if (JSON.stringify([states, alphabet]) === JSON.stringify([model.states, model.alphabet])) return;
  const transitions = ownRecord();
  for (const state of states) {
    transitions[state] = ownRecord();
    for (const symbol of alphabet) {
      const target = model.transitions[state]?.[symbol];
      if (states.includes(target)) transitions[state][symbol] = target;
    }
  }
  const start = states.includes(model.start) ? model.start : states[0] ?? "";
  const accepting = model.accepting.filter(state => states.includes(state));
  model = {states, alphabet, start, accepting, transitions};
  renderEditorChoices();
  onDefinitionChange();
}

function renderEditorChoices() {
  const states = unique(model.states);
  const start = byId("start");
  start.replaceChildren(option("", "Choose a state"), ...states.map(state => option(state)));
  start.value = model.start;
  const accepting = byId("accepting");
  accepting.replaceChildren();
  if (!states.length) accepting.append(element("span", "Add states to select them.", "sub"));
  for (const state of states) {
    const label = element("label");
    const checkbox = element("input");
    checkbox.type = "checkbox";
    checkbox.checked = model.accepting.includes(state);
    checkbox.addEventListener("change", () => {
      model.accepting = checkbox.checked ? [...model.accepting, state] : model.accepting.filter(name => name !== state);
      onDefinitionChange();
    });
    label.append(checkbox, document.createTextNode(state));
    accepting.append(label);
  }
  renderTable(true);
}

function renderTable(editable = false, current = null) {
  const holder = byId(editable ? "rules" : "table");
  const states = unique(model.states);
  const alphabet = unique(model.alphabet);
  holder.replaceChildren();
  if (!states.length || !alphabet.length) {
    holder.append(element("p", "Add states and symbols to see transition rules.", "sub"));
    return;
  }
  const table = element("table");
  const header = table.createTHead().insertRow();
  for (const label of ["State", ...alphabet]) {
    const heading = element("th", label);
    heading.scope = "col";
    header.append(heading);
  }
  const body = table.createTBody();
  for (const state of states) {
    const row = body.insertRow();
    const labels = [!editable && state === model.start ? "→" : "", state, !editable && model.accepting.includes(state) ? "*" : ""];
    const heading = element("th", labels.filter(Boolean).join(" "));
    heading.scope = "row";
    row.append(heading);
    for (const symbol of alphabet) {
      const cell = row.insertCell();
      const target = model.transitions[state]?.[symbol];
      if (editable) {
        const field = element("select");
        field.setAttribute("aria-label", `Transition from ${state} on ${symbol}`);
        field.append(option("", "—"), ...states.map(name => option(name)));
        field.value = target ?? "";
        field.addEventListener("change", () => {
          const row = model.transitions[state] ?? ownRecord();
          row[symbol] = field.value;
          model.transitions[state] = row;
          onDefinitionChange();
        });
        cell.append(field);
      } else {
        cell.textContent = target ?? "—";
        if (current?.from === state && current.symbol === symbol) cell.className = "active-cell";
      }
    }
  }
  holder.append(table);
}

function describeRun() {
  if (!result) return {label: "Blocked", kind: "bad", note: "Complete the DFA in the editor before running a string.",
    coach: errors[0]};
  const last = result.trace.length - 1;
  const state = result.trace[Math.min(cursor, last)].to;
  if (evaluated && result.invalid && cursor > last) {
    const {symbol, index} = result.invalid;
    const note = `${JSON.stringify(symbol)} at position ${index + 1} is outside the alphabet.`;
    return {label: "Invalid input", kind: "bad", note, coach: `The machine stops in ${state}. It has no rule for ${JSON.stringify(symbol)} because the symbol is outside Σ.`};
  }
  if (evaluated && !result.invalid && cursor === last) {
    const ending = result.accepted ? "an accepting state" : "outside the accepting set";
    const note = `Final state ${state} is ${ending}.`;
    const move = result.trace[cursor];
    const lead = cursor ? `Reading ${move.symbol} sent ${move.from} to ${state}. ` : "ε consumes no symbols. ";
    return {label: result.accepted ? "Accepted" : "Rejected", kind: result.accepted ? "good" : "bad", note, coach: lead + note};
  }
  const next = result.trace[cursor + 1];
  const move = result.trace[cursor];
  const why = cursor ? `δ(${move.from}, ${move.symbol}) = ${state}, so the machine moved to ${state}.` : `Every run starts at ${state}.`;
  return {label: cursor ? "In progress" : "Ready", note: next ? `Next symbol ${next.symbol} · current state ${state}` : "Press Step or Play to evaluate this input.",
    coach: next ? `${why} The next rule is δ(${state}, ${next.symbol}) = ${next.to}.` : why};
}

function updateStepper(container, render) {
  const focusIndex = container.contains(document.activeElement) ? document.activeElement.dataset.index : null;
  const top = container.scrollTop;
  const left = container.scrollLeft;
  container.replaceChildren();
  render();
  container.scrollTo(left, top);
  if (focusIndex != null) container.querySelector(`[data-index="${focusIndex}"]`)?.focus({preventScroll: true});
}

function renderTape(characters) {
  updateStepper(tape, () => {
    if (!characters.length) {
      const empty = button("ε", () => jumpTo(0));
      empty.disabled = !result;
      empty.setAttribute("aria-label", "Evaluate the empty string");
      tape.append(empty);
    }
    for (const [index, symbol] of characters.entries()) {
      const invalid = result?.invalid?.index === index;
      const chip = button(symbol === " " ? "␣" : symbol, () => jumpTo(index + 1));
      chip.dataset.index = index;
      chip.disabled = !result || (result.invalid !== null && index > result.invalid.index);
      chip.setAttribute("aria-label", `Jump to symbol ${index + 1}: ${JSON.stringify(symbol)}`);
      if (index < cursor) chip.classList.add("read");
      if (index === cursor - 1) chip.classList.add("focus");
      if (invalid) chip.classList.add("invalid");
      tape.append(chip);
    }
  });
}

function renderTrace() {
  updateStepper(traceList, () => {
    if (!result) return;
    const moves = result.invalid ? [...result.trace, {invalid: result.invalid}] : result.trace;
    for (const [index, move] of moves.entries()) {
      const li = element("li");
      const row = button(undefined, () => jumpTo(index), "trace-row");
      row.dataset.index = index;
      if (index === cursor) row.setAttribute("aria-current", "step");
      if (index > cursor) row.classList.add("future");
      const detail = move.invalid ? `Unknown symbol ${JSON.stringify(move.invalid.symbol)}` :
        index ? `${move.from}  →  ${move.to}   on  ${move.symbol}` : `Start at ${move.to}`;
      const target = element("span", move.to ?? "!", "target");
      target.title = move.to ?? "Invalid";
      row.append(element("span", index, "index"), element("span", detail), target);
      li.append(row);
      traceList.append(li);
    }
  });
}

function graphStep() {
  if (!result) return null;
  return result.trace[cursor] ?? {to: result.trace.at(-1).to};
}

function renderRun() {
  const characters = symbols();
  const length = result ? result.trace.length - 1 + Number(Boolean(result.invalid)) : 0;
  const finished = evaluated && cursor === length;
  stepButton.disabled = !result || playing || finished;
  playButton.disabled = !result || (finished && !playing);
  playButton.textContent = playing ? "Ⅱ Pause" : "▶ Play";
  byId("reset").disabled = !result || (!evaluated && !playing);
  const status = describeRun();
  setBadge(byId("verdict"), status.label, status.kind);
  byId("run-message").textContent = status.note;
  byId("coach").textContent = status.coach;
  byId("trace-sub").textContent = result ? `Initial state + ${result.trace.length - 1} possible moves` : "A complete DFA is required.";
  const consumed = result ? Math.min(cursor, result.trace.length - 1) : 0;
  byId("progress").textContent = `${consumed}/${characters.length}`;
  renderTape(characters);
  renderTrace();
  if (playing) {
    const row = traceList.querySelector('[aria-current="step"]');
    if (row && row.offsetTop + row.offsetHeight > traceList.offsetTop + traceList.scrollTop + traceList.clientHeight) {
      traceList.scrollTop = row.offsetTop - traceList.offsetTop;
    }
  }
  renderGraph(model, graphStep(), zoom);
  renderTable(false, graphStep());
}

function jumpTo(index) {
  if (!result) return;
  stopPlayback();
  cursor = Math.min(index, result.trace.length - 1 + Number(Boolean(result.invalid)));
  evaluated = true;
  renderRun();
}

function tick() {
  const limit = result.trace.length - 1 + Number(Boolean(result.invalid));
  cursor = Math.min(cursor + 1, limit);
  evaluated = true;
  if (cursor === limit) stopPlayback();
  renderRun();
  if (playing) timer = setTimeout(tick, Number(byId("speed").value));
}

function verifyExample() {
  if (!activeExample || errors.length) return;
  const output = byId("check-results");
  output.replaceChildren();
  for (const [word, expected] of activeExample.cases) {
    const run = simulate(model, word);
    const pass = run.invalid === null && run.accepted === expected;
    const row = element("div", undefined, "case");
    const load = button(describeWord(word), () => {
      input.value = word;
      prepareRun();
      input.focus();
    }, "ghost check");
    load.setAttribute("aria-label", `Use test string ${describeWord(word)}`);
    row.append(load, element("span", expected ? "Expect accept" : "Expect reject"), element("strong", pass ? "Pass" : "Fail", pass ? "pass" : "fail"));
    output.append(row);
  }
}

byId("tabs").addEventListener("click", event => {
  const clicked = event.target.closest("button[data-tab]");
  if (clicked) selectTab(clicked.dataset.tab);
});
byId("new-button").addEventListener("click", newDfa);
byId("check").addEventListener("click", verifyExample);
input.addEventListener("input", prepareRun);
input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !stepButton.disabled) stepButton.click();
});
byId("start").addEventListener("change", event => {
  model.start = event.target.value;
  onDefinitionChange();
});
byId("states").addEventListener("input", editSets);
byId("alphabet").addEventListener("input", editSets);
stepButton.addEventListener("click", () => {
  if (tab === "editor") selectTab("trace");
  jumpTo(cursor + 1);
});
playButton.addEventListener("click", () => {
  if (playing) {
    stopPlayback();
    renderRun();
    return;
  }
  if (tab === "editor") selectTab("trace");
  playing = true;
  tick();
});
byId("reset").addEventListener("click", prepareRun);
byId("zoom-in").addEventListener("click", () => {
  zoom = Math.min(3, zoom * 1.22);
  renderGraph(model, graphStep(), zoom);
});
byId("zoom-out").addEventListener("click", () => {
  zoom = Math.max(.6, zoom / 1.22);
  renderGraph(model, graphStep(), zoom);
});
byId("fit").addEventListener("click", () => {
  zoom = 1;
  renderGraph(model, graphStep(), zoom);
});
new ResizeObserver(() => renderGraph(model, graphStep(), zoom)).observe(graph.parentElement);

const exampleDialog = byId("examples-dialog");
byId("examples-button").addEventListener("click", () => exampleDialog.showModal());
byId("help-button").addEventListener("click", () => byId("help-dialog").showModal());
for (const example of examples) {
  const item = button(undefined, () => {
    loadExample(example);
    exampleDialog.close();
  });
  item.append(element("strong", example.name), element("span", example.description, "sub"));
  byId("example-options").append(item);
}
loadExample(examples[0]);
