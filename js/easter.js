/* Easter eggs: star (home, tap N times), cat (surprise), heart (letter). Text: data/content.js → easter.
   Found eggs are remembered in localStorage on this device only; "เริ่มค้นหาใหม่" resets. */
(function () {
  "use strict";
  var cfg = (window.SITE_CONTENT || {}).easter || {};
  var KEY = "just-for-toey:eggs";
  function $(id) { return document.getElementById(id); }
  function load() { try { var v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) { /* storage unavailable: found-state lasts this visit only */ } }
  function init() {
    if (!$("egg-star")) return;
    var found = load(), dlg = $("egg-dialog");
    function updateCount() { $("egg-count").textContent = found.length; }
    function mark(name) { if (found.indexOf(name) === -1) { found.push(name); save(found); updateCount(); } }
    function say(text) {
      $("egg-text").textContent = text;
      if (dlg.showModal) { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute("open", "");
    }
    $("egg-close").addEventListener("click", function () { if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg && dlg.close) dlg.close(); });

    // star: N quick taps (each within 1.5 s of the previous)
    var need = (cfg.star && cfg.star.taps) || 5, taps = 0, last = 0, star = $("egg-star");
    star.addEventListener("click", function () {
      var now = Date.now(); taps = now - last < 1500 ? taps + 1 : 1; last = now;
      star.classList.remove("pop"); void star.offsetWidth; star.classList.add("pop");
      if (taps >= need || found.indexOf("star") > -1) {
        taps = 0; mark("star"); say((cfg.star && cfg.star.message) || "เจอแล้ว!");
      }
    });
    // heart in the letter
    $("heart-egg").addEventListener("click", function () { mark("heart"); say((cfg.heart && cfg.heart.message) || "เจอแล้ว!"); });
    // cat: a different line each tap
    var lines = (cfg.cat && cfg.cat.lines && cfg.cat.lines.length) ? cfg.cat.lines : ["เมี๊ยว~"], li = 0, bubble = $("cat-bubble");
    $("cat-egg").addEventListener("click", function () {
      bubble.hidden = false; bubble.textContent = lines[li % lines.length]; li++; mark("cat");
    });
    $("egg-reset").addEventListener("click", function () {
      found = []; save(found); updateCount(); taps = 0; li = 0; bubble.hidden = true; bubble.textContent = "";
    });
    updateCount();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
