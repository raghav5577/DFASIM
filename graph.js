const svgNS = "http://www.w3.org/2000/svg";

function svg(tag, attributes = {}, parent = graph, content) {
  const node = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (content !== undefined) node.textContent = content;
  parent.append(node);
  return node;
}

function drawWeb(parent, cx, cy, radius, sectors, rotation = 0, sweep = 360) {
  const full = sweep === 360;
  const points = (r) => Array.from({length: sectors + 1}, (_, i) => {
    const angle = (rotation + sweep * i / sectors) * Math.PI / 180;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
  });
  const ends = points(radius);
  for (const [x, y] of full ? ends.slice(0, -1) : ends) {
    svg("path", {d: `M${cx},${cy} L${x},${y}`}, parent);
  }
  for (const fraction of [.24, .45, .67, .86, 1]) {
    const ring = points(radius * fraction);
    const path = ring.slice(1).map(([x, y], i) => {
      const [px, py] = ring[i];
      return `Q${cx + ((x + px) / 2 - cx) * .85},${cy + ((y + py) / 2 - cy) * .85} ${x},${y}`;
    }).join(" ");
    svg("path", {d: `M${ring[0]} ${path}`}, parent);
  }
}

function pointOn(curve, t) {
  const [a, b, c, d] = curve;
  const u = 1 - t;
  return a.map((coordinate, i) => u ** 3 * coordinate + 3 * u ** 2 * t * b[i] + 3 * u * t ** 2 * c[i] + t ** 3 * d[i]);
}

function drawStrand(curve, symbols, active, labelOffset) {
  const [a, b, c, d] = curve;
  const path = `M${a} C${b} ${c} ${d}`;
  const color = active ? "#ff5874" : "#a6c8ec";
  const group = svg("g", {"aria-hidden": "true"});
  svg("path", {d: path, fill: "none", stroke: color, "stroke-width": active ? 10 : 6, opacity: active ? .2 : .1}, group);
  svg("path", {d: path, fill: "none", stroke: color, "stroke-width": active ? 2.5 : 1.65,
    "marker-end": `url(#arrow-${active ? "live" : "idle"})`}, group);
  for (const side of [-1, 1]) {
    let silk = "";
    for (let i = 1; i < 9; i++) {
      const t = i / 10;
      const [x, y] = pointOn(curve, t);
      const [xx, yy] = pointOn(curve, t + .002);
      const length = Math.hypot(xx - x, yy - y) || 1;
      const spread = Math.sin(t * Math.PI) * 5 * side;
      const edge = [x - (yy - y) / length * spread, y + (xx - x) / length * spread];
      const midpoint = pointOn(curve, t - .05);
      silk += i === 1 ? `M${edge}` : ` Q${midpoint} ${edge}`;
      svg("path", {d: `M${x},${y} L${edge}`, fill: "none", stroke: color, opacity: .44}, group);
    }
    svg("path", {d: silk, fill: "none", stroke: color, opacity: active ? .95 : .55, class: active ? "pulse" : ""}, group);
  }
  const [x, midY] = pointOn(curve, .5);
  const y = midY + labelOffset;
  const label = symbols.join(", ");
  const shown = label.length > 19 ? label.slice(0, 17) + "…" : label;
  const width = Math.max(23, shown.length * 8 + 9);
  const chip = svg("g", {}, group);
  svg("title", {}, chip, label);
  svg("rect", {x: x - width / 2, y: y - 10, width, height: 20, rx: 4, fill: "#0b1427",
    stroke: active ? color : "#385c83"}, chip);
  svg("text", {x, y, class: `edge-label${active ? " active" : ""}`}, chip, shown);
}

