/* Shared user-account helper for Creativity Center.
   Accounts live in Firebase at users/{normalizedPhone}. Session lives in sessionStorage. */
(function () {
    var CONFIG = {
        apiKey: "AIzaSyBV93xGbKln5RcaPP9VOTlmh5auKD04Zms",
        authDomain: "creatitity-d09f7.firebaseapp.com",
        databaseURL: "https://creatitity-d09f7-default-rtdb.firebaseio.com",
        projectId: "creatitity-d09f7",
        storageBucket: "creatitity-d09f7.appspot.com",
        messagingSenderId: "591631410491",
        appId: "1:591631410491:web:ff000c0a8d2f030f57031e"
    };

    function db() {
        if (!firebase.apps.length) firebase.initializeApp(CONFIG);
        return firebase.database();
    }

    // 0155 225 0338 / +20 155 225 0338 / 0020155... -> 01552250338
    function normPhone(raw) {
        var d = String(raw || '').replace(/\D/g, '');
        if (d.indexOf('0020') === 0) d = '0' + d.slice(4);
        else if (d.indexOf('20') === 0 && d.length === 12) d = '0' + d.slice(2);
        return d;
    }

    async function sha256(text) {
        var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }

    function setSession(u) {
        sessionStorage.setItem('isUser', 'true');
        sessionStorage.setItem('currentUser', u.phone);
        sessionStorage.setItem('currentUserName', u.name);
    }

    var ccUser = {
        normPhone: normPhone,
        db: db,

        isLoggedIn: function () { return sessionStorage.getItem('isUser') === 'true'; },
        phone: function () { return sessionStorage.getItem('currentUser') || ''; },
        name: function () { return sessionStorage.getItem('currentUserName') || ''; },

        register: async function (name, phone, pass) {
            var p = normPhone(phone);
            if (p.length < 10) throw new Error('Enter a valid phone number');
            if (pass.length < 6) throw new Error('Password must be at least 6 characters');
            var ref = db().ref('users/' + p);
            var snap = await ref.once('value');
            if (snap.exists()) throw new Error('This phone number already has an account');
            await ref.set({ name: name, phone: p, passHash: await sha256(pass), createdAt: Date.now() });
            var u = { name: name, phone: p };
            setSession(u);
            return u;
        },

        login: async function (phone, pass) {
            var p = normPhone(phone);
            var snap = await db().ref('users/' + p).once('value');
            var u = snap.val();
            if (!u || u.passHash !== await sha256(pass)) throw new Error('Wrong phone number or password');
            setSession(u);
            return { name: u.name, phone: p };
        },

        logout: function () {
            sessionStorage.removeItem('isUser');
            sessionStorage.removeItem('currentUser');
            sessionStorage.removeItem('currentUserName');
        },

        // Fills name/phone inputs for a logged-in user (only if the field is empty)
        prefill: function (map) {
            if (!this.isLoggedIn()) return;
            var vals = { name: this.name(), phone: this.phone() };
            Object.keys(map).forEach(function (k) {
                var el = document.getElementById(map[k]);
                if (el && !el.value) el.value = vals[k];
            });
        },

        // Extra fields to attach to every new request so it shows up in "My Requests"
        requestExtras: function () {
            var extra = { createdAt: Date.now() };
            if (this.isLoggedIn()) extra.userPhone = this.phone();
            return extra;
        }
    };

    window.ccUser = ccUser;
})();

