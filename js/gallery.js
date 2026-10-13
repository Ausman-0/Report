/* Just for Toey — Memories gallery.
   Permanent photos come from data/content.js (assets/images/).
   Photos picked in the browser are stored in IndexedDB on THIS device only. */
(function () {
  "use strict";

  var ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  var MAX_BYTES = 15 * 1024 * 1024, MAX_PHOTOS = 30, MAX_SIDE = 1600, QUALITY = 0.85;
  var DB_NAME = "just-for-toey", STORE = "photos";

  /* ---------- pure helpers (unit-testable in Node) ---------- */
  function validateFile(file) {
    if (!file || typeof file.type !== "string") return { ok: false, reason: "อ่านไฟล์ไม่ได้" };
    if (ALLOWED.indexOf(file.type) === -1) return { ok: false, reason: "ชนิดไฟล์ไม่รองรับ (ใช้ JPG, PNG, WebP หรือ GIF)" };
    if (!(file.size > 0)) return { ok: false, reason: "ไฟล์ว่างเปล่า" };
    if (file.size > MAX_BYTES) return { ok: false, reason: "ไฟล์ใหญ่เกิน 15 MB" };
    return { ok: true };
  }
  function scaleSize(w, h, max) {
    if (w <= max && h <= max) return { w: w, h: h };
    var r = Math.min(max / w, max / h);
    return { w: Math.max(1, Math.round(w * r)), h: Math.max(1, Math.round(h * r)) };
  }
  function normalizePhotos(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (p) { return p && typeof p.src === "string" && p.src; }).map(function (p) {
      return { src: p.src, title: p.title || "", caption: p.caption || "", date: p.date || "",
        alt: p.alt || p.title || p.caption || "รูปความทรงจำ", local: false };
    });
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { validateFile: validateFile, scaleSize: scaleSize, normalizePhotos: normalizePhotos };
    return;
  }

  /* ---------- IndexedDB ---------- */
  function openDB() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("no-idb")); return; }
      var req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE, { autoIncrement: true }); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error("idb-open")); };
      req.onblocked = function () { reject(new Error("idb-blocked")); };
    });
  }
  function readAll() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var out = [], tx = db.transaction(STORE, "readonly");
        var cur = tx.objectStore(STORE).openCursor();
        cur.onsuccess = function () { var c = cur.result; if (c) { out.push(c.value); c.continue(); } };
        tx.oncomplete = function () { db.close(); resolve(out); };
        tx.onerror = tx.onabort = function () { db.close(); reject(tx.error || new Error("idb-read")); };
      });
    });
  }
  function replaceAll(records) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite"), st = tx.objectStore(STORE);
        st.clear();
        records.forEach(function (r) { st.add(r); });
        tx.oncomplete = function () { db.close(); resolve(); };
        tx.onerror = tx.onabort = function () { db.close(); reject(tx.error || new Error("idb-write")); };
      });
    });
  }

  /* ---------- image processing ---------- */
  function decode(file) {
    function viaImg() {
      return new Promise(function (resolve, reject) {
        var u = URL.createObjectURL(file), im = new Image();
        im.onload = function () { URL.revokeObjectURL(u); resolve(im); };
        im.onerror = function () { URL.revokeObjectURL(u); reject(new Error("decode")); };
        im.src = u;
      });
    }
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: "from-image" }).catch(viaImg);
    }
    return viaImg();
  }
  function shrink(file) {
    return decode(file).then(function (src) {
      var w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
      var s = scaleSize(w, h, MAX_SIDE);
      var canvas = document.createElement("canvas");
      canvas.width = s.w; canvas.height = s.h;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, s.w, s.h);
      ctx.drawImage(src, 0, 0, s.w, s.h);
      if (src.close) src.close();
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error("toBlob")); }, "image/jpeg", QUALITY);
      });
    });
  }

  /* ---------- state ---------- */
  var C = window.SITE_CONTENT || {};
  var cfg = C.gallery || {};
  var defaultItems = normalizePhotos(cfg.photos);
  var items = defaultItems, idx = 0, localMode = false, displayUrls = [];
  var pending = [], nextId = 1, busy = false, replaceId = null, dbOK = true;

  function $(id) { return document.getElementById(id); }
  var el = {};

  function setStatus(msg, isError) { el.status.textContent = msg ? (isError ? "⚠️ " : "✓ ") + msg : ""; el.status.classList.toggle("err", !!isError); }
  function revokeAll(urls) { urls.forEach(function (u) { URL.revokeObjectURL(u); }); urls.length = 0; }

  /* ---------- viewer ---------- */
  function render() {
    var n = items.length;
    el.empty.hidden = n > 0;
    el.stage.hidden = n === 0;
    el.controls.hidden = n < 2;
    if (!n) return;
    idx = ((idx % n) + n) % n;
    var it = items[idx];
    el.missing.hidden = true; el.img.hidden = false;
    el.img.alt = it.alt;
    el.img.removeAttribute("src");
    el.img.src = it.src;
    el.title.textContent = it.title;
    el.date.textContent = it.date;
    el.caption.textContent = it.caption;
    el.count.textContent = (idx + 1) + " / " + n;
    el.banner.hidden = !localMode;
    if (el.lb.open) renderLightbox();
  }
  function renderLightbox() {
    var it = items[idx];
    el.lbImg.alt = it.alt; el.lbImg.src = it.src;
    el.lbCaption.textContent = [it.title, it.date, it.caption].filter(Boolean).join(" · ");
    el.lbCount.textContent = (idx + 1) + " / " + items.length;
  }
  function step(d) { if (items.length > 1) { idx += d; render(); } }
  function openLightbox() {
    if (!items.length || !el.missing.hidden) return;
    renderLightbox();
    if (el.lb.showModal) el.lb.showModal(); else el.lb.setAttribute("open", "");
  }
  function closeLightbox() { if (el.lb.close) el.lb.close(); else el.lb.removeAttribute("open"); }

  function setLocalGallery(records) {
    revokeAll(displayUrls);
    items = records.map(function (r) {
      var u = URL.createObjectURL(r.blob); displayUrls.push(u);
      return { src: u, title: "", caption: r.caption || "", date: "", alt: r.caption || "รูปที่เลือกเอง", local: true };
    });
    localMode = true; idx = 0; render();
  }
  function useDefault() {
    revokeAll(displayUrls);
    items = defaultItems; localMode = false; idx = 0; render();
  }

  /* ---------- picker ---------- */
  function renderPending() {
    var ul = el.list;
    while (ul.firstChild) ul.removeChild(ul.firstChild);
    pending.forEach(function (p, i) {
      var li = document.createElement("li"); li.className = "pend-item";
      var im = document.createElement("img"); im.src = p.url; im.alt = "ตัวอย่างรูปที่เลือก " + (i + 1); im.width = 72; im.height = 72;
      var box = document.createElement("div"); box.className = "pend-body";
      var lab = document.createElement("label"); lab.textContent = "คำบรรยายรูปที่ " + (i + 1) + " (ไม่ใส่ก็ได้)";
      var inp = document.createElement("input"); inp.type = "text"; inp.maxLength = 80; inp.value = p.caption;
      inp.addEventListener("input", function () { p.caption = inp.value; });
      lab.appendChild(inp);
      var row = document.createElement("div"); row.className = "pend-actions";
      var rep = document.createElement("button"); rep.type = "button"; rep.className = "btn btn-soft sm"; rep.textContent = "เปลี่ยนรูป";
      rep.addEventListener("click", function () { replaceId = p.id; el.replaceInput.value = ""; el.replaceInput.click(); });
      var del = document.createElement("button"); del.type = "button"; del.className = "btn btn-soft sm"; del.textContent = "ลบ";
      del.setAttribute("aria-label", "ลบรูปที่ " + (i + 1));
      del.addEventListener("click", function () { removePending(p.id); });
      row.appendChild(rep); row.appendChild(del);
      box.appendChild(lab); box.appendChild(row);
      li.appendChild(im); li.appendChild(box); ul.appendChild(li);
    });
    el.apply.disabled = pending.length === 0 || busy;
  }
  function removePending(id) {
    pending = pending.filter(function (p) { if (p.id === id) URL.revokeObjectURL(p.url); return p.id !== id; });
    renderPending(); setStatus("เอารูปออกจากรายการแล้ว (ยังไม่มีผลจนกว่าจะกด “ใช้รูปที่เลือก”)");
  }
  function addFiles(fileList) {
    if (busy) return;
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    var rejected = [], good = [];
    files.forEach(function (f) {
      var v = validateFile(f);
      if (!v.ok) rejected.push(f.name + ": " + v.reason);
      else if (pending.length + good.length >= MAX_PHOTOS) rejected.push(f.name + ": เกินจำนวนสูงสุด " + MAX_PHOTOS + " รูป");
      else good.push(f);
    });
    busy = true; renderPending(); setStatus("กำลังเตรียมรูป…");
    var done = 0;
    good.reduce(function (chain, f) {
      return chain.then(function () {
        return shrink(f).then(function (blob) {
          pending.push({ id: nextId++, blob: blob, url: URL.createObjectURL(blob), caption: "", name: f.name }); done++;
        }).catch(function () { rejected.push(f.name + ": เปิดรูปนี้ไม่ได้ (ไฟล์อาจเสีย)"); });
      });
    }, Promise.resolve()).then(function () {
      busy = false; renderPending();
      var msg = done ? "เพิ่ม " + done + " รูปแล้ว กด “ใช้รูปที่เลือก” เพื่อใช้งาน" : "";
      if (rejected.length) setStatus((msg ? msg + " | " : "") + "ข้าม " + rejected.length + " ไฟล์ → " + rejected.join(" ; "), true);
      else setStatus(msg);
    });
  }
  function replaceFile(file) {
    var v = validateFile(file);
    if (!v.ok) { setStatus(file.name + ": " + v.reason, true); return; }
    busy = true; renderPending();
    shrink(file).then(function (blob) {
      pending.forEach(function (p) {
        if (p.id === replaceId) { URL.revokeObjectURL(p.url); p.blob = blob; p.url = URL.createObjectURL(blob); p.name = file.name; }
      });
      setStatus("เปลี่ยนรูปแล้ว กด “ใช้รูปที่เลือก” เพื่อบันทึก");
    }).catch(function () { setStatus("เปิดรูปนี้ไม่ได้ (ไฟล์อาจเสีย)", true); })
      .then(function () { busy = false; renderPending(); });
  }
  function applyPending() {
    if (!pending.length || busy) return;
    var records = pending.map(function (p) { return { blob: p.blob, caption: p.caption.trim(), name: p.name }; });
    replaceAll(records).then(function () {
      setLocalGallery(records);
      setStatus("ใช้รูปที่เลือกแล้ว (เก็บในเครื่องนี้เท่านั้น)");
    }).catch(function (err) {
      var quota = err && (err.name === "QuotaExceededError" || /quota/i.test(String(err.message)));
      if (quota) { setStatus("พื้นที่เก็บของเบราว์เซอร์เต็ม ลองลบบางรูปแล้วลองใหม่ (รูปเดิมยังไม่ถูกเปลี่ยน)", true); return; }
      setLocalGallery(records);
      setStatus("เบราว์เซอร์นี้เก็บรูปถาวรไม่ได้ (เช่นโหมดส่วนตัว) รูปจะแสดงชั่วคราวจนกว่าจะปิดหน้านี้", true);
    });
  }
  function resetAll() {
    if (!window.confirm("กลับไปใช้รูปเดิมของเว็บ? รูปที่เลือกไว้ในเครื่องนี้จะถูกลบ")) return;
    replaceAll([]).catch(function () {}).then(function () {
      pending.forEach(function (p) { URL.revokeObjectURL(p.url); });
      pending = []; renderPending(); useDefault();
      setStatus("กลับมาใช้รูปเดิมแล้ว");
    });
  }

  /* ---------- init ---------- */
  function init() {
    ["gal-intro","gal-banner","gal-empty","gal-stage","gal-open","gal-img","gal-missing","gal-title","gal-date","gal-caption",
     "gal-controls","gal-prev","gal-next","gal-count","gal-lightbox","lb-close","lb-img","lb-caption","lb-prev","lb-next","lb-count",
     "pick-input","replace-input","pick-status","pending-list","apply-btn","reset-btn"].forEach(function (id) {
      var key = id.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
      el[key] = $(id);
    });
    if (!el.galStage) return;
    el.intro = el.galIntro; el.banner = el.galBanner; el.empty = el.galEmpty; el.stage = el.galStage; el.img = el.galImg;
    el.missing = el.galMissing; el.title = el.galTitle; el.date = el.galDate; el.caption = el.galCaption; el.controls = el.galControls;
    el.count = el.galCount; el.lb = el.galLightbox; el.status = el.pickStatus; el.list = el.pendingList; el.apply = el.applyBtn;
    el.replaceInput = el.replaceInput;

    el.intro.textContent = cfg.intro || "";
    el.banner.textContent = "กำลังแสดงรูปที่เลือกไว้ในเครื่องนี้เท่านั้น — คนอื่นที่เปิดลิงก์จะไม่เห็นรูปเหล่านี้";

    el.img.addEventListener("error", function () {
      var it = items[idx]; if (!it) return;
      el.img.hidden = true; el.missing.hidden = false;
      el.missing.textContent = it.local ? "เปิดรูปนี้ไม่ได้" : "ไม่พบรูป: " + it.src + " (เช็กชื่อไฟล์และตัวพิมพ์เล็ก-ใหญ่ใน data/content.js)";
    });
    el.galPrev.addEventListener("click", function () { step(-1); });
    el.galNext.addEventListener("click", function () { step(1); });
    el.lbPrev.addEventListener("click", function () { step(-1); });
    el.lbNext.addEventListener("click", function () { step(1); });
    el.galOpen.addEventListener("click", openLightbox);
    el.lbClose.addEventListener("click", closeLightbox);
    el.lb.addEventListener("click", function (e) { if (e.target === el.lb) closeLightbox(); });
    el.lb.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") step(-1); else if (e.key === "ArrowRight") step(1);
    });
    el.stage.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") step(-1); else if (e.key === "ArrowRight") step(1);
    });
    var x0 = null;
    el.stage.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    el.stage.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    });
    el.pickInput.addEventListener("change", function () { addFiles(el.pickInput.files); el.pickInput.value = ""; });
    el.replaceInput.addEventListener("change", function () { if (el.replaceInput.files[0]) replaceFile(el.replaceInput.files[0]); });
    el.apply.addEventListener("click", applyPending);
    el.resetBtn.addEventListener("click", resetAll);
    window.addEventListener("pagehide", function () { revokeAll(displayUrls); pending.forEach(function (p) { URL.revokeObjectURL(p.url); }); });

    render(); renderPending();

    readAll().then(function (records) {
      if (!records.length) return;
      setLocalGallery(records);
      records.forEach(function (r) {
        var b = r.blob; pending.push({ id: nextId++, blob: b, url: URL.createObjectURL(b), caption: r.caption || "", name: r.name || "" });
      });
      renderPending();
    }).catch(function () { dbOK = false; });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
