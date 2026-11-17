/* Muscu : ecrans et interactions. Vanilla JS, aucune dependance.
   Principe : rien ne bloque pendant une seance. On fait les exercices dans
   l'ordre qu'on veut, on passe, on remplace, on ajoute, a tout moment. */
(function () {
  'use strict';

  const VERSION = '1.0.1';
  const $ = function (s) { return document.querySelector(s); };
  const S = Stats;

  const ui = {
    draft: {},          /* entryId -> { kg, reps } en cours de saisie */
    week: 0,            /* decalage de semaine dans Stats (0 = cette semaine) */
    metric: 'maxKg',    /* courbe affichee dans la fiche exercice */
    sheet: null,        /* etat de la feuille du bas ouverte */
    pickerCb: null,
    pickerCreate: '',
    wake: null,
    lastRoute: ''
  };

  /* ---------- Icones (trait, 24px) ---------- */
  function svg(p, cls) { return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  const ic = {
    lift: svg('<path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/>'),
    list: svg('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'),
    chart: svg('<path d="M4 19V5M4 19h16M8 15l4-5 3 3 5-6"/>'),
    clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    back: svg('<path d="M15 18l-6-6 6-6"/>'),
    next: svg('<path d="M9 18l6-6-6-6"/>'),
    dots: svg('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    trophy: svg('<path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8.5 20h7"/>'),
    up: svg('<path d="M18 15l-6-6-6 6"/>'),
    down: svg('<path d="M6 9l6 6 6-6"/>'),
    x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    swap: svg('<path d="M7 7h12l-3-3M17 17H5l3 3"/>'),
    skip: svg('<path d="M5 6l7 6-7 6M13 6l7 6-7 6"/>'),
    search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>')
  };

  /* ---------- Formatage ---------- */
  function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(n, dec) {
    const p = Math.pow(10, dec == null ? 1 : dec);
    return String(Math.round((+n || 0) * p) / p).replace('.', ',');
  }
  function kgTxt(kg) { return (+kg || 0) > 0 ? num(kg) + ' kg' : 'PDC'; }
  function setTxt(st) { return kgTxt(st.kg) + ' × ' + st.reps; }
  function setsLine(sets) {
    if (!sets.length) return '';
    const kg0 = +sets[0].kg || 0;
    if (sets.every(function (s) { return (+s.kg || 0) === kg0; })) return kgTxt(kg0) + ' × ' + sets.map(function (s) { return s.reps; }).join(' · ');
    return sets.map(function (s) { return ((+s.kg || 0) > 0 ? num(s.kg) : 'PDC') + '×' + s.reps; }).join(' · ');
  }
  function tonTxt(kg) { return kg >= 1000 ? num(kg / 1000) + ' t' : Math.round(kg) + ' kg'; }
  function dur(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    if (m < 60) return m + ' min';
    return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0');
  }
  function dLong(iso) { return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function dShort(iso) { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }); }
  function hm(iso) { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  function ago(iso) {
    const d = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / S.DAY);
    if (d <= 0) return "aujourd'hui";
    if (d === 1) return 'hier';
    return 'il y a ' + d + ' j';
  }
  function norm(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function parseNum(v) { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) && n > 0 ? n : 0; }

  /* ---------- Donnees ---------- */
  function doc() { return Store.doc; }
  function exo(id) { return Store.doc.exercises[id]; }
  function exName(id) { const e = exo(id); return e ? e.name : 'Exercice inconnu'; }
  function active() { return Store.activeSession(); }
  function templates() { return S.live(doc().templates).sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); }); }
  function liveExercises() { return S.live(doc().exercises); }
  function findEntry(s, id) { return (s.entries || []).find(function (e) { return e.id === id; }); }
  function saveSession(s) { Store.put('sessions', s); }

  /* ---------- Rendu ---------- */
  function top(title, right, left) {
    return '<header class="top">' + (left || '') + '<h1>' + title + '</h1><div class="top-r">' + (right || '') + '</div></header>';
  }
  function gearBtn() { return '<a class="iconbtn" href="#/reglages" aria-label="Réglages">' + ic.gear + '<span class="syncdot"></span></a>'; }
  function backBtn(href, label) { return '<a class="back" href="' + href + '">' + ic.back + '<span>' + label + '</span></a>'; }

  function routeParts() { return (location.hash || '#/').replace(/^#\/?/, '').split('/').filter(Boolean); }

  function render() {
    const p = routeParts();
    const r = p.join('/');
    let html;
    switch (p[0]) {
      case undefined: html = vHome(); break;
      case 'ex': html = vExercise(p[1]); break;
      case 'programmes': html = vTemplates(); break;
      case 'programme': html = vTemplate(p[1]); break;
      case 'stats': html = p[1] === 'ex' ? vExStats(p[2]) : vStats(); break;
      case 'historique': html = p[1] ? vSession(p[1]) : vHistory(); break;
      case 'reglages': html = vSettings(); break;
      case 'exercices': html = vLibrary(); break;
      default: html = vHome();
    }
    if (html == null) return; /* redirection en cours */
    $('#view').innerHTML = html;
    const tab = { '': 'seance', ex: 'seance', programmes: 'prog', programme: 'prog', stats: 'stats', historique: 'hist' }[p[0] || ''] || '';
    document.querySelectorAll('#tabbar .tab').forEach(function (t) { t.classList.toggle('on', t.dataset.tab === tab); });
    if (r !== ui.lastRoute) { window.scrollTo(0, 0); ui.lastRoute = r; }
    updateSyncDot();
    const s = active();
    wake(!!s && (p[0] === undefined || p[0] === 'ex'));
    $('#tabbar .tab[data-tab="seance"]').classList.toggle('live', !!s);
  }

  /* Rendu immediat (pas d'attente du hashchange, qui arriverait apres un focus
     et le detruirait) ; le hashchange qui suit est ignore. */
  function go(hash) {
    if (location.hash !== hash) { ui.skipHash = hash; location.hash = hash; }
    render();
  }

  /* ---------- Accueil seance ---------- */
  function vHome() {
    const s = active();
    if (s) return vLive(s);
    const tpls = templates();
    let html = top('Séance', gearBtn());
    if (!tpls.length) {
      html += '<div class="empty"><p>Crée tes séances types (Upper, Lower, Push...) pour les lancer en un tap. Pendant la séance, tout reste modifiable.</p>' +
        '<button class="btn primary" data-act="tpl-new">' + ic.plus + 'Créer une séance type</button></div>';
    } else {
      html += '<div class="stack">' + tpls.map(cardTpl).join('') + '</div>';
    }
    html += '<button class="btn ghost wide" data-act="start-free">' + ic.plus + 'Séance libre</button>';
    return html;
  }

  function lastOfTemplate(tplId) {
    const list = S.sessions(doc()).filter(function (s) { return s.templateId === tplId && s.end; });
    return list[list.length - 1] || null;
  }

  function cardTpl(t) {
    const last = lastOfTemplate(t.id);
    return '<div class="card tpl">' +
      '<a class="tpl-main" href="#/programme/' + t.id + '"><div class="tpl-name">' + h(t.name) + '</div>' +
      '<div class="muted small">' + t.items.length + ' exercice' + (t.items.length > 1 ? 's' : '') + ' · ' + (last ? 'dernière ' + ago(last.start) : 'jamais faite') + '</div>' +
      '<div class="tpl-exos">' + t.items.map(function (i) { return h(exName(i.exId)); }).join(' · ') + '</div></a>' +
      '<button class="btn primary" data-act="start" data-id="' + t.id + '">Démarrer</button></div>';
  }

  function startSession(tplId) {
    if (active()) { go('#/'); return; }
    const t = tplId ? Store.get('templates', tplId) : null;
    const s = {
      id: Store.uid('s'), templateId: t ? t.id : null, name: t ? t.name : 'Séance libre',
      start: new Date().toISOString(), end: null,
      entries: t ? t.items.map(function (i) { return { id: Store.uid('e'), exId: i.exId, target: i.sets || 3, sets: [] }; }) : []
    };
    saveSession(s);
    go('#/');
  }

  /* ---------- Seance en cours ---------- */
  function vLive(s) {
    let html = '<header class="top live"><div class="top-t"><div class="eyebrow"><span class="dot-live"></span>En cours · <span data-chrono="' + s.start + '">' + dur(Date.now() - new Date(s.start)) + '</span></div>' +
      '<h1>' + h(s.name) + '</h1></div><div class="top-r">' + gearBtn() + '<button class="btn primary sm" data-act="finish">Terminer</button></div></header>';
    if (!s.entries.length) html += '<div class="empty"><p>Ajoute ton premier exercice.</p></div>';
    html += '<div class="stack">' + s.entries.map(function (e) { return entryRow(s, e); }).join('') + '</div>';
    html += '<button class="btn ghost wide" data-act="add-entry">' + ic.plus + 'Ajouter un exercice</button>';
    html += '<button class="link danger" data-act="abandon">Abandonner la séance</button>';
    return html;
  }

  function entryRow(s, e) {
    const n = e.sets.length, tgt = e.target || 3, done = n >= tgt;
    const lp = S.lastPerf(doc(), e.exId, s.id);
    const sub = n ? "Aujourd'hui : " + setsLine(e.sets) : (lp ? 'Dernière : ' + setsLine(lp.sets) : 'Première fois');
    return '<div class="entry' + (done ? ' done' : n ? ' started' : '') + '" data-act="open-ex" data-id="' + e.id + '">' +
      '<div class="prog">' + (done ? ic.check : n + '/' + tgt) + '</div>' +
      '<div class="en-main"><div class="en-name">' + h(exName(e.exId)) + '</div><div class="en-sub">' + h(sub) + '</div></div>' +
      '<button class="iconbtn" data-act="entry-menu" data-id="' + e.id + '" aria-label="Options">' + ic.dots + '</button></div>';
  }

  function initDraft(s, e) {
    if (e.sets.length) { const l = e.sets[e.sets.length - 1]; return { kg: +l.kg || 0, reps: +l.reps || 0 }; }
    const lp = S.lastPerf(doc(), e.exId, s.id);
    if (lp) return { kg: +lp.sets[0].kg || 0, reps: +lp.sets[0].reps || 0 };
    return { kg: 0, reps: 0 };
  }

  function nextEntry(s, e) {
    const i = s.entries.indexOf(e);
    for (let k = 1; k < s.entries.length; k++) {
      const c = s.entries[(i + k) % s.entries.length];
      if (c.sets.length < (c.target || 3)) return c;
    }
    return null;
  }

  function vExercise(id) {
    const s = active();
    const e = s && findEntry(s, id);
    if (!e) { go('#/'); return null; }
    const lp = S.lastPerf(doc(), e.exId, s.id);
    const b = S.bests(doc(), e.exId);
    const d = ui.draft[e.id] || (ui.draft[e.id] = initDraft(s, e));
    const n = e.sets.length;
    let html = '<header class="top">' + backBtn('#/', 'Séance') + '<div class="top-r"><button class="iconbtn" data-act="entry-menu" data-id="' + e.id + '" aria-label="Options">' + ic.dots + '</button></div></header>';
    html += '<h1 class="ex-title">' + h(exName(e.exId)) + '</h1>';
    html += '<div class="last card">' +
      '<div class="eyebrow">' + (lp ? 'Dernière fois · ' + dLong(lp.date) : 'Première fois sur cet exercice') + '</div>' +
      (lp ? '<div class="chips">' + lp.sets.map(function (st) { return '<span class="chip">' + setTxt(st) + (st.rpe ? '<small>RPE ' + st.rpe + '</small>' : '') + '</span>'; }).join('') + '</div>' : '') +
      (b.maxKg ? '<div class="muted small rec">' + ic.trophy + 'Record ' + kgTxt(b.maxKg) + ' · 1RM est. ' + num(b.maxE1rm) + ' kg</div>' : '') +
      '</div>';
    if (n) {
      html += '<div class="sets">' + e.sets.map(function (st, i) {
        const pr = S.prCheck(doc(), e.exId, s.id, st);
        return '<button class="setrow" data-act="edit-set" data-sid="' + s.id + '" data-eid="' + e.id + '" data-i="' + i + '">' +
          '<span class="setn">' + (i + 1) + '</span><span class="setv">' + setTxt(st) + '</span>' +
          (st.rpe ? '<span class="rpe">RPE ' + st.rpe + '</span>' : '') +
          (pr ? '<span class="pr">' + ic.trophy + (pr === 'kg' ? 'Charge' : '1RM') + '</span>' : '') + '</button>';
      }).join('') + '</div>';
      const last = e.sets[n - 1];
      if (!last.rpe) {
        html += '<div class="rpe-ask"><span class="muted small">Ressenti série ' + n + ' (facultatif)</span><div class="rpe-chips">' +
          [6, 7, 8, 9, 10].map(function (v) { return '<button class="chip-btn" data-act="rpe" data-id="' + e.id + '" data-v="' + v + '">' + v + '</button>'; }).join('') + '</div></div>';
      }
    }
    html += '<div class="entry-form card">' +
      stepper('Kilos', 'in-kg', d.kg ? num(d.kg, 2) : '', 'kg', 'decimal') +
      stepper('Reps', 'in-reps', d.reps ? String(d.reps) : '', 'reps', 'numeric') +
      '<button class="btn primary big" data-act="validate" data-id="' + e.id + '">' + ic.check + 'Valider la série ' + (n + 1) + '</button>' +
      '<div class="muted small center">0 kg = poids du corps</div></div>';
    const nx = nextEntry(s, e);
    if (nx) html += '<button class="btn ' + (n >= (e.target || 3) ? 'primary' : 'ghost') + ' wide" data-act="open-ex" data-id="' + nx.id + '">Exercice suivant : ' + h(exName(nx.exId)) + ic.next + '</button>';
    else if (n) html += '<button class="btn ghost wide" data-act="finish">Terminer la séance</button>';
    return html;
  }

  function stepper(label, id, val, key, mode) {
    return '<div class="stepper"><label for="' + id + '">' + label + '</label><div class="st-row">' +
      '<button class="st-btn" data-act="step" data-k="' + key + '" data-d="-1" aria-label="Moins">−</button>' +
      '<input id="' + id + '" data-k="' + key + '" inputmode="' + mode + '" autocomplete="off" value="' + h(val) + '" placeholder="0">' +
      '<button class="st-btn" data-act="step" data-k="' + key + '" data-d="1" aria-label="Plus">+</button></div></div>';
  }

  function validateSet(entryId) {
    const s = active(); const e = s && findEntry(s, entryId); if (!e) return;
    const d = ui.draft[e.id] || { kg: 0, reps: 0 };
    if (!(d.reps > 0)) { shake('#in-reps'); toast('Indique le nombre de reps'); return; }
    const set = { kg: d.kg || 0, reps: Math.round(d.reps), rpe: null, at: Date.now() };
    e.sets.push(set);
    saveSession(s);
    const pr = S.prCheck(doc(), e.exId, s.id, set);
    if (pr) toast((pr === 'kg' ? 'Record de charge' : 'Record 1RM estimé') + ' sur ' + exName(e.exId) + ' !', 'pr');
    else if (e.sets.length === (e.target || 3)) toast('Exercice terminé', 'ok');
    render();
  }

  /* ---------- Menus d'une ligne d'exercice ---------- */
  function entryMenu(entryId) {
    const s = active(); const e = s && findEntry(s, entryId); if (!e) return;
    const i = s.entries.indexOf(e);
    openSheet({ type: 'entry', eid: e.id },
      '<div class="sheet-title">' + h(exName(e.exId)) + '</div>' +
      '<div class="sheet-row"><span>Séries prévues</span><div class="mini-step"><button class="st-btn sm" data-act="target" data-d="-1">−</button><b>' + (e.target || 3) + '</b><button class="st-btn sm" data-act="target" data-d="1">+</button></div></div>' +
      '<button class="sheet-btn" data-act="skip">' + ic.skip + 'Passer (le mettre à la fin)</button>' +
      '<button class="sheet-btn" data-act="replace">' + ic.swap + 'Remplacer par un autre exercice</button>' +
      (i > 0 ? '<button class="sheet-btn" data-act="move" data-d="-1">' + ic.up + 'Monter</button>' : '') +
      (i < s.entries.length - 1 ? '<button class="sheet-btn" data-act="move" data-d="1">' + ic.down + 'Descendre</button>' : '') +
      '<button class="sheet-btn danger" data-act="remove-entry">' + ic.x + 'Retirer de la séance</button>');
  }

  function entryAction(act, d) {
    const s = active(); const e = s && findEntry(s, ui.sheet && ui.sheet.eid); if (!e) return;
    const i = s.entries.indexOf(e);
    if (act === 'target') {
      e.target = Math.max(1, Math.min(12, (e.target || 3) + d));
      saveSession(s); entryMenu(e.id); render(); return;
    }
    closeSheet();
    if (act === 'skip') {
      s.entries.splice(i, 1); s.entries.push(e); saveSession(s);
      toast(exName(e.exId) + ' passé à la fin');
      /* On enchaine sur l'exercice qui a pris sa place (le prochain non termine). */
      let nx = null;
      for (let k = i; k < s.entries.length - 1 && !nx; k++) { if (s.entries[k].sets.length < (s.entries[k].target || 3)) nx = s.entries[k]; }
      if (!nx) nx = nextEntry(s, e);
      go(routeParts()[0] === 'ex' && nx ? '#/ex/' + nx.id : '#/');
    } else if (act === 'move') {
      const j = i + d; if (j < 0 || j >= s.entries.length) return;
      s.entries.splice(i, 1); s.entries.splice(j, 0, e); saveSession(s); render();
    } else if (act === 'remove-entry') {
      if (e.sets.length && !confirm('Retirer ' + exName(e.exId) + ' et ses ' + e.sets.length + ' séries ?')) return;
      s.entries.splice(i, 1); saveSession(s); go('#/');
    } else if (act === 'replace') {
      openPicker('Remplacer ' + exName(e.exId), function (exId) {
        const ss = active(); const ee = ss && findEntry(ss, e.id); if (!ee) return;
        let target = ee;
        if (ee.sets.length) {
          /* Des series sont deja faites : on les garde, le nouvel exercice vient juste apres. */
          target = { id: Store.uid('e'), exId: exId, target: ee.target || 3, sets: [] };
          ss.entries.splice(ss.entries.indexOf(ee) + 1, 0, target);
        } else {
          ee.exId = exId; delete ui.draft[ee.id];
        }
        saveSession(ss);
        go('#/ex/' + target.id);
      });
    }
  }

  /* ---------- Fin de seance ---------- */
  function templateChanged(s) {
    const t = s.templateId && Store.get('templates', s.templateId);
    if (!t) return null;
    const a = s.entries.map(function (e) { return e.exId; }).join('|');
    const b = t.items.map(function (i) { return i.exId; }).join('|');
    return a !== b ? t : null;
  }

  function finishSheet() {
    const s = active(); if (!s) return;
    const sum = S.sessionSummary(doc(), s);
    if (!sum.sets) {
      openSheet({ type: 'finish' }, '<div class="sheet-title">Aucune série enregistrée</div><p class="muted">Cette séance est vide.</p>' +
        '<div class="sheet-actions"><button class="btn ghost" data-act="close-sheet">Continuer</button><button class="btn danger" data-act="abandon-now">Supprimer la séance</button></div>');
      return;
    }
    const t = templateChanged(s);
    openSheet({ type: 'finish' }, '<div class="sheet-title">Terminer « ' + h(s.name) + ' » ?</div>' +
      '<div class="tiles">' + tile('Durée', dur(sum.duration)) + tile('Séries', sum.sets) + tile('Tonnage', tonTxt(sum.tonnage)) + tile('Records', sum.prs, sum.prs ? 'is-pr' : '') + '</div>' +
      (t ? '<label class="check"><input type="checkbox" id="upd-tpl"><span>Mettre à jour la séance type « ' + h(t.name) + ' » avec les exercices et l\'ordre d\'aujourd\'hui</span></label>' : '') +
      '<div class="sheet-actions"><button class="btn ghost" data-act="close-sheet">Continuer</button><button class="btn primary" data-act="finish-now">Terminer</button></div>');
  }

  function finishNow() {
    const s = active(); if (!s) return;
    const box = $('#upd-tpl');
    const t = templateChanged(s);
    if (t && box && box.checked) {
      t.items = s.entries.map(function (e) { return { exId: e.exId, sets: e.target || 3 }; });
      Store.put('templates', t);
    }
    s.entries = s.entries.filter(function (e) { return e.sets.length; });
    s.end = new Date().toISOString();
    saveSession(s);
    ui.draft = {};
    closeSheet();
    Sync.schedule(0);
    go('#/historique/' + s.id);
    toast('Séance enregistrée', 'ok');
  }

  /* ---------- Feuille d'edition d'une serie (seance en cours ET historique) ---------- */
  function setSheet(sid, eid, i) {
    const s = Store.get('sessions', sid); const e = s && findEntry(s, eid); const st = e && e.sets[i];
    if (!st) return;
    const cur = ui.sheet && ui.sheet.type === 'set' && ui.sheet.sid === sid && ui.sheet.eid === eid && ui.sheet.i === i ? ui.sheet : { type: 'set', sid: sid, eid: eid, i: i, kg: +st.kg || 0, reps: +st.reps || 0, rpe: st.rpe || null };
    openSheet(cur, '<div class="sheet-title">Série ' + (i + 1) + ' · ' + h(exName(e.exId)) + '</div>' +
      stepper('Kilos', 'sh-kg', cur.kg ? num(cur.kg, 2) : '', 'skg', 'decimal') +
      stepper('Reps', 'sh-reps', cur.reps ? String(cur.reps) : '', 'sreps', 'numeric') +
      '<div class="sheet-row"><span>Ressenti (RPE)</span><div class="rpe-chips">' + [6, 7, 8, 9, 10].map(function (v) {
        return '<button class="chip-btn' + (cur.rpe === v ? ' on' : '') + '" data-act="sh-rpe" data-v="' + v + '">' + v + '</button>';
      }).join('') + '</div></div>' +
      '<div class="sheet-actions"><button class="btn danger ghost" data-act="set-del">Supprimer</button><button class="btn primary" data-act="set-save">Enregistrer</button></div>');
  }

  function setSave(del) {
    const c = ui.sheet; if (!c || c.type !== 'set') return;
    const s = Store.get('sessions', c.sid); const e = s && findEntry(s, c.eid); if (!e) return;
    if (del) {
      e.sets.splice(c.i, 1);
    } else {
      if (!(c.reps > 0)) { shake('#sh-reps'); return; }
      Object.assign(e.sets[c.i], { kg: c.kg || 0, reps: Math.round(c.reps), rpe: c.rpe || null });
    }
    if (s.end) s.entries = s.entries.filter(function (x) { return x.sets.length; });
    saveSession(s);
    if (del && !s.end) delete ui.draft[e.id];
    closeSheet(); render();
  }

  /* ---------- Selecteur d'exercice ---------- */
  function openPicker(title, cb) {
    ui.pickerCb = cb;
    $('#pk-title').textContent = title;
    $('#pk-q').value = '';
    renderPicker();
    $('#picker').classList.add('open');
    document.body.classList.add('noscroll');
  }
  function closePicker() { $('#picker').classList.remove('open'); document.body.classList.remove('noscroll'); ui.pickerCb = null; $('#pk-q').blur(); }

  function recentExIds(limit) {
    const out = [];
    const list = S.sessions(doc()).reverse();
    for (let i = 0; i < list.length && out.length < limit; i++) {
      list[i].entries.forEach(function (e) { if (out.indexOf(e.exId) < 0 && out.length < limit && Store.get('exercises', e.exId)) out.push(e.exId); });
    }
    return out;
  }

  function renderPicker() {
    const q = norm($('#pk-q').value.trim());
    const all = liveExercises();
    let html = '';
    if (q) {
      const hits = all.filter(function (e) { return norm(e.name).indexOf(q) >= 0 || norm(e.muscle).indexOf(q) >= 0; })
        .sort(function (a, b) { return norm(a.name).indexOf(q) - norm(b.name).indexOf(q) || a.name.localeCompare(b.name, 'fr'); });
      if (!all.some(function (e) { return norm(e.name) === q; })) {
        html += '<button class="pk-row create" data-act="pk-create">' + ic.plus + '<span>Créer « ' + h($('#pk-q').value.trim()) + ' »</span></button>';
      }
      html += hits.map(pkRow).join('');
    } else {
      const rec = recentExIds(8);
      if (rec.length) html += '<div class="pk-h">Récents</div>' + rec.map(function (id) { return pkRow(exo(id)); }).join('');
      Seed.MUSCLES.concat(['Autre']).forEach(function (m) {
        const list = all.filter(function (e) { return (e.muscle || 'Autre') === m; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'fr'); });
        if (list.length) html += '<div class="pk-h">' + h(m) + '</div>' + list.map(pkRow).join('');
      });
    }
    $('#pk-list').innerHTML = html;
  }
  function pkRow(e) { return '<button class="pk-row" data-act="pk-pick" data-id="' + e.id + '"><span>' + h(e.name) + '</span><small>' + h(e.muscle || '') + '</small></button>'; }

  function musclePicker(title, current, act) {
    return '<div class="sheet-title">' + title + '</div><div class="muscle-grid">' + Seed.MUSCLES.map(function (m) {
      return '<button class="chip-btn' + (m === current ? ' on' : '') + '" data-act="' + act + '" data-v="' + h(m) + '">' + h(m) + '</button>';
    }).join('') + '</div>';
  }

  function createExercise(name, muscle) {
    const id = Store.uid('x-');
    Store.put('exercises', { id: id, name: name, muscle: muscle });
    return id;
  }

  /* ---------- Seances types ---------- */
  function vTemplates() {
    const tpls = templates();
    let html = top('Séances types', gearBtn());
    html += tpls.length ? '<div class="stack">' + tpls.map(function (t) {
      return '<a class="card row-link" href="#/programme/' + t.id + '"><div><div class="tpl-name">' + h(t.name) + '</div><div class="tpl-exos">' +
        (t.items.length ? t.items.map(function (i) { return h(exName(i.exId)); }).join(' · ') : 'Aucun exercice') + '</div></div>' + ic.next + '</a>';
    }).join('') + '</div>' : '<div class="empty"><p>Aucune séance type pour l\'instant.</p></div>';
    html += '<button class="btn primary wide" data-act="tpl-new">' + ic.plus + 'Nouvelle séance type</button>';
    return html;
  }

  function vTemplate(id) {
    const t = Store.get('templates', id);
    if (!t) { go('#/programmes'); return null; }
    let html = '<header class="top">' + backBtn('#/programmes', 'Séances types') + '</header>';
    html += '<input class="name-in" id="tpl-name" data-id="' + t.id + '" value="' + h(t.name) + '" placeholder="Nom de la séance" enterkeyhint="done">';
    html += '<div class="stack">' + t.items.map(function (it, i) {
      return '<div class="card titem"><div class="ti-main"><div class="en-name">' + h(exName(it.exId)) + '</div>' +
        '<div class="mini-step"><button class="st-btn sm" data-act="ti-sets" data-i="' + i + '" data-d="-1">−</button><b>' + it.sets + ' séries</b><button class="st-btn sm" data-act="ti-sets" data-i="' + i + '" data-d="1">+</button></div></div>' +
        '<div class="ti-act">' +
        '<button class="iconbtn" data-act="ti-move" data-i="' + i + '" data-d="-1" aria-label="Monter"' + (i === 0 ? ' disabled' : '') + '>' + ic.up + '</button>' +
        '<button class="iconbtn" data-act="ti-move" data-i="' + i + '" data-d="1" aria-label="Descendre"' + (i === t.items.length - 1 ? ' disabled' : '') + '>' + ic.down + '</button>' +
        '<button class="iconbtn" data-act="ti-del" data-i="' + i + '" aria-label="Retirer">' + ic.x + '</button></div></div>';
    }).join('') + '</div>';
    html += '<button class="btn ghost wide" data-act="ti-add" data-id="' + t.id + '">' + ic.plus + 'Ajouter un exercice</button>';
    if (t.items.length && !active()) html += '<button class="btn primary wide" data-act="start" data-id="' + t.id + '">Démarrer cette séance</button>';
    html += '<button class="link danger" data-act="tpl-del" data-id="' + t.id + '">Supprimer cette séance type</button>';
    return html;
  }

  function tplAction(act, el) {
    const t = Store.get('templates', routeParts()[1]); if (!t) return;
    const i = +el.dataset.i, d = +el.dataset.d;
    if (act === 'ti-sets') t.items[i].sets = Math.max(1, Math.min(12, t.items[i].sets + d));
    else if (act === 'ti-move') { const j = i + d; if (j < 0 || j >= t.items.length) return; const x = t.items.splice(i, 1)[0]; t.items.splice(j, 0, x); }
    else if (act === 'ti-del') t.items.splice(i, 1);
    Store.put('templates', t); render();
  }

  /* ---------- Stats ---------- */
  function tile(label, value, cls, delta) {
    return '<div class="tile ' + (cls || '') + '"><div class="t-v">' + value + '</div><div class="t-l">' + label + '</div>' + (delta || '') + '</div>';
  }
  function deltaTxt(cur, prev, fmt) {
    const d = cur - prev;
    if (!prev && !cur) return '';
    const f = fmt || function (x) { return x; };
    return '<div class="t-d ' + (d > 0 ? 'up' : d < 0 ? 'down' : '') + '">' + (d > 0 ? '+' : d < 0 ? '−' : '=') + (d ? f(Math.abs(d)) : '') + ' vs sem. préc.</div>';
  }

  function vStats() {
    const ws = S.addDays(S.weekStart(new Date()), ui.week * 7);
    const we = S.addDays(ws, 6);
    const cur = S.weekSummary(doc(), ws), prev = S.weekSummary(doc(), S.addDays(ws, -7));
    let html = top('Stats', gearBtn());
    const lbl = ui.week === 0 ? 'Cette semaine' : ui.week === -1 ? 'Semaine dernière' : 'Semaine du ' + ws.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    html += '<div class="weeknav"><button class="iconbtn" data-act="week" data-d="-1" aria-label="Semaine précédente">' + ic.back + '</button>' +
      '<div><b>' + lbl + '</b><div class="muted small">' + ws.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' au ' + we.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + '</div></div>' +
      '<button class="iconbtn" data-act="week" data-d="1" aria-label="Semaine suivante"' + (ui.week >= 0 ? ' disabled' : '') + '>' + ic.next + '</button></div>';
    html += '<div class="tiles">' + tile('Séances', cur.sessions, '', deltaTxt(cur.sessions, prev.sessions)) +
      tile('Séries', cur.sets, '', deltaTxt(cur.sets, prev.sets)) +
      tile('Tonnage', tonTxt(cur.tonnage), '', deltaTxt(cur.tonnage, prev.tonnage, tonTxt)) + '</div>';

    html += '<h2>Séries par muscle</h2>';
    const muscles = Object.keys(Object.assign({}, prev.byMuscle, cur.byMuscle))
      .sort(function (a, b) { return (cur.byMuscle[b] || 0) - (cur.byMuscle[a] || 0) || (prev.byMuscle[b] || 0) - (prev.byMuscle[a] || 0); });
    if (!muscles.length) html += '<p class="muted">Aucune série sur ces deux semaines.</p>';
    else {
      const max = Math.max.apply(null, muscles.map(function (m) { return Math.max(cur.byMuscle[m] || 0, prev.byMuscle[m] || 0); }));
      html += '<div class="card bars">' + muscles.map(function (m) {
        const c = cur.byMuscle[m] || 0, p = prev.byMuscle[m] || 0;
        return '<div class="bar-row"><span class="bar-l">' + h(m) + '</span><div class="bar"><i class="prev" style="width:' + (p / max * 100) + '%"></i><i style="width:' + (c / max * 100) + '%"></i></div>' +
          '<span class="bar-v">' + c + '</span></div>';
      }).join('') + '<div class="legend"><span><i class="lg cur"></i>' + (ui.week === 0 ? 'cette semaine' : 'semaine affichée') + '</span><span><i class="lg prev"></i>semaine d\'avant</span></div></div>';
    }

    html += '<h2>Progression par exercice</h2>';
    const done = {};
    S.sessions(doc()).forEach(function (s) { s.entries.forEach(function (e) { if (e.sets.length) done[e.exId] = s.start; }); });
    const ids = Object.keys(done).sort(function (a, b) { return done[b] < done[a] ? -1 : 1; });
    if (!ids.length) html += '<p class="muted">Tes exercices apparaîtront ici après ta première séance.</p>';
    else html += '<div class="card list">' + ids.map(function (id) {
      const hist = S.exerciseHistory(doc(), id);
      const best = Math.max.apply(null, hist.map(function (x) { return x.maxKg; }));
      return '<a class="ex-row" href="#/stats/ex/' + id + '"><div><div class="en-name">' + h(exName(id)) + '</div><div class="muted small">' + hist.length + ' séance' + (hist.length > 1 ? 's' : '') + ' · ' + ago(done[id]) + '</div></div>' +
        spark(hist.slice(-8).map(function (x) { return x.maxKg || x.reps; })) + '<span class="ex-best">' + (best ? kgTxt(best) : '') + '</span></a>';
    }).join('') + '</div>';
    return html;
  }

  function spark(vals) {
    if (vals.length < 2) return '<span class="spark"></span>';
    const w = 64, hh = 24, mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), r = mx - mn || 1;
    const pts = vals.map(function (v, i) { return (i / (vals.length - 1) * (w - 4) + 2).toFixed(1) + ',' + (hh - 3 - (v - mn) / r * (hh - 6)).toFixed(1); }).join(' ');
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + hh + '"><polyline points="' + pts + '"/></svg>';
  }

  const METRICS = {
    maxKg: { label: 'Charge max', fmt: function (v) { return num(v) + ' kg'; } },
    e1rm: { label: '1RM est.', fmt: function (v) { return num(v) + ' kg'; } },
    volume: { label: 'Volume', fmt: tonTxt },
    count: { label: 'Séries', fmt: function (v) { return v; } }
  };

  function vExStats(id) {
    const e = exo(id);
    if (!e) { go('#/stats'); return null; }
    const hist = S.exerciseHistory(doc(), id);
    const b = S.bests(doc(), id);
    let html = '<header class="top">' + backBtn('#/stats', 'Stats') + '</header><h1 class="ex-title">' + h(e.name) + '</h1>';
    html += '<div class="tiles">' + tile('Record charge', b.maxKg ? kgTxt(b.maxKg) : '-', 'is-pr') + tile('1RM estimé', b.maxE1rm ? num(b.maxE1rm) + ' kg' : '-') + tile('Séances', hist.length) + '</div>';
    if (!hist.length) return html + '<p class="muted">Pas encore de série sur cet exercice.</p>';
    html += '<div class="seg">' + Object.keys(METRICS).map(function (k) {
      return '<button class="' + (ui.metric === k ? 'on' : '') + '" data-act="metric" data-v="' + k + '">' + METRICS[k].label + '</button>';
    }).join('') + '</div>';
    html += '<div class="card chart">' + chart(hist, ui.metric) + '</div>';
    html += '<h2>Détail par séance</h2><div class="card list">' + hist.slice().reverse().map(function (x) {
      return '<a class="hist-row" href="#/historique/' + x.sessionId + '"><div class="muted small">' + dLong(x.date) + '</div><div class="hist-sets">' +
        x.sets.map(function (st) { return '<span class="chip">' + setTxt(st) + (st.rpe ? '<small>RPE ' + st.rpe + '</small>' : '') + '</span>'; }).join('') + '</div></a>';
    }).join('') + '</div>';
    return html;
  }

  /* Courbe SVG : un point par seance, valeur ecrite sur le dernier point et sur le max. */
  function chart(hist, metric) {
    const W = 340, H = 190, L = 40, R = 14, T = 22, B = 26;
    const vals = hist.map(function (x) { return x[metric] || 0; });
    let mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    if (mn === mx) { mn = Math.max(0, mn - 1); mx = mx + 1; }
    const pad = (mx - mn) * 0.12; mn = Math.max(0, mn - pad); mx = mx + pad;
    const n = vals.length;
    const x = function (i) { return n === 1 ? (L + (W - R)) / 2 : L + i / (n - 1) * (W - L - R); };
    const y = function (v) { return T + (1 - (v - mn) / (mx - mn)) * (H - T - B); };
    const f = METRICS[metric].fmt;
    let g = '';
    for (let k = 0; k <= 2; k++) {
      const v = mn + (mx - mn) * k / 2, yy = y(v);
      g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '"/>' +
        '<text class="axis" x="' + (L - 6) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end">' + (metric === 'volume' ? tonTxt(v).replace(' ', ' ') : num(v, metric === 'count' ? 0 : 0)) + '</text>';
    }
    const pts = vals.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); }).join(' ');
    const iMax = vals.lastIndexOf(Math.max.apply(null, vals));
    let dots = vals.map(function (v, i) { return '<circle class="pt' + (i === iMax ? ' max' : '') + '" cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="' + (i === n - 1 || i === iMax ? 4.5 : 3) + '"/>'; }).join('');
    const label = function (i) { return '<text class="val" x="' + Math.min(W - R, Math.max(L + 12, x(i))).toFixed(1) + '" y="' + (y(vals[i]) - 9).toFixed(1) + '" text-anchor="middle">' + f(vals[i]) + '</text>'; };
    /* Toutes les valeurs ecrites tant que ca reste lisible, sinon la derniere et le max. */
    if (n <= 7) vals.forEach(function (v, i) { dots += label(i); });
    else { dots += label(n - 1); if (iMax !== n - 1) dots += label(iMax); }
    const xl = '<text class="axis" x="' + x(0).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (n === 1 ? 'middle' : 'start') + '">' + dShort(hist[0].date) + '</text>' +
      (n > 1 ? '<text class="axis" x="' + x(n - 1).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="end">' + dShort(hist[n - 1].date) + '</text>' : '');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + METRICS[metric].label + ' par séance">' + g + '<polyline class="line" points="' + pts + '"/>' + dots + xl + '</svg>';
  }

  /* ---------- Historique ---------- */
  function vHistory() {
    const list = S.sessions(doc()).reverse();
    let html = top('Historique', gearBtn());
    if (!list.length) return html + '<div class="empty"><p>Tes séances terminées apparaîtront ici.</p></div>';
    let wk = null;
    html += '<div class="card list">';
    list.forEach(function (s) {
      const w = S.weekStart(s.start).getTime();
      if (w !== wk) {
        wk = w;
        html += '<div class="list-h">Semaine du ' + new Date(w).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) + '</div>';
      }
      const sum = S.sessionSummary(doc(), s);
      html += '<a class="hist-row" href="' + (s.end ? '#/historique/' + s.id : '#/') + '"><div class="hr-top"><b>' + h(s.name) + '</b>' + (s.end ? '' : '<span class="badge">En cours</span>') + '<span class="muted small">' + dLong(s.start) + '</span></div>' +
        '<div class="muted small">' + sum.exercises + ' exos · ' + sum.sets + ' séries · ' + tonTxt(sum.tonnage) + ' · ' + dur(sum.duration) + (sum.prs ? ' · <span class="pr-txt">' + sum.prs + ' record' + (sum.prs > 1 ? 's' : '') + '</span>' : '') + '</div></a>';
    });
    return html + '</div>';
  }

  function vSession(id) {
    const s = Store.get('sessions', id);
    if (!s) { go('#/historique'); return null; }
    if (!s.end) { go('#/'); return null; }
    const sum = S.sessionSummary(doc(), s);
    let html = '<header class="top">' + backBtn('#/historique', 'Historique') + '</header>';
    html += '<h1 class="ex-title">' + h(s.name) + '</h1><div class="muted sub-title">' + dLong(s.start) + ' · ' + hm(s.start) + ' - ' + hm(s.end) + '</div>';
    html += '<div class="tiles">' + tile('Durée', dur(sum.duration)) + tile('Séries', sum.sets) + tile('Tonnage', tonTxt(sum.tonnage)) + tile('Records', sum.prs, sum.prs ? 'is-pr' : '') + '</div>';
    html += '<div class="stack">' + s.entries.map(function (e) {
      return '<div class="card"><a class="en-name link-ex" href="#/stats/ex/' + e.exId + '">' + h(exName(e.exId)) + ic.next + '</a><div class="sets">' +
        e.sets.map(function (st, i) {
          const pr = S.prCheck(doc(), e.exId, s.id, st);
          return '<button class="setrow" data-act="edit-set" data-sid="' + s.id + '" data-eid="' + e.id + '" data-i="' + i + '"><span class="setn">' + (i + 1) + '</span><span class="setv">' + setTxt(st) + '</span>' +
            (st.rpe ? '<span class="rpe">RPE ' + st.rpe + '</span>' : '') + (pr ? '<span class="pr">' + ic.trophy + (pr === 'kg' ? 'Charge' : '1RM') + '</span>' : '') + '</button>';
        }).join('') + '</div></div>';
    }).join('') + '</div>';
    html += '<button class="link danger" data-act="session-del" data-id="' + s.id + '">Supprimer cette séance</button>';
    return html;
  }

  /* ---------- Reglages ---------- */
  function syncLine() {
    const st = Sync.status;
    if (st === 'off') return '<span class="sdot off"></span>Copie en ligne non configurée : les données restent sur ce téléphone.';
    if (st === 'syncing') return '<span class="sdot busy"></span>Copie en cours...';
    if (st === 'error') return '<span class="sdot err"></span>' + h(Sync.lastError);
    return '<span class="sdot ok"></span>Copie à jour' + (Sync.lastSync ? ' (' + hm(Sync.lastSync) + ')' : '');
  }

  function vSettings() {
    const st = Store.settings;
    let html = '<header class="top">' + backBtn('#/', 'Retour') + '</header><h1 class="ex-title">Réglages</h1>';
    html += '<h2>Copie en ligne</h2><div class="card form">' +
      '<div class="sync-line" id="sync-line">' + syncLine() + '</div>' +
      '<label>Jeton GitHub<input id="set-token" type="password" autocomplete="off" value="' + h(st.token) + '" placeholder="github_pat_..."></label>' +
      '<label>Dépôt privé<input id="set-repo" autocomplete="off" autocapitalize="off" value="' + h(st.owner + '/' + st.repo) + '"></label>' +
      '<div class="row2"><button class="btn ghost" data-act="sync-now">Copier maintenant</button><button class="btn primary" data-act="settings-save">Enregistrer</button></div>' +
      '<details><summary>Comment créer le jeton (une fois par appareil)</summary><ol>' +
      '<li>Le dépôt privé <b>Taaqz-13/muscu-data</b> existe déjà (créé le 17/11/2026).</li>' +
      '<li>Settings &gt; Developer settings &gt; Personal access tokens &gt; <b>Fine-grained tokens</b> &gt; Generate new token.</li>' +
      '<li>Repository access : <b>Only select repositories</b> &gt; <b>muscu-data</b>.</li>' +
      '<li>Permissions &gt; Repository &gt; <b>Contents : Read and write</b>. Expiration au choix.</li>' +
      '<li>Copier le jeton, le coller ici, Enregistrer.</li></ol></details></div>';
    html += '<h2>Données</h2><div class="card form">' +
      '<div class="muted small" id="persist-line">' + (ui.persisted == null ? '' : ui.persisted ? 'Stockage protégé : iOS ne l\'effacera pas pour gagner de la place.' : 'Stockage non protégé par le navigateur : la copie en ligne est recommandée.') + '</div>' +
      '<div class="row2"><button class="btn ghost" data-act="export">Exporter (JSON)</button><label class="btn ghost file">Importer<input type="file" id="import-file" accept="application/json,.json"></label></div>' +
      '<a class="row-link" href="#/exercices"><span>Bibliothèque d\'exercices (' + liveExercises().length + ')</span>' + ic.next + '</a></div>';
    html += '<p class="muted small center">Muscu v' + VERSION + '</p>';
    return html;
  }

  function settingsSave() {
    const st = Store.settings;
    st.token = $('#set-token').value.trim();
    const parts = $('#set-repo').value.trim().split('/');
    if (parts.length === 2 && parts[0] && parts[1]) { st.owner = parts[0]; st.repo = parts[1]; }
    Store.saveSettings();
    toast('Réglages enregistrés', 'ok');
    Sync.now();
  }

  function exportData() {
    const text = JSON.stringify(Store.doc, null, 1);
    const name = 'muscu-' + new Date().toISOString().slice(0, 10) + '.json';
    const file = new File([text], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: name }).catch(function () { /* annule */ });
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  function importData(file) {
    const r = new FileReader();
    r.onload = function () {
      try {
        const d = JSON.parse(r.result);
        const n = Object.keys(Store.normalize(d).sessions).length;
        if (!confirm('Fusionner ce fichier (' + n + ' séances) avec les données actuelles ? Rien ne sera effacé.')) return;
        Store.applyDoc(d);
        Sync.schedule(0);
        toast('Import terminé', 'ok');
        render();
      } catch (e) { toast('Fichier illisible'); }
    };
    r.readAsText(file);
  }

  /* ---------- Bibliotheque d'exercices ---------- */
  function vLibrary() {
    const all = liveExercises();
    let html = '<header class="top">' + backBtn('#/reglages', 'Réglages') + '</header><h1 class="ex-title">Exercices</h1>';
    html += '<button class="btn primary wide" data-act="lib-new">' + ic.plus + 'Nouvel exercice</button>';
    Seed.MUSCLES.concat(['Autre']).forEach(function (m) {
      const list = all.filter(function (e) { return (e.muscle || 'Autre') === m; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'fr'); });
      if (!list.length) return;
      html += '<h2>' + h(m) + '</h2><div class="card list">' + list.map(function (e) {
        return '<button class="pk-row" data-act="lib-edit" data-id="' + e.id + '"><span>' + h(e.name) + '</span>' + ic.next + '</button>';
      }).join('') + '</div>';
    });
    return html;
  }

  function libSheet(id) {
    const e = id ? Store.get('exercises', id) : null;
    const cur = ui.sheet && ui.sheet.type === 'lib' && ui.sheet.id === (id || null) ? ui.sheet : { type: 'lib', id: id || null, muscle: e ? e.muscle : '' };
    openSheet(cur, '<div class="sheet-title">' + (e ? 'Modifier l\'exercice' : 'Nouvel exercice') + '</div>' +
      '<input class="name-in sm" id="lib-name" value="' + h(e ? e.name : (cur.name || '')) + '" placeholder="Nom de l\'exercice">' +
      musclePicker('Muscle principal', cur.muscle, 'lib-muscle') +
      '<div class="sheet-actions">' + (e ? '<button class="btn danger ghost" data-act="lib-del">Supprimer</button>' : '<button class="btn ghost" data-act="close-sheet">Annuler</button>') +
      '<button class="btn primary" data-act="lib-save">Enregistrer</button></div>');
  }

  /* ---------- Feuille du bas, toasts ---------- */
  function openSheet(state, html) {
    ui.sheet = state;
    $('#sheet-body').innerHTML = html;
    $('#sheet').classList.add('open');
    document.body.classList.add('noscroll');
  }
  function closeSheet() {
    ui.sheet = null;
    $('#sheet').classList.remove('open');
    document.body.classList.remove('noscroll');
  }

  let toastT = null;
  function toast(msg, kind) {
    const t = $('#toast');
    t.innerHTML = (kind === 'pr' ? ic.trophy : kind === 'ok' ? ic.check : '') + '<span>' + h(msg) + '</span>';
    t.className = 'show ' + (kind || '');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.className = ''; }, kind === 'pr' ? 3200 : 2200);
  }
  function shake(sel) { const el = $(sel); if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

  function updateSyncDot() {
    document.querySelectorAll('.syncdot').forEach(function (d) { d.className = 'syncdot ' + (Sync.status === 'error' ? 'err' : ''); });
    const l = $('#sync-line'); if (l) l.innerHTML = syncLine();
  }

  async function wake(on) {
    try {
      if (on && !ui.wake && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        ui.wake = await navigator.wakeLock.request('screen');
        ui.wake.addEventListener('release', function () { ui.wake = null; });
      } else if (!on && ui.wake) { const w = ui.wake; ui.wake = null; await w.release(); }
    } catch (e) { ui.wake = null; }
  }

  /* ---------- Evenements ---------- */
  document.addEventListener('click', function (ev) {
    const el = ev.target.closest('[data-act]');
    if (!el) {
      if (ev.target.id === 'sheet') closeSheet();
      return;
    }
    const act = el.dataset.act, id = el.dataset.id;
    switch (act) {
      case 'start': startSession(id); break;
      case 'start-free': startSession(null); break;
      case 'open-ex': closeSheet(); go('#/ex/' + id); break;
      case 'entry-menu': ev.stopPropagation(); entryMenu(id); break;
      case 'target': case 'skip': case 'replace': case 'move': case 'remove-entry': entryAction(act, +el.dataset.d || 0); break;
      case 'add-entry':
        openPicker('Ajouter un exercice', function (exId) {
          const s = active(); if (!s) return;
          const e = { id: Store.uid('e'), exId: exId, target: 3, sets: [] };
          s.entries.push(e); saveSession(s); go('#/ex/' + e.id);
        }); break;
      case 'step': {
        const k = el.dataset.k, d = +el.dataset.d;
        if (k === 'kg' || k === 'reps') {
          const eid = routeParts()[1]; const dr = ui.draft[eid]; if (!dr) return;
          if (k === 'kg') dr.kg = Math.max(0, Math.round(((dr.kg || 0) + d * 2.5) * 100) / 100);
          else dr.reps = Math.max(0, (dr.reps || 0) + d);
          const inp = $(k === 'kg' ? '#in-kg' : '#in-reps');
          inp.value = k === 'kg' ? (dr.kg ? num(dr.kg, 2) : '') : (dr.reps ? dr.reps : '');
        } else if (ui.sheet && ui.sheet.type === 'set') {
          const c = ui.sheet;
          if (k === 'skg') { c.kg = Math.max(0, Math.round(((c.kg || 0) + d * 2.5) * 100) / 100); $('#sh-kg').value = c.kg ? num(c.kg, 2) : ''; }
          else { c.reps = Math.max(0, (c.reps || 0) + d); $('#sh-reps').value = c.reps || ''; }
        }
        break;
      }
      case 'validate': validateSet(id); break;
      case 'rpe': {
        const s = active(); const e = s && findEntry(s, id); if (!e || !e.sets.length) return;
        e.sets[e.sets.length - 1].rpe = +el.dataset.v; saveSession(s); render(); break;
      }
      case 'edit-set': setSheet(el.dataset.sid, el.dataset.eid, +el.dataset.i); break;
      case 'sh-rpe': { const v = +el.dataset.v; ui.sheet.rpe = ui.sheet.rpe === v ? null : v; el.parentNode.querySelectorAll('.chip-btn').forEach(function (b) { b.classList.toggle('on', +b.dataset.v === ui.sheet.rpe); }); break; }
      case 'set-save': setSave(false); break;
      case 'set-del': setSave(true); break;
      case 'finish': finishSheet(); break;
      case 'finish-now': finishNow(); break;
      case 'close-sheet': closeSheet(); break;
      case 'abandon':
        if (!confirm('Abandonner la séance ? Les séries saisies seront supprimées.')) return;
        /* falls through */
      case 'abandon-now': {
        const s = active(); if (s) Store.remove('sessions', s.id);
        ui.draft = {}; closeSheet(); go('#/'); break;
      }
      case 'pk-close': closePicker(); break;
      case 'pk-pick': { const cb = ui.pickerCb; closePicker(); if (cb) cb(id); break; }
      case 'pk-create':
        ui.pickerCreate = $('#pk-q').value.trim();
        openSheet({ type: 'pk-muscle' }, musclePicker('Muscle principal de « ' + h(ui.pickerCreate) + ' »', '', 'pk-muscle'));
        break;
      case 'pk-muscle': {
        const newId = createExercise(ui.pickerCreate, el.dataset.v);
        const cb = ui.pickerCb; closeSheet(); closePicker(); if (cb) cb(newId); else render();
        break;
      }
      case 'tpl-new': {
        const t = { id: Store.uid('t'), name: 'Nouvelle séance', items: [], createdAt: Date.now() };
        Store.put('templates', t); go('#/programme/' + t.id);
        const n = $('#tpl-name'); if (n) { n.focus(); n.select(); }
        break;
      }
      case 'tpl-del':
        if (!confirm('Supprimer cette séance type ? L\'historique est conservé.')) return;
        Store.remove('templates', id); go('#/programmes'); break;
      case 'ti-add':
        openPicker('Ajouter à la séance type', function (exId) {
          const t = Store.get('templates', id); if (!t) return;
          t.items.push({ exId: exId, sets: 3 }); Store.put('templates', t); render();
        }); break;
      case 'ti-sets': case 'ti-move': case 'ti-del': tplAction(act, el); break;
      case 'week': ui.week = Math.min(0, ui.week + (+el.dataset.d)); render(); break;
      case 'metric': ui.metric = el.dataset.v; render(); break;
      case 'session-del':
        if (!confirm('Supprimer définitivement cette séance de l\'historique ?')) return;
        Store.remove('sessions', id); go('#/historique'); break;
      case 'settings-save': settingsSave(); break;
      case 'sync-now': Sync.now(); break;
      case 'export': exportData(); break;
      case 'lib-new': libSheet(null); break;
      case 'lib-edit': libSheet(id); break;
      case 'lib-muscle':
        ui.sheet.muscle = el.dataset.v;
        el.parentNode.querySelectorAll('.chip-btn').forEach(function (b) { b.classList.toggle('on', b === el); });
        break;
      case 'lib-save': {
        const c = ui.sheet; const name = $('#lib-name').value.trim();
        if (!name) { shake('#lib-name'); return; }
        if (!c.muscle) { toast('Choisis le muscle principal'); return; }
        if (c.id) { const e = Store.get('exercises', c.id); e.name = name; e.muscle = c.muscle; Store.put('exercises', e); }
        else createExercise(name, c.muscle);
        closeSheet(); render(); break;
      }
      case 'lib-del':
        if (!confirm('Supprimer cet exercice de la bibliothèque ? Son historique reste visible.')) return;
        Store.remove('exercises', ui.sheet.id); closeSheet(); render(); break;
    }
  });

  document.addEventListener('input', function (ev) {
    const t = ev.target;
    if (t.id === 'in-kg' || t.id === 'in-reps') {
      const dr = ui.draft[routeParts()[1]]; if (!dr) return;
      if (t.id === 'in-kg') dr.kg = parseNum(t.value); else dr.reps = Math.round(parseNum(t.value));
    } else if ((t.id === 'sh-kg' || t.id === 'sh-reps') && ui.sheet) {
      if (t.id === 'sh-kg') ui.sheet.kg = parseNum(t.value); else ui.sheet.reps = Math.round(parseNum(t.value));
    } else if (t.id === 'pk-q') {
      renderPicker();
    }
  });

  document.addEventListener('change', function (ev) {
    const t = ev.target;
    if (t.id === 'tpl-name') {
      const tp = Store.get('templates', t.dataset.id); if (!tp) return;
      tp.name = t.value.trim() || 'Séance sans nom'; Store.put('templates', tp);
    } else if (t.id === 'import-file' && t.files[0]) {
      importData(t.files[0]); t.value = '';
    }
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter') return;
    const t = ev.target;
    if (t.id === 'tpl-name') t.blur();
    if (t.id === 'in-kg') { $('#in-reps').focus(); ev.preventDefault(); }
    else if (t.id === 'in-reps') { t.blur(); validateSet(routeParts()[1]); }
    else if (t.id === 'pk-q') { const first = $('#pk-list [data-act]'); if (first) first.click(); }
  });

  /* Selection du contenu a la prise de focus : on tape directement la nouvelle valeur. */
  document.addEventListener('focusin', function (ev) {
    if (['in-kg', 'in-reps', 'sh-kg', 'sh-reps'].indexOf(ev.target.id) >= 0) setTimeout(function () { try { ev.target.select(); } catch (e) { /* */ } }, 0);
  });

  window.addEventListener('hashchange', function () {
    if (ui.skipHash && location.hash === ui.skipHash) { ui.skipHash = null; return; }
    ui.skipHash = null;
    closeSheet(); if ($('#picker').classList.contains('open')) closePicker(); render();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { ui.wake = null; render(); }
  });

  /* Une synchro qui rapporte des donnees ne doit pas casser une saisie en cours. */
  Store.on('sync-status', function () {
    updateSyncDot();
    const typing = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if (Sync.status === 'ok' && !typing && !ui.sheet && !$('#picker').classList.contains('open')) render();
  });
  Store.on('storage-error', function () { toast('Mémoire du téléphone pleine : exporte tes données.'); });

  setInterval(function () {
    document.querySelectorAll('[data-chrono]').forEach(function (el) { el.textContent = dur(Date.now() - new Date(el.dataset.chrono)); });
  }, 20000);

  /* ---------- Demarrage ---------- */
  Store.load();
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then(function (p) { ui.persisted = p; const l = $('#persist-line'); if (l) render(); }).catch(function () { /* */ });
  }
  Sync.init();
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () { /* hors ligne indisponible */ });
  }
})();