function renderGraph(dfa, step, zoom) {
  const states = [...new Set(dfa.states)];
  const n = states.length;
  const cols = Math.min(6, n);
  const rows = Math.max(1, Math.ceil(n / 6));
  const width = Math.max(680, 160 + (cols - 1) * 165);
  const height = Math.max(330, rows * 225 + 105);
  graph.replaceChildren();
  graph.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const scroller = graph.parentElement;
  const scale = Math.min(scroller.clientWidth / width, scroller.clientHeight / height) * zoom;
  graph.style.width = Math.max(1, width * scale) + "px";
  graph.style.height = Math.max(1, height * scale) + "px";
  graph.style.maxHeight = "none";
  graph.style.marginInline = "auto";
  const defs = svg("defs");
  for (const [id, fill] of [["idle", "#a6c8ec"], ["live", "#ff5874"]]) {
    const marker = svg("marker", {id: `arrow-${id}`, viewBox: "0 0 10 10", refX: 9, refY: 5,
      markerWidth: 5.5, markerHeight: 5.5, orient: "auto-start-reverse"}, defs);
    svg("path", {d: "M0 0L10 5L0 10L2.5 5Z", fill}, marker);
  }
  const glow = svg("filter", {id: "glow", x: "-65%", y: "-65%", width: "230%", height: "230%"}, defs);
  svg("feGaussianBlur", {stdDeviation: 5}, glow);
  const ornament = svg("g", {stroke: "#72a9db", "stroke-width": .7, opacity: .44, fill: "none"});
  drawWeb(ornament, width - 1, 1, 132, 6, 0, 180);
  drawWeb(ornament, 1, height - 1, 74, 4, -90, 90);
  if (!n) {
    svg("text", {x: width / 2, y: height / 2, class: "node-caption"}, graph, "ADD STATES IN THE DFA EDITOR");
    return;
  }
  const spacing = n <= 3 ? 176 : 154;
  const positions = new Map(states.map((state, i) => {
    const row = Math.floor(i / 6);
    const rowSize = Math.min(6, n - row * 6);
    return [state, [width / 2 + (i % 6 - (rowSize - 1) / 2) * spacing, rows === 1 ? 168 : 154 + row * 225]];
  }));
  const radius = 40;
  for (const from of states) {
    const [x, y] = positions.get(from);
    const connections = new Map();
    for (const symbol of new Set(dfa.alphabet)) {
      const to = dfa.transitions[from]?.[symbol];
      if (!positions.has(to)) continue;
      if (!connections.has(to)) connections.set(to, []);
      connections.get(to).push(symbol);
    }
    for (const [to, symbols] of connections) {
      const active = step?.from === from && step.to === to && symbols.includes(step.symbol);
      const [tx, ty] = positions.get(to);
      if (from === to) {
        drawStrand([[x - 22, y - 34], [x - 73, y - 137], [x + 73, y - 137], [x + 22, y - 34]], symbols, active, -12);
      } else if (ty === y) {
        const direction = Math.sign(tx - x);
        const bend = direction * (30 + Math.min(72, Math.max(0, Math.abs(tx - x) / spacing - 1) * 27));
        drawStrand([[x + direction * 38, y - direction * 12], [x + (tx - x) * .34, y - bend],
          [x + (tx - x) * .66, y - bend], [tx - direction * 38, y - direction * 12]], symbols, active, -direction * 13);
      } else {
        const direction = Math.sign(ty - y);
        const sway = (x <= tx ? -1 : 1) * (26 + Math.abs(tx - x) * .08);
        drawStrand([[x, y + direction * radius], [x + sway, y + (ty - y) * .37],
          [tx + sway, y + (ty - y) * .63], [tx, ty - direction * radius]], symbols, active, -11);
      }
    }
  }
  if (positions.has(dfa.start)) {
    const [x, y] = positions.get(dfa.start);
    svg("path", {d: `M${Math.max(7, x - 96)},${y} H${x - radius - 4}`, stroke: "#a6c8ec",
      "stroke-width": 1.7, "marker-end": "url(#arrow-idle)"});
    svg("text", {x: Math.max(27, x - 71), y: y - 10, class: "start-label"}, graph, "START");
  }
  for (const [state, [x, y]] of positions) {
    const accepting = dfa.accepting.includes(state);
    const active = step?.to === state;
    const color = accepting || active ? "#ff536e" : "#91b9e2";
    const node = svg("g");
    svg("title", {}, node, [state, active && "current", accepting && "accepting", state === dfa.start && "start"].filter(Boolean).join(" · "));
    if (active) svg("circle", {cx: x, cy: y, r: radius + 2, fill: "none", stroke: color, "stroke-width": 7, filter: "url(#glow)", opacity: .9}, node);
    svg("circle", {cx: x, cy: y, r: radius, fill: active ? "#321c34" : "#111d34", stroke: color, "stroke-width": active ? 2.8 : 1.8}, node);
    const web = svg("g", {stroke: color, "stroke-width": .65, opacity: active ? .33 : .26, fill: "none"}, node);
    drawWeb(web, x, y, radius - 4, 10, -90);
    if (accepting) svg("circle", {cx: x, cy: y, r: radius - 5, fill: "none", stroke: color, "stroke-width": 1.35}, node);
    svg("text", {x, y, class: "node-text", "paint-order": "stroke", stroke: "#111a2d", "stroke-width": 3}, node,
      state.length > 6 ? state.slice(0, 5) + "…" : state);
    if (active || accepting) svg("text", {x, y: y + 60, class: "node-caption"}, node, active ? "CURRENT" : "ACCEPTING");
  }
}
