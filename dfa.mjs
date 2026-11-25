export const examples = [
  {
    name: "Multiples of 3",
    description: "Binary numbers divisible by three. The states track remainders 0, 1, and 2.",
    regex: "(0|1(01*0)*1)*",
    states: ["r0", "r1", "r2"], alphabet: ["0", "1"], start: "r0", accepting: ["r0"],
    transitions: {r0: {0: "r0", 1: "r1"}, r1: {0: "r2", 1: "r0"}, r2: {0: "r1", 1: "r2"}},
    input: "1001", cases: [["1001", true], ["101", false], ["0", true], ["", true]]
  },
  {
    name: "Ends in 01",
    description: "Accepts when the last two symbols are 0 followed by 1.",
    regex: "(0|1)*01",
    states: ["q0", "q1", "q2"], alphabet: ["0", "1"], start: "q0", accepting: ["q2"],
    transitions: {q0: {0: "q1", 1: "q0"}, q1: {0: "q1", 1: "q2"}, q2: {0: "q1", 1: "q0"}},
    input: "1101", cases: [["1101", true], ["010", false], ["01", true], ["", false]]
  },
  {
    name: "Even number of 1s",
    description: "Every 1 flips parity. A 0 leaves parity unchanged.",
    regex: "(0|10*1)*",
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

// -------------------------------------------------------------
// Regular Expression to DFA & DFA to Regular Expression Engine
// -------------------------------------------------------------

export class RegexAST {
  static empty() { return { type: "empty" }; }
  static epsilon() { return { type: "epsilon" }; }
  static char(c) { return { type: "char", value: c }; }
  static union(left, right) {
    if (left.type === "empty") return right;
    if (right.type === "empty") return left;
    return { type: "union", left, right };
  }
  static concat(left, right) {
    if (left.type === "empty" || right.type === "empty") return RegexAST.empty();
    if (left.type === "epsilon") return right;
    if (right.type === "epsilon") return left;
    return { type: "concat", left, right };
  }
  static star(inner) {
    if (inner.type === "empty" || inner.type === "epsilon") return RegexAST.epsilon();
    if (inner.type === "star") return inner;
    return { type: "star", inner };
  }
  static plus(inner) {
    if (inner.type === "empty") return RegexAST.empty();
    return { type: "plus", inner };
  }
  static opt(inner) {
    return { type: "opt", inner };
  }
}

export function parseRegex(input) {
  // Strip whitespace, normalize empty
  const str = input.replace(/\s+/g, "");
  if (!str) return RegexAST.epsilon();

  let pos = 0;
  function peek() { return str[pos]; }
  function next() { return str[pos++]; }

  function parseUnion() {
    let node = parseConcat();
    while (pos < str.length && peek() === '|') {
      next(); // consume '|'
      const right = parseConcat();
      node = RegexAST.union(node, right);
    }
    return node;
  }

  function parseConcat() {
    let terms = [];
    while (pos < str.length && peek() !== ')' && peek() !== '|') {
      terms.push(parseFactor());
    }
    if (terms.length === 0) return RegexAST.epsilon();
    let res = terms[0];
    for (let i = 1; i < terms.length; i++) {
      res = RegexAST.concat(res, terms[i]);
    }
    return res;
  }

  function parseFactor() {
    let base = parseBase();
    while (pos < str.length) {
      if (peek() === '*') {
        next();
        base = RegexAST.star(base);
      } else if (peek() === '+') {
        next();
        base = RegexAST.plus(base);
      } else if (peek() === '?') {
        next();
        base = RegexAST.opt(base);
      } else {
        break;
      }
    }
    return base;
  }

  function parseBase() {
    if (pos >= str.length) throw new Error("Unexpected end of expression.");
    const ch = peek();
    if (ch === '(') {
      next();
      const inner = parseUnion();
      if (pos >= str.length || next() !== ')') {
        throw new Error("Unmatched '(' in expression.");
      }
      return inner;
    }
    if (ch === ')' || ch === '|' || ch === '*' || ch === '+' || ch === '?') {
      throw new Error(`Unexpected operator '${ch}' at position ${pos + 1}.`);
    }
    if (ch === 'ε' || ch === 'E' || (ch === '\\' && str[pos + 1] === 'e')) {
      if (ch === '\\') next();
      next();
      return RegexAST.epsilon();
    }
    if (ch === '\\') {
      next();
      if (pos >= str.length) throw new Error("Dangling escape '\\' at end.");
      return RegexAST.char(next());
    }
    return RegexAST.char(next());
  }

  const ast = parseUnion();
  if (pos < str.length) {
    throw new Error(`Unexpected character '${peek()}' at position ${pos + 1}.`);
  }
  return ast;
}

export class NFA {
  constructor() {
    this.numStates = 0;
    this.transitions = new Map();
    this.start = null;
    this.accept = null;
    this.alphabet = new Set();
  }

  newState() {
    const id = this.numStates++;
    this.transitions.set(id, new Map());
    return id;
  }

  addTransition(from, symbol, to) {
    if (symbol !== null) this.alphabet.add(symbol);
    const stateMap = this.transitions.get(from);
    if (!stateMap.has(symbol)) stateMap.set(symbol, new Set());
    stateMap.get(symbol).add(to);
  }
}

export function astToNFA(ast) {
  const nfa = new NFA();

  function build(node) {
    const s = nfa.newState();
    const f = nfa.newState();

    if (node.type === "empty") {
      return { start: s, accept: f };
    } else if (node.type === "epsilon") {
      nfa.addTransition(s, null, f);
      return { start: s, accept: f };
    } else if (node.type === "char") {
      nfa.addTransition(s, node.value, f);
      return { start: s, accept: f };
    } else if (node.type === "union") {
      const left = build(node.left);
      const right = build(node.right);
      nfa.addTransition(s, null, left.start);
      nfa.addTransition(s, null, right.start);
      nfa.addTransition(left.accept, null, f);
      nfa.addTransition(right.accept, null, f);
      return { start: s, accept: f };
    } else if (node.type === "concat") {
      const left = build(node.left);
      const right = build(node.right);
      nfa.addTransition(left.accept, null, right.start);
      return { start: left.start, accept: right.accept };
    } else if (node.type === "star") {
      const inner = build(node.inner);
      nfa.addTransition(s, null, inner.start);
      nfa.addTransition(s, null, f);
      nfa.addTransition(inner.accept, null, inner.start);
      nfa.addTransition(inner.accept, null, f);
      return { start: s, accept: f };
    } else if (node.type === "plus") {
      const inner = build(node.inner);
      nfa.addTransition(s, null, inner.start);
      nfa.addTransition(inner.accept, null, inner.start);
      nfa.addTransition(inner.accept, null, f);
      return { start: s, accept: f };
    } else if (node.type === "opt") {
      const inner = build(node.inner);
      nfa.addTransition(s, null, inner.start);
      nfa.addTransition(s, null, f);
      nfa.addTransition(inner.accept, null, f);
      return { start: s, accept: f };
    }
    throw new Error("Unknown AST node: " + node.type);
  }

  const { start, accept } = build(ast);
  nfa.start = start;
  nfa.accept = accept;
  return nfa;
}

export function epsilonClosure(nfa, states) {
  const closure = new Set(states);
  const stack = [...states];
  while (stack.length > 0) {
    const u = stack.pop();
    const map = nfa.transitions.get(u);
    if (map && map.has(null)) {
      for (const v of map.get(null)) {
        if (!closure.has(v)) {
          closure.add(v);
          stack.push(v);
        }
      }
    }
  }
  return closure;
}

export function nfaToDfa(nfa, customAlphabet = null) {
  const alphabet = customAlphabet ? [...new Set(customAlphabet)].sort() : [...nfa.alphabet].sort();
  if (alphabet.length === 0) alphabet.push("0", "1");

  const startClosure = epsilonClosure(nfa, [nfa.start]);
  const keyOf = set => [...set].sort((a, b) => a - b).join(",");

  const dfaStates = [];
  const dfaStateMap = new Map();

  const startKey = keyOf(startClosure);
  dfaStates.push(startClosure);
  dfaStateMap.set(startKey, 0);

  const rawTransitions = {};
  const queue = [0];

  let trapId = null;

  while (queue.length > 0) {
    const currentId = queue.shift();
    const currentSet = dfaStates[currentId];
    rawTransitions[currentId] = {};

    for (const symbol of alphabet) {
      const destSet = new Set();
      for (const u of currentSet) {
        const trans = nfa.transitions.get(u);
        if (trans && trans.has(symbol)) {
          for (const v of trans.get(symbol)) {
            destSet.add(v);
          }
        }
      }

      if (destSet.size === 0) {
        if (trapId === null) {
          trapId = dfaStates.length;
          dfaStates.push(new Set());
          dfaStateMap.set("", trapId);
          rawTransitions[trapId] = {};
          for (const s of alphabet) rawTransitions[trapId][s] = trapId;
        }
        rawTransitions[currentId][symbol] = trapId;
      } else {
        const closure = epsilonClosure(nfa, destSet);
        const k = keyOf(closure);
        let destId;
        if (dfaStateMap.has(k)) {
          destId = dfaStateMap.get(k);
        } else {
          destId = dfaStates.length;
          dfaStates.push(closure);
          dfaStateMap.set(k, destId);
          queue.push(destId);
        }
        rawTransitions[currentId][symbol] = destId;
      }
    }
  }

  const rawAccepting = new Set();
  for (let i = 0; i < dfaStates.length; i++) {
    if (dfaStates[i].has(nfa.accept)) {
      rawAccepting.add(i);
    }
  }

  return minimizeDfa({
    numStates: dfaStates.length,
    alphabet,
    start: 0,
    accepting: rawAccepting,
    transitions: rawTransitions
  });
}

export function minimizeDfa(rawDfa) {
  const { numStates, alphabet, start, accepting, transitions } = rawDfa;

  // Reachable states from start
  const reachable = new Set();
  const q = [start];
  reachable.add(start);
  while (q.length > 0) {
    const u = q.shift();
    for (const a of alphabet) {
      const v = transitions[u]?.[a];
      if (v !== undefined && !reachable.has(v)) {
        reachable.add(v);
        q.push(v);
      }
    }
  }

  const activeStates = [...reachable];
  let P = [
    activeStates.filter(s => accepting.has(s)),
    activeStates.filter(s => !accepting.has(s))
  ].filter(group => group.length > 0);

  let changed = true;
  while (changed) {
    changed = false;
    const newP = [];
    for (const group of P) {
      if (group.length <= 1) {
        newP.push(group);
        continue;
      }
      const buckets = new Map();
      for (const state of group) {
        const sig = alphabet.map(a => {
          const target = transitions[state][a];
          const partIdx = P.findIndex(p => p.includes(target));
          return partIdx;
        }).join(",");
        if (!buckets.has(sig)) buckets.set(sig, []);
        buckets.get(sig).push(state);
      }
      const split = [...buckets.values()];
      if (split.length > 1) changed = true;
      newP.push(...split);
    }
    P = newP;
  }

  const startGroupIdx = P.findIndex(group => group.includes(start));
  
  const orderedGroups = [];
  const visitedGroup = new Set();
  const bq = [startGroupIdx];
  visitedGroup.add(startGroupIdx);

  while (bq.length > 0) {
    const gIdx = bq.shift();
    orderedGroups.push(gIdx);
    const rep = P[gIdx][0];
    for (const a of alphabet) {
      const target = transitions[rep][a];
      const targetGIdx = P.findIndex(g => g.includes(target));
      if (targetGIdx !== -1 && !visitedGroup.has(targetGIdx)) {
        visitedGroup.add(targetGIdx);
        bq.push(targetGIdx);
      }
    }
  }

  for (let i = 0; i < P.length; i++) {
    if (!visitedGroup.has(i)) orderedGroups.push(i);
  }

  const groupToName = new Map();
  orderedGroups.forEach((gIdx, index) => {
    groupToName.set(gIdx, "q" + index);
  });

  const finalStates = orderedGroups.map((_, i) => "q" + i);
  const finalStart = "q0";
  const finalAccepting = [];
  const finalTransitions = {};

  for (const [gIdx, name] of groupToName.entries()) {
    finalTransitions[name] = {};
    const rep = P[gIdx][0];
    if (accepting.has(rep)) {
      finalAccepting.push(name);
    }
    for (const a of alphabet) {
      const target = transitions[rep][a];
      const targetGIdx = P.findIndex(g => g.includes(target));
      finalTransitions[name][a] = groupToName.get(targetGIdx);
    }
  }

  return {
    states: finalStates,
    alphabet,
    start: finalStart,
    accepting: finalAccepting,
    transitions: finalTransitions
  };
}

export function regexToDfa(pattern, customAlphabet = null) {
  const ast = parseRegex(pattern);
  const nfa = astToNFA(ast);
  return nfaToDfa(nfa, customAlphabet);
}

// Convert any DFA to an equivalent Regular Expression using State Elimination (GNFA)
export function dfaToRegex(dfa) {
  const { states, alphabet, start, accepting, transitions } = dfa;
  if (!accepting || accepting.length === 0) return "∅";

  // Reachable states only
  const reachable = new Set();
  const q = [start];
  reachable.add(start);
  while (q.length > 0) {
    const u = q.shift();
    for (const a of alphabet) {
      const v = transitions[u]?.[a];
      if (v !== undefined && !reachable.has(v)) {
        reachable.add(v);
        q.push(v);
      }
    }
  }

  const validAccepting = accepting.filter(s => reachable.has(s));
  if (validAccepting.length === 0) return "∅";

  // Build GNFA
  const activeStates = [...reachable];
  const allStates = ["S", ...activeStates, "A"];

  const R = {};
  for (const u of allStates) {
    R[u] = {};
    for (const v of allStates) {
      R[u][v] = null;
    }
  }

  R["S"][start] = "ε";
  for (const f of validAccepting) {
    R[f]["A"] = "ε";
  }

  for (const u of activeStates) {
    const symMap = {};
    for (const a of alphabet) {
      const v = transitions[u]?.[a];
      if (v && reachable.has(v)) {
        if (!symMap[v]) symMap[v] = [];
        symMap[v].push(a);
      }
    }
    for (const [v, syms] of Object.entries(symMap)) {
      R[u][v] = syms.length === 1 ? syms[0] : syms.join("|");
    }
  }

  function simplifyUnion(r1, r2) {
    if (!r1 || r1 === "∅") return r2 || "∅";
    if (!r2 || r2 === "∅") return r1 || "∅";
    if (r1 === r2) return r1;
    const parts = new Set();
    for (const p of (r1 + "|" + r2).split("|")) {
      if (p && p !== "∅") parts.add(p);
    }
    return [...parts].join("|");
  }

  function simplifyConcat(r1, r2) {
    if (!r1 || !r2 || r1 === "∅" || r2 === "∅") return null;
    if (r1 === "ε") return r2;
    if (r2 === "ε") return r1;
    let s1 = r1;
    if (r1.includes("|") && !(r1.startsWith("(") && r1.endsWith(")") && matchingParen(r1))) {
      s1 = `(${r1})`;
    }
    let s2 = r2;
    if (r2.includes("|") && !(r2.startsWith("(") && r2.endsWith(")") && matchingParen(r2))) {
      s2 = `(${r2})`;
    }
    return s1 + s2;
  }

  function simplifyStar(r) {
    if (!r || r === "∅" || r === "ε") return "ε";
    if (r.endsWith("*") && matchingStar(r)) return r;
    if (r.length === 1) return r + "*";
    if (r.startsWith("(") && r.endsWith(")") && matchingParen(r)) return r + "*";
    return `(${r})*`;
  }

  function matchingStar(s) {
    if (!s.endsWith("*")) return false;
    const inner = s.slice(0, -1);
    if (inner.length === 1) return true;
    return inner.startsWith("(") && inner.endsWith(")") && matchingParen(inner);
  }

  function matchingParen(s) {
    let d = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "(") d++;
      else if (s[i] === ")") d--;
      if (d === 0 && i < s.length - 1) return false;
    }
    return d === 0;
  }

  // Elimination order: sort activeStates by degree (number of incoming * outgoing)
  const order = [...activeStates].sort((a, b) => {
    const inA = activeStates.filter(u => R[u][a] !== null).length;
    const outA = activeStates.filter(v => R[a][v] !== null).length;
    const inB = activeStates.filter(u => R[u][b] !== null).length;
    const outB = activeStates.filter(v => R[b][v] !== null).length;
    return (inA * outA) - (inB * outB);
  });

  for (const k of order) {
    const loop = R[k][k];
    const loopStar = loop ? simplifyStar(loop) : "ε";

    const preds = allStates.filter(u => u !== k && R[u][k] !== null);
    const succs = allStates.filter(v => v !== k && R[k][v] !== null);

    for (const u of preds) {
      for (const v of succs) {
        const inEdge = R[u][k];
        const outEdge = R[k][v];
        const throughK = simplifyConcat(simplifyConcat(inEdge, loopStar), outEdge);
        R[u][v] = simplifyUnion(R[u][v], throughK);
      }
    }

    for (const u of allStates) {
      R[u][k] = null;
      R[k][u] = null;
    }
  }

  let finalRegex = R["S"]["A"] || "∅";
  return finalRegex;
}

export function getDfaRegex(dfa) {
  if (!dfa) return "—";
  if (dfa.regex) return dfa.regex;
  const errors = validate(dfa);
  if (errors.length > 0) return "Incomplete DFA";
  try {
    return dfaToRegex(dfa);
  } catch (err) {
    return "—";
  }
}
