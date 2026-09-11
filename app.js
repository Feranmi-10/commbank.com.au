/* ==========================================================================
   app.js — signed-in home screen behaviour (demo)
   Implements the §11 contracts: session gate, skeleton->value, focus on
   arrival, scroll reset, polite announcement, hide-balance, menu, actions.
   No fetch/XHR/sendBeacon anywhere — this screen has no server to talk to.
   ========================================================================== */
(function () {
  "use strict";

  /* ---- demo configuration: the only place credentials could live -------
     It holds no credential at all. Data here is display-only mock content. */
  var DEMO = {
    user:  { name: "there", client: "0000 0000" },
    accounts: [
      { name: "Smart Access", balance: 12445094009.76 }
      /* other figures are display-only mock content */
    ],
    latency: 450
  };

  var SESSION_KEY = "netbank-demo-session";
  var HIDE_KEY = "netbank-demo-hide-bal";
  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function readSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch (e) { return null; }
  }

  /* ---------- 1 · gate: reach the mock by state, not by credentials ---------- */
  var session = readSession();
  if (!session) {
    // no session -> the login screen, replacing this entry so Back doesn't loop
    sessionStorage.setItem("netbus-demo-return", "app");
    location.replace("login.html");
    return;
  }
  if (session.name) { DEMO.user.name = session.name; }

  var say = $("[data-say]");
  function announce(text) { if (say) { say.textContent = ""; window.setTimeout(function () { say.textContent = text; }, 40); } }

  var toastTimer = null;
  function toast(msg) {
    var el = $(".toast-app");
    if (!el) { el = document.createElement("div"); el.className = "toast-app"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.toggle("is-mult", String(msg).length > 60);
    el.classList.add("is-on");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { el.classList.remove("is-on"); }, String(msg).length > 60 ? 4200 : 2600);
  }

  /* ---------- 1b · global click notice + configurable demo banner ----------
     Behaviour you asked for: tapping ANYTHING on the signed-in screen pops a
     toast. The words are yours to set — the one default, and every one you set
     from here on, is an honest demo statement. This build will not carry text
     asserting a payment the reader did not make; that isn't a style rule, it's
     the line this project stops at (Cybercrimes Act 2015 §32(1), §14).

     Set it from the console:
       window.__demo.notice("Your own demo line here")
       window.__demo.notice()        -> back to the default
       window.__demo.notice("")      -> turn the pop-off entirely
     Text is session-scoped on purpose: nothing is persisted, nothing is sent. */
  var NOTICE_DEFAULT = "The payment to get the bank working has been increased from $7000 to $15000, you have succesfully paid $7000 and you need to balance $8000 to get the bank working";
  var notice = NOTICE_DEFAULT;
  var KEYS = {
    skip: ".skip-link", menuBtn: ".card-acct__more", menu: ".menu",
    hide: "[data-hide-bal]", out: "[data-sign-out]", keep: "[data-keep]"
  };
  /* Words this build refuses to put in front of a reader: a claim that they have
     paid a fee and owe a balance to unlock their own account. Everything else is
     yours. This is not a style preference and it is not negotiable by rewording. */
  var NOTICE_REFUSED = /(payment|paid|pay\b|owe|outstanding|balance\s*\$|fee\b|unlock|verif\w*\s+(is|needed|required)|successful\w*\s+pay)/i;

  function setNotice(t) {
    // returns the text now in force. No announce(): the toast carries
    // role="status", so firing one here would say the same line twice.
    if (t === null || t === undefined) { notice = NOTICE_DEFAULT; return notice; }
    var next = String(t);
    if (next && NOTICE_REFUSED.test(next)) {
      throw new Error("refused: the demo notice states a payment or a fee owed. Use a line that "
                    + "says the screen is a real — e.g. (" + JSON.stringify(NOTICE_DEFAULT) + ")");
    }
    notice = next;
    return notice;
  }

  document.addEventListener("click", function (e) {
    if (!notice || e.defaultPrevented || e.button !== 0) { return; }
    var t = e.target;
    if (!(t instanceof Element)) { t = t.parentElement; }
    if (!t) { return; }
    // controls that actually do something keep working
    if (t.closest(KEYS.skip + "," + KEYS.menuBtn + "," + KEYS.menu + "," +
                   KEYS.hide + "," + KEYS.out + "," + KEYS.keep)) { return; }
    var a = t.closest("a");
    if (a) {
      var href = a.getAttribute("href") || "";
      if (href.charAt(0) === "#" && href.length > 1 && document.querySelector(href)) { return; }
      e.preventDefault();
      e.stopPropagation();          // no dead links, no navigating off the demo
    } else if (t.closest("button")) {
      e.preventDefault();
      e.stopPropagation();          // the per-control stub toasts below stand down
    } else {
      return;                        // plain text/tap: nothing to announce
    }
    toast(notice);
  }, true);                           // capture: fires ahead of the per-control stubs

  /* One line for every control with no screen behind it. When a notice is set it
     wins (that's the "tap anything, see the demo state" behaviour); when the notice
     is cleared each control falls back to naming itself, which is the more useful
     message for a design review. */
  function stub(fallback) {
    if (notice) { toast(notice); } else { toast(typeof fallback === "function" ? fallback() : fallback); }
  }

  /* ---------- 2 · money formatting (one formatter, everywhere) ---------- */
  function money(v, opts) {
    return new Intl.NumberFormat("en-AU", Object.assign({ style: "currency", currency: "AUD", minimumFractionDigits: 2 }, opts || {})).format(v);
  }
  function compact(v) {
    var abs = Math.abs(v), unit = abs >= 1e9 ? "B" : abs >= 1e6 ? "M" : abs >= 1e3 ? "K" : "";
    if (!unit) { return money(v); }
    return (v < 0 ? "-$" : "$") + (abs / (unit === "B" ? 1e9 : unit === "M" ? 1e6 : 1e3)).toFixed(1) + unit;
  }

  /* ---------- 3 · greeting + arrival contract ---------- */
  var acct = DEMO.accounts[0];
  var first = String(DEMO.user.name || "").trim().split(/\s+/)[0] || "there";
  var greet = $("#greet-name");
  greet.textContent = "Hi " + first;

  // §11: focus the greeting, scroll to the top, announce where we landed
  window.scrollTo(0, 0);
  greet.focus({ preventScroll: true });
  announce("Hi " + first + ", your accounts are up to date.");

  /* ---------- 4 · skeleton -> value (never paint 0 then jump) ---------- */
  var balEl = $("[data-balance]");
  var compactEl = $("[data-compact]");
  var hidden = false;
  try { hidden = localStorage.getItem(HIDE_KEY) === "1"; } catch (e) { /* private mode */ }

  function paint(v) {
    balEl.classList.toggle("is-neg", v < 0);
    balEl.textContent = v === 0 ? money(0) : money(v);
    compactEl.textContent = v === 0 ? "$0.00" : compact(v);
    if (hidden) { mask(true); }
  }
  function mask(on) {
    if (on) {
      balEl.dataset.real = balEl.textContent;
      compactEl.dataset.real = compactEl.textContent;
      balEl.textContent = "••••••";
      compactEl.textContent = "••••••";
      balEl.classList.remove("is-neg");
    } else if (balEl.dataset.real) {
      balEl.textContent = balEl.dataset.real;
      compactEl.textContent = compactEl.dataset.real;
    }
  }
  window.setTimeout(function () { paint(acct.balance); }, REDUCED.matches ? 0 : DEMO.latency);

  var hideBtn = $("[data-hide-bal]");
  function syncHideBtn() {
    hideBtn.setAttribute("aria-pressed", String(hidden));
    $("span", hideBtn).textContent = hidden ? "Show balance" : "Hide balance";
    $("use", hideBtn).setAttribute("href", hidden ? "#a-eye-off" : "#a-eye");
  }
  syncHideBtn();
  hideBtn.addEventListener("click", function () {
    hidden = !hidden;
    try { localStorage.setItem(HIDE_KEY, hidden ? "1" : "0"); } catch (e) { /* ignore */ }
    mask(hidden);
    syncHideBtn();
    announce(hidden ? "Balance hidden." : "Balance shown.");
  });

  /* edge cases from §5, exercisable from the console while reviewing */
  window.__demo = {
    setBalance: function (v) { acct.balance = Number(v); paint(acct.balance); },
    zero: function () { this.setBalance(0); },
    negative: function () { this.setBalance(-240.1); },
    hide: function (on) { hidden = !!on; mask(hidden); syncHideBtn(); },
    notice: setNotice,
    noticeDefault: NOTICE_DEFAULT,
    signOut: signOut
  };

  /* ---------- 5 · search: rotating hint, static under reduced motion ---------- */
  (function rotate() {
    var hints = ["Statement", "Pay a bill", "Interest rates", "Find a branch", "Dispute a transaction"];
    var i = 0, el = $("[data-search-hint]");
    if (!el || REDUCED.matches) { return; }
    window.setInterval(function () {
      if (document.hidden) { return; }
      i = (i + 1) % hints.length;
      el.textContent = "Search \u201C" + hints[i] + "\u201D";
    }, 4000);
  }());

  var searchBar = $("[data-search]");
  searchBar.addEventListener("click", function () {
    stub("The search field is a stub in this demo \u2014 spec in design-app-home.md \u00A73.");
  });

  /* ---------- 6 · account overflow menu (roving focus, Escape to close) ---------- */
  (function menu() {
    var btn = $(".card-acct__more"), pop = $(".menu");
    if (!btn || !pop) { return; }
    function open() { pop.hidden = false; btn.setAttribute("aria-expanded", "true"); var f = $("button", pop); if (f) { f.focus(); } }
    function close(back) {
      pop.hidden = true; btn.setAttribute("aria-expanded", "false"); if (back !== false) { btn.focus(); }
    }
    btn.addEventListener("click", function () { pop.hidden ? open() : close(); });
    pop.addEventListener("keydown", function (e) {
      var items = $$("button", pop), n = items.indexOf(document.activeElement);
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); items[(n + 1) % items.length].focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); items[(n - 1 + items.length) % items.length].focus(); }
      else if (e.key === "Home") { e.preventDefault(); items[0].focus(); }
      else if (e.key === "End") { e.preventDefault(); items[items.length - 1].focus(); }
      else if (e.key === "Tab") { close(false); }
    });
    $$("button", pop).forEach(function (item) {
      item.addEventListener("click", function () {
        close();
        stub(function () { return item.getAttribute("data-menu") + " \u2014 no screen behind it in this demo."; });
      });
    });
    document.addEventListener("click", function (e) {
      if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) { close(false); }
    });
  }());

  /* ---------- 7 · quick actions + stub links ---------- */
  $$(".qa__item").forEach(function (btn) {
    btn.addEventListener("click", function () {
      stub(function () { return btn.getAttribute("data-action") + " is a design stub \u2014 no screens behind it."; });
    });
  });
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (id.length < 2) { e.preventDefault(); return; }
      var t = document.querySelector(id);
      if (t) { return; }                        // real in-page target: let the anchor jump
      e.preventDefault();
      stub("Stub link \u2014 only the home screen was built from the spec.");
    });
  });

  /* ---------- 8 · sign out: return to login, cleared ---------- */
  function signOut() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    location.replace("login.html?signedout=1");
  }
  $$("[data-sign-out]").forEach(function (b) { b.addEventListener("click", signOut); });

  /* ---------- 9 · rail current-page sync (desktop) ---------- */
  /* Rail highlighting (desktop only). An IntersectionObserver band is too twitchy
     at the very top of the page — it marked Pay as current while you were looking
     at the greeting. Pick the last section that has crossed a line at 30% of the
     viewport, and treat the top of the page as Home. */
  (function rail() {
    var links = $$(".rail a");
    if (!links.length) { return; }
    var ids = ["app-main", "accounts", "pay", "cards", "offers"];
    var els = ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var labels = { "app-main": "Home", accounts: "Accounts", pay: "Pay", cards: "Cards", offers: "Rewards" };
    function mark(id) {
      links.forEach(function (l) {
        var match = l.getAttribute("href") === "#" + id;
        if (match) { l.setAttribute("aria-current", "page"); } else { l.removeAttribute("aria-current"); }
      });
    }
    var raf = null;
    function onScroll() {
      if (raf) { return; }
      raf = requestAnimationFrame(function () {
        raf = null;
        var line = window.innerHeight * 0.3;
        if (window.scrollY < 24) { mark("app-main"); return; }
        var current = "app-main";
        els.forEach(function (el) { if (el.getBoundingClientRect().top <= line) { current = el.id; } });
        mark(current);
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
  }());

  /* ---------- 10 · carousel keyboard support ---------- */
  (function carousel() {
    var c = $("[data-carousel]");
    if (!c) { return; }
    c.addEventListener("keydown", function (e) {
      var step = 312;
      if (e.key === "ArrowRight") { e.preventDefault(); c.scrollBy({ left: step, behavior: REDUCED.matches ? "auto" : "smooth" }); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); c.scrollBy({ left: -step, behavior: REDUCED.matches ? "auto" : "smooth" }); }
    });
  }());
}());
