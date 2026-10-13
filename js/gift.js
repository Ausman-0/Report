/* Gift box: tap → lid opens → messages one by one. Text: data/content.js → gift */
(function () {
  "use strict";
  var cfg = (window.SITE_CONTENT || {}).gift || {};
  var msgs = Array.isArray(cfg.messages) && cfg.messages.length ? cfg.messages : ["ขอให้วันนี้เป็นวันที่ดีนะ"];
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function $(id) { return document.getElementById(id); }
  function init() {
    var box = $("gift-box"); if (!box) return;
    var card = $("gift-card"), msg = $("gift-msg"), prog = $("gift-progress"),
        next = $("gift-next"), home = $("gift-home"), replay = $("gift-replay");
    var step = 0, opened = false, opening = false;
    $("gift-hint").textContent = cfg.hint || "แตะกล่องเพื่อเปิด";
    function render() {
      var last = step === msgs.length - 1;
      msg.textContent = msgs[step];
      prog.textContent = msgs.length > 1 ? (step + 1) + " / " + msgs.length : "";
      next.hidden = last; home.hidden = !last; replay.hidden = !last;
    }
    function showCard() {
      opening = false; opened = true; step = 0; render(); card.hidden = false;
      (next.hidden ? home : next).focus();
    }
    box.addEventListener("click", function () {
      if (opened || opening) return;
      opening = true;
      box.classList.add("open"); box.setAttribute("aria-expanded", "true");
      if (reduce) showCard(); else setTimeout(showCard, 750);
    });
    next.addEventListener("click", function () {
      if (step < msgs.length - 1) step++;
      render(); (next.hidden ? home : next).focus();
    });
    replay.addEventListener("click", function () {
      card.hidden = true; opened = false;
      box.classList.remove("open"); box.setAttribute("aria-expanded", "false"); box.focus();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
