import {readFileSync, writeFileSync} from "node:fs";

const read = name => readFileSync(new URL(name, import.meta.url), "utf8");
const sections = {
  STYLES: read("theme.css"),
  ENGINE: read("dfa.mjs").replace(/^export /gm, ""),
  INTERFACE: read("graph.js") + "\n" + read("interface.js")
};
const html = read("webstate.html").replace(
  /\/\* (STYLES|ENGINE|INTERFACE) \*\//g,
  (_, section) => sections[section]
);
writeFileSync(new URL("Webstate_Lab.html", import.meta.url), html);
