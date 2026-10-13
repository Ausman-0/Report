/* Love letter: tap envelope → letter appears. Text: data/content.js → letter */
(function () {
  "use strict";
  var cfg = (window.SITE_CONTENT || {}).letter || {};
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function $(id) { return document.getElementById(id); }
  function init() {
    var env = $("env-btn"); if (!env) return;
    var wrap = $("env-wrap"), paper = $("letter-paper"), body = $("letter-body");
    $("letter-hint").textContent = cfg.sealHint || "แตะซองเพื่อเปิดจดหมาย";
    $("letter-to").textContent = cfg.to || "";
    $("letter-closing").textContent = cfg.closing || "";
    $("letter-sign").textContent = cfg.sign || "";
    (Array.isArray(cfg.paragraphs) ? cfg.paragraphs : []).forEach(function (t) {
      var p = document.createElement("p"); p.textContent = t; body.appendChild(p);
    });
    function reveal() {
      wrap.hidden = true; paper.hidden = false;
      paper.classList.remove("reveal"); void paper.offsetWidth; paper.classList.add("reveal");
      var ps = paper.querySelectorAll("#letter-body p, .letter-closing, .letter-sign");
      for (var i = 0; i < ps.length; i++) ps[i].style.animationDelay = reduce ? "0s" : (0.25 + i * 0.35) + "s";
      paper.focus();
    }
    env.addEventListener("click", function () {
      if (!paper.hidden || env.classList.contains("opening")) return;
      env.classList.add("opening"); env.setAttribute("aria-expanded", "true");
      if (reduce) reveal(); else setTimeout(reveal, 650);
    });
    $("letter-replay").addEventListener("click", function () {
      paper.hidden = true; wrap.hidden = false;
      env.classList.remove("opening"); env.setAttribute("aria-expanded", "false"); env.focus();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
