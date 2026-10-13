/* Just for Toey — app logic. To change text, edit data/content.js instead. */
(function () {
  "use strict";
  var C = window.SITE_CONTENT || {};
  var VIEWS = ["welcome", "home", "memories", "surprise", "music", "letter"];
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function get(obj, path, fallback) {
    var cur = obj;
    for (var i = 0; i < path.length; i++) {
      if (cur == null || typeof cur !== "object") return fallback;
      cur = cur[path[i]];
    }
    return cur == null ? fallback : cur;
  }

  /* ---- Fill text from content.js (uses textContent, so no HTML injection) ---- */
  var BINDINGS = {
    siteTitle: ["recipient", "siteTitle"],
    welcomeMessage: ["welcome", "message"],
    welcomeButton: ["welcome", "buttonText"],
    homeHeading: ["home", "heading"],
    homeIntro: ["home", "intro"],
    navHome: ["nav", "home"], navMemories: ["nav", "memories"], navSurprise: ["nav", "surprise"],
    navMusic: ["nav", "music"], navLetter: ["nav", "letter"]
  };
  function applyContent() {
    var nodes = document.querySelectorAll("[data-bind]");
    for (var i = 0; i < nodes.length; i++) {
      var path = BINDINGS[nodes[i].getAttribute("data-bind")];
      var val = path ? get(C, path, null) : null;
      if (val !== null) nodes[i].textContent = val;
    }
    var title = get(C, ["recipient", "siteTitle"], null);
    if (title) document.title = title;
  }
  function applyColors() {
    var colors = get(C, ["colors"], {});
    var map = { sky: "--sky", powder: "--powder", periwinkle: "--periwinkle", cream: "--cream", blush: "--blush", text: "--text" };
    Object.keys(map).forEach(function (k) {
      if (typeof colors[k] === "string" && /^#[0-9a-fA-F]{3,8}$/.test(colors[k])) {
        document.documentElement.style.setProperty(map[k], colors[k]);
      }
    });
  }

  /* ---- Simple hash router: #/home, #/memories, ... ---- */
  var current = null;
  function routeFromHash() {
    var m = /^#\/(\w+)/.exec(location.hash);
    var name = m && VIEWS.indexOf(m[1]) > -1 ? m[1] : "welcome";
    show(name, false);
  }
  function show(name, moveFocus) {
    if (name === current) return;
    current = name;
    VIEWS.forEach(function (v) {
      var el = document.getElementById("view-" + v);
      if (el) el.hidden = v !== name;
    });
    var isWelcome = name === "welcome";
    document.body.classList.toggle("is-welcome", isWelcome);
    document.getElementById("bottom-nav").hidden = isWelcome;
    var links = document.querySelectorAll("[data-nav]");
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute("data-nav") === name) links[i].setAttribute("aria-current", "page");
      else links[i].removeAttribute("aria-current");
    }
    document.dispatchEvent(new CustomEvent("toey:view", { detail: { name: name } }));
    window.scrollTo(0, 0);
    if (moveFocus) {
      var main = document.getElementById("main");
      main.focus({ preventScroll: true });
    }
  }
  function go(name) {
    if (location.hash === "#/" + name) { show(name, true); } else { location.hash = "#/" + name; }
  }

  function init() {
    applyColors();
    applyContent();
    document.getElementById("start-btn").addEventListener("click", function () {
      var w = document.getElementById("view-welcome");
      if (reduceMotion) { go("home"); return; }
      w.classList.add("leaving");
      setTimeout(function () { w.classList.remove("leaving"); go("home"); }, 350);
    });
    window.addEventListener("hashchange", function () {
      var m = /^#\/(\w+)/.exec(location.hash);
      var name = m && VIEWS.indexOf(m[1]) > -1 ? m[1] : "welcome";
      show(name, true);
    });
    routeFromHash();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