/* ---------- Service pages: login reminder + unsaved-request warning ---------- */
(function () {
    var SW_BASE = { customClass: { popup: 'custom-swal-popup', title: 'custom-swal-title' } };
    var dirty = false;

    function formEl() { return document.getElementById('installationForm') || document.getElementById('adminForm') || document.getElementById('joinForm'); }
    function staff() { return sessionStorage.getItem('isAdmin') === 'true' || sessionStorage.getItem('isOwner') === 'true'; }
    function here() { var f = location.pathname.split('/').pop(); return /^[\w\-]+\.html$/.test(f) ? f : ''; }
    function accountUrl(tab) { var n = here(); return 'index-10.html?tab=' + tab + (n ? '&next=' + encodeURIComponent(n) : ''); }

    ccUser.markSaved = function () { dirty = false; };
    ccUser.isDirty = function () { return dirty; };

    function confirmLeave(onLeave) {
        if (!window.Swal) { if (confirm('Your request has not been saved. Leave without saving?')) onLeave(); return; }
        Swal.fire(Object.assign({
            title: 'Request not saved',
            text: 'Your request has not been submitted, so no ticket was created. If you leave now, the details you entered will be lost.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Leave without saving',
            cancelButtonText: 'Keep editing',
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#2563eb',
            reverseButtons: true,
            focusCancel: true
        }, SW_BASE)).then(function (r) { if (r.isConfirmed) { dirty = false; onLeave(); } });
    }

    function init() {
        var form = formEl();
        if (!form) return;

        // ---- unsaved request tracking ----
        form.addEventListener('input', function () { dirty = true; });
        form.addEventListener('change', function () { dirty = true; });
        form.addEventListener('reset', function () { dirty = false; });

        // closing the popup (x / outside click) with typed data
        if (typeof window.closeForm === 'function') {
            var origClose = window.closeForm;
            window.closeForm = function () {
                if (dirty) { confirmLeave(function () { origClose(); }); return; }
                origClose();
            };
        }
        // leaving the page through any link
        document.addEventListener('click', function (e) {
            if (!dirty) return;
            var a = e.target.closest && e.target.closest('a[href]');
            if (!a || a.target === '_blank' || /^(#|javascript:|mailto:|tel:)/i.test(a.getAttribute('href'))) return;
            e.preventDefault();
            var href = a.href;
            confirmLeave(function () { location.href = href; });
        }, true);
        // closing the tab / refresh / browser back (browsers only allow their own wording here)
        window.addEventListener('beforeunload', function (e) {
            if (!dirty) return;
            e.preventDefault(); e.returnValue = '';
        });

        // ---- login reminder ----
        if (ccUser.isLoggedIn() || staff()) return;
        var login = accountUrl('login'), reg = accountUrl('register');

        var bar = document.createElement('div');
        bar.id = 'ccLoginBar';
        bar.setAttribute('role', 'status');
        bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:900;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px 14px;padding:10px 44px 10px 16px;background:#0f2a5c;border-top:1px solid #2563eb;color:#e6eefc;font:600 14px/1.4 system-ui,-apple-system,Segoe UI,Tahoma,sans-serif;box-shadow:0 -4px 18px rgba(0,0,0,.35)';
        bar.innerHTML = '<span><i class="fa-solid fa-circle-info" style="color:#60a5fa;margin-right:6px"></i>Log in to track your requests, see your assigned admin and rate the service.</span>' +
            '<span style="display:flex;gap:8px">' +
            '<a href="' + login + '" style="background:#2563eb;color:#fff;padding:6px 14px;border-radius:8px;text-decoration:none;font-weight:700">Login</a>' +
            '<a href="' + reg + '" style="border:1px solid #60a5fa;color:#bfdbfe;padding:5px 14px;border-radius:8px;text-decoration:none;font-weight:700">Create account</a></span>' +
            '<button type="button" aria-label="Close" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:0;color:#bfdbfe;font-size:22px;cursor:pointer;line-height:1">&times;</button>';
        var dismissed = false;
        try { dismissed = sessionStorage.getItem('ccLoginBarOff') === '1'; } catch (e) {}
        if (!dismissed) {
            document.body.appendChild(bar);
            bar.querySelector('button').onclick = function () {
                bar.remove();
                try { sessionStorage.setItem('ccLoginBarOff', '1'); } catch (e) {}
            };
        }

        // note inside the request form itself
        var note = document.createElement('div');
        note.style.cssText = 'margin:0 0 14px;padding:10px 12px;border-radius:10px;background:rgba(37,99,235,.15);border:1px solid rgba(96,165,250,.5);color:#dbeafe;font-size:13px;line-height:1.5';
        note.innerHTML = '<i class="fa-solid fa-user-lock" style="margin-right:6px;color:#60a5fa"></i>You are not logged in. Requests sent as a guest are not linked to an account. ' +
            '<a href="' + login + '" style="color:#93c5fd;font-weight:700">Log in</a> or <a href="' + reg + '" style="color:#93c5fd;font-weight:700">create an account</a> to follow your request.';
        form.parentNode.insertBefore(note, form);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();