(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const reduced = () => motion.matches;
  const nextFrame = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

  /* ------------------------------------------------------------------ *
   * Stacked sections: a card taller than the viewport sticks only once
   * its bottom edge reaches the bottom of the viewport.
   * ------------------------------------------------------------------ */
  const cards = [...document.querySelectorAll(".card")];
  const setStickTop = () => cards.forEach((el) =>
    el.style.setProperty("--stick-top", `${Math.min(0, innerHeight - el.offsetHeight)}px`));
  const ro = new ResizeObserver(setStickTop);
  cards.forEach((el) => ro.observe(el));
  addEventListener("resize", setStickTop);

  /* ------------------------------------------------------------------ *
   * Fig. 1: time to first paint
   * ------------------------------------------------------------------ */
  (function race() {
    const fig = $("#race");
    const T = 2;         // seconds shown on the axis
    const HTML = 0.3;    // seconds until the HTML has arrived
    const lanes = [...fig.querySelectorAll(".lane")];
    const pct = (s) => `${(s / T) * 100}%`;

    $("#axis").innerHTML = [0, 0.5, 1, 1.5, 2]
      .map((s) => `<span style="left:${pct(s)}">${s === 0 ? "0" : s.toFixed(1)} s</span>`)
      .join("");

    lanes.forEach((lane) => {
      const d = +lane.dataset.css;
      Object.assign($(".seg.html", lane).style, { left: "0%", width: pct(HTML) });
      Object.assign($(".seg.css", lane).style, { left: pct(HTML), width: pct(d) });
      $(".paint", lane).style.left = pct(HTML + d);
    });

    function set(t) {
      lanes.forEach((lane) => {
        const d = +lane.dataset.css;
        $(".seg.html", lane).style.setProperty("--f", clamp(t / HTML));
        $(".seg.css", lane).style.setProperty("--f", clamp((t - HTML) / d));
        $(".head", lane).style.left = pct(Math.min(t, T));
        lane.classList.toggle("painted", t >= HTML + d);
      });
    }

    let raf = 0;
    function run() {
      cancelAnimationFrame(raf);
      if (reduced()) return set(T);
      const wall = 3000;
      let start = 0;
      set(0);
      const tick = (now) => {
        start ||= now;
        const t = ((now - start) / wall) * T;
        set(t);
        if (t < T) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    set(0);
    $("#raceReplay").addEventListener("click", run);
    new IntersectionObserver((entries, io) => {
      if (entries[0].isIntersecting) { io.disconnect(); run(); }
    }, { threshold: 0.6 }).observe(fig);
  })();

  /* ------------------------------------------------------------------ *
   * Fig. 2: CSS files fly from source into each page's chunk
   * ------------------------------------------------------------------ */
  (function build() {
    const fig = $("#build");
    const order = ["home-header", "home-hero", "blog-header"];
    const blocks = [...fig.querySelectorAll(".blk")];
    let timers = [];

    function reset() {
      timers.forEach(clearTimeout);
      timers = [];
      fig.querySelectorAll(".flyer").forEach((e) => e.remove());
      blocks.forEach((b) => b.classList.remove("in"));
      fig.querySelectorAll(".out").forEach((o) => o.classList.remove("done"));
    }

    function fly(id) {
      const chip = fig.querySelector(`[data-to="${id}"]`);
      const blk = fig.querySelector(`#${id}`);
      const f = fig.getBoundingClientRect();
      const a = chip.getBoundingClientRect();
      const b = blk.getBoundingClientRect();
      const el = chip.cloneNode(true);
      el.removeAttribute("data-to");
      el.classList.add("flyer");
      el.style.left = `${a.left - f.left}px`;
      el.style.top = `${a.top - f.top}px`;
      fig.appendChild(el);
      const dx = b.left - a.left + 10;
      const dy = b.top - a.top + 2;
      el.animate(
        [
          { transform: "translate(0, 0) scale(1)" },
          { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 18}px) scale(1.08)`, offset: 0.5 },
          { transform: `translate(${dx}px, ${dy}px) scale(1)`, opacity: 1, offset: 0.85 },
          { transform: `translate(${dx}px, ${dy}px) scale(1)`, opacity: 0 },
        ],
        { duration: 1300, easing: "cubic-bezier(.45, 0, .25, 1)" }
      ).onfinish = () => el.remove();
      timers.push(setTimeout(() => land(blk), 1050));
    }

    // A chunk gets its name only once every block in it has landed.
    function land(blk) {
      blk.classList.add("in");
      const out = blk.closest(".out");
      if ([...out.querySelectorAll(".blk")].every((b) => b.classList.contains("in"))) {
        timers.push(setTimeout(() => out.classList.add("done"), reduced() ? 0 : 450));
      }
    }

    function run() {
      reset();
      if (reduced()) return blocks.forEach(land);
      // With a preview on screen, give the reader ~1 s with it before blog.css starts.
      const preview = getComputedStyle(fig.querySelector(".mini")).display !== "none";
      [400, 2100, preview ? 6000 : 4300].forEach((t, i) => timers.push(setTimeout(() => fly(order[i]), t)));
    }

    $("#buildReplay").addEventListener("click", run);
    new IntersectionObserver((entries, io) => {
      if (entries[0].isIntersecting) { io.disconnect(); run(); }
    }, { threshold: 0.5 }).observe(fig);
  })();

  /* ------------------------------------------------------------------ *
   * Fig. 3: the stage
   * ------------------------------------------------------------------ */
  const stage = $("#stage");
  const site = $("#site");
  const browser = $("#browser");
  const cursor = $("#cursor");

  const HEADER = [["position", "sticky"], ["background", "white"]];
  const OVER = [["position", "absolute"], ["background", "transparent"], ["color", "white"]];
  const LOOK = {
    home: { pos: "over", bg: "clear", fg: "light" },
    blog: { pos: "bar", bg: "white", fg: "dark" },
  };

  const rule = (id, sel, file, line, decls, { struck = false, enter = "fade" } = {}) => ({
    id, sel, file, line, enter,
    decls: decls.map(([p, v]) => ({ p, v, struck, hit: false, keep: false })),
  });
  const homeRules = () => [
    rule("hoh", ".header-over-hero", "home.css", 7, OVER),
    rule("hh", ".header", "home.css", 2, HEADER, { struck: true }),
  ];
  const blogHeader = () => rule("bh", ".header", "blog.css", 2, HEADER, { enter: "slide" });

  const initial = () => ({
    url: "/",
    page: "home",
    cls: "header header-over-hero",
    look: { ...LOOK.home },
    links: [{ f: "home" }],
    rules: homeRules(),
    cursor: "rest",
    click: 0,
    loading: false,
    broken: false,
  });

  const strike = (s, prop) => {
    s.rules.find((r) => r.id === "hoh").decls.find((d) => d.p === prop).struck = true;
  };
  const F = (f) => `<span class="f ${f}">${f}.css</span>`;
  const C = (t) => `<code>${t}</code>`;

  // Each step: a caption and frames of [delay in ms, mutation].
  const steps = [
    {
      cap: `Open Home`,
      frames: [],
    },
    {
      cap: `Click Blog → ${F("blog")} added`,
      frames: [
        [200, (s) => { s.cursor = "nav-blog"; }],
        [950, (s) => { s.click++; }],
        [200, (s) => {
          Object.assign(s, { url: "/blog", page: "blog", cls: "header", look: { ...LOOK.blog } });
          s.links.forEach((l) => (l.fresh = l.flag = false));
          s.links.push({ f: "blog", fresh: true });
          s.rules = [blogHeader(), { ...rule("hoh", ".header-over-hero", "home.css", 7, OVER), dim: true }, rule("hh", ".header", "home.css", 2, HEADER, { struck: true })];
        }],
      ],
    },
    {
      cap: `Back home → ${F("blog")} wins against ${F("home")}`,
      frames: [
        [200, (s) => { s.cursor = "logo"; }],
        [950, (s) => { s.click++; }],
        [200, (s) => {
          Object.assign(s, { url: "/", page: "home", cls: "header header-over-hero", look: { ...LOOK.home } });
          s.links.forEach((l) => (l.fresh = l.flag = false));
          s.rules.find((r) => r.id === "hoh").dim = false;
        }],
        [650, (s) => {
          s.links.find((l) => l.f === "blog").flag = true;
          s.rules.find((r) => r.id === "bh").pulse = true;
        }],
        [900, (s) => { s.rules.find((r) => r.id === "hoh").decls.forEach((d) => (d.hit = d.p !== "color")); }],
        [700, (s) => { strike(s, "position"); s.look.pos = "bar"; s.broken = true; }],
        [650, (s) => { strike(s, "background"); s.look.bg = "white"; }],
        [750, (s) => { s.rules.find((r) => r.id === "hoh").decls.find((d) => d.p === "color").keep = true; }],
      ],
    },
  ];
  const LAST = steps.length - 1;

  /* ---------- rendering ---------- */
  let lastClick = 0;

  function render(s, instant) {
    if (instant) stage.classList.add("instant");
    $("#path").textContent = s.url;
    Object.assign(site.dataset, { page: s.page, ...s.look });
    browser.classList.toggle("loading", s.loading);
    browser.classList.toggle("is-broken", s.broken);
    $("#hdrClass").textContent = s.cls;
    renderLinks(s.links, instant);
    renderRules(s.rules, instant);
    placeCursor(s.cursor);
    if (!instant && s.click !== lastClick) clickFx(s.cursor);
    lastClick = s.click;
    if (instant) nextFrame(() => stage.classList.remove("instant"));
  }

  function renderLinks(links, instant) {
    const box = $("#links");
    const old = new Map([...box.children].map((e) => [e.dataset.f, e]));
    const keep = new Set(links.map((l) => l.f));
    old.forEach((e, f) => { if (!keep.has(f)) e.remove(); });
    links.forEach((l) => {
      let e = old.get(l.f);
      if (!e) {
        e = document.createElement("div");
        e.className = "ln i1 link";
        e.dataset.f = l.f;
        e.innerHTML =
          `<span class="tg">&lt;link</span><span class="rel"> <span class="at">rel</span>=<span class="av">"stylesheet"</span></span> ` +
          `<span class="at">href</span>=<span class="av">"${l.f}.css"</span><span class="tg">&gt;</span>` +
          `<i class="tok ${l.f}"></i><em class="tag"></em>`;
        box.appendChild(e);
        if (!instant) { e.classList.add("pre"); nextFrame(() => e.classList.remove("pre")); }
      }
      e.classList.toggle("fresh", !!l.fresh);
      e.classList.toggle("flag", !!l.flag);
      $(".tag", e).textContent = l.flag ? "still loaded" : l.fresh ? "added" : "";
    });
  }

  function buildRule(r) {
    const e = document.createElement("div");
    e.className = "rule";
    e.dataset.id = r.id;
    const decls = r.decls
      .map((d, i) => `<div class="decl" style="--i:${i}"><span class="dtext"><span class="pn">${d.p}</span>: <span class="pv">${d.v}</span>;</span></div>`)
      .join("");
    e.innerHTML =
      `<div class="rule-in"><div class="rule-body">` +
      `<div class="rh"><span><span class="sel">${r.sel}</span> {</span>` +
      `<span class="src"><i class="tok ${r.file.split(".")[0]}"></i>${r.file}:${r.line}</span></div>` +
      `${decls}<div>}</div></div></div>`;
    return e;
  }

  function renderRules(rules, instant) {
    const list = $("#ruleList");
    const old = new Map([...list.children].map((e) => [e.dataset.id, e]));
    const keep = new Set(rules.map((r) => r.id));
    old.forEach((e, id) => { if (!keep.has(id)) e.remove(); });
    const entering = [];
    rules.forEach((r, i) => {
      let e = old.get(r.id);
      if (!e) {
        e = buildRule(r);
        if (!instant) { e.classList.add(r.enter === "slide" ? "pre-slide" : "pre-fade"); entering.push(e); }
      }
      if (list.children[i] !== e) list.insertBefore(e, list.children[i] || null);
      e.classList.toggle("dim", !!r.dim);
      e.classList.toggle("pulse", !!r.pulse);
      e.querySelectorAll(".decl").forEach((de, j) => {
        de.classList.toggle("struck", r.decls[j].struck);
        de.classList.toggle("hit", r.decls[j].hit);
        de.classList.toggle("keep", r.decls[j].keep);
      });
    });
    if (entering.length) nextFrame(() => entering.forEach((e) => {
      if (e.classList.contains("pre-slide")) e.classList.add("landed");
      e.classList.remove("pre-slide", "pre-fade");
    }));
  }

  function targetEl(t) { return browser.querySelector(`[data-target="${t}"]`); }

  function placeCursor(t) {
    const b = browser.getBoundingClientRect();
    let x = b.width * 0.72, y = b.height * 0.74;
    const el = t !== "rest" && targetEl(t);
    if (el) {
      const r = el.getBoundingClientRect();
      x = r.left - b.left + r.width * 0.55;
      y = r.top - b.top + r.height * 0.62;
    }
    cursor.style.transform = `translate(${x - 4}px, ${y - 2}px)`;
  }

  function clickFx(t) {
    cursor.classList.remove("click");
    void cursor.offsetWidth;
    cursor.classList.add("click");
    setTimeout(() => cursor.classList.remove("click"), 500);
    const el = targetEl(t);
    if (el) { el.classList.add("pressed"); setTimeout(() => el.classList.remove("pressed"), 260); }
  }

  /* ---------- playback ---------- */
  let S = initial();
  let step = 0;          // step currently shown
  let frame = 0;         // next frame to run within `step`
  let timer = 0;
  let playing = false;
  const HOLD = 2600;     // pause between steps while playing

  const midStep = () => frame < steps[step].frames.length;

  function stateAt(k) {
    const s = initial();
    for (let i = 1; i <= k; i++) steps[i].frames.forEach(([, fn]) => fn(s));
    return s;
  }

  function jump(k) {
    clearTimeout(timer);
    step = Math.max(0, Math.min(LAST, k));
    S = stateAt(step);
    frame = steps[step].frames.length;
    render(S, true);
    ui();
  }

  function runFrames() {
    clearTimeout(timer);
    const fr = steps[step].frames;
    if (frame >= fr.length) {
      ui();
      if (playing) {
        if (step < LAST) timer = setTimeout(() => startStep(step + 1), HOLD);
        else { playing = false; ui(); }
      }
      return;
    }
    const [delay, fn] = fr[frame];
    timer = setTimeout(() => {
      fn(S);
      frame++;
      render(S, false);
      runFrames();
    }, delay);
  }

  function startStep(k) {
    step = k;
    frame = 0;
    ui();
    runFrames();
  }

  function play() {
    if (step === LAST && !midStep()) { jump(0); playing = true; ui(); timer = setTimeout(() => startStep(1), 900); return; }
    playing = true;
    ui();
    if (midStep()) runFrames();
    else startStep(step + 1);
  }
  function pause() { playing = false; clearTimeout(timer); ui(); }

  function next() {
    pause();
    if (midStep()) jump(step);
    else if (step < LAST) startStep(step + 1);
  }
  function prev() {
    pause();
    jump(step - 1);
  }

  /* ---------- controls ---------- */
  const playBtn = $("#play");
  const dots = $("#dots");
  dots.innerHTML = steps.map((_, i) => `<button type="button" aria-label="Step ${i + 1}"></button>`).join("");
  [...dots.children].forEach((b, i) => b.addEventListener("click", () => { pause(); jump(i); }));

  function ui() {
    const end = step === LAST && !midStep();
    playBtn.classList.toggle("is-playing", playing);
    playBtn.classList.toggle("is-end", end && !playing);
    playBtn.setAttribute("aria-label", playing ? "Pause" : end ? "Replay" : "Play");
    $("#prev").disabled = step === 0 && !midStep();
    $("#next").disabled = end;
    [...dots.children].forEach((b, i) => {
      b.classList.toggle("on", i === step);
      b.classList.toggle("done", i < step);
    });
    $("#caption").innerHTML = `<span class="stepn">${step + 1}/${steps.length}</span>${steps[step].cap}`;
  }

  playBtn.addEventListener("click", () => (playing ? pause() : play()));
  $("#next").addEventListener("click", next);
  $("#prev").addEventListener("click", prev);

  let inView = false;
  let started = false;
  new IntersectionObserver((entries) => {
    inView = entries[0].isIntersecting;
    if (inView && !started) {
      started = true;
      if (!reduced()) timer = setTimeout(play, 700);
    }
  }, { threshold: 0.45 }).observe(stage);

  document.addEventListener("keydown", (e) => {
    if (!inView || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "ArrowRight") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    else if (e.key === " " && e.target.tagName !== "BUTTON") { e.preventDefault(); playing ? pause() : play(); }
  });

  addEventListener("resize", () => {
    cursor.style.transition = "none";
    placeCursor(S.cursor);
    nextFrame(() => (cursor.style.transition = ""));
  });

  // ?step=N opens the stage at a given step (for slides and screenshots)
  const q = new URLSearchParams(location.search).get("step");
  if (q !== null) { started = true; jump(+q - 1); }
  else jump(0);

  document.fonts?.ready.then(() => placeCursor(S.cursor));

  /* ------------------------------------------------------------------ *
   * Section 04: why this is hard to fix
   * ------------------------------------------------------------------ */
  (function hard() {
    // Fig. 4: an event log that lights up the code each event runs
    const fig4 = $("#whyImport");
    const log = $("#lifeLog");
    const lines = (l) => fig4.querySelectorAll(`.cl[data-l="${l}"]`);
    const events = [
      { r: "/", t: `import Home.tsx → ${F("home")} added`, run: "import" },
      { r: "/", t: "render &lt;Home /&gt;", run: "render" },
      { r: "/blog", t: `unmount &lt;Home /&gt; → <b>nothing runs</b> for ${F("home")}`, miss: true },
      { r: "/", t: "render &lt;Home /&gt; · import already done", run: "render" },
    ];
    let lifeTimers = [];
    function lifeReset() {
      lifeTimers.forEach(clearTimeout);
      lifeTimers = [];
      log.innerHTML = "";
      fig4.querySelectorAll(".cl").forEach((c) => c.classList.remove("hot", "miss"));
      $("#runsImport").textContent = "runs 0×";
      $("#runsRender").textContent = "runs 0×";
    }
    // The log line appears first; the code lights up a moment later.
    function lifeEvent(e, counts, animate) {
      log.insertAdjacentHTML("beforeend", `<li class="${e.miss ? "bad" : ""}"><span class="lr">${e.r}</span><span>${e.t}</span></li>`);
      fig4.querySelectorAll(".cl").forEach((c) => c.classList.remove("hot", "miss"));
      if (animate) lifeTimers.push(setTimeout(() => lifeCode(e, counts, true), 900));
      else lifeCode(e, counts, false);
    }
    function lifeCode(e, counts, animate) {
      if (e.run) {
        counts[e.run]++;
        const badge = $(e.run === "import" ? "#runsImport" : "#runsRender");
        badge.textContent = `runs ${counts[e.run]}×`;
        if (animate) { badge.classList.remove("bump"); void badge.offsetWidth; badge.classList.add("bump"); }
        lines(e.run).forEach((c) => c.classList.add("hot"));
      }
      if (e.miss) lines("import").forEach((c) => c.classList.add("miss"));
    }
    function lifeRun() {
      lifeReset();
      const counts = { import: 0, render: 0 };
      if (reduced()) { events.forEach((e) => lifeEvent(e, counts, false)); return; }
      // The unmount line is the one to think about, so it gets the longest pause.
      const at = [2500, 5700, 8900, 15000];
      events.forEach((e, i) => lifeTimers.push(setTimeout(() => lifeEvent(e, counts, true), at[i])));
      lifeTimers.push(setTimeout(() => fig4.querySelectorAll(".cl").forEach((c) => c.classList.remove("hot")), 18500));
    }
    $("#importReplay").addEventListener("click", lifeRun);
    new IntersectionObserver((entries, io) => {
      if (entries[0].isIntersecting) { io.disconnect(); lifeRun(); }
    }, { threshold: 0.6 }).observe(fig4);

    // Fig. 5: swap the two <link> tags
    const links = $("#ordLinks");
    const pv = $("#pv");
    let order = ["home", "blog"];
    function renderOrder(animate) {
      const els = order.map((f) => links.querySelector(`[data-f="${f}"]`));
      const before = els.map((e) => e.getBoundingClientRect().top);
      els.forEach((e) => links.appendChild(e));
      if (animate && !reduced()) {
        els.forEach((e, i) => {
          const d = before[i] - e.getBoundingClientRect().top;
          e.animate([{ transform: `translateY(${d}px)` }, { transform: "none" }], { duration: 450, easing: "cubic-bezier(.2, .8, .2, 1)" });
        });
      }
      const last = order[order.length - 1];
      els.forEach((e) => e.classList.toggle("last", e.dataset.f === last));
      // the source files in cascade order, as the browser sees them
      const inside = { home: ["header", "hero"], blog: ["header"] };
      const seq = order.flatMap((f) => inside[f]);
      $("#seq").innerHTML = seq
        .map((x, i) => `<span class="seq-c ${x === "header" ? "shared" : "own"}${i === seq.length - 1 ? " win" : ""}">${x}.css</span>`)
        .join(`<span class="sep">→</span>`);
      pv.classList.toggle("broken", last === "blog");
      $("#ordWin").innerHTML = last === "blog"
        ? `${F("blog")} loads last, so its ${C(".header")} wins`
        : `${F("home")} loads last, so ${C(".header-over-hero")} wins`;
    }
    renderOrder(false);
    $("#swap").addEventListener("click", () => { order.reverse(); renderOrder(true); });

    // @layer dialog
    const dlg = $("#layerDialog");
    $("#layerOpen").addEventListener("click", () => dlg.showModal());
    $("#layerClose").addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

    // Fig. 6: priority = 1 + highest priority among the files it imports
    const graph = { "Header.tsx": [], "Home.tsx": ["Header.tsx"], "Sidebar.tsx": ["Header.tsx"], "Blog.tsx": ["Sidebar.tsx"] };
    const kind = { "Header.tsx": "comp", "Home.tsx": "pg-home", "Blog.tsx": "pg-blog" };
    const body = $("#rankBody");
    let prev = null;
    const chip = (m) => `<span class="chip ${kind[m] || ""}">${m}</span>`;
    function ranks() {
      const memo = {};
      const r = (m) => (memo[m] ??= 1 + Math.max(0, ...graph[m].map(r)));
      Object.keys(graph).forEach(r);
      return memo;
    }
    function renderRank() {
      const r = ranks();
      const rows = Object.keys(graph).sort((a, b) => r[a] - r[b] || a.localeCompare(b));
      body.innerHTML = rows.map((m) => {
        const cls = !prev ? "" : !(m in prev) ? "new" : prev[m] !== r[m] ? "changed" : "";
        const imports = graph[m].length ? graph[m].map(chip).join(" ") : `<span class="none">nothing</span>`;
        return `<tr class="${cls}"><td>${chip(m)}</td><td>${imports}</td><td class="prio"><span>${r[m]}</span></td></tr>`;
      }).join("");
      prev = r;
    }
    renderRank();
    const add = $("#addImport");
    add.addEventListener("click", () => {
      const on = !graph["Logo.tsx"];
      if (on) { graph["Logo.tsx"] = []; graph["Header.tsx"] = ["Logo.tsx"]; }
      else { delete graph["Logo.tsx"]; graph["Header.tsx"] = []; }
      add.textContent = on ? "− Remove that import" : "+ Header.tsx imports Logo.tsx";
      renderRank();
    });
  })();
})();
