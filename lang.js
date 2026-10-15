/* Language switcher (English / العربية) for the Creativity Center home page.
   - Translates the visible page text, flips layout to RTL, remembers the choice.
   - Also translates SweetAlert dialogs without touching the login functions. */
(function () {
    var KEY = 'cc_lang';

    var EN2AR = {
        'Installation': 'التركيب',
        'Maintenance': 'الصيانة',
        'Administration': 'إدارة الشبكات',
        'Products': 'المنتجات',
        'About Us': 'من نحن',
        'Welcome': 'أهلاً بك',
        'Learn, build and grow with everything your center needs in one place.': 'تعلّم وابنِ وانمُ مع كل ما يحتاجه مركزك في مكان واحد.',
        'Set up your environment with ease': 'جهّز بيئتك بكل سهولة',
        'Keep your system running smoothly': 'حافظ على نظامك يعمل بكفاءة',
        'Manage users, settings and resources': 'إدارة المستخدمين والإعدادات والموارد',
        'Learn more about our center': 'تعرّف أكثر على مركزنا',
        'Browse our products and equipment': 'تصفّح منتجاتنا ومعداتنا',
        'JOIN TO CREATIVITY': 'انضم إلى Creativity',
        'Login': 'تسجيل الدخول',
        'Account': 'حسابي',
        'Sign in or create a new account': 'سجّل دخولك أو أنشئ حساباً جديداً',
        'Login as User': 'الدخول كمستخدم',
        'Create Account': 'إنشاء حساب',
        'My Requests': 'طلباتي',
        'Follow Creativity Center': 'تابع Creativity Center',
        'Customer Service': 'خدمة العملاء',
        'Live chat on WhatsApp': 'محادثة مباشرة على واتساب',
        'Services': 'الخدمات',
        'Our Center': 'مركزنا',
        'Join Creativity': 'الانضمام للمركز',
        'Enter your email to subscribe to our newsletter': 'أدخل بريدك الإلكتروني للاشتراك في نشرتنا البريدية',
        'Enter your email': 'أدخل بريدك الإلكتروني',
        'Subscribe': 'اشترك',
        '© 2026 Creativity Center. All rights reserved.': '© 2026 Creativity Center. جميع الحقوق محفوظة.',
        'Staff': 'فريق العمل',
        'Admin login': 'دخول الأدمن',
        'Owner login': 'دخول المالك',
        'Admin · Logout': 'الأدمن · تسجيل الخروج',
        'Owner · Logout': 'المالك · تسجيل الخروج',
        'Dashboard': 'لوحة التحكم',
        'Price List': 'قائمة الأسعار',
        'Admins': 'الأدمنز',
        'Creativity Center home': 'الصفحة الرئيسية',
        'Sections': 'الأقسام',
        'Facebook': 'فيسبوك',
        'WhatsApp': 'واتساب',
        'Language': 'اللغة'
    };
    var AR2EN = {};
    Object.keys(EN2AR).forEach(function (k) { AR2EN[EN2AR[k]] = k; });

    var LOGOUT_EN = ' · Logout', LOGOUT_AR = ' · تسجيل الخروج';

    function tr(str, toAr) {
        var m = str.match(/^(\s*)([\s\S]*?)(\s*)$/), core = m[2];
        if (!core) return str;
        var out = (toAr ? EN2AR : AR2EN)[core];
        if (out === undefined) {
            var suf = toAr ? LOGOUT_EN : LOGOUT_AR;
            if (core.length > suf.length && core.slice(-suf.length) === suf) {
                out = core.slice(0, -suf.length) + (toAr ? LOGOUT_AR : LOGOUT_EN);
            }
        }
        return out === undefined ? str : m[1] + out + m[3];
    }

    function apply(root, toAr) {
        var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (n) {
                var p = n.parentNode && n.parentNode.nodeName;
                return (p === 'SCRIPT' || p === 'STYLE') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
            }
        });
        var n, list = [];
        while ((n = w.nextNode())) list.push(n);
        list.forEach(function (t) {
            var v = tr(t.nodeValue, toAr);
            if (v !== t.nodeValue) t.nodeValue = v;
        });
        root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(function (el) {
            ['placeholder', 'aria-label', 'title'].forEach(function (a) {
                var cur = el.getAttribute(a);
                if (cur) { var v = tr(cur, toAr); if (v !== cur) el.setAttribute(a, v); }
            });
        });
    }

    var lang = 'en';
    try { lang = localStorage.getItem(KEY) || ''; } catch (e) {}
    if (lang !== 'ar' && lang !== 'en') lang = /^ar/i.test(navigator.language || '') ? 'ar' : 'en';

    function setLang(next, first) {
        var wasAr = lang === 'ar';
        lang = next;
        try { localStorage.setItem(KEY, lang); } catch (e) {}
        var de = document.documentElement;
        de.lang = lang;
        de.dir = lang === 'ar' ? 'rtl' : 'ltr';
        if (first) { if (lang === 'ar') apply(document.body, true); }
        else if ((lang === 'ar') !== wasAr) apply(document.body, lang === 'ar');
        document.querySelectorAll('[data-lang]').forEach(function (b) {
            var on = b.getAttribute('data-lang') === lang;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', on);
        });
    }

    // keep dynamically re-written texts (e.g. "Name · Logout") translated
    var busy = false;
    var mo = new MutationObserver(function () {
        if (busy || lang !== 'ar') return;
        busy = true;
        ['staffMenu'].forEach(function (id) { var el = document.getElementById(id); if (el) apply(el, true); });
        var sf = document.querySelector('.staff-foot'); if (sf) apply(sf, true);
        mo.takeRecords();
        busy = false;
    });
    ['staffMenu'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) mo.observe(el, { subtree: true, childList: true, characterData: true });
    });
    var sf = document.querySelector('.staff-foot');
    if (sf) mo.observe(sf, { subtree: true, childList: true, characterData: true });

    document.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-lang]');
        if (b) setLang(b.getAttribute('data-lang'), false);
    });

    /* ---------- SweetAlert dialogs ---------- */
    var SW = {
        'User Login': 'دخول المستخدم', 'Create account': 'إنشاء حساب', 'Account created!': 'تم إنشاء حسابك!',
        'Welcome!': 'أهلاً بك!', 'Logout?': 'تسجيل الخروج؟',
        'Are you sure you want to log out?': 'هل تريد تسجيل الخروج فعلاً؟',
        'Are you sure you want to end owner session?': 'هل تريد إنهاء جلسة المالك؟',
        'Are you sure you want to end admin session?': 'هل تريد إنهاء جلسة الأدمن؟',
        'Owner Authorization': 'تسجيل دخول المالك', 'Admin Authorization': 'تسجيل دخول الأدمن',
        'Access Granted!': 'تم السماح بالدخول!', 'Welcome back, Owner!': 'أهلاً بعودتك أيها المالك!',
        'Access Denied': 'تم رفض الدخول',
        'Invalid owner username or password.': 'اسم المستخدم أو كلمة السر غير صحيحة.',
        'Invalid username or password.': 'اسم المستخدم أو كلمة السر غير صحيحة.',
        'Logged Out': 'تم تسجيل الخروج', 'Owner session terminated.': 'تم إنهاء جلسة المالك.',
        'Admin session terminated.': 'تم إنهاء جلسة الأدمن.',
        'Thank you!': 'شكراً لك!', 'You are subscribed.': 'تم اشتراكك بنجاح.',
        'Login': 'دخول', 'Cancel': 'إلغاء', 'Sign up': 'إنشاء الحساب', 'Back': 'رجوع',
        'Yes, Logout': 'نعم، سجّل الخروج', 'Access Dashboard': 'دخول لوحة التحكم', 'Access Terminal': 'دخول',
        'Please enter phone and password': 'اكتب رقم الموبايل وكلمة السر',
        'Please fill all fields': 'من فضلك املأ كل الحقول',
        'Please enter both username and password': 'اكتب اسم المستخدم وكلمة السر',
        'Enter a valid phone number': 'اكتب رقم موبايل صحيح',
        'Password must be at least 6 characters': 'كلمة السر لازم تكون 6 أحرف على الأقل',
        'This phone number already has an account': 'الرقم ده عليه حساب بالفعل',
        'Wrong phone number or password': 'رقم الموبايل أو كلمة السر غير صحيحة'
    };
    var PH = {
        'Phone number': 'رقم الموبايل', 'Password': 'كلمة السر', 'Full name': 'الاسم بالكامل',
        'Password (6+ characters)': 'كلمة السر (6 أحرف على الأقل)', 'Owner Username': 'اسم مستخدم المالك',
        'Owner Password': 'كلمة سر المالك', 'Username': 'اسم المستخدم'
    };

    function sw(s) {
        if (lang !== 'ar' || typeof s !== 'string') return s;
        if (SW[s] !== undefined) return SW[s];
        var m = s.match(/^Welcome back, (.+)!$/);
        if (m) return 'أهلاً بعودتك، ' + m[1] + '!';
        m = s.match(/^Welcome, (.+)$/);
        if (m) return 'أهلاً ' + m[1];
        return s;
    }
    function swHtml(h) {
        if (lang !== 'ar' || typeof h !== 'string') return h;
        Object.keys(PH).forEach(function (k) { h = h.split('placeholder="' + k + '"').join('placeholder="' + PH[k] + '"'); });
        return h;
    }

    if (window.Swal) {
        var origFire = Swal.fire.bind(Swal);
        Swal.fire = function (a, b, c) {
            if (typeof a === 'string') return origFire(sw(a), sw(b), c);
            if (a && typeof a === 'object') {
                var o = Object.assign({}, a);
                ['title', 'text', 'confirmButtonText', 'cancelButtonText', 'denyButtonText'].forEach(function (k) {
                    if (o[k]) o[k] = sw(o[k]);
                });
                if (o.html) o.html = swHtml(o.html);
                a = o;
            }
            return origFire.apply(null, [a].concat([].slice.call(arguments, 1)));
        };
        var origVal = Swal.showValidationMessage.bind(Swal);
        Swal.showValidationMessage = function (m) { return origVal(sw(m)); };
    }

    setLang(lang, true);
})();
