/* Music page: YouTube playlist from data/content.js → music. No autoplay on page open;
   the video is only loaded after you tap "เล่นที่นี่". Nothing is downloaded or copied. */
(function () {
  "use strict";
  function parseYouTube(url) {
    if (typeof url !== "string") return { valid: false };
    var u; try { u = new URL(url.trim()); } catch (e) { return { valid: false }; }
    if (u.protocol !== "https:" && u.protocol !== "http:") return { valid: false };
    var host = u.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, ""), id = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else { var m = /^\/(embed|shorts|live|v)\/([^/?]+)/.exec(u.pathname); if (m) id = m[2]; }
    } else return { valid: false };
    var okId = /^[A-Za-z0-9_-]{11}$/.test(id || "");
    u.protocol = "https:";
    return { valid: true, id: okId ? id : null, href: okId ? "https://www.youtube.com/watch?v=" + id : u.href };
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { parseYouTube: parseYouTube }; return; }

  var cfg = (window.SITE_CONTENT || {}).music || {};
  var active = null; // {li, btn, wrap}
  function $(id) { return document.getElementById(id); }
  function stop() {
    if (!active) return;
    while (active.wrap.firstChild) active.wrap.removeChild(active.wrap.firstChild);
    active.wrap.hidden = true; active.btn.textContent = "เล่นที่นี่"; active.btn.setAttribute("aria-expanded", "false");
    active = null;
  }
  function play(t, id, btn, wrap) {
    stop();
    var f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&playsinline=1&rel=0";
    f.title = "วิดีโอ YouTube: " + t.title;
    f.allow = "autoplay; encrypted-media; picture-in-picture"; f.allowFullscreen = true;
    f.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation allow-popups");
    f.referrerPolicy = "strict-origin-when-cross-origin";
    wrap.appendChild(f);
    var n = document.createElement("p"); n.className = "small";
    n.textContent = "ถ้าขึ้นว่าวิดีโอไม่พร้อมใช้งาน ให้กด “เปิดใน YouTube”";
    wrap.appendChild(n); wrap.hidden = false;
    btn.textContent = "หยุด"; btn.setAttribute("aria-expanded", "true");
    active = { btn: btn, wrap: wrap };
  }
  function init() {
    var ul = $("playlist"); if (!ul) return;
    $("music-intro").textContent = cfg.intro || "";
    var tracks = Array.isArray(cfg.tracks) ? cfg.tracks : [];
    if (!tracks.length) { var e = document.createElement("li"); e.className = "notice"; e.textContent = "ยังไม่มีเพลงในรายการ"; ul.appendChild(e); }
    tracks.forEach(function (t, i) {
      var li = document.createElement("li"); li.className = "track";
      var h = document.createElement("b"); h.textContent = t.title || ("เพลงที่ " + (i + 1)); li.appendChild(h);
      if (t.artist) { var a = document.createElement("div"); a.className = "small"; a.textContent = t.artist; li.appendChild(a); }
      if (t.note) { var n = document.createElement("p"); n.className = "track-note"; n.textContent = t.note; li.appendChild(n); }
      var info = parseYouTube(t.url), row = document.createElement("div"); row.className = "actions";
      var wrap = document.createElement("div"); wrap.className = "player"; wrap.hidden = true;
      if (info.valid && info.id) {
        var b = document.createElement("button"); b.type = "button"; b.className = "btn btn-primary sm";
        b.textContent = "เล่นที่นี่"; b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-label", "เล่นที่นี่: " + h.textContent);
        b.addEventListener("click", function () { if (active && active.btn === b) stop(); else play(t, info.id, b, wrap); });
        row.appendChild(b);
      }
      if (info.valid) {
        var l = document.createElement("a"); l.className = "btn btn-soft sm"; l.href = info.href; l.target = "_blank"; l.rel = "noopener noreferrer";
        l.textContent = "เปิดใน YouTube"; l.setAttribute("aria-label", "เปิดใน YouTube: " + h.textContent + " (แท็บใหม่)"); row.appendChild(l);
      } else {
        var w = document.createElement("p"); w.className = "small err-note"; w.textContent = "⚠️ ลิงก์ YouTube ไม่ถูกต้อง — แก้ที่ data/content.js"; row.appendChild(w);
      }
      li.appendChild(row); li.appendChild(wrap); ul.appendChild(li);
    });
    document.addEventListener("toey:view", function (e) { if (e.detail.name !== "music") stop(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
