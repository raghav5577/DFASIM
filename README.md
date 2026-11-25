# Webstate Lab

A browser-based workbench for deterministic finite automata, built for the semester mini-project by Raghav Karnatak and Utsav Yadav.

Open **Webstate_Lab.html** in a modern browser. The packaged file works offline without an installation step.

## Demo

1. The starting example checks whether a binary integer is a multiple of three. Click **Play** with input `1001` to demonstrate the trace `r0 → r1 → r2 → r1 → r0` and the **Accepted** verdict.
2. Try `101` for rejection, `10X1` for invalid input, and a blank test string for ε. Use **Verify** to compare the example against four known cases.
3. Use **New DFA** to enter the states, alphabet, start state and accepting set, and then fill in every transition. Use the **Table** tab to view the transition function and its highlighted cell during a run.

## Source

| File | Role |
| --- | --- |
| `dfa.mjs` | DFA validation, simulation, and sample machines |
| `graph.js` | SVG graph, web edges, and state rendering |
| `interface.js` | Editor, trace, playback, and rule-based Trace Coach |
| `theme.css` | Responsive comic-book interface |
| `webstate.html` | HTML template |
| `build.mjs` | Combines the source files into the portable HTML |

Run `node build.mjs` from the source directory after edits. Reopen `Webstate_Lab.html` to see the result. The simulator and the Trace Coach both use the same deterministic transition data.
