/* ==========================================================================
   CommBank homepage clone — behaviour (vanilla JS, no dependencies)
   Modules: nav drawer · mega menus · search · log-on drawer · cookies
            · back-to-top · scroll reveals · demo form
   ========================================================================== */
(function () {
  "use strict";

  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var MOBILE = window.matchMedia("(max-width: 860px)");
  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");
  var body = document.body;
  var header = $("[data-header]");
  var backdrop = $("[data-backdrop]");
  var openPanel = null;   // currently open mega / search panel
  var hoverOk = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------------------------------------------------------------- utils */
  function lock(lock_it) {
    body.classList.toggle("is-locked", !!lock_it);
  }

  /* tiny toast, used for placeholder links so clicks are never silent dead ends */
  var toastTimer = null;
  function toast(message) {
    var el = $("#clone-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "clone-toast";
      el.className = "toast";
      el.setAttribute("role", "status");
      body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("is-on");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { el.classList.remove("is-on"); }, 3200);
  }

  function showBackdrop(on) {
    if (!backdrop) { return; }
    if (on) {
      backdrop.hidden = false;
      requestAnimationFrame(function () { backdrop.classList.add("is-open"); });
    } else {
      backdrop.classList.remove("is-open");
      window.setTimeout(function () { if (!backdrop.classList.contains("is-open")) { backdrop.hidden = true; } }, REDUCED.matches ? 0 : 280);
    }
  }

  function trapKeys(container, onEscape) {
    container.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { onEscape(); return; }
      if (e.key !== "Tab") { return; }
      var focusables = $$('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', container)
        .filter(function (el) { return el.offsetParent !== null; });
      if (!focusables.length) { return; }
      var first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* --------------------------------------------------- 1. mobile nav drawer */
  var nav = $("#primary-nav");
  var navToggle = $("[data-nav-toggle]");

  function setNav(open) {
    if (!nav || !navToggle) { return; }
    nav.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    var use = $(".ico use", navToggle);
    if (use) { use.setAttribute("href", open ? "#i-close" : "#i-menu"); }
    var lbl = $(".visually-hidden", navToggle);
    if (lbl) { lbl.textContent = open ? "Close menu" : "Menu"; }
    lock(open && MOBILE.matches);
  }

  if (navToggle) {
    navToggle.addEventListener("click", function () { setNav(!nav.classList.contains("is-open")); });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav && nav.classList.contains("is-open") && MOBILE.matches) {
      setNav(false);
      navToggle.focus();
    }
  });
  nav && nav.addEventListener("click", function (e) {
    if (e.target.closest("a")) { setNav(false); }
  });

  /* ------------------------------------------------------ 2. mega menu panels */
  var megaTriggers = $$("[data-mega]");
  var closeTimer = null;
  var openedAt = new WeakMap();   // panel -> timestamp, guards the click/focusout race

  function closePanelNow(panel, btn) {
    if (!panel) { return; }
    panel.classList.remove("is-open");
    // let the fade-out finish before pulling it out of the a11y tree
    window.setTimeout(function () {
      if (!panel.classList.contains("is-open")) { panel.hidden = true; }
    }, REDUCED.matches ? 0 : 200);
    if (btn) { btn.setAttribute("aria-expanded", "false"); }
    var li = btn && btn.closest("li");
    if (li) { li.classList.remove("is-active"); }
    if (openPanel === panel) { openPanel = null; }
  }

  function megaCloseAll() {
    $$("[data-mega-panel]").forEach(function (p) {
      var btn = $('[data-mega="' + p.id + '"]');
      if (p.classList.contains("is-open")) { closePanelNow(p, btn); }
      else {
        p.classList.remove("is-open");
        if (btn) { btn.setAttribute("aria-expanded", "false"); }
        var li2 = btn && btn.closest("li");
        if (li2) { li2.classList.remove("is-active"); }
      }
    });
    openPanel = null;
  }

  /* open (or switch to) a panel; `keepOpen` = don't toggle shut when it is already showing */
  function megaOpen(btn, keepOpen) {
    var panel = document.getElementById(btn.getAttribute("data-mega"));
    if (!panel) { return; }
    closeSearch();
    var already = panel.classList.contains("is-open");
    if (already && keepOpen) { return; }
    if (openPanel && openPanel !== panel) {
      megaCloseAll();
    } else if (already) {
      closePanelNow(panel, btn);
      return;
    } else {
      megaCloseAll();
    }
    panel.hidden = false;
    openedAt.set(panel, Date.now());
    panel.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
    var li = btn.closest("li");
    if (li) { li.classList.add("is-active"); }
    openPanel = panel;
  }

  megaTriggers.forEach(function (btn) {
    var panel = document.getElementById(btn.getAttribute("data-mega"));
    if (!panel) { return; }
    var li = btn.closest("li");
    var wasOpen = false;

    btn.addEventListener("pointerdown", function () { wasOpen = panel.classList.contains("is-open"); });

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      // Keyboard/pointer devices that hover already opened the menu: a click there
      // must NOT toggle it shut (that reads as a flicker). Tap devices and coarse
      // pointers get the usual open/close toggle.
      if (wasOpen && hoverOk && !MOBILE.matches && e.pointerType !== undefined) { megaOpen(btn, true); return; }
      if (wasOpen) { megaCloseAll(); return; }
      megaOpen(btn, hoverOk && !MOBILE.matches);
      if (!MOBILE.matches) {
        var first = panel.querySelector("a");
        if (first) { first.focus({ preventScroll: true }); }
      }
    });

    if (hoverOk) {
      li.addEventListener("mouseenter", function () {
        if (MOBILE.matches) { return; }
        window.clearTimeout(closeTimer);
        megaOpen(btn, true);
      });
      li.addEventListener("mouseleave", function () {
        if (MOBILE.matches) { return; }
        closeTimer = window.setTimeout(function () {
          var stillInside = panel.matches(":hover") || li.contains(document.activeElement) || panel.contains(document.activeElement);
          if (stillInside) { return; }
          closePanelNow(panel, btn);
        }, 140);
      });
      panel.addEventListener("mouseenter", function () { window.clearTimeout(closeTimer); });
    }

    // Tabbing/clicking out of the panel closes it — but never in the same tick it was opened
    panel.addEventListener("focusout", function () {
      if (MOBILE.matches) { return; }
      window.setTimeout(function () {
        if (Date.now() - (openedAt.get(panel) || 0) < 300) { return; }
        var stillInside = panel.contains(document.activeElement) || li.contains(document.activeElement);
        if (!stillInside) { closePanelNow(panel, btn); }
      }, 0);
    });
  });

  document.addEventListener("click", function (e) {
    if (!openPanel) { return; }
    if (openPanel.contains(e.target) || e.target.closest("[data-mega]")) { return; }
    megaCloseAll();
  });

  /* ------------------------------------------------------------- 3. search */
  var searchPanel = $("[data-search]");
  var searchToggle = $("[data-search-toggle]");
  var searchForm = $("[data-search-form]");

  function openSearch() {
    if (!searchPanel) { return; }
    megaCloseAll();
    searchPanel.hidden = false;
    openPanel = searchPanel;
    var input = $("input", searchPanel);
    if (input) { input.focus({ preventScroll: true }); }
  }
  function closeSearch() {
    if (searchPanel && !searchPanel.hidden) {
      searchPanel.hidden = true;
      if (openPanel === searchPanel) { openPanel = null; }
    }
  }
  if (searchToggle) {
    searchToggle.addEventListener("click", function () {
      searchToggle.setAttribute("aria-expanded", String(searchPanel.hidden));
      if (searchPanel.hidden) { openSearch(); } else { closeSearch(); }
    });
  }
  if (searchForm) {
    searchForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = ($("input", searchForm).value || "").trim();
      var msg = $("[data-search-hint]", searchPanel);
      if (!q) {
        if (msg) { msg.textContent = "Popular searches"; }
        $("input", searchForm).focus();
        return;
      }
      if (msg) {
        msg.textContent = 'Showing results for “' + q + '” — this clone has no search backend, so the list is a placeholder.';
        msg.classList.add("search__msg");
      }
    });
    $$("[data-search-chips] .chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        $("input", searchForm).value = chip.textContent.trim();
        $("input", searchForm).focus();
      });
    });
  }

  /* ------------------------------------------------- 4. log-on drawer (modal) */
  var drawer = $("#logon-drawer");
  var lastFocus = null;

  function openDrawer(btn) {
    if (!drawer) { return; }
    megaCloseAll();
    closeSearch();
    lastFocus = btn || document.activeElement;
    drawer.hidden = false;
    requestAnimationFrame(function () { drawer.classList.add("is-open"); });
    showBackdrop(true);
    lock(true);
    var target = $("[data-drawer-close]", drawer);
    if (target) { window.setTimeout(function () { target.focus({ preventScroll: true }); }, REDUCED.matches ? 0 : 260); }
  }

  function closeDrawer() {
    if (!drawer || drawer.hidden) { return; }
    drawer.classList.remove("is-open");
    showBackdrop(false);
    lock(false);
    window.setTimeout(function () { if (!drawer.classList.contains("is-open")) { drawer.hidden = true; } }, REDUCED.matches ? 0 : 320);
    if (lastFocus && typeof lastFocus.focus === "function") { lastFocus.focus({ preventScroll: true }); }
  }

  $$("[data-drawer]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (btn.getAttribute("aria-expanded") === "true") { closeDrawer(); } else { openDrawer(btn); }
    });
  });
  if (drawer) {
    $("[data-drawer-close]", drawer).addEventListener("click", closeDrawer);
    trapKeys(drawer, closeDrawer);
  }
  if (backdrop) { backdrop.addEventListener("click", closeDrawer); }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && openPanel) { megaCloseAll(); closeSearch(); } });

  /* --------------------------------------------------------- 5. cookie notice */
  var STORE_KEY = "clone-cookie-consent";
  function store(key, value) {
    try { localStorage.setItem(key, value); } catch (err) { /* private mode — ignore */ }
  }
  function read(key) {
    try { return localStorage.getItem(key); } catch (err) { return null; }
  }

  function dismissCookies(animate) {
    var box = $("#cookies");
    if (!box) { return; }
    if (animate && !REDUCED.matches) {
      box.style.transition = "opacity .35s ease, transform .35s ease";
      box.style.opacity = "0";
      box.style.transform = "translateY(-12px)";
      window.setTimeout(function () { box.hidden = true; }, 360);
    } else {
      box.hidden = true;
    }
  }

  $$("[data-cookie-dismiss]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      dismissCookies(true);
      store(STORE_KEY, Date.now());
      var focus = $("#main");
      if (focus) { focus.setAttribute("tabindex", "-1"); focus.focus({ preventScroll: true }); }
    });
  });

  $$("[data-scroll]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var t = $(btn.getAttribute("data-scroll"));
      if (!t) { return; }
      var top = t.getBoundingClientRect().top + window.pageYOffset - (header ? header.offsetHeight + 8 : 0);
      window.scrollTo({ top: top, behavior: REDUCED.matches ? "auto" : "smooth" });
    });
  });

  /* --------------------------------------------------- 6. back-to-top button */
  var toTop = $("[data-to-top]");
  if (toTop) {
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: REDUCED.matches ? "auto" : "smooth" });
      var brand = $(".brand");
      if (brand) { window.setTimeout(function () { brand.focus({ preventScroll: true }); }, REDUCED.matches ? 0 : 400); }
    });
  }

  var ticking = false;
  function onScroll() {
    if (ticking) { return; }
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.pageYOffset;
      var doc = document.documentElement;
      if (header) { header.classList.toggle("is-scrolled", y > 8); }
      if (toTop) {
        var nearBottom = y + window.innerHeight >= doc.scrollHeight - 120;
        toTop.classList.toggle("is-hidden", y < 240 || nearBottom);
      }
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* -------------------------------------------------- 7. reveal on scroll */
  (function reveals() {
    var targets = $$(".card, .hero__media, .hero__copy, .cookies__box, .disclaimer__body, .mega-col");
    function show(el) { el.classList.remove("reveal"); el.classList.add("revealed"); el.style.transitionDelay = ""; }

    if (REDUCED.matches || !("IntersectionObserver" in window)) { targets.forEach(show); return; }

    // anything already on screen at load is never hidden — otherwise a slow observer
    // (or a full-page screenshot tool) would leave the hero and cards blank
    var pending = targets.filter(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.92 && r.bottom > 0) { show(el); return false; }
      return true;
    });
    pending.forEach(function (el, i) {
      el.classList.add("reveal");
      el.style.transitionDelay = (i % 4) * 70 + "ms";
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("is-in"); io.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    pending.forEach(function (el) { io.observe(el); });

    // safety net: nothing stays invisible because of an observer that never fired
    window.setTimeout(function () {
      pending.forEach(function (el) {
        if (!el.classList.contains("is-in")) { show(el); }
      });
    }, 1600);
  }());

  /* --------------------------------------------------- 8. demo log-on form */
  var demoForm = $("[data-demo-form]");
  if (demoForm) {
    demoForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var user = $("#user", demoForm);
      var pass = $("#pass", demoForm);
      var status = $("[data-demo-status]", demoForm.parentElement);
      if (!user.value.trim()) {
        status.textContent = "Enter a User ID to see the validation step.";
        user.focus();
        return;
      }
      if (pass.value.length < 6) {
        status.textContent = "Password needs at least 6 characters (demo rule only).";
        pass.focus();
        return;
      }
      status.textContent = "Nice — that is how the real form would hand off to authentication. Nothing was sent anywhere; the clone has no backend.";
      pass.value = "";
    });
  }

  /* ------------------------------------------------- 9. keep sticky offset right */
  // anchors should land below the sticky header rather than under it
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) { return; }
    var id = a.getAttribute("href");
    if (!id) { return; }
    if (id === "#") { e.preventDefault(); return; }
    var t = null;
    try { t = document.querySelector(id); } catch (err) { return; }
    if (!t) {
      // not built yet in this clone — say so instead of silently doing nothing
      if (a.closest("[data-mega]")) { return; }
      e.preventDefault();
      toast('“' + (a.textContent || id).trim() + '” is a placeholder link — only the homepage layout was cloned.');
      return;
    }
    e.preventDefault();
    var top = t.getBoundingClientRect().top + window.pageYOffset - (header ? header.offsetHeight + 6 : 0);
    window.scrollTo({ top: Math.max(top, 0), behavior: REDUCED.matches ? "auto" : "smooth" });
    if (!t.hasAttribute("tabindex")) { t.setAttribute("tabindex", "-1"); }
    window.setTimeout(function () { t.focus({ preventScroll: true }); }, REDUCED.matches ? 0 : 420);
    if (history.replaceState) { history.replaceState(null, "", id); }
  });

  // reset desktop/mobile differences when the viewport crosses the breakpoint
  var onBreak = function () {
    if (!MOBILE.matches) { setNav(false); megaCloseAll(); }
  };
  if (MOBILE.addEventListener) { MOBILE.addEventListener("change", onBreak); }
  else if (MOBILE.addListener) { MOBILE.addListener(onBreak); }

  // expose for quick console poking while developing
  window.__clone = { megaCloseAll: megaCloseAll, openDrawer: openDrawer, closeDrawer: closeDrawer, dismissCookies: dismissCookies };

  /* 10. mobile: move a mega panel into its own nav item so it reads as an
          accordion, then move it back to the header when we hit desktop.     */
  (function reparentPanels() {
    var host = header;
    if (!host || !nav) { return; }
    var originals = megaTriggers.map(function (btn) {
      var panel = document.getElementById(btn.getAttribute("data-mega"));
      return panel ? { panel: panel, li: btn.closest("li"), index: Array.prototype.indexOf.call(host.children, panel) } : null;
    }).filter(Boolean);

    function apply() {
      originals.forEach(function (item) {
        if (MOBILE.matches) {
          if (item.panel.parentElement !== item.li) { item.li.appendChild(item.panel); }
        } else if (item.panel.parentElement !== host) {
          host.insertBefore(item.panel, host.children[item.index] || null);
        }
      });
    }

    apply();
    if (MOBILE.addEventListener) { MOBILE.addEventListener("change", apply); }
    else if (MOBILE.addListener) { MOBILE.addListener(apply); }
    window.addEventListener("resize", apply, { passive: true });
  }());
}());
