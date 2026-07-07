/* Admin portal for abuzafor.me — talks to the Express API (see server/). */
(function () {
  'use strict';

  var API = (window.SITE_CONFIG && window.SITE_CONFIG.apiBase) || localStorage.getItem('apiBase') || '';
  var token = localStorage.getItem('adminToken') || '';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var toastEl = $('#toast');
  var toastTimer;
  function toast(msg, isError) {
    toastEl.textContent = msg;
    toastEl.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 3000);
  }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers);
    if (!(opts.body instanceof FormData)) opts.headers['Content-Type'] = 'application/json';
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    return fetch(API + path, opts).then(function (res) {
      if (res.status === 401 && token) { logout(); throw new Error('Session expired — please sign in again'); }
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.error || ('Request failed (' + res.status + ')'));
        return data;
      });
    });
  }

  /* ---------- Auth ---------- */
  var loginScreen = $('#loginScreen'), dashboard = $('#dashboard');

  function showDashboard() {
    loginScreen.style.display = 'none';
    dashboard.hidden = false;
    openTab('profile');
  }
  function logout() {
    token = '';
    localStorage.removeItem('adminToken');
    dashboard.hidden = true;
    loginScreen.style.display = 'flex';
  }

  // No API configured: ask for it on the login screen and remember it
  if (!((window.SITE_CONFIG && window.SITE_CONFIG.apiBase))) {
    $('#apiUrlField').hidden = false;
    $('#apiUrlInput').value = API;
    if (!API) $('#apiHint').innerHTML = 'Enter your backend URL above (or set <code>apiBase</code> in <code>config.js</code> to skip this step).';
  }

  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('#loginBtn'), err = $('#loginError');
    err.classList.remove('show');
    var apiInput = $('#apiUrlInput');
    if (!$('#apiUrlField').hidden && apiInput.value.trim()) {
      API = apiInput.value.trim().replace(/\/+$/, '');
      localStorage.setItem('apiBase', API);
    }
    if (!API) {
      err.textContent = 'Please enter your backend API URL first.';
      err.classList.add('show');
      return;
    }
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
    api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('#loginEmail').value.trim(), password: $('#loginPassword').value }),
    }).then(function (data) {
      token = data.token;
      localStorage.setItem('adminToken', token);
      showDashboard();
    }).catch(function (e2) {
      err.textContent = e2.message;
      err.classList.add('show');
    }).finally(function () {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    });
  });

  $('#logoutBtn').addEventListener('click', logout);

  /* ---------- Field helpers ---------- */
  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  }
  function set(obj, path, val) {
    var keys = path.split('.'), o = obj;
    for (var i = 0; i < keys.length - 1; i++) { o[keys[i]] = o[keys[i]] || {}; o = o[keys[i]]; }
    o[keys[keys.length - 1]] = val;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fieldHTML(f, value) {
    var v = value == null ? (f.def != null ? f.def : '') : value;
    var name = 'data-field="' + f.key + '"';
    var hint = f.hint ? '<div class="hint">' + f.hint + '</div>' : '';
    if (f.type === 'textarea') return '<div class="fg"><label>' + f.label + '</label><textarea ' + name + '>' + esc(v) + '</textarea>' + hint + '</div>';
    if (f.type === 'lines') return '<div class="fg"><label>' + f.label + '</label><textarea ' + name + ' data-type="lines">' + esc((v || []).join('\n')) + '</textarea><div class="hint">One per line. ' + (f.hint || '') + '</div></div>';
    if (f.type === 'check') return '<div class="fg check"><input type="checkbox" ' + name + ' data-type="check" ' + (v ? 'checked' : '') + ' id="cb-' + f.key + '"><label for="cb-' + f.key + '">' + f.label + '</label></div>';
    if (f.type === 'number') return '<div class="fg"><label>' + f.label + '</label><input type="number" ' + name + ' data-type="number" value="' + esc(v) + '">' + hint + '</div>';
    if (f.type === 'select') {
      var opts = f.options.map(function (o) { return '<option value="' + o + '"' + (o === v ? ' selected' : '') + '>' + o + '</option>'; }).join('');
      return '<div class="fg"><label>' + f.label + '</label><select ' + name + '>' + opts + '</select>' + hint + '</div>';
    }
    if (f.type === 'image') {
      return '<div class="fg"><label>' + f.label + '</label>' +
        '<input type="text" ' + name + ' value="' + esc(v) + '" placeholder="https://... (or upload below)">' +
        '<div style="margin-top:.5rem;"><button type="button" class="btn-sm" data-upload="' + f.key + '"><i class="fas fa-upload"></i> Upload image</button>' +
        '<input type="file" accept="image/*" hidden data-upload-input="' + f.key + '"></div>' +
        (v ? '<img class="img-preview" src="' + esc(v) + '">' : '') + hint + '</div>';
    }
    return '<div class="fg"><label>' + f.label + '</label><input type="text" ' + name + ' value="' + esc(v) + '" placeholder="' + esc(f.ph || '') + '">' + hint + '</div>';
  }

  function buildForm(fields, data) {
    var html = '', row = [];
    fields.forEach(function (f) {
      var cell = fieldHTML(f, get(data || {}, f.key));
      if (f.half) {
        row.push(cell);
        if (row.length === 2) { html += '<div class="f-row">' + row.join('') + '</div>'; row = []; }
      } else {
        if (row.length) { html += '<div class="f-row">' + row.join('') + '</div>'; row = []; }
        html += cell;
      }
    });
    if (row.length) html += '<div class="f-row">' + row.join('') + '</div>';
    return html;
  }

  function readForm(root, fields) {
    var out = {};
    fields.forEach(function (f) {
      var el = root.querySelector('[data-field="' + f.key + '"]');
      if (!el) return;
      var val;
      if (f.type === 'check') val = el.checked;
      else if (f.type === 'lines') val = el.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      else if (f.type === 'number') val = Number(el.value) || 0;
      else val = el.value.trim();
      set(out, f.key, val);
    });
    return out;
  }

  function wireUploads(root) {
    root.querySelectorAll('[data-upload]').forEach(function (btn) {
      var key = btn.getAttribute('data-upload');
      var input = root.querySelector('[data-upload-input="' + key + '"]');
      btn.addEventListener('click', function () { input.click(); });
      input.addEventListener('change', function () {
        if (!input.files[0]) return;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        var fd = new FormData();
        fd.append('file', input.files[0]);
        api('/api/upload/image', { method: 'POST', body: fd }).then(function (data) {
          root.querySelector('[data-field="' + key + '"]').value = data.url;
          toast('Image uploaded');
        }).catch(function (e) { toast(e.message, true); }).finally(function () {
          btn.innerHTML = '<i class="fas fa-upload"></i> Upload image';
        });
      });
    });
  }

  /* ---------- Resource definitions ---------- */
  var RESOURCES = {
    projects: {
      title: 'Projects', icon: 'fas fa-rocket',
      desc: 'Shown as the 3D timeline on the site. Order controls timeline position (0 = top).',
      itemTitle: function (d) { return d.title; },
      itemSub: function (d) { return (d.platform || '') + (d.featured ? ' · FEATURED' : ''); },
      itemIcon: function (d) { return d.icon || 'fas fa-rocket'; },
      fields: [
        { key: 'title', label: 'Title', half: true },
        { key: 'tagline', label: 'Tagline (short, under app name)', half: true },
        { key: 'platform', label: 'Platform line', ph: 'iOS — Athlete & Coach Performance Tracking' },
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'highlights', label: 'Highlights', type: 'lines' },
        { key: 'tech', label: 'Tech stack', type: 'lines', hint: 'e.g. Flutter, Firebase' },
        { key: 'icon', label: 'Icon class (fallback only)', ph: 'fas fa-running', half: true, hint: 'Font Awesome class, used only when no project image is set' },
        { key: 'period', label: 'Timeline label', ph: '2025', half: true },
        { key: 'status', label: 'Status', type: 'select', options: ['live', 'oss', 'dev'], half: true },
        { key: 'statusText', label: 'Status badge text', ph: 'Live on App Store', half: true },
        { key: 'gradient', label: 'Preview gradient (fallback only)', ph: 'linear-gradient(135deg,#0a2e1f,#00e5a0,#0a3d2e)', hint: 'CSS gradient, used only when no project image is set' },
        { key: 'imageUrl', label: 'Project image (fills the whole card)', type: 'image', hint: 'This becomes the full card visual with a glowing frame — click to zoom on the live site. Recommended: a clear screenshot, at least 800px wide. Leave blank to fall back to the icon + gradient style.' },
        { key: 'links.appStore', label: 'App Store URL', half: true },
        { key: 'links.playStore', label: 'Play Store URL', half: true },
        { key: 'links.github', label: 'GitHub URL', half: true },
        { key: 'links.web', label: 'Website URL', half: true },
        { key: 'featured', label: 'Featured project', type: 'check' },
        { key: 'order', label: 'Order', type: 'number', half: true },
      ],
    },
    skills: {
      title: 'Skills', icon: 'fas fa-layer-group',
      desc: 'Cards in the My Toolkit grid.',
      itemTitle: function (d) { return d.name; },
      itemSub: function (d) { return d.iconClass; },
      itemIcon: function (d) { return (d.iconClass || 'fas fa-code').replace(' colored', ''); },
      fields: [
        { key: 'name', label: 'Name', half: true },
        { key: 'color', label: 'Color (hex)', ph: '#02569B', half: true },
        { key: 'iconClass', label: 'Icon class', ph: 'devicon-flutter-plain colored', hint: 'devicon.dev or Font Awesome class' },
        { key: 'order', label: 'Order', type: 'number', half: true },
      ],
    },
    experiences: {
      title: 'Experience', icon: 'fas fa-briefcase',
      desc: 'Work history timeline.',
      itemTitle: function (d) { return d.role; },
      itemSub: function (d) { return d.company + ' · ' + d.start + ' – ' + d.end; },
      itemIcon: function () { return 'fas fa-briefcase'; },
      fields: [
        { key: 'role', label: 'Role / Title' },
        { key: 'company', label: 'Company' },
        { key: 'start', label: 'Start', ph: 'Sep 2025', half: true },
        { key: 'end', label: 'End', ph: 'Present', half: true },
        { key: 'bullets', label: 'Responsibilities', type: 'lines' },
        { key: 'current', label: 'Current position (highlighted dot)', type: 'check' },
        { key: 'order', label: 'Order', type: 'number', half: true },
      ],
    },
    education: {
      title: 'Education', icon: 'fas fa-graduation-cap',
      desc: 'Academic background cards.',
      itemTitle: function (d) { return d.degree; },
      itemSub: function (d) { return d.institution + ' · ' + d.period; },
      itemIcon: function () { return 'fas fa-graduation-cap'; },
      fields: [
        { key: 'degree', label: 'Degree' },
        { key: 'institution', label: 'Institution' },
        { key: 'period', label: 'Period', ph: '2022 – 2025', half: true },
        { key: 'cgpa', label: 'CGPA', ph: '3.62 / 4.00', half: true },
        { key: 'extra', label: 'Extra line', ph: 'Minor: MIS', half: true },
        { key: 'order', label: 'Order', type: 'number', half: true },
      ],
    },
    certifications: {
      title: 'Certifications', icon: 'fas fa-certificate',
      desc: 'Credential list under Education.',
      itemTitle: function (d) { return d.title; },
      itemSub: function (d) { return d.year; },
      itemIcon: function (d) { return d.iconClass || 'fas fa-certificate'; },
      fields: [
        { key: 'title', label: 'Title' },
        { key: 'year', label: 'Year', ph: '2025', half: true },
        { key: 'iconClass', label: 'Icon class', ph: 'fas fa-certificate', half: true },
        { key: 'order', label: 'Order', type: 'number', half: true },
      ],
    },
  };

  var PROFILE_FIELDS = [
    { key: 'name', label: 'Full name', half: true },
    { key: 'tagline', label: 'Hero tagline', half: true },
    { key: 'heroDescription', label: 'Hero description', type: 'textarea' },
    { key: 'aboutParagraphs', label: 'About paragraphs', type: 'lines', hint: 'Wrap words in **double asterisks** to highlight them.' },
    { key: 'email', label: 'Email', half: true },
    { key: 'phone', label: 'Phone', half: true },
    { key: 'location', label: 'Location', half: true },
    { key: 'github', label: 'GitHub username', ph: 'AbuZafor99', half: true, hint: 'Drives the GitHub Activity section' },
    { key: 'linkedin', label: 'LinkedIn URL', half: true },
    { key: 'experienceStart', label: 'Experience start date', ph: '2025-09-01', half: true, hint: 'Drives the experience counter' },
    { key: 'statLiveApps', label: 'Stat: live apps count', ph: 'auto', half: true, hint: 'Leave blank to count live projects automatically' },
    { key: 'statLiveSub', label: 'Stat: live apps subtitle', ph: 'App Store & Play Store', half: true },
    { key: 'statOss', label: 'Stat: open source count', ph: 'auto', half: true, hint: 'Leave blank to count open-source projects automatically' },
    { key: 'statOssSub', label: 'Stat: open source subtitle', ph: 'GitHub — EarthQForecast', half: true },
    { key: 'statExpSub', label: 'Stat: experience subtitle', ph: 'ScaleUp Ad Agency', half: true },
  ];
  var DETAIL_FIELDS = [
    { key: 'label', label: 'Label', half: true },
    { key: 'value', label: 'Value', half: true },
  ];

  /* ---------- Tabs ---------- */
  var main = $('#mainContent');
  document.querySelectorAll('.side-link').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.side-link').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      openTab(btn.getAttribute('data-tab'));
    });
  });

  function pageHead(title, desc) {
    return '<div class="page-head"><h2>' + title + '</h2><p>' + desc + '</p></div>';
  }
  function loading() {
    main.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
  }

  function openTab(tab) {
    if (tab === 'profile') return renderProfile();
    if (tab === 'cv') return renderCV();
    if (tab === 'account') return renderAccount();
    renderResource(tab);
  }

  /* ---------- Profile tab ---------- */
  function renderProfile() {
    loading();
    api('/api/profile').then(function (profile) {
      profile = profile || {};
      var details = (profile.aboutDetails || []).slice();
      main.innerHTML = pageHead('Profile & About', 'Hero text, about section, and contact details shown on the site.') +
        '<form class="panel" id="profileForm"><h3><i class="fas fa-user"></i> Profile</h3>' + buildForm(PROFILE_FIELDS, profile) + '</form>' +
        '<div class="panel"><h3><i class="fas fa-th-large"></i> About detail cards</h3><div id="detailList"></div>' +
        '<button type="button" class="btn-sm" id="addDetail"><i class="fas fa-plus"></i> Add detail</button></div>' +
        '<button class="btn-p" id="saveProfile"><i class="fas fa-save"></i> Save Profile</button>';

      var detailList = $('#detailList');
      function renderDetails() {
        detailList.innerHTML = details.map(function (d, i) {
          return '<div class="f-row" style="align-items:end;margin-bottom:.6rem;" data-di="' + i + '">' +
            '<div class="fg" style="margin:0;"><label>Label</label><input type="text" data-dk="label" value="' + esc(d.label) + '"></div>' +
            '<div style="display:flex;gap:.5rem;align-items:end;"><div class="fg" style="margin:0;flex:1;"><label>Value</label><input type="text" data-dk="value" value="' + esc(d.value) + '"></div>' +
            '<button type="button" class="btn-sm danger" data-del="' + i + '" style="height:38px;"><i class="fas fa-trash"></i></button></div></div>';
        }).join('');
        detailList.querySelectorAll('[data-del]').forEach(function (b) {
          b.addEventListener('click', function () { syncDetails(); details.splice(Number(b.getAttribute('data-del')), 1); renderDetails(); });
        });
      }
      function syncDetails() {
        detailList.querySelectorAll('[data-di]').forEach(function (row, i) {
          details[i] = {
            label: row.querySelector('[data-dk="label"]').value.trim(),
            value: row.querySelector('[data-dk="value"]').value.trim(),
          };
        });
      }
      renderDetails();
      $('#addDetail').addEventListener('click', function () { syncDetails(); details.push({ label: '', value: '' }); renderDetails(); });

      $('#saveProfile').addEventListener('click', function () {
        syncDetails();
        var body = readForm($('#profileForm'), PROFILE_FIELDS);
        body.aboutDetails = details.filter(function (d) { return d.label || d.value; });
        api('/api/profile', { method: 'PUT', body: JSON.stringify(body) })
          .then(function () { toast('Profile saved'); })
          .catch(function (e) { toast(e.message, true); });
      });
    }).catch(function (e) { main.innerHTML = pageHead('Profile & About', '') + '<div class="panel">' + esc(e.message) + '</div>'; });
  }

  /* ---------- Generic resource tab ---------- */
  function renderResource(name) {
    var cfg = RESOURCES[name];
    loading();
    api('/api/' + name).then(function (items) {
      main.innerHTML = pageHead(cfg.title, cfg.desc) +
        '<button class="btn-add" id="addNew"><i class="fas fa-plus"></i> Add new</button><div id="itemList"></div>';
      var list = $('#itemList');

      function itemCard(doc, isNew) {
        var card = document.createElement('div');
        card.className = 'item-card' + (isNew ? ' open' : '');
        card.innerHTML =
          '<div class="item-head">' +
          '<div class="item-ic"><i class="' + esc(isNew ? cfg.icon : cfg.itemIcon(doc)) + '"></i></div>' +
          '<div class="item-title"><div class="t">' + esc(isNew ? 'New ' + cfg.title.replace(/s$/, '').toLowerCase() : cfg.itemTitle(doc)) + '</div>' +
          '<div class="s">' + esc(isNew ? '' : cfg.itemSub(doc)) + '</div></div>' +
          '<div class="item-actions"><button class="btn-sm" data-act="toggle"><i class="fas fa-pen"></i></button>' +
          (isNew ? '' : '<button class="btn-sm danger" data-act="delete"><i class="fas fa-trash"></i></button>') + '</div></div>' +
          '<div class="item-body">' + buildForm(cfg.fields, doc) +
          '<div style="display:flex;gap:.6rem;margin-top:.5rem;"><button class="btn-sm primary" data-act="save"><i class="fas fa-save"></i> Save</button>' +
          (isNew ? '<button class="btn-sm" data-act="cancel">Cancel</button>' : '') + '</div></div>';

        wireUploads(card);
        card.querySelector('.item-head').addEventListener('click', function (e) {
          if (e.target.closest('[data-act]')) return;
          card.classList.toggle('open');
        });
        card.querySelector('[data-act="toggle"]').addEventListener('click', function () { card.classList.toggle('open'); });
        var cancelBtn = card.querySelector('[data-act="cancel"]');
        if (cancelBtn) cancelBtn.addEventListener('click', function () { card.remove(); });
        var delBtn = card.querySelector('[data-act="delete"]');
        if (delBtn) delBtn.addEventListener('click', function () {
          if (!confirm('Delete "' + cfg.itemTitle(doc) + '"? This cannot be undone.')) return;
          api('/api/' + name + '/' + doc._id, { method: 'DELETE' })
            .then(function () { card.remove(); toast('Deleted'); })
            .catch(function (e) { toast(e.message, true); });
        });
        card.querySelector('[data-act="save"]').addEventListener('click', function () {
          var body = readForm(card, cfg.fields);
          var req = isNew
            ? api('/api/' + name, { method: 'POST', body: JSON.stringify(body) })
            : api('/api/' + name + '/' + doc._id, { method: 'PUT', body: JSON.stringify(body) });
          req.then(function (saved) {
            toast('Saved');
            card.replaceWith(itemCard(saved, false));
          }).catch(function (e) { toast(e.message, true); });
        });
        return card;
      }

      items.forEach(function (doc) { list.appendChild(itemCard(doc, false)); });
      $('#addNew').addEventListener('click', function () {
        list.prepend(itemCard({}, true));
      });
    }).catch(function (e) { main.innerHTML = pageHead(cfg.title, '') + '<div class="panel">' + esc(e.message) + '</div>'; });
  }

  /* ---------- CV tab ---------- */
  function renderCV() {
    loading();
    api('/api/profile').then(function (profile) {
      profile = profile || {};
      main.innerHTML = pageHead('CV / Resume', 'Upload a PDF — the site\'s "Download Resume" buttons switch to it instantly.') +
        '<div class="panel"><h3><i class="fas fa-file-pdf"></i> Current CV</h3>' +
        (profile.cvUrl
          ? '<div class="cv-current"><i class="fas fa-file-pdf"></i><div><div class="n">' + esc(profile.cvFileName || 'CV.pdf') + '</div><div class="u">' + esc(profile.cvUrl) + '</div></div></div>'
          : '<p style="color:var(--muted);font-size:.85rem;margin-bottom:1rem;">No CV uploaded yet — the site is serving the PDF bundled in the repo.</p>') +
        '<div class="drop-zone" id="dropZone"><i class="fas fa-cloud-upload-alt"></i>Drop your CV PDF here or click to choose<input type="file" accept="application/pdf" hidden id="cvInput"></div></div>';

      var zone = $('#dropZone'), input = $('#cvInput');
      zone.addEventListener('click', function () { input.click(); });
      ['dragover', 'dragleave', 'drop'].forEach(function (ev) {
        zone.addEventListener(ev, function (e) {
          e.preventDefault();
          zone.classList.toggle('drag', ev === 'dragover');
          if (ev === 'drop' && e.dataTransfer.files[0]) uploadCV(e.dataTransfer.files[0]);
        });
      });
      input.addEventListener('change', function () { if (input.files[0]) uploadCV(input.files[0]); });

      function uploadCV(file) {
        if (file.type !== 'application/pdf') return toast('CV must be a PDF', true);
        zone.innerHTML = '<i class="fas fa-spinner fa-spin"></i>Uploading...';
        var fd = new FormData();
        fd.append('file', file);
        api('/api/upload/cv', { method: 'POST', body: fd }).then(function () {
          toast('CV uploaded — live on the site');
          renderCV();
        }).catch(function (e) { toast(e.message, true); renderCV(); });
      }
    });
  }

  /* ---------- Account tab ---------- */
  function renderAccount() {
    main.innerHTML = pageHead('Account', 'Change your admin password.') +
      '<form class="panel" id="pwForm"><h3><i class="fas fa-key"></i> Change password</h3>' +
      '<div class="fg"><label>Current password</label><input type="password" id="curPw" autocomplete="current-password" required></div>' +
      '<div class="fg"><label>New password (min 8 chars)</label><input type="password" id="newPw" autocomplete="new-password" required minlength="8"></div>' +
      '<button type="submit" class="btn-p"><i class="fas fa-save"></i> Update password</button></form>';
    $('#pwForm').addEventListener('submit', function (e) {
      e.preventDefault();
      api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: $('#curPw').value, newPassword: $('#newPw').value }),
      }).then(function () { toast('Password updated'); e.target.reset(); })
        .catch(function (err) { toast(err.message, true); });
    });
  }

  /* ---------- Boot ---------- */
  if (token) {
    api('/api/auth/me').then(showDashboard).catch(function () { logout(); });
  }
})();
