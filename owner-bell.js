/* Owner-only notification bell for Creativity Center.
   - Shows only while sessionStorage.isOwner === 'true' (appears right after owner login, disappears on logout).
   - Builds the notification list from the data already in Firebase (requests, admin decisions,
     completions, customer cancellations, ratings), so nothing is missed while the owner was offline.
   - "Unread" = newer than the last time the owner opened the bell (stored in this browser).
   - New events that arrive while a page is open pop up as a small toast and the bell shakes. */
(function () {
    if (window.__ccBell) return;
    window.__ccBell = true;

    var CFG = {
        apiKey: "AIzaSyBV93xGbKln5RcaPP9VOTlmh5auKD04Zms",
        authDomain: "creatitity-d09f7.firebaseapp.com",
        databaseURL: "https://creatitity-d09f7-default-rtdb.firebaseio.com",
        projectId: "creatitity-d09f7",
        storageBucket: "creatitity-d09f7.appspot.com",
        messagingSenderId: "591631410491",
        appId: "1:591631410491:web:ff000c0a8d2f030f57031e"
    };
    var SEC = [
        { ref: 'installations',  ar: 'تركيب',        en: 'Installation' },
        { ref: 'maintenance',    ar: 'صيانة',        en: 'Maintenance' },
        { ref: 'administration', ar: 'إدارة شبكات',  en: 'Administration' },
        { ref: 'joinRequests',   ar: 'انضمام',       en: 'Join' }
    ];
    var SEEN_KEY = 'cc_owner_bell_seen';
    var MAX = 40;
    var DASH = 'index-6.html';

    var started = false, ui = null, refs = [], store = {}, loaded = {}, known = null, events = [], panelOpen = false, unreadAtOpen = 0;

    function lang() {
        var l = ''; try { l = localStorage.getItem('cc_lang') || ''; } catch (e) {}
        if (l !== 'ar' && l !== 'en') l = /^ar/i.test(navigator.language || '') ? 'ar' : 'en';
        return l;
    }
    function L(ar, en) { return lang() === 'ar' ? ar : en; }
    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
    function isOwner() { return sessionStorage.getItem('isOwner') === 'true'; }
    function getSeen() { try { var v = localStorage.getItem(SEEN_KEY); return v === null ? null : Number(v) || 0; } catch (e) { return 0; } }
    function setSeen(v) { try { localStorage.setItem(SEEN_KEY, String(v)); } catch (e) {} }
    var DIS_KEY = 'cc_owner_bell_dismissed';
    function getDis() { try { return JSON.parse(localStorage.getItem(DIS_KEY)) || {}; } catch (e) { return {}; } }
    function addDis(ids) {
        var d = getDis(); ids.forEach(function (i) { d[i] = 1; });
        var keys = Object.keys(d); if (keys.length > 600) keys.slice(0, keys.length - 600).forEach(function (k) { delete d[k]; });
        try { localStorage.setItem(DIS_KEY, JSON.stringify(d)); } catch (e) {}
    }
    function toMs(v) { if (typeof v === 'number') return v; var n = Date.parse(v); return isNaN(n) ? 0 : n; }

    /* ---------- events ---------- */
    function buildEvents() {
        var out = [];
        SEC.forEach(function (s) {
            var d = store[s.ref] || {};
            Object.keys(d).forEach(function (k) {
                var r = d[k]; if (!r || typeof r !== 'object') return;
                var id = r.dbId || k, who = r.name || '', secL = L(s.ar, s.en);
                function add(kind, time, icon, color, text) {
                    if (time) out.push({ id: s.ref + '/' + k + '/' + kind, time: time, icon: icon, color: color, text: text, sub: secL + ' · ' + id });
                }
                var created = toMs(r.createdAt || r.timestamp);
                if (r.type === 'cancel') {
                    add('new', created, 'fa-ban', '#f87171', L('طلب إلغاء جديد من ', 'New cancellation request from ') + who);
                } else {
                    add('new', created, 'fa-file-circle-plus', '#60a5fa', L('طلب ' + secL + ' جديد من ', 'New ' + secL + ' request from ') + who);
                }
                var by = r.respondedBy || L('أدمن', 'An admin');
                if (r.adminResponse === 'accepted') add('acc', toMs(r.adminResponseAt), 'fa-circle-check', '#34d399', L(by + ' وافق على الطلب', by + ' agreed to the request'));
                if (r.adminResponse === 'rejected') add('rej', toMs(r.adminResponseAt), 'fa-circle-xmark', '#f87171', L(by + ' رفض الطلب', by + ' rejected the request'));
                if (r.status === 'completed') {
                    var cb = r.completedBy || L('أدمن', 'An admin');
                    add('done', toMs(r.completedAt), 'fa-flag-checkered', '#93c5fd', L(cb + ' نفّذ الطلب', cb + ' completed the request'));
                }
                if (r.userCancelled) add('ucan', toMs(r.cancelledAt), 'fa-user-xmark', '#fca5a5', L((who || 'العميل') + ' ألغى طلبه', (who || 'The customer') + ' cancelled the request'));
                if (r.rating && r.rating.stars) add('rate', toMs(r.rating.at), 'fa-star', '#fbbf24', L((who || 'العميل') + ' قيّم الطلب ' + r.rating.stars + '/5', (who || 'The customer') + ' rated the request ' + r.rating.stars + '/5'));
            });
        });
        var dis = getDis();
        out = out.filter(function (e) { return !dis[e.id]; });
        out.sort(function (a, b) { return b.time - a.time; });
        return out.slice(0, MAX);
    }

    function fmtTime(ms) {
        var diff = Date.now() - ms;
        if (diff < 60000) return L('الآن', 'just now');
        if (diff < 3600000) { var m = Math.floor(diff / 60000); return L('منذ ' + m + ' دقيقة', m + ' min ago'); }
        if (diff < 86400000) { var h = Math.floor(diff / 3600000); return L('منذ ' + h + ' ساعة', h + ' h ago'); }
        return new Date(ms).toLocaleString(lang() === 'ar' ? 'ar-EG' : 'en-GB');
    }

    /* ---------- UI ---------- */
    function css() {
        if (document.getElementById('ccBellCss')) return;
        var s = document.createElement('style'); s.id = 'ccBellCss';
        s.textContent =
            '#ccBell{position:relative;height:44px;min-width:44px;padding:0;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:#12244a;color:#cfdcf2;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:17px;flex:0 0 auto}' +
            '#ccBell:hover{border-color:#60a5fa}' +
            '#ccBell.float{position:fixed;top:14px;inset-inline-end:14px;z-index:950}' +
            '#ccBell .cnt{position:absolute;top:-6px;inset-inline-end:-6px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#ef4444;color:#fff;font:800 11px/20px system-ui,sans-serif;text-align:center;display:none}' +
            '#ccBell.shake i{animation:ccShake .7s ease}' +
            '@keyframes ccShake{0%,100%{transform:rotate(0)}15%{transform:rotate(18deg)}30%{transform:rotate(-16deg)}45%{transform:rotate(12deg)}60%{transform:rotate(-8deg)}75%{transform:rotate(4deg)}}' +
            '#ccPanel{position:fixed;top:70px;inset-inline-end:14px;width:min(380px,calc(100vw - 28px));max-height:min(70vh,520px);display:none;flex-direction:column;background:#12244a;border:1px solid rgba(255,255,255,.14);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.5);z-index:960;color:#f3f6fc;font:500 14px/1.4 "Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;overflow:hidden}' +
            '#ccPanel.open{display:flex}' +
            '#ccPanel .hd{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.1);font-weight:800}' +
            '#ccPanel .hd button{background:none;border:0;color:#93c5fd;font:700 12px inherit;cursor:pointer;font-family:inherit}' +
            '#ccPanel .bd{overflow-y:auto;flex:1}' +
            '#ccPanel .it{display:flex;gap:12px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.06);cursor:pointer;text-decoration:none;color:inherit}' +
            '#ccPanel .it:hover{background:rgba(96,165,250,.08)}' +
            '#ccPanel .it.un{background:rgba(37,99,235,.14)}' +
            '#ccPanel .ic{width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center;flex:0 0 auto}' +
            '#ccPanel .tx{font-weight:600;font-size:13px;overflow-wrap:anywhere}' +
            '#ccPanel .sb{margin-top:3px;font-size:11px;color:#9db2d6}' +
            '#ccPanel .x{flex:0 0 auto;align-self:flex-start;width:28px;height:28px;border-radius:8px;border:0;background:transparent;color:#9db2d6;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center}' +
            '#ccPanel .x:hover{background:rgba(239,68,68,.2);color:#fca5a5}' +
            '#ccPanel .hd button[data-clearall]{display:inline-flex;align-items:center;padding:6px 10px;border-radius:8px;background:rgba(239,68,68,.12);color:#fca5a5}' +
            '#ccPanel .hd button[data-clearall]:hover{background:rgba(239,68,68,.25)}' +
            '#ccPanel .em{padding:36px 16px;text-align:center;color:#9db2d6}' +
            '#ccToast{position:fixed;top:70px;inset-inline-end:14px;max-width:min(340px,calc(100vw - 28px));z-index:970;background:#12244a;border:1px solid #2563eb;border-radius:12px;padding:10px 14px;color:#f3f6fc;font:600 13px/1.4 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.45);display:none;cursor:pointer}';
        document.head.appendChild(s);
    }

    function buildUI() {
        css();
        var btn = document.createElement('button');
        btn.id = 'ccBell'; btn.type = 'button';
        btn.innerHTML = '<i class="fa-solid fa-bell"></i><span class="cnt"></span>';
        var host = document.querySelector('.tools') || document.querySelector('.top-bar');
        if (host) host.insertBefore(btn, host.firstChild); else { btn.className = 'float'; document.body.appendChild(btn); }

        var panel = document.createElement('div'); panel.id = 'ccPanel';
        var toast = document.createElement('div'); toast.id = 'ccToast';
        document.body.appendChild(panel); document.body.appendChild(toast);
        toast.onclick = function () { location.href = DASH; };

        btn.addEventListener('click', function (e) { e.stopPropagation(); panelOpen ? closePanel() : openPanel(); });
        panel.addEventListener('click', function (e) {
            e.stopPropagation();
            var t = e.target.closest ? e.target : null; if (!t) return;
            var one = t.closest('[data-dismiss]');
            if (one) { e.preventDefault(); addDis([one.getAttribute('data-dismiss')]); afterDismiss(); return; }
            if (t.closest('[data-clearall]')) { addDis(events.map(function (x) { return x.id; })); afterDismiss(); }
        });
        document.addEventListener('click', docClick);
        ui = { btn: btn, panel: panel, toast: toast, cnt: btn.querySelector('.cnt'), tt: null };
        updateLabels();
    }
    function afterDismiss() { events = buildEvents(); updateBadge(); renderPanel(); }
    function docClick() { if (panelOpen) closePanel(); }
    function updateLabels() { if (ui) ui.btn.setAttribute('aria-label', L('الإشعارات', 'Notifications')); }

    function unreadCount() { var seen = getSeen() || 0; return events.filter(function (e) { return e.time > seen; }).length; }
    function markRead() { if (events.length) setSeen(Math.max(getSeen() || 0, events[0].time)); updateBadge(); }

    function updateBadge() {
        if (!ui) return;
        var n = unreadCount();
        ui.cnt.style.display = n ? 'block' : 'none';
        ui.cnt.textContent = n > 99 ? '99+' : n;
    }

    function renderPanel() {
        if (!ui) return;
        var seen = panelOpen ? (unreadAtOpen) : (getSeen() || 0);
        var body = events.length ? events.map(function (e) {
            return '<a class="it ' + (e.time > seen ? 'un' : '') + '" href="' + DASH + '">' +
                '<div class="ic"><i class="fa-solid ' + e.icon + '" style="color:' + e.color + '"></i></div>' +
                '<div style="flex:1;min-width:0"><div class="tx">' + esc(e.text) + '</div><div class="sb">' + esc(e.sub) + ' · ' + esc(fmtTime(e.time)) + '</div></div>' +
                '<button type="button" class="x" data-dismiss="' + esc(e.id) + '" aria-label="' + esc(L('إزالة الإشعار', 'Dismiss notification')) + '"><i class="fa-solid fa-xmark"></i></button></a>';
        }).join('') : '<div class="em">' + esc(L('لا توجد إشعارات بعد', 'No notifications yet')) + '</div>';
        ui.panel.innerHTML = '<div class="hd"><span><i class="fa-solid fa-bell" style="margin-inline-end:8px;color:#fbbf24"></i>' + esc(L('الإشعارات', 'Notifications')) + '</span>' +
            (events.length ? '<button type="button" data-clearall><i class="fa-solid fa-xmark" style="margin-inline-end:6px"></i>' + esc(L('مسح الكل', 'Clear all')) + '</button>' : '') + '</div><div class="bd">' + body + '</div>';
    }

    function openPanel() {
        panelOpen = true;
        unreadAtOpen = getSeen() || 0;       /* keep unread highlight while the panel is open */
        renderPanel();
        ui.panel.classList.add('open');
        markRead();
    }
    function closePanel() { panelOpen = false; if (ui) ui.panel.classList.remove('open'); }

    function showToast(ev) {
        if (!ui || panelOpen) return;
        ui.btn.classList.remove('shake'); void ui.btn.offsetWidth; ui.btn.classList.add('shake');
        ui.toast.innerHTML = '<i class="fa-solid ' + ev.icon + '" style="color:' + ev.color + ';margin-inline-end:8px"></i>' + esc(ev.text);
        ui.toast.style.display = 'block';
        clearTimeout(ui.tt); ui.tt = setTimeout(function () { if (ui) ui.toast.style.display = 'none'; }, 5000);
    }

    /* ---------- data ---------- */
    function refresh() {
        events = buildEvents();
        var allLoaded = SEC.every(function (s) { return loaded[s.ref]; });
        if (allLoaded) {
            if (getSeen() === null) setSeen(Date.now());      /* first ever run: don't flag old history as unread */
            if (known === null) {
                known = {}; events.forEach(function (e) { known[e.id] = 1; });
            } else {
                var fresh = events.filter(function (e) { return !known[e.id]; });
                fresh.forEach(function (e) { known[e.id] = 1; });
                if (fresh.length) showToast(fresh[0]);
            }
        }
        updateBadge();
        if (panelOpen) { renderPanel(); markRead(); }
    }

    function ensureFirebase(cb) {
        function ready() { try { if (!firebase.apps.length) firebase.initializeApp(CFG); cb(firebase.database()); } catch (e) {} }
        if (window.firebase && firebase.database) return ready();
        function load(src, next) { var s = document.createElement('script'); s.src = src; s.onload = next; document.head.appendChild(s); }
        function loadFA() {
            if (!document.querySelector('link[href*="font-awesome"]')) {
                var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'; document.head.appendChild(l);
            }
        }
        loadFA();
        var app = function () { load('https://www.gstatic.com/firebasejs/10.8.0/firebase-database-compat.js', ready); };
        if (window.firebase) app(); else load('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js', app);
    }

    function start() {
        if (started) return; started = true;
        ensureFirebase(function (db) {
            if (!started) return;
            buildUI();
            SEC.forEach(function (s) {
                var r = db.ref(s.ref);
                var cb = function (snap) { store[s.ref] = snap.val() || {}; loaded[s.ref] = true; refresh(); };
                r.on('value', cb);
                refs.push({ r: r, cb: cb });
            });
        });
    }
    function stop() {
        if (!started) return; started = false;
        refs.forEach(function (x) { try { x.r.off('value', x.cb); } catch (e) {} }); refs = [];
        store = {}; loaded = {}; known = null; events = []; closePanel();
        document.removeEventListener('click', docClick);
        ['ccBell', 'ccPanel', 'ccToast'].forEach(function (id) { var el = document.getElementById(id); if (el) el.remove(); });
        ui = null;
    }

    /* the owner can log in / out without a page reload on the home page, so keep checking */
    function tick() { if (isOwner()) start(); else stop(); }
    tick();
    setInterval(tick, 1500);
    window.addEventListener('storage', function (e) { if (e.key === 'cc_lang' && ui) { updateLabels(); if (panelOpen) renderPanel(); } });
    setInterval(function () { if (ui && panelOpen) renderPanel(); }, 60000);
})();