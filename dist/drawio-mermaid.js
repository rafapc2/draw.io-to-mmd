"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/core/util.js
  var require_util = __commonJS({
    "src/core/util.js"(exports, module) {
      "use strict";
      function parseStyle(str) {
        const out = {};
        const order = [];
        String(str || "").split(";").forEach((part) => {
          part = part.trim();
          if (!part) return;
          const i = part.indexOf("=");
          const k = i < 0 ? part : part.slice(0, i);
          const v = i < 0 ? "" : part.slice(i + 1);
          if (!(k in out)) order.push(k);
          out[k] = v;
        });
        Object.defineProperty(out, "__order", { value: order, enumerable: false });
        return out;
      }
      function stringifyStyle(obj) {
        const keys = obj.__order ? obj.__order.filter((k) => k in obj) : [];
        Object.keys(obj).forEach((k) => {
          if (keys.indexOf(k) < 0) keys.push(k);
        });
        return keys.map((k) => obj[k] === "" ? k : `${k}=${obj[k]}`).join(";") + (keys.length ? ";" : "");
      }
      function setStyle(styleStr, key, value) {
        const s = parseStyle(styleStr);
        if (value === null || value === void 0) delete s[key];
        else s[key] = String(value);
        return stringifyStyle(s);
      }
      var NAMED = {
        black: "#000000",
        white: "#ffffff",
        red: "#ff0000",
        green: "#008000",
        lime: "#00ff00",
        blue: "#0000ff",
        yellow: "#ffff00",
        orange: "#ffa500",
        purple: "#800080",
        pink: "#ffc0cb",
        gray: "#808080",
        grey: "#808080",
        silver: "#c0c0c0",
        brown: "#a52a2a",
        cyan: "#00ffff",
        magenta: "#ff00ff",
        navy: "#000080",
        teal: "#008080",
        maroon: "#800000",
        olive: "#808000",
        gold: "#ffd700",
        violet: "#ee82ee",
        lightgray: "#d3d3d3",
        lightgrey: "#d3d3d3",
        lightblue: "#add8e6",
        lightgreen: "#90ee90",
        darkgray: "#a9a9a9",
        darkgrey: "#a9a9a9",
        darkblue: "#00008b",
        darkgreen: "#006400",
        darkred: "#8b0000",
        coral: "#ff7f50"
      };
      function normalizeColor(value) {
        if (value === void 0 || value === null) return null;
        let v = String(value).trim().toLowerCase();
        const ld = v.match(/^light-dark\(\s*([^,]+?)\s*(?:,|\))/);
        if (ld) v = ld[1];
        if (!v || v === "none" || v === "default" || v === "inherit" || v === "transparent") return null;
        let m = v.match(/^#([0-9a-f]{3})$/);
        if (m) return "#" + m[1].split("").map((c) => c + c).join("");
        m = v.match(/^#([0-9a-f]{6}|[0-9a-f]{8})$/);
        if (m) return "#" + m[1];
        m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (m) {
          return "#" + [m[1], m[2], m[3]].map((n) => Math.min(255, +n).toString(16).padStart(2, "0")).join("");
        }
        if (NAMED[v]) return NAMED[v];
        return null;
      }
      var ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
      function decodeEntities(s) {
        return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e) => {
          if (e[0] === "#") {
            const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
            return String.fromCodePoint(code);
          }
          const r = ENTITIES[e.toLowerCase()];
          return r === void 0 ? all : r;
        });
      }
      function labelFromCell(value, isHtml) {
        let s = value == null ? "" : String(value);
        if (isHtml) {
          s = s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?(div|p|li|h[1-6])(\s[^>]*)?>/gi, "\n").replace(/<[^>]+>/g, "");
          s = decodeEntities(s).replace(/\n{2,}/g, "\n").replace(/^\n+|\n+$/g, "");
        }
        return s.replace(/\r/g, "").trim().replace(/"/g, "#quot;").replace(/</g, "#lt;").replace(/>/g, "#gt;").replace(/\n/g, "<br/>");
      }
      var MMD_ENT = { quot: '"', amp: "&", lt: "<", gt: ">", apos: "'", nbsp: " " };
      var KEEP_TAGS = /&lt;(\/?(?:b|i|u|s|strong|em|sub|sup|code))&gt;/gi;
      function labelToCell(label) {
        return String(label).split(/<br\s*\/?>|\\n/i).map((frag) => frag.replace(/#(quot|amp|lt|gt|apos|nbsp);/g, (a, n) => MMD_ENT[n]).replace(/#(\d+);/g, (a, n) => String.fromCodePoint(+n)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(KEEP_TAGS, "<$1>")).join("<br>");
      }
      var RESERVED = /* @__PURE__ */ new Set([
        "end",
        "graph",
        "flowchart",
        "subgraph",
        "style",
        "class",
        "classdef",
        "click",
        "linkstyle",
        "default",
        "direction",
        "call",
        "href",
        "interpolate"
      ]);
      function makeIdAllocator() {
        const used = /* @__PURE__ */ new Set();
        const map = /* @__PURE__ */ new Map();
        const counters = {};
        const readable = (o) => /^[A-Za-z][A-Za-z0-9_-]{0,15}$/.test(o);
        return function alloc(original, hint) {
          if (map.has(original)) return map.get(original);
          let id = String(original).replace(/[^A-Za-z0-9_]/g, "_");
          if (hint && !readable(String(original))) {
            const slug = String(hint.label || "").replace(/<[^>]*>/g, " ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24).replace(/_+$/, "");
            const kind = hint.kind || "shape";
            id = /^[a-z]/.test(slug) ? slug : slug ? kind + "_" + slug : kind + "_" + (counters[kind] = (counters[kind] || 0) + 1);
          }
          if (!id || RESERVED.has(id.toLowerCase()) || /^[ox]/i.test(id) && /^[ox]+$/i.test(id) || /^\d/.test(id)) id = "n" + id;
          let cand = id;
          for (let i = 2; used.has(cand.toLowerCase()); i++) cand = id + "_" + i;
          used.add(cand.toLowerCase());
          map.set(original, cand);
          return cand;
        };
      }
      module.exports = {
        parseStyle,
        stringifyStyle,
        setStyle,
        normalizeColor,
        decodeEntities,
        labelFromCell,
        labelToCell,
        makeIdAllocator
      };
    }
  });

  // src/core/shapes.js
  var require_shapes = __commonJS({
    "src/core/shapes.js"(exports, module) {
      "use strict";
      var { parseStyle, stringifyStyle, normalizeColor } = require_util();
      var SHAPES = {
        rect: { open: "[", close: "]", style: "rounded=0;whiteSpace=wrap;html=1;" },
        round: { open: "(", close: ")", style: "rounded=1;whiteSpace=wrap;html=1;" },
        stadium: { open: "([", close: "])", style: "rounded=1;arcSize=50;whiteSpace=wrap;html=1;" },
        subroutine: { open: "[[", close: "]]", style: "shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;" },
        cylinder: { open: "[(", close: ")]", style: "shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;", h: 60 },
        circle: { open: "((", close: "))", style: "ellipse;whiteSpace=wrap;html=1;aspect=fixed;", square: true },
        doublecircle: { open: "(((", close: ")))", style: "ellipse;shape=doubleEllipse;whiteSpace=wrap;html=1;aspect=fixed;", square: true },
        rhombus: { open: "{", close: "}", style: "rhombus;whiteSpace=wrap;html=1;", grow: 1.6 },
        hexagon: { open: "{{", close: "}}", style: "shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;fixedSize=1;", grow: 1.3 },
        parallelogram: { open: "[/", close: "/]", style: "shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;", grow: 1.3 },
        parallelogram_alt: { open: "[\\", close: "\\]", style: "shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;flipH=1;", grow: 1.3 },
        trapezoid: { open: "[/", close: "\\]", style: "shape=trapezoid;perimeter=trapezoidPerimeter;whiteSpace=wrap;html=1;fixedSize=1;", grow: 1.3 },
        trapezoid_alt: { open: "[\\", close: "/]", style: "shape=trapezoid;perimeter=trapezoidPerimeter;whiteSpace=wrap;html=1;fixedSize=1;flipV=1;", grow: 1.3 },
        asymmetric: { open: ">", close: "]", style: "shape=step;perimeter=stepPerimeter;whiteSpace=wrap;html=1;fixedSize=1;", grow: 1.2 }
      };
      function shapeFromStyle(style) {
        const s = typeof style === "string" ? parseStyle(style) : style;
        const shape = s.shape || "";
        const flipH = s.flipH === "1";
        const flipV = s.flipV === "1";
        if (shape === "doubleEllipse") return "doublecircle";
        if ("ellipse" in s || shape === "ellipse") return "circle";
        if ("rhombus" in s || shape === "rhombus" || shape === "mxgraph.flowchart.decision") return "rhombus";
        if (shape === "hexagon" || shape === "mxgraph.flowchart.preparation") return "hexagon";
        if (/^cylinder/.test(shape) || shape === "datastore" || shape === "mxgraph.flowchart.database") return "cylinder";
        if (shape === "process" || shape === "mxgraph.flowchart.predefined_process") return "subroutine";
        if (shape === "parallelogram" || shape === "mxgraph.flowchart.data") return flipH ? "parallelogram_alt" : "parallelogram";
        if (shape === "trapezoid") return flipV ? "trapezoid_alt" : "trapezoid";
        if (shape === "step" || shape === "mxgraph.flowchart.display") return "asymmetric";
        if (shape === "mxgraph.flowchart.terminator") return "stadium";
        if (s.rounded === "1") {
          const arc = parseFloat(s.arcSize);
          return arc >= 40 ? "stadium" : "round";
        }
        return "rect";
      }
      function defaultSize(shapeName, label) {
        const def = SHAPES[shapeName] || SHAPES.rect;
        const lines = String(label || "").split(/<br\s*\/?>/i);
        const longest = Math.max.apply(null, lines.map((l) => l.replace(/<[^>]+>/g, "").length));
        let w = Math.max(80, Math.round(longest * 8 + 30));
        let h = Math.max(def.h || 40, lines.length * 20 + 20);
        if (def.grow) {
          w = Math.round(w * def.grow);
          h = Math.round(h * Math.min(def.grow, 1.4));
        }
        if (def.square) {
          w = h = Math.max(w, h);
        }
        return { w, h };
      }
      var ARROW_FROM_DRAWIO = {
        none: "none",
        classic: "arrow",
        classicThin: "arrow",
        block: "arrow",
        blockThin: "arrow",
        open: "arrow",
        openThin: "arrow",
        async: "arrow",
        oval: "circle",
        ovalThin: "circle",
        cross: "cross",
        diamond: "circle",
        diamondThin: "circle"
      };
      var ARROW_TO_DRAWIO = { none: "none", arrow: "classic", cross: "cross", circle: "oval" };
      function edgeKindFromStyle(s) {
        if (typeof s === "string") s = parseStyle(s);
        const end = s.endArrow === void 0 ? "classic" : s.endArrow;
        const start = s.startArrow === void 0 ? "none" : s.startArrow;
        const sw = parseFloat(s.strokeWidth);
        return {
          end: ARROW_FROM_DRAWIO[end] || "arrow",
          start: ARROW_FROM_DRAWIO[start] || "none",
          line: s.dashed === "1" || s.dashed === "true" ? "dotted" : sw >= 4 ? "thick" : "solid"
        };
      }
      function edgeStyleFromKind(kind, orthogonal) {
        const s = parseStyle((orthogonal === false ? "" : "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;") + "html=1;");
        s.endArrow = ARROW_TO_DRAWIO[kind.end];
        s.startArrow = ARROW_TO_DRAWIO[kind.start];
        if (kind.end !== "none") s.endFill = kind.end === "circle" ? "0" : "1";
        if (kind.line === "dotted") s.dashed = "1";
        if (kind.line === "thick") s.strokeWidth = "4";
        return stringifyStyle(s);
      }
      function linkOperator(kind) {
        const head = { arrow: ">", cross: "x", circle: "o", none: "" };
        const tail = { arrow: "<", cross: "x", circle: "o", none: "" };
        let body;
        if (kind.line === "dotted") body = (e2) => "-.-" + e2;
        else if (kind.line === "thick") body = (e2) => "==" + (e2 || "=");
        else body = (e2) => "--" + (e2 || "-");
        const e = head[kind.end];
        return tail[kind.start] + body(e);
      }
      module.exports = {
        SHAPES,
        shapeFromStyle,
        defaultSize,
        edgeKindFromStyle,
        edgeStyleFromKind,
        linkOperator,
        normalizeColor
      };
    }
  });

  // src/core/toMermaid.js
  var require_toMermaid = __commonJS({
    "src/core/toMermaid.js"(exports, module) {
      "use strict";
      var { parseStyle, normalizeColor, labelFromCell, makeIdAllocator } = require_util();
      var { SHAPES, shapeFromStyle, edgeKindFromStyle, linkOperator } = require_shapes();
      function toMermaid(model, opts) {
        opts = opts || {};
        const withMeta = opts.metadata !== false;
        const warnings = (model.warnings || []).slice();
        const alloc = makeIdAllocator();
        const nodes = model.nodes;
        const byId = new Map(nodes.map((n) => [n.id, n]));
        const children = /* @__PURE__ */ new Map();
        nodes.forEach((n) => {
          const p = n.parent && byId.has(n.parent) ? n.parent : null;
          if (!children.has(p)) children.set(p, []);
          children.get(p).push(n);
        });
        const isGroup = (n) => (children.get(n.id) || []).length > 0;
        const edges = model.edges.filter((e) => {
          const ok = byId.has(e.source) && byId.has(e.target);
          if (!ok) warnings.push(`Edge ${e.id} skipped: it is not connected to two shapes`);
          return ok;
        });
        let dx = 0, dy = 0;
        edges.forEach((e) => {
          const a = byId.get(e.source), b = byId.get(e.target);
          dx += Math.abs(b.x + b.w / 2 - (a.x + a.w / 2));
          dy += Math.abs(b.y + b.h / 2 - (a.y + a.h / 2));
        });
        if (!edges.length) {
          const xs = nodes.map((n) => n.x + n.w), ys = nodes.map((n) => n.y + n.h);
          dx = Math.max.apply(null, xs.concat([0])) - Math.min.apply(null, nodes.map((n) => n.x).concat([0]));
          dy = Math.max.apply(null, ys.concat([0])) - Math.min.apply(null, nodes.map((n) => n.y).concat([0]));
        }
        let dir = dx > dy ? "LR" : "TD";
        if (dir === "TD") {
          const up = edges.filter((e) => byId.get(e.target).y < byId.get(e.source).y - 1).length;
          if (edges.length && up > edges.length / 2) dir = "BT";
        } else {
          const left = edges.filter((e) => byId.get(e.target).x < byId.get(e.source).x - 1).length;
          if (edges.length && left > edges.length / 2) dir = "RL";
        }
        const lines = [`flowchart ${dir}`];
        const meta = [];
        const styles = [];
        const mid = (n) => {
          const st = parseStyle(n.style);
          const kind = isGroup(n) ? "group" : st.shape === "image" || st.image ? "image" : "shape";
          return alloc(n.id, { label: labelFromCell(n.label, n.html), kind });
        };
        const label = (n) => {
          const t = labelFromCell(n.label, n.html);
          const st = parseStyle(n.style);
          return !t && (st.shape === "image" || st.image) ? "\u{1F5BC}" : t;
        };
        function emitNode(n, indent) {
          const id = mid(n);
          const st = parseStyle(n.style);
          if (isGroup(n)) {
            const title = label(n);
            lines.push(`${indent}subgraph ${id} ["${title || " "}"]`);
            (children.get(n.id) || []).forEach((c) => emitNode(c, indent + "  "));
            lines.push(`${indent}end`);
          } else {
            const sh = SHAPES[shapeFromStyle(st)];
            lines.push(`${indent}${id}${sh.open}"${label(n) || " "}"${sh.close}`);
          }
          const props = nodeStyleProps(st);
          if (props.length) styles.push(`  style ${id} ${props.join(",")}`);
          if (withMeta) meta.push(`%% drawio:node ${id} ${JSON.stringify(nodeMeta(n))}`);
        }
        (children.get(null) || []).forEach((n) => emitNode(n, "  "));
        const linkStyles = [];
        edges.forEach((e, i) => {
          const st = parseStyle(e.style);
          const op = linkOperator(edgeKindFromStyle(st));
          const text = labelFromCell(e.label, e.html);
          lines.push(`  ${mid(byId.get(e.source))} ${op}${text ? `|"${text}"|` : ""} ${mid(byId.get(e.target))}`);
          const props = edgeStyleProps(st);
          if (props.length) linkStyles.push(`  linkStyle ${i} ${props.join(",")}`);
          if (withMeta) meta.push(`%% drawio:edge ${i} ${JSON.stringify(edgeMeta(e, mid(byId.get(e.source)), mid(byId.get(e.target))))}`);
        });
        const out = lines.concat(styles, linkStyles);
        if (withMeta) {
          out.push("  %% --- draw.io round-trip data (ignored by Mermaid) ---");
          out.push(`  %% drawio:graph ${JSON.stringify({ v: 1, dir })}`);
          meta.forEach((m) => out.push("  " + m));
        }
        return { text: out.join("\n") + "\n", warnings };
      }
      function nodeMeta(n) {
        return { id: n.id, x: round(n.x), y: round(n.y), w: round(n.w), h: round(n.h), style: n.style || "" };
      }
      function edgeMeta(e, s, t) {
        const m = { id: e.id, s, t, style: e.style || "" };
        if (e.points && e.points.length) m.points = e.points.map((p) => ({ x: round(p.x), y: round(p.y) }));
        return m;
      }
      var round = (v) => Math.round((+v || 0) * 100) / 100;
      function nodeStyleProps(st) {
        const p = [];
        const fill = normalizeColor(st.fillColor);
        const stroke = normalizeColor(st.strokeColor);
        const font = normalizeColor(st.fontColor);
        if (fill) p.push(`fill:${fill}`);
        else if (st.fillColor === "none") p.push("fill:transparent");
        if (stroke) p.push(`stroke:${stroke}`);
        else if (st.strokeColor === "none") p.push("stroke:transparent");
        if (st.strokeWidth && parseFloat(st.strokeWidth) > 0) p.push(`stroke-width:${num(st.strokeWidth)}px`);
        if (font) p.push(`color:${font}`);
        if (st.dashed === "1") p.push(`stroke-dasharray:${(st.dashPattern || "5 5").replace(/,/g, " ")}`);
        if (st.fontStyle && parseInt(st.fontStyle, 10) & 1) p.push("font-weight:bold");
        if (st.fontStyle && parseInt(st.fontStyle, 10) & 2) p.push("font-style:italic");
        if (st.fontSize) p.push(`font-size:${num(st.fontSize)}px`);
        return p;
      }
      function edgeStyleProps(st) {
        const p = [];
        const stroke = normalizeColor(st.strokeColor);
        const font = normalizeColor(st.fontColor);
        if (stroke) p.push(`stroke:${stroke}`);
        if (st.strokeWidth && parseFloat(st.strokeWidth) > 0) p.push(`stroke-width:${num(st.strokeWidth)}px`);
        if (font) p.push(`color:${font}`);
        return p;
      }
      var num = (v) => String(Math.round(parseFloat(v) * 100) / 100);
      module.exports = { toMermaid };
    }
  });

  // src/core/layout.js
  var require_layout = __commonJS({
    "src/core/layout.js"(exports, module) {
      "use strict";
      var LAYER_GAP = 70;
      var NODE_GAP = 40;
      var PAD = 24;
      var HEADER = 32;
      function layout(nodes, edges, dir) {
        const horizontal = dir === "LR" || dir === "RL";
        LAYER_GAP = edges.some((e) => e.label) ? horizontal ? 130 : 90 : 70;
        const reverse = dir === "BT" || dir === "RL";
        const byId = new Map(nodes.map((n) => [n.id, n]));
        const kids = /* @__PURE__ */ new Map();
        nodes.forEach((n) => {
          const p = n.parent && byId.has(n.parent) ? n.parent : null;
          if (!kids.has(p)) kids.set(p, []);
          kids.get(p).push(n);
        });
        const rel = /* @__PURE__ */ new Map();
        function chain(n) {
          const c = [];
          for (let cur = n; cur; cur = cur.parent && byId.has(cur.parent) ? byId.get(cur.parent) : null) c.push(cur);
          return c;
        }
        function layoutLevel(parentId) {
          const items = kids.get(parentId) || [];
          items.forEach((it) => {
            if (kids.has(it.id)) layoutGroup(it);
          });
          if (!items.length) return { w: 0, h: 0 };
          const idx = new Map(items.map((it, i) => [it.id, i]));
          const links = /* @__PURE__ */ new Set();
          edges.forEach((e) => {
            const a = byId.get(e.source), b = byId.get(e.target);
            if (!a || !b) return;
            const ca = chain(a), cb = chain(b);
            const ia = ca.find((n) => idx.has(n.id));
            const ib = cb.find((n) => idx.has(n.id));
            if (!ia || !ib || ia === ib) return;
            links.add(idx.get(ia.id) + ">" + idx.get(ib.id));
          });
          const adj = items.map(() => []);
          links.forEach((l) => {
            const [a, b] = l.split(">").map(Number);
            adj[a].push(b);
          });
          const linked = /* @__PURE__ */ new Set();
          links.forEach((l) => l.split(">").forEach((i) => linked.add(+i)));
          const loose = items.filter((it, i) => !linked.has(i));
          if (loose.length && loose.length < items.length) {
            const rest = items.filter((it, i) => linked.has(i));
            const kidsBackup = kids.get(parentId);
            kids.set(parentId, rest);
            const size = layoutLevel(parentId);
            kids.set(parentId, kidsBackup);
            const maxW = Math.max(size.w, 640);
            let x = 0, y = size.h + LAYER_GAP, rowH = 0;
            loose.forEach((it) => {
              if (x > 0 && x + it.w > maxW) {
                x = 0;
                y += rowH + NODE_GAP;
                rowH = 0;
              }
              rel.set(it.id, { x, y });
              x += it.w + NODE_GAP;
              rowH = Math.max(rowH, it.h);
            });
            return { w: Math.max(size.w, x > 0 ? x - NODE_GAP : maxW), h: y + rowH };
          }
          const state = items.map(() => 0);
          const dag = items.map(() => []);
          (function visit() {
            function dfs(u) {
              state[u] = 1;
              adj[u].forEach((v) => {
                if (state[v] === 1) return;
                dag[u].push(v);
                if (state[v] === 0) dfs(v);
              });
              state[u] = 2;
            }
            const start = [];
            links.forEach((l) => {
              const a = +l.split(">")[0];
              if (start.indexOf(a) < 0) start.push(a);
            });
            start.concat(items.map((it, i) => i)).forEach((i) => {
              if (state[i] === 0) dfs(i);
            });
          })();
          const layer = items.map(() => 0);
          const indeg = items.map(() => 0);
          dag.forEach((vs) => vs.forEach((v) => indeg[v]++));
          const queue = [];
          indeg.forEach((d, i) => {
            if (!d) queue.push(i);
          });
          while (queue.length) {
            const u = queue.shift();
            dag[u].forEach((v) => {
              layer[v] = Math.max(layer[v], layer[u] + 1);
              if (--indeg[v] === 0) queue.push(v);
            });
          }
          const nLayers = Math.max.apply(null, layer) + 1;
          const rows = [];
          for (let l = 0; l < nLayers; l++) rows.push([]);
          items.forEach((it, i) => rows[layer[i]].push(i));
          const pos = items.map(() => 0);
          rows.forEach((r) => r.forEach((i, k) => {
            pos[i] = k;
          }));
          const preds = items.map(() => []);
          dag.forEach((vs, u) => vs.forEach((v) => preds[v].push(u)));
          for (let sweep = 0; sweep < 4; sweep++) {
            for (let l = 1; l < nLayers; l++) {
              const bc = (i) => preds[i].length ? preds[i].reduce((s, p) => s + pos[p], 0) / preds[i].length : pos[i];
              rows[l].sort((a, b) => bc(a) - bc(b) || a - b);
              rows[l].forEach((i, k) => {
                pos[i] = k;
              });
            }
            for (let l = nLayers - 2; l >= 0; l--) {
              const bc = (i) => dag[i].length ? dag[i].reduce((s, p) => s + pos[p], 0) / dag[i].length : pos[i];
              rows[l].sort((a, b) => bc(a) - bc(b) || a - b);
              rows[l].forEach((i, k) => {
                pos[i] = k;
              });
            }
          }
          const main = (it) => horizontal ? it.w : it.h;
          const cross = (it) => horizontal ? it.h : it.w;
          const order = rows.map((r) => r.slice());
          if (reverse) order.reverse();
          const bandStart = [];
          let m = 0;
          const bandThick = order.map((r) => Math.max.apply(null, r.map((i) => main(items[i]))));
          order.forEach((r, li) => {
            bandStart[li] = m;
            m += bandThick[li] + LAYER_GAP;
          });
          const c = items.map(() => 0);
          order.forEach((r) => {
            let p = 0;
            r.forEach((i) => {
              c[i] = p;
              p += cross(items[i]) + NODE_GAP;
            });
          });
          const neighbours = items.map(() => []);
          dag.forEach((vs, u) => vs.forEach((v) => {
            neighbours[v].push(u);
            neighbours[u].push(v);
          }));
          const center = (i) => c[i] + cross(items[i]) / 2;
          const settle = (r, useNeighbours, reverseSweep) => {
            const seq = reverseSweep ? r.slice().reverse() : r;
            let edge = reverseSweep ? Infinity : -Infinity;
            seq.forEach((i) => {
              const nb = neighbours[i].filter(useNeighbours);
              const want = nb.length ? nb.reduce((s, k) => s + center(k), 0) / nb.length - cross(items[i]) / 2 : c[i];
              if (reverseSweep) {
                c[i] = Math.min(want, edge - cross(items[i]));
                edge = c[i] - NODE_GAP;
              } else {
                c[i] = Math.max(want, edge);
                edge = c[i] + cross(items[i]) + NODE_GAP;
              }
            });
          };
          const layerOf = /* @__PURE__ */ new Map();
          order.forEach((r, li) => r.forEach((i) => layerOf.set(i, li)));
          for (let pass = 0; pass < 3; pass++) {
            order.forEach((r, li) => settle(r, (k) => layerOf.get(k) < li, false));
            for (let li = order.length - 1; li >= 0; li--) settle(order[li], (k) => layerOf.get(k) > li, true);
          }
          const minC = Math.min.apply(null, items.map((it, i) => c[i]));
          const maxC = Math.max.apply(null, items.map((it, i) => c[i] + cross(it)));
          order.forEach((r, li) => r.forEach((i) => {
            const it = items[i];
            const mm = bandStart[li] + (bandThick[li] - main(it)) / 2;
            const cc = c[i] - minC;
            rel.set(it.id, horizontal ? { x: mm, y: cc } : { x: cc, y: mm });
          }));
          const widest = maxC - minC;
          const total = m - LAYER_GAP;
          return horizontal ? { w: total, h: widest } : { w: widest, h: total };
        }
        function layoutGroup(g) {
          const size = layoutLevel(g.id);
          const header = String(g.label || "").trim() ? HEADER : 0;
          (kids.get(g.id) || []).forEach((c) => {
            const r = rel.get(c.id);
            rel.set(c.id, { x: r.x + PAD, y: r.y + PAD + header });
          });
          g.w = Math.max(size.w + PAD * 2, 140);
          g.h = size.h + PAD * 2 + header;
        }
        layoutLevel(null);
        function place(parentId, ox, oy) {
          (kids.get(parentId) || []).forEach((n) => {
            const r = rel.get(n.id);
            n.x = Math.round(ox + r.x);
            n.y = Math.round(oy + r.y);
            place(n.id, n.x, n.y);
          });
        }
        place(null, 40, 40);
      }
      module.exports = { layout };
    }
  });

  // src/core/fromMermaid.js
  var require_fromMermaid = __commonJS({
    "src/core/fromMermaid.js"(exports, module) {
      "use strict";
      var {
        parseStyle,
        stringifyStyle,
        normalizeColor,
        labelToCell
      } = require_util();
      var {
        SHAPES,
        shapeFromStyle,
        defaultSize,
        edgeKindFromStyle,
        edgeStyleFromKind
      } = require_shapes();
      var { layout } = require_layout();
      var ID = /^[\wÀ-￿]+(?:-(?=[\wÀ-￿])[\wÀ-￿]+)*/;
      var OPENERS = [
        ["(((", [[")))", "doublecircle"]]],
        ["((", [["))", "circle"]]],
        ["([", [["])", "stadium"]]],
        ["(", [[")", "round"]]],
        ["[[", [["]]", "subroutine"]]],
        ["[(", [[")]", "cylinder"]]],
        ["[/", [["/]", "parallelogram"], ["\\]", "trapezoid"]]],
        ["[\\", [["\\]", "parallelogram_alt"], ["/]", "trapezoid_alt"]]],
        ["[", [["]", "rect"]]],
        ["{{", [["}}", "hexagon"]]],
        ["{", [["}", "rhombus"]]],
        [">", [["]", "asymmetric"]]]
      ];
      var HEAD = "(?:>|[xo](?![\\w]))";
      var LINKS = [
        // dotted
        { re: new RegExp(`^(<|[xo](?=-))?-\\.+-(${HEAD})?`), build: (m) => ({ line: "dotted", s: m[1], e: m[2] }) },
        { re: new RegExp(`^(<)?-\\.\\s+(.+?)\\s+\\.+-(${HEAD})?`), build: (m) => ({ line: "dotted", s: m[1], e: m[3], label: m[2] }) },
        // thick
        { re: new RegExp(`^(<|[xo](?==))?(?:={2,}(${HEAD})|={3,})`), build: (m) => ({ line: "thick", s: m[1], e: m[2] }) },
        { re: new RegExp(`^(<)?==\\s+(.+?)\\s+={2,}(${HEAD})?`), build: (m) => ({ line: "thick", s: m[1], e: m[3], label: m[2] }) },
        // solid
        { re: new RegExp(`^(<|[xo](?=-))?(?:-{2,}(${HEAD})|-{3,})`), build: (m) => ({ line: "solid", s: m[1], e: m[2] }) },
        { re: new RegExp(`^(<)?--\\s+(.+?)\\s+-{2,}(${HEAD})?`), build: (m) => ({ line: "solid", s: m[1], e: m[3], label: m[2] }) }
      ];
      var HEAD_NAME = { "<": "arrow", ">": "arrow", x: "cross", o: "circle" };
      var PROP_TO_STYLE = {
        fill: "fillColor",
        stroke: "strokeColor",
        color: "fontColor"
      };
      function unquote(s) {
        s = s.trim();
        let m = s.match(/^"([\s\S]*)"$/);
        if (m) s = m[1];
        m = s.match(/^`([\s\S]*)`$/);
        if (m) s = m[1];
        return s;
      }
      function parseProps(str) {
        const out = {};
        let depth = 0, cur = "";
        const parts = [];
        for (const ch of String(str).replace(/;\s*$/, "")) {
          if (ch === "(") depth++;
          if (ch === ")") depth--;
          if (ch === "," && depth === 0) {
            parts.push(cur);
            cur = "";
          } else cur += ch;
        }
        parts.push(cur);
        parts.forEach((p) => {
          const i = p.indexOf(":");
          if (i > 0) out[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim();
        });
        return out;
      }
      function splitStatements(line) {
        const out = [];
        let cur = "", q = false;
        for (const ch of line) {
          if (ch === '"') q = !q;
          if (ch === ";" && !q) {
            out.push(cur);
            cur = "";
          } else cur += ch;
        }
        out.push(cur);
        return out.map((s) => s.trim()).filter(Boolean);
      }
      function parse(text) {
        const g = {
          dir: "TD",
          nodes: /* @__PURE__ */ new Map(),
          edges: [],
          classDefs: {},
          nodeStyles: {},
          linkStyles: [],
          defaultLinkStyle: null,
          meta: { nodes: {}, edges: {}, graph: null },
          warnings: []
        };
        const stack = [];
        let headerSeen = false;
        function ensure(id) {
          let n = g.nodes.get(id);
          if (!n) {
            n = { id, label: null, shape: null, classes: [], parent: null, isGroup: false, order: g.nodes.size };
            g.nodes.set(id, n);
          }
          const cur = stack.length ? stack[stack.length - 1] : null;
          if (cur && !n.parent && n.id !== cur) n.parent = cur;
          return n;
        }
        function parseNode(s, pos) {
          const m = s.slice(pos).match(ID);
          if (!m) return null;
          const id = m[0];
          pos += id.length;
          const node = ensure(id);
          const rest = s.slice(pos);
          for (const [open, closers] of OPENERS) {
            if (!rest.startsWith(open)) continue;
            let body = rest.slice(open.length);
            let label = null, shape = null, used = 0;
            const lead = body.match(/^\s*"([^"]*)"\s*/);
            if (lead) {
              for (const [close, name] of closers) {
                if (body.slice(lead[0].length).startsWith(close)) {
                  label = lead[1];
                  shape = name;
                  used = open.length + lead[0].length + close.length;
                  break;
                }
              }
            }
            if (shape === null) {
              let best = -1, bestShape = null, bestClose = "";
              for (const [close, name] of closers) {
                const i = body.indexOf(close);
                if (i >= 0 && (best < 0 || i < best)) {
                  best = i;
                  bestShape = name;
                  bestClose = close;
                }
              }
              if (best < 0) continue;
              label = body.slice(0, best);
              shape = bestShape;
              used = open.length + best + bestClose.length;
            }
            node.label = unquote(label);
            node.shape = shape;
            pos += used;
            break;
          }
          const cm = s.slice(pos).match(/^:::([\w-]+)/);
          if (cm) {
            node.classes.push(cm[1]);
            pos += cm[0].length;
          }
          return { nodes: [node], pos };
        }
        function parseNodeGroup(s, pos) {
          const all = [];
          for (; ; ) {
            while (/\s/.test(s[pos] || "")) pos++;
            const r = parseNode(s, pos);
            if (!r) return all.length ? { nodes: all, pos } : null;
            all.push(r.nodes[0]);
            pos = r.pos;
            while (/\s/.test(s[pos] || "")) pos++;
            if (s[pos] === "&") {
              pos++;
              continue;
            }
            return { nodes: all, pos };
          }
        }
        function parseLink(s, pos) {
          const rest = s.slice(pos);
          for (const L of LINKS) {
            const m = rest.match(L.re);
            if (!m) continue;
            const info = L.build(m);
            let consumed = m[0].length;
            let label = info.label || null;
            const lab = rest.slice(consumed).match(/^\s*\|\s*("[^"]*"|[^|]*)\s*\|/);
            if (lab) {
              label = unquote(lab[1]);
              consumed += lab[0].length;
            }
            return {
              kind: {
                line: info.line,
                start: info.s ? HEAD_NAME[info.s] : "none",
                end: info.e ? HEAD_NAME[info.e] : "none"
              },
              label: label === null ? "" : unquote(label),
              pos: pos + consumed
            };
          }
          return null;
        }
        function chain(s) {
          let r = parseNodeGroup(s, 0);
          if (!r) {
            g.warnings.push(`Unrecognized statement: ${s}`);
            return;
          }
          let prev = r.nodes, pos = r.pos;
          for (; ; ) {
            while (/\s/.test(s[pos] || "")) pos++;
            if (pos >= s.length) return;
            const link = parseLink(s, pos);
            if (!link) {
              g.warnings.push(`Unrecognized text "${s.slice(pos)}" in: ${s}`);
              return;
            }
            r = parseNodeGroup(s, link.pos);
            if (!r) {
              g.warnings.push(`Missing node after link in: ${s}`);
              return;
            }
            prev.forEach((a) => r.nodes.forEach((b) => g.edges.push({
              source: a.id,
              target: b.id,
              label: link.label,
              kind: link.kind
            })));
            prev = r.nodes;
            pos = r.pos;
          }
        }
        String(text).replace(/\r/g, "").split("\n").forEach((raw) => {
          const line = raw.trim();
          if (!line) return;
          const meta = line.match(/^%%\s*drawio:(node|edge|graph)\s*(\S*)\s*(\{.*\})\s*$/) || line.match(/^%%\s*drawio:(graph)()\s*(\{.*\})\s*$/);
          if (meta) {
            try {
              const data = JSON.parse(meta[3]);
              if (meta[1] === "graph") g.meta.graph = data;
              else g.meta[meta[1] + "s"][meta[2]] = data;
            } catch (e) {
              g.warnings.push("Ignored malformed drawio metadata line");
            }
            return;
          }
          if (line.startsWith("%%")) return;
          const head = line.match(/^(?:flowchart|graph)(?:-elk)?\b\s*(TB|TD|BT|RL|LR)?\s*;?$/i);
          if (head && !headerSeen) {
            headerSeen = true;
            if (head[1]) g.dir = head[1].toUpperCase() === "TB" ? "TD" : head[1].toUpperCase();
            return;
          }
          if (!headerSeen && /^[a-zA-Z-]+(\s|$)/.test(line) && !/^(flowchart|graph)/i.test(line) && /^(sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|gitGraph|mindmap|timeline)/.test(line)) {
            throw new Error('Only Mermaid flowcharts ("flowchart" / "graph") are supported');
          }
          headerSeen = true;
          splitStatements(line).forEach((st) => {
            let m;
            if (m = st.match(/^subgraph\s+(.+)$/i)) {
              const spec = m[1].trim();
              let id, title;
              const sm = spec.match(/^([\wÀ-￿-]+)\s*\[\s*([\s\S]*?)\s*\]$/);
              if (sm) {
                id = sm[1];
                title = unquote(sm[2]);
              } else {
                id = unquote(spec);
                title = id;
              }
              const grp = ensure(id);
              grp.isGroup = true;
              grp.label = title;
              grp.shape = "group";
              stack.push(id);
              return;
            }
            if (/^end$/i.test(st)) {
              stack.pop();
              return;
            }
            if (/^direction\s/i.test(st) || /^click\s/i.test(st) || /^accTitle|^accDescr|^title\s/i.test(st)) return;
            if (m = st.match(/^style\s+(\S+)\s+(.+)$/i)) {
              m[1].split(",").forEach((id) => {
                g.nodeStyles[id] = Object.assign(g.nodeStyles[id] || {}, parseProps(m[2]));
              });
              return;
            }
            if (m = st.match(/^classDef\s+(\S+)\s+(.+)$/i)) {
              m[1].split(",").forEach((c) => {
                g.classDefs[c] = Object.assign(g.classDefs[c] || {}, parseProps(m[2]));
              });
              return;
            }
            if (m = st.match(/^class\s+(\S+)\s+(\S+)$/i)) {
              m[1].split(",").forEach((id) => ensure(id).classes.push(m[2]));
              return;
            }
            if (m = st.match(/^linkStyle\s+(\S+)\s+(.+)$/i)) {
              const props = parseProps(m[2]);
              if (m[1] === "default") g.defaultLinkStyle = props;
              else m[1].split(",").forEach((i) => {
                g.linkStyles[+i] = Object.assign(g.linkStyles[+i] || {}, props);
              });
              return;
            }
            chain(st);
          });
        });
        return g;
      }
      function applyNodeProps(styleStr, props) {
        const s = parseStyle(styleStr);
        Object.keys(props).forEach((k) => {
          const v = props[k];
          if (PROP_TO_STYLE[k]) {
            const key = PROP_TO_STYLE[k];
            if (v === "transparent" || v === "none") {
              if (key !== "fontColor") s[key] = "none";
              return;
            }
            const c = normalizeColor(v);
            if (c && normalizeColor(s[key]) !== c) s[key] = c;
          } else if (k === "stroke-width") {
            const w = parseFloat(v);
            if (!isNaN(w) && parseFloat(s.strokeWidth) !== w) s.strokeWidth = String(w);
          } else if (k === "stroke-dasharray") {
            if (s.dashed !== "1") s.dashed = "1";
            if (!s.dashPattern && /\d/.test(v) && v.replace(/[\s,]+/g, " ").trim() !== "5 5") s.dashPattern = v.replace(/[\s,]+/g, " ").trim();
          } else if (k === "font-weight" && /bold|[6-9]00/.test(v)) {
            s.fontStyle = String((parseInt(s.fontStyle, 10) || 0) | 1);
          } else if (k === "font-style" && /italic/.test(v)) {
            s.fontStyle = String((parseInt(s.fontStyle, 10) || 0) | 2);
          } else if (k === "font-size") {
            const f = parseFloat(v);
            if (!isNaN(f) && parseFloat(s.fontSize) !== f) s.fontSize = String(f);
          }
        });
        return stringifyStyle(s);
      }
      var GROUP_STYLE = "swimlane;startSize=32;fontStyle=1;container=1;collapsible=0;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#9e9e9e;fontColor=#333333;";
      function routeEdges(nodes, edges) {
        const byId = new Map(nodes.map((n) => [n.id, n]));
        const isAncestor = (a, b) => {
          for (let p = b.parent; p; p = (byId.get(p) || {}).parent) if (p === a.id) return true;
          return false;
        };
        const pairs = /* @__PURE__ */ new Map();
        const todo = edges.filter((e) => !e.fromMeta && e.source !== e.target);
        todo.forEach((e) => {
          const k = [e.source, e.target].sort().join("|");
          pairs.set(k, (pairs.get(k) || []).concat(e));
        });
        todo.forEach((e) => {
          const a = byId.get(e.source), b = byId.get(e.target);
          if (!a || !b || isAncestor(a, b) || isAncestor(b, a)) return;
          const list = pairs.get([e.source, e.target].sort().join("|"));
          const k = list.indexOf(e) + 1, n = list.length + 1;
          const dx = b.x + b.w / 2 - (a.x + a.w / 2), dy = b.y + b.h / 2 - (a.y + a.h / 2);
          const r2 = (v) => String(Math.round(Math.min(1, Math.max(0, v)) * 100) / 100);
          const lane = (a0, a1, b0, b1) => {
            const lo = Math.max(a0, b0), hi = Math.min(a1, b1);
            return hi - lo > 10 ? lo + (hi - lo) * k / n : null;
          };
          const s = parseStyle(e.style);
          if (Math.abs(dx) / (a.w + b.w) >= Math.abs(dy) / (a.h + b.h)) {
            const y = lane(a.y, a.y + a.h, b.y, b.y + b.h);
            s.exitX = dx >= 0 ? "1" : "0";
            s.entryX = dx >= 0 ? "0" : "1";
            s.exitY = y === null ? r2(k / n) : r2((y - a.y) / a.h);
            s.entryY = y === null ? r2(k / n) : r2((y - b.y) / b.h);
          } else {
            const x = lane(a.x, a.x + a.w, b.x, b.x + b.w);
            s.exitY = dy >= 0 ? "1" : "0";
            s.entryY = dy >= 0 ? "0" : "1";
            s.exitX = x === null ? r2(k / n) : r2((x - a.x) / a.w);
            s.entryX = x === null ? r2(k / n) : r2((x - b.x) / b.w);
          }
          e.style = stringifyStyle(s);
        });
      }
      function layoutNewNodes(nodes, edges, known, dir) {
        const knownIds = new Set(known.map((n) => n.id));
        const fresh = nodes.filter((n) => !knownIds.has(n.id));
        const freshIds = new Set(fresh.map((n) => n.id));
        const saved = new Map(fresh.map((n) => [n.id, n.parent]));
        fresh.forEach((n) => {
          if (!freshIds.has(n.parent)) n.parent = null;
        });
        layout(fresh, edges.filter((e) => freshIds.has(e.source) && freshIds.has(e.target)), dir);
        fresh.forEach((n) => {
          n.parent = saved.get(n.id);
        });
        const right = Math.max.apply(null, known.map((n) => n.x + n.w));
        const top = Math.min.apply(null, known.map((n) => n.y));
        const dx = right + 80 - Math.min.apply(null, fresh.map((n) => n.x));
        const dy = top - Math.min.apply(null, fresh.map((n) => n.y));
        fresh.forEach((n) => {
          n.x += dx;
          n.y += dy;
        });
      }
      var GROUP_STYLE_UNTITLED = "rounded=0;container=1;collapsible=0;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#9e9e9e;";
      function fromMermaid(text) {
        const g = parse(text);
        const warnings = g.warnings.slice();
        const nodes = [];
        const list = Array.from(g.nodes.values()).sort((a, b) => a.order - b.order);
        const allMeta = list.length > 0 && list.every((n) => g.meta.nodes[n.id] && isFinite(g.meta.nodes[n.id].x));
        list.forEach((n) => {
          const meta = g.meta.nodes[n.id];
          const shape = n.isGroup ? "group" : n.shape || "rect";
          let label = n.label === null ? n.id : n.label;
          if (label.trim() === "" || label === "\u{1F5BC}" && meta && /image/.test(meta.style || "")) label = "";
          let style;
          if (n.isGroup) {
            style = meta && meta.style ? meta.style : label ? GROUP_STYLE : GROUP_STYLE_UNTITLED;
            if (!/(^|;)container=1/.test(style)) style += (style.endsWith(";") || !style ? "" : ";") + "container=1;";
          } else if (meta && meta.style && shapeFromStyle(meta.style) === shape) {
            style = meta.style;
          } else {
            style = SHAPES[shape].style;
          }
          const classNames = ["default"].concat(n.classes);
          classNames.forEach((c) => {
            if (g.classDefs[c]) style = applyNodeProps(style, g.classDefs[c]);
          });
          if (g.nodeStyles[n.id]) style = applyNodeProps(style, g.nodeStyles[n.id]);
          const size = defaultSize(shape === "group" ? "rect" : shape, label);
          nodes.push({
            id: meta && meta.id || n.id,
            mermaidId: n.id,
            label: labelToCell(label),
            html: true,
            style,
            shape,
            x: meta && isFinite(meta.x) ? meta.x : 0,
            y: meta && isFinite(meta.y) ? meta.y : 0,
            w: meta && meta.w > 0 ? meta.w : size.w,
            h: meta && meta.h > 0 ? meta.h : size.h,
            parent: n.parent,
            isGroup: n.isGroup
          });
        });
        const finalId = new Map(nodes.map((n) => [n.mermaidId, n.id]));
        nodes.forEach((n) => {
          n.parent = n.parent ? finalId.get(n.parent) || null : null;
        });
        const metaList = Object.keys(g.meta.edges).map(Number).sort((a, b) => a - b).map((k) => g.meta.edges[k]);
        const hasEnds = metaList.some((m) => m.s !== void 0);
        const byPair = /* @__PURE__ */ new Map();
        metaList.forEach((m) => {
          const k = m.s + ">" + m.t;
          byPair.set(k, (byPair.get(k) || []).concat(m));
        });
        const seenPair = /* @__PURE__ */ new Map();
        const edges = g.edges.map((e, i) => {
          let meta;
          if (hasEnds) {
            const k = e.source + ">" + e.target;
            const occ = seenPair.get(k) || 0;
            seenPair.set(k, occ + 1);
            meta = (byPair.get(k) || [])[occ];
          } else meta = g.meta.edges[i];
          const kind = e.kind;
          let style;
          if (meta && meta.style) {
            const k = edgeKindFromStyle(meta.style);
            style = k.start === kind.start && k.end === kind.end && k.line === kind.line ? meta.style : edgeStyleFromKind(kind);
          } else {
            style = edgeStyleFromKind(kind);
          }
          [g.defaultLinkStyle, g.linkStyles[i]].forEach((props) => {
            if (!props) return;
            const mapped = {};
            if (props.stroke) mapped.stroke = props.stroke;
            if (props["stroke-width"]) mapped["stroke-width"] = props["stroke-width"];
            if (props.color) mapped.color = props.color;
            style = applyNodeProps(style, mapped);
          });
          return {
            id: meta && meta.id || null,
            fromMeta: !!meta,
            source: finalId.get(e.source),
            target: finalId.get(e.target),
            label: labelToCell(e.label),
            html: true,
            style,
            kind,
            points: meta && meta.points || []
          };
        });
        const known = nodes.filter((n) => g.meta.nodes[n.mermaidId] && isFinite(g.meta.nodes[n.mermaidId].x));
        if (!known.length) {
          layout(nodes, edges, g.dir);
          edges.forEach((e) => {
            e.points = [];
          });
        } else if (known.length < nodes.length) {
          layoutNewNodes(nodes, edges, known, g.dir);
        }
        routeEdges(nodes, edges);
        return { nodes, edges, dir: g.dir, warnings, hasGeometry: allMeta };
      }
      module.exports = { fromMermaid, parse, parseProps };
    }
  });

  // src/core/cells.js
  var require_cells = __commonJS({
    "src/core/cells.js"(exports, module) {
      "use strict";
      var { parseStyle } = require_util();
      function cellsToModel(cells, opts) {
        opts = opts || {};
        const byId = new Map(cells.map((c) => [c.id, c]));
        const include = opts.include ? new Set(opts.include) : null;
        const warnings = [];
        const ok = (c) => !include || include.has(c.id);
        const isEdgeLabel = (c) => c.vertex && (byId.get(c.parent) || {}).edge;
        const absolute = (c) => {
          let x = c.geometry && c.geometry.x || 0, y = c.geometry && c.geometry.y || 0;
          for (let p = byId.get(c.parent); p && p.vertex; p = byId.get(p.parent)) {
            x += p.geometry && p.geometry.x || 0;
            y += p.geometry && p.geometry.y || 0;
          }
          return { x, y };
        };
        const parentOf = (c) => {
          for (let p = byId.get(c.parent); p; p = byId.get(p.parent)) {
            if (p.vertex && ok(p) && !isEdgeLabel(p)) return p.id;
          }
          return null;
        };
        const labels = /* @__PURE__ */ new Map();
        cells.filter(isEdgeLabel).forEach((c) => {
          if (c.value && ok(byId.get(c.parent))) labels.set(c.parent, c.value);
        });
        const nodes = cells.filter((c) => c.vertex && ok(c) && !isEdgeLabel(c)).map((c) => {
          const g = c.geometry || {};
          const a = absolute(c);
          return {
            id: c.id,
            label: c.value || "",
            html: parseStyle(c.style).html === "1",
            style: c.style || "",
            x: a.x,
            y: a.y,
            w: g.w || 0,
            h: g.h || 0,
            parent: parentOf(c)
          };
        });
        const origin = (c) => {
          let x = 0, y = 0;
          for (let p = byId.get(c.parent); p && p.vertex; p = byId.get(p.parent)) {
            x += p.geometry && p.geometry.x || 0;
            y += p.geometry && p.geometry.y || 0;
          }
          return { x, y };
        };
        if (opts.inferContainers !== false) inferContainers(nodes);
        const edges = cells.filter((c) => c.edge && ok(c)).map((c) => ({
          id: c.id,
          source: c.source,
          target: c.target,
          label: c.value || labels.get(c.id) || "",
          html: parseStyle(c.style).html === "1",
          style: c.style || "",
          points: (c.geometry && c.geometry.points || []).map((pt) => ({ x: pt.x + origin(c).x, y: pt.y + origin(c).y }))
        }));
        edges.forEach((e) => {
          if ((byId.get(e.source) || {}).edge || (byId.get(e.target) || {}).edge) {
            e.source = e.target = null;
          }
        });
        return { nodes, edges, warnings };
      }
      function inferContainers(nodes) {
        const area = (n) => n.w * n.h;
        const inside = (b, a) => b.x >= a.x - 1 && b.y >= a.y - 1 && b.x + b.w <= a.x + a.w + 1 && b.y + b.h <= a.y + a.h + 1;
        nodes.forEach((b) => {
          if (b.parent || area(b) <= 0) return;
          let best = null;
          nodes.forEach((a) => {
            if (a === b || area(a) <= area(b) * 1.05 || !inside(b, a)) return;
            if (!best || area(a) < area(best)) best = a;
          });
          if (best) b.parent = best.id;
        });
      }
      function modelToCells(model, opts) {
        opts = opts || {};
        const layerId = opts.layerId || "1";
        const taken = new Set(opts.taken || []);
        taken.add("0");
        taken.add(layerId);
        let counter = 0;
        const fresh = (prefix) => {
          let id;
          do {
            id = prefix + ++counter;
          } while (taken.has(id));
          taken.add(id);
          return id;
        };
        const ids = /* @__PURE__ */ new Map();
        model.nodes.forEach((n) => {
          let id = n.id;
          if (id == null || taken.has(String(id))) id = fresh("mmd-");
          else taken.add(String(id));
          ids.set(n.id, String(id));
        });
        const byId = new Map(model.nodes.map((n) => [n.id, n]));
        const ordered = [];
        const seen = /* @__PURE__ */ new Set();
        const visit = (n) => {
          if (seen.has(n.id)) return;
          seen.add(n.id);
          if (n.parent && byId.has(n.parent)) visit(byId.get(n.parent));
          ordered.push(n);
        };
        model.nodes.forEach(visit);
        const cells = ordered.map((n) => {
          const p = n.parent && byId.get(n.parent);
          return {
            id: ids.get(n.id),
            vertex: true,
            value: n.label,
            style: n.style,
            parent: p ? ids.get(p.id) : layerId,
            geometry: { x: n.x - (p ? p.x : 0), y: n.y - (p ? p.y : 0), w: n.w, h: n.h }
          };
        });
        model.edges.forEach((e) => {
          if (!ids.has(e.source) || !ids.has(e.target)) return;
          let id = e.id;
          if (id == null || taken.has(String(id))) id = fresh("mmd-e");
          else taken.add(String(id));
          cells.push({
            id: String(id),
            edge: true,
            value: e.label,
            style: e.style,
            parent: layerId,
            source: ids.get(e.source),
            target: ids.get(e.target),
            geometry: { points: e.points || [] }
          });
        });
        return cells;
      }
      module.exports = { cellsToModel, modelToCells };
    }
  });

  // src/core/index.js
  var require_core = __commonJS({
    "src/core/index.js"(exports, module) {
      "use strict";
      module.exports = __spreadProps(__spreadValues(__spreadValues(__spreadValues(__spreadValues({}, require_toMermaid()), require_fromMermaid()), require_cells()), require_util()), {
        shapeFromStyle: require_shapes().shapeFromStyle
      });
    }
  });

  // src/adapter.js
  var require_adapter = __commonJS({
    "src/adapter.js"(exports, module) {
      "use strict";
      var core = require_core();
      var plainLabel = (cell) => {
        const v = cell.value;
        if (v && typeof v === "object" && typeof v.getAttribute === "function") return v.getAttribute("label") || "";
        return v == null ? "" : String(v);
      };
      function readCells(graph, selectionOnly) {
        const model = graph.getModel();
        const root = model.getRoot();
        const out = [];
        const selected = /* @__PURE__ */ new Set();
        const walk = (cell, underSelected) => {
          const isSel = underSelected || selectionOnly && graph.isCellSelected(cell);
          if (cell !== root && model.getParent(cell) !== root && model.isVisible(cell)) {
            const g = cell.geometry;
            out.push({
              id: cell.id,
              parent: model.getParent(cell).id,
              vertex: model.isVertex(cell),
              edge: model.isEdge(cell),
              value: plainLabel(cell),
              style: cell.style || "",
              source: cell.source ? cell.source.id : null,
              target: cell.target ? cell.target.id : null,
              geometry: g ? {
                x: g.x || 0,
                y: g.y || 0,
                w: g.width || 0,
                h: g.height || 0,
                points: (g.points || []).map((p) => ({ x: p.x, y: p.y }))
              } : void 0
            });
            if (isSel) selected.add(cell.id);
          }
          for (let i = 0; i < model.getChildCount(cell); i++) walk(model.getChildAt(cell, i), isSel);
        };
        walk(root, false);
        return { cells: out, selected: selectionOnly ? Array.from(selected) : null };
      }
      function exportMermaid(graph, opts) {
        opts = opts || {};
        const { cells, selected } = readCells(graph, !!opts.selectionOnly);
        const model = core.cellsToModel(cells, selected && selected.length ? { include: selected } : {});
        if (!model.nodes.length) {
          return { text: "", warnings: ["The diagram has no shapes to export"], empty: true };
        }
        return core.toMermaid(model, { metadata: opts.metadata !== false });
      }
      function importMermaid(graph, mx, text, opts) {
        opts = opts || {};
        const model = graph.getModel();
        const parent = graph.getDefaultParent();
        const parsed = core.fromMermaid(text);
        if (!parsed.nodes.length) throw new Error("No flowchart shapes found in the Mermaid text");
        const existing = model.getChildCells(parent, true, true);
        const taken = /* @__PURE__ */ new Set();
        if (!opts.replace) {
          Object.keys(model.cells || {}).forEach((id) => taken.add(id));
        }
        if (!opts.replace && existing.length) {
          const b = graph.getBoundingBoxFromGeometry(existing, true) || graph.getGraphBounds();
          const minX = Math.min.apply(null, parsed.nodes.map((n) => n.x));
          const minY = Math.min.apply(null, parsed.nodes.map((n) => n.y));
          const dx = b.x + b.width + 80 - minX, dy = b.y - minY;
          parsed.nodes.forEach((n) => {
            n.x += dx;
            n.y += dy;
          });
          parsed.edges.forEach((e) => e.points.forEach((p) => {
            p.x += dx;
            p.y += dy;
          }));
        }
        const flat = core.modelToCells(parsed, { layerId: parent.id, taken });
        const created = /* @__PURE__ */ new Map();
        const result = [];
        model.beginUpdate();
        try {
          if (opts.replace) graph.removeCells(existing, true);
          flat.filter((c) => c.vertex).forEach((c) => {
            const g = c.geometry;
            const cell = new mx.mxCell(c.value, new mx.mxGeometry(g.x, g.y, g.w, g.h), c.style);
            cell.setId(c.id);
            cell.setVertex(true);
            cell.setConnectable(true);
            const p = c.parent === parent.id ? parent : created.get(c.parent);
            graph.addCell(cell, p);
            created.set(c.id, cell);
            result.push(cell);
          });
          flat.filter((c) => c.edge).forEach((c) => {
            const geo = new mx.mxGeometry();
            geo.relative = true;
            if (c.geometry.points.length) geo.points = c.geometry.points.map((p) => new mx.mxPoint(p.x, p.y));
            const cell = new mx.mxCell(c.value, geo, c.style);
            cell.setId(c.id);
            cell.setEdge(true);
            graph.addEdge(cell, parent, created.get(c.source), created.get(c.target));
            result.push(cell);
          });
        } finally {
          model.endUpdate();
        }
        return { cells: result, warnings: parsed.warnings };
      }
      module.exports = { readCells, exportMermaid, importMermaid };
    }
  });

  // src/plugin.js
  var require_plugin = __commonJS({
    "src/plugin.js"() {
      var adapter = require_adapter();
      Draw.loadPlugin(function(ui) {
        const graph = ui.editor.graph;
        mxResources.parse("exportMermaid=Export to Mermaid...");
        mxResources.parse("importMermaid=Import from Mermaid...");
        const el = (tag, css, text) => {
          const e = document.createElement(tag);
          if (css) e.style.cssText = css;
          if (text) mxUtils.write(e, text);
          return e;
        };
        const textarea = (readOnly) => {
          const t = el("textarea", "width:100%;height:290px;box-sizing:border-box;font:12px/1.4 Menlo,Consolas,monospace;resize:none;white-space:pre;overflow:auto;");
          t.readOnly = !!readOnly;
          t.spellcheck = false;
          return t;
        };
        const row = () => el("div", "display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;");
        const button = (label, fn, primary) => {
          const b = mxUtils.button(label, fn);
          b.className = primary ? "geBtn gePrimaryBtn" : "geBtn";
          return b;
        };
        const note = () => el("div", "margin-top:8px;font-size:12px;color:#b00020;white-space:pre-wrap;min-height:16px;");
        const copy = (text) => {
          if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
          const t = textarea(false);
          t.value = text;
          document.body.appendChild(t);
          t.select();
          document.execCommand("copy");
          document.body.removeChild(t);
          return Promise.resolve();
        };
        const download = (name, text) => {
          const a = el("a");
          a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
          a.download = name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
        };
        const fileName = () => (ui.getCurrentFile && ui.getCurrentFile() && ui.getCurrentFile().getTitle() || "diagram").replace(/\.(drawio|xml|dio)$/i, "");
        function showExport() {
          const hasSelection = !graph.isSelectionEmpty();
          const div = el("div", "padding:16px;");
          div.appendChild(el("div", "font-weight:bold;font-size:15px;margin-bottom:8px;", "Export to Mermaid"));
          const area = textarea(true);
          const msg = note();
          div.appendChild(area);
          const opts = row();
          const meta = el("input");
          meta.type = "checkbox";
          meta.checked = true;
          const metaLabel = el("label", "cursor:pointer;");
          metaLabel.appendChild(meta);
          metaLabel.appendChild(document.createTextNode(" Include draw.io data (exact sizes, positions & styles for a lossless re-import)"));
          opts.appendChild(metaLabel);
          let sel = null;
          if (hasSelection) {
            sel = el("input");
            sel.type = "checkbox";
            sel.checked = true;
            const l = el("label", "cursor:pointer;");
            l.appendChild(sel);
            l.appendChild(document.createTextNode(" Selection only"));
            opts.appendChild(l);
          }
          div.appendChild(opts);
          const render = () => {
            try {
              const r = adapter.exportMermaid(graph, { metadata: meta.checked, selectionOnly: sel ? sel.checked : false });
              area.value = r.text;
              msg.style.color = r.empty ? "#b00020" : "#8a6d00";
              msg.textContent = (r.warnings || []).join("\n");
            } catch (e) {
              area.value = "";
              msg.style.color = "#b00020";
              msg.textContent = "Export failed: " + e.message;
            }
          };
          meta.addEventListener("change", render);
          if (sel) sel.addEventListener("change", render);
          render();
          div.appendChild(msg);
          const btns = row();
          btns.style.justifyContent = "flex-end";
          btns.appendChild(button("Copy", function() {
            copy(area.value).then(() => {
              this.textContent = "Copied";
              setTimeout(() => {
                this.textContent = "Copy";
              }, 1200);
            });
          }));
          btns.appendChild(button("Download .mmd", () => download(fileName() + ".mmd", area.value)));
          btns.appendChild(button("Close", () => ui.hideDialog(), true));
          div.appendChild(btns);
          ui.showDialog(div, 720, 480, true, true);
          area.focus();
        }
        function showImport() {
          const div = el("div", "padding:16px;");
          div.appendChild(el("div", "font-weight:bold;font-size:15px;margin-bottom:8px;", "Import from Mermaid"));
          const area = textarea(false);
          area.placeholder = "flowchart TD\n  A[Start] --> B{Ok?}\n  B -->|yes| C([Done])";
          div.appendChild(area);
          const opts = row();
          const mk = (value, label, checked) => {
            const r = el("input");
            r.type = "radio";
            r.name = "mmd-mode";
            r.value = value;
            r.checked = checked;
            const l = el("label", "cursor:pointer;");
            l.appendChild(r);
            l.appendChild(document.createTextNode(" " + label));
            opts.appendChild(l);
            return r;
          };
          mk("insert", "Add to this page", true);
          const replace = mk("replace", "Replace this page", false);
          div.appendChild(opts);
          const msg = note();
          div.appendChild(msg);
          const file = el("input");
          file.type = "file";
          file.accept = ".mmd,.mermaid,.md,.txt";
          file.style.display = "none";
          file.addEventListener("change", () => {
            const f = file.files[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = () => {
              area.value = String(reader.result);
            };
            reader.readAsText(f);
          });
          const btns = row();
          btns.style.justifyContent = "flex-end";
          btns.appendChild(file);
          btns.appendChild(button("Open file...", () => file.click()));
          btns.appendChild(button("Cancel", () => ui.hideDialog()));
          btns.appendChild(button("Import", () => {
            msg.style.color = "#b00020";
            msg.textContent = "";
            const text = area.value.replace(/^\s*```(?:mermaid)?\s*\n?|\n?```\s*$/g, "");
            if (!text.trim()) {
              msg.textContent = "Paste some Mermaid text first.";
              return;
            }
            try {
              const r = adapter.importMermaid(graph, { mxCell, mxGeometry, mxPoint }, text, { replace: replace.checked });
              graph.setSelectionCells(r.cells);
              graph.scrollCellToVisible(r.cells[0]);
              ui.hideDialog();
              if (r.warnings.length) ui.alert("Imported with warnings:\n" + r.warnings.join("\n"));
            } catch (e) {
              msg.textContent = "Import failed: " + e.message;
            }
          }, true));
          div.appendChild(btns);
          ui.showDialog(div, 720, 480, true, true);
          area.focus();
        }
        ui.actions.addAction("exportMermaid", showExport);
        ui.actions.addAction("importMermaid", showImport);
        const addTo = (name, items, separator) => {
          const menu = ui.menus.get(name);
          if (!menu) return false;
          const old = menu.funct;
          menu.funct = function(m, parent) {
            old.apply(this, arguments);
            ui.menus.addMenuItems(m, separator ? ["-"].concat(items) : items, parent);
          };
          return true;
        };
        addTo("extras", ["importMermaid", "exportMermaid"], true);
        addTo("exportAs", ["exportMermaid"], false);
        addTo("importFrom", ["importMermaid"], false);
      });
    }
  });
  require_plugin();
})();
