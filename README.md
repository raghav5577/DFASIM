# Webstate Lab

A browser-based workbench for deterministic finite automata, built for the semester mini-project by Raghav Karnatak and Utsav Yadav.

Open **Webstate_Lab.html** in a modern browser. The packaged file works offline without an installation step.

## Demo

1. The starting example checks whether a binary integer is a multiple of three. Click **Play** with input `1001` to demonstrate the trace `r0 → r1 → r2 → r1 → r0` and the **Accepted** verdict.
2. Try `101` for rejection, `10X1` for invalid input, and a blank test string for ε. Use **Verify** to compare the example against four known cases.
3. Check the **Regex** pill right beside the **State diagram** heading to see the equivalent regular expression for any active machine.
4. Open the **Regex → DFA** tab in the navigation bar to convert any regular expression (e.g. `(0|1)*01`, `(a|b)*abb`) into an equivalent minimal DFA, and immediately test strings on the **Trace** and inspect transitions on the **Table**.
5. Use **New DFA** or the **DFA Editor** to enter states, alphabet, start state, and transitions manually. The regex heading automatically recomputes to match your machine via state elimination.

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

## Deploy to Vercel

Import this repository into Vercel with the **Other** framework preset and no build command. `vercel.json` serves the project root as static files and routes `/` to `Webstate_Lab.html`, so no package installation or server runtime is needed.
