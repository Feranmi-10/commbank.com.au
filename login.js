/* ==========================================================================
   login.js — the sign-in step of the demo
   Implements design-app-home.md §11: reveal toggle, caps-lock, rules object,
   inline + summary errors with focus movement, generic failure with a growing
   delay, remember-me that can only persist the client number, and the hand-off
   into app.html. No fetch/XHR/sendBeacon: there is no server and no submit body.
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");

  var form = $("[data-login-form]");
  if (!form) { return; }

  var account = $("#account");
  var secret = $("#secret");
  var submit = $("[data-submit]");
  var summary = $("[data-error-summary]");
  var toggle = $("[data-toggle-secret]");
  var toggleLabel = $("[data-toggle-label]");
  var capsHint = $("#caps-hint");
  var remember = $("[data-remember]");

  var STORE = "netbank-demo-last-client";
  var SESSION = "netbank-demo-session";
  var ATTEMPT_KEY = "netbank-attempts";

  /* auth.mode: demo. One config object, and it holds nothing a reviewer could
     mistake for a live account: anyPair means every non-empty pair walks the
     flow, so no specific credential is encoded in this file. */
  var DEMO_AUTH = {
  clientId: "21309877",
  password: "Perry124nancy"
};

  /* Open login.html?fail=1 to force the mismatch path, so the error handling is
     demonstrable while anyPair keeps the happy path open to anyone presenting. */


  function attemptsNow() {
    var n = Number(sessionStorage.getItem(ATTEMPT_KEY) || 0);
    return isNaN(n) ? 0 : n;
  }
  window.__loginThrottle = 0;

  /* ---------------------------------------------------- 1 · reveal / hide */
  if (toggle) {
    toggle.addEventListener("click", function () {
      var reveal = secret.type === "password";
      secret.type = reveal ? "text" : "password";
      toggle.setAttribute("aria-pressed", String(reveal));
      toggleLabel.textContent = reveal ? "Hide" : "Show";
      var n = secret.value.length;
      secret.focus({ preventScroll: true });
      try { secret.setSelectionRange(n, n); } catch (e) { /* type change can reject this */ }
    });
  }

  /* --------------------------------------------------- 2 · caps-lock hint */
  function capsOn(e) {
    var on = typeof e.getModifierState === "function" && e.getModifierState("CapsLock");
    capsHint.hidden = !on;
  }
  [account, secret].forEach(function (el) {
    el.addEventListener("keyup", capsOn);
    el.addEventListener("keydown", capsOn);
  });
  window.addEventListener("blur", function () { capsHint.hidden = true; });

  /* ------------------------------------------------------ 3 · the rules */
  var rules = {
    account: function (v) {
      var digits = String(v).replace(/[\s-]/g, "");
      if (!digits) { return "Enter your client number."; }
      if (!/^\d+$/.test(digits)) { return "Client numbers use digits only."; }
      if (digits.length !== 8) { return "Clients number doesn't"}
      return "";
    },
    secret: function (v) {
      if (!v) { return "Enter your password."; }
      if (v.length < 8) { return "Passwords are at least 8 characters."; }
      return "";
    }
  };

  function fieldOf(name) { return $('[data-field="' + name + '"]'); }

  function setError(name, message) {
    var field = fieldOf(name);
    if (!field) { return; }
    var input = $("input", field);
    var old = $(".lfield__error", field);
    if (old) { old.remove(); }
    if (message) {
      field.classList.add("is-bad");
      input.setAttribute("aria-invalid", "true");
      var p = document.createElement("p");
      p.className = "lfield__error";
      p.id = input.id + "-error";
      p.textContent = message;
      field.appendChild(p);
      input.setAttribute("aria-describedby", input.id + "-error");
    } else {
      field.classList.remove("is-bad");
      input.removeAttribute("aria-invalid");
      input.setAttribute("aria-describedby", input.id === "secret" ? "caps-hint" : "account-help");
    }
  }

  function renderSummary(errors) {
    if (!errors.length) { summary.hidden = true; summary.innerHTML = ""; return; }
    var html = "<strong>" + (errors.length === 1 ? "There is 1 problem" : "There are " + errors.length + " problems") + "</strong><ul>";
    errors.forEach(function (e) { html += '<li><a href="#' + e.target + '">' + e.msg + "</a></li>"; });
    summary.innerHTML = html + "</ul>";
    summary.hidden = false;
  }

  // every problem in the summary jumps to, and focuses, its own field
  summary.addEventListener("click", function (e) {
    var a = e.target.closest("a[href^='#']");
    if (!a) { return; }
    e.preventDefault();
    var el = document.getElementById(a.getAttribute("href").slice(1));
    if (el) { el.focus(); el.scrollIntoView({ block: "center", behavior: REDUCED.matches ? "auto" : "smooth" }); }
  });

  // live clearing: a field drops its error the moment it becomes valid, not on the next submit
  Object.keys(rules).forEach(function (name) {
    var input = $("#" + name);
    input.addEventListener("input", function () {
      if (fieldOf(name).classList.contains("is-bad") && !rules[name](input.value)) {
        setError(name, "");
        if (!$$("[data-field].is-bad").length) { renderSummary([]); }
      }
    });
  });

  /* --------------------------------------- 4 · generic failure + growing delay */
  function failAuth() {
    var attempts = attemptsNow() + 1;          // read fresh: two tabs, or a reload, must not reset it
    try { sessionStorage.setItem(ATTEMPT_KEY, String(attempts)); } catch (err) { /* ignore */ }
    var wait = attempts >= 3 ? 1200 : 0;      // never enumerate faster than they can retry
    window.__loginThrottle = wait;
    submit.classList.add("is-busy");
    submit.disabled = true;
    window.setTimeout(function () {
      submit.classList.remove("is-busy");
      submit.disabled = false;
      // one sentence about both fields together; no field-level blame, no existence leak
      renderSummary([{ target: "account", msg: "The client number or password you entered doesn\u2019t match." }]);
      if (attempts >= 3) {
        var ul = $("ul", summary);
        if (ul) {
          var li = document.createElement("li");
          li.textContent = "After";
          ul.appendChild(li);
        }
      }
      summary.setAttribute("tabindex", "-1");
      summary.focus({ preventScroll: true });
      summary.scrollIntoView({ block: "center", behavior: REDUCED.matches ? "auto" : "smooth" });
    }, wait);
  }

  /* ---------------------------------------------------------- 5 · submit */
  form.addEventListener("submit", function (e) {
    e.preventDefault();                        // inert on purpose: nothing to send this to
    var problems = [];
    Object.keys(rules).forEach(function (name) {
      var msg = rules[name]($("#" + name).value);
      setError(name, msg);
      if (msg) { problems.push({ name: name, target: name, msg: msg }); }
    });
    renderSummary(problems);

    if (problems.length) {
      summary.setAttribute("tabindex", "-1");
      summary.focus({ preventScroll: true });
      summary.scrollIntoView({ block: "center", behavior: REDUCED.matches ? "auto" : "smooth" });
      return;
    }

var okId = account.value.trim() === DEMO_AUTH.clientId;
var okPw = secret.value === DEMO_AUTH.password;

if (!okId || !okPw) {
  failAuth();
  return;
}
    try { sessionStorage.setItem(ATTEMPT_KEY, "0"); } catch (err) { /* ignore */ }

    // remember-me persists the client number and nothing else — never the secret
    if (remember && remember.checked) {
      try { localStorage.setItem(STORE, account.value.trim()); } catch (err) { /* private mode */ }
    } else if (remember) {
      try { localStorage.removeItem(STORE); } catch (err) { /* ignore */ }
    }

    submit.classList.add("is-busy");
    submit.disabled = true;
    $(".lbtn__text", submit).textContent = "Checking\u2026";

    // 400-600ms reads as real without testing patience (§11)
    window.setTimeout(function () {
      try {
        sessionStorage.setItem(SESSION, JSON.stringify({ at: Date.now(), name: "Nancy" }));
      } catch (err) {
        // storage unavailable: app.html falls back to its own demo defaults
      }
      window.location.href = "app.html";        // push, so Back returns to a cleared login
    }, REDUCED.matches ? 0 : 500);
  });

  /* ------------------------------------------- 6 · prefill from remember-me */
  (function prefill() {
    if (!remember) { return; }
    var saved = null;
    try { saved = localStorage.getItem(STORE); } catch (err) { return; }
    if (!saved) { return; }
    account.value = saved;
    remember.checked = true;

    var n = document.createElement("p");
    n.className = "lfield__help";
    n.appendChild(document.createTextNode(""));
    var clear = document.createElement("button");
    clear.type = "button";
    clear.style.cssText = "font:inherit;font-size:.82rem;font-weight:700;color:#0f6f6c;background:none;border:0;padding:0;cursor:pointer;text-decoration:underline;text-underline-offset:3px";
    clear.textContent = "";
    clear.addEventListener("click", function () {
      try { localStorage.removeItem(STORE); } catch (err) { /* ignore */ }
      account.value = "";
      remember.checked = false;
      n.remove();                               // the note belongs to a value that no longer exists
      account.focus();
    });
    n.appendChild(clear);
    fieldOf("account").appendChild(n);
  }());

  /* --------------------------------- 7 · signed-out notice, after the hand-back */
  if (/[?&]signedout=1/.test(location.search)) {
    var note = document.createElement("p");
    note.className = "lfield__help";
    note.setAttribute("role", "status");
    note.textContent = "You\u2019ve been signed out .";
    var panel = $(".lpanel");
    panel.insertBefore(note, $(".lform"));
  }

  /* ---------------------------- 8 · help / terms / support, as a bottom sheet */
  var sheet = null, lastFocused = null;
  var SHEET_COPY = {
    help: {
      title: "Get help logging on",
      body: "<ul><li>Check that Caps Lock is off \u2014 the password is case sensitive.</li>" +
            "<li>Failed attempts here cost nothing: the demo accepts any pair and has no account behind it.</li>" +
            "<li>In a real bank a locked sign-in is resolved on a number you looked up yourself, never one sent to you in a text.</li></ul>" +
            "<p style='margin-top:.8rem'>Nimbus is fictional, so nothing on this page can help or harm a real account.</p>"
    },
    terms: {
      title: "Electronic Banking Terms and Conditions",
      body: "<p>Placeholder copy for the layout. The design problem worth solving here is a long document inside a short sheet: scrollable content that never traps focus and hands it back on close.</p>"
    },
    support: {
      title: "Need financial support?",
      body: "<p>Placeholder copy. Layout note: this has to read as a secondary path, not a second call to action competing with Log on.</p>"
    }
  };

  function openSheet(kind) {
    var copy = SHEET_COPY[kind];
    if (!copy) { return; }
    if (!sheet) {
      sheet = document.createElement("section");
      sheet.className = "lhelp";
      sheet.setAttribute("role", "dialog");
      sheet.setAttribute("aria-modal", "false");
      sheet.setAttribute("aria-labelledby", "lhelp-title");
      document.body.appendChild(sheet);
    }
    lastFocused = document.activeElement;
    sheet.innerHTML = '<h2 id="lhelp-title">' + copy.title + "</h2>" + copy.body +
      '<button class="lbtn" type="button" data-sheet-close style="min-width:96px;padding:.55rem 1.25rem;font-size:.95rem">Close</button>';
    requestAnimationFrame(function () { sheet.classList.add("is-open"); });
    $("[data-sheet-close]", sheet).addEventListener("click", closeSheet);
    $("[data-sheet-close]", sheet).focus({ preventScroll: true });
  }

  function closeSheet() {
    if (!sheet) { return; }
    sheet.classList.remove("is-open");
    window.setTimeout(function () {
      if (sheet && !sheet.classList.contains("is-open")) { sheet.remove(); sheet = null; }
    }, REDUCED.matches ? 0 : 300);
    if (lastFocused && lastFocused.focus) { lastFocused.focus({ preventScroll: true }); }
  }

  $$("[data-help]").forEach(function (btn) { btn.addEventListener("click", function () { openSheet("help"); }); });
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) { return; }
    var key = (a.getAttribute("href") || "").slice(1);
    if (SHEET_COPY[key]) { e.preventDefault(); openSheet(key); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && sheet) { closeSheet(); }
  });
}());
