export const examples = [
  {
    name: "Multiples of 3",
    description: "Binary numbers divisible by three. The states track remainders 0, 1, and 2.",
    states: ["r0", "r1", "r2"], alphabet: ["0", "1"], start: "r0", accepting: ["r0"],
    transitions: {r0: {0: "r0", 1: "r1"}, r1: {0: "r2", 1: "r0"}, r2: {0: "r1", 1: "r2"}},
    input: "1001", cases: [["1001", true], ["101", false], ["0", true], ["", true]]
  },
  {
    name: "Ends in 01",
    description: "Accepts when the last two symbols are 0 followed by 1.",
    states: ["q0", "q1", "q2"], alphabet: ["0", "1"], start: "q0", accepting: ["q2"],
    transitions: {q0: {0: "q1", 1: "q0"}, q1: {0: "q1", 1: "q2"}, q2: {0: "q1", 1: "q0"}},
    input: "1101", cases: [["1101", true], ["010", false], ["01", true], ["", false]]
  },
  {
    name: "Even number of 1s",
    description: "Every 1 flips parity. A 0 leaves parity unchanged.",
    states: ["even", "odd"], alphabet: ["0", "1"], start: "even", accepting: ["even"],
    transitions: {even: {0: "even", 1: "odd"}, odd: {0: "odd", 1: "even"}},
    input: "1010", cases: [["1010", true], ["1011", false], ["00", true], ["", true]]
  }
];

export function validate(dfa) {
  const errors = [];
  const {states, alphabet, start, accepting, transitions} = dfa;
  if (!states.length) errors.push("Add at least one state.");
  if (new Set(states).size !== states.length) errors.push("State names must be unique.");
  if (!alphabet.length) errors.push("Add at least one alphabet symbol.");
  if (new Set(alphabet).size !== alphabet.length) errors.push("Alphabet symbols must be unique.");
  if (alphabet.some(symbol => Array.from(symbol).length !== 1 || /\s/u.test(symbol) || symbol === "ε")) {
    errors.push("Use single characters other than whitespace or ε as symbols.");
  }
  if (!states.includes(start)) errors.push("Choose a start state.");
  if (accepting.some(state => !states.includes(state))) errors.push("Each accepting state must exist.");
  for (const state of new Set(states)) {
    for (const symbol of new Set(alphabet)) {
      const target = transitions[state]?.[symbol];
      if (!states.includes(target)) errors.push(`δ(${state}, ${symbol}) needs a destination state.`);
    }
  }
  return errors;
}

export function simulate(dfa, input) {
  const trace = [{to: dfa.start}];
  let current = dfa.start;
  for (const [index, symbol] of Array.from(input).entries()) {
    if (!dfa.alphabet.includes(symbol)) return {trace, invalid: {symbol, index}, accepted: null};
    const next = dfa.transitions[current][symbol];
    trace.push({from: current, symbol, to: next});
    current = next;
  }
  return {trace, invalid: null, accepted: dfa.accepting.includes(current)};
}
