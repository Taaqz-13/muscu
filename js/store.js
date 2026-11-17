/* Etat de l'app : un seul document { exercises, templates, sessions },
   chaque objet indexe par son id et date par updatedAt.
   - Enregistre dans localStorage a CHAQUE modification (une seance en cours
     survit a la fermeture de l'app).
   - Fusion entre appareils : par id, le plus recent (updatedAt) gagne.
     Une suppression est un objet { deleted: true } plus recent, jamais un trou. */
(function (root) {
  'use strict';

  const KEY = 'muscu.data.v1';
  const SKEY = 'muscu.settings.v1';
  const COLLS = ['exercises', 'templates', 'sessions'];

  function emptyDoc() { return { v: 1, exercises: {}, templates: {}, sessions: {} }; }

  function uid(prefix) {
    return (prefix || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function normalize(d) {
    const out = emptyDoc();
    if (!d || typeof d !== 'object') return out;
    COLLS.forEach(function (c) {
      const src = d[c];
      if (src && typeof src === 'object') {
        Object.keys(src).forEach(function (k) { if (src[k] && src[k].id) out[c][k] = src[k]; });
      }
    });
    return out;
  }

  function merge(a, b) {
    a = normalize(a);
    if (!b) return a;
    b = normalize(b);
    const out = emptyDoc();
    COLLS.forEach(function (c) {
      const keys = {};
      Object.keys(a[c]).forEach(function (k) { keys[k] = 1; });
      Object.keys(b[c]).forEach(function (k) { keys[k] = 1; });
      Object.keys(keys).forEach(function (k) {
        const x = a[c][k], y = b[c][k];
        if (!x) out[c][k] = y;
        else if (!y) out[c][k] = x;
        else out[c][k] = (y.updatedAt || 0) > (x.updatedAt || 0) ? y : x;
      });
    });
    return out;
  }

  /* JSON a cles triees : sert a savoir si deux documents sont identiques. */
  function stable(o) {
    if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']';
    if (o && typeof o === 'object') {
      return '{' + Object.keys(o).sort().map(function (k) { return JSON.stringify(k) + ':' + stable(o[k]); }).join(',') + '}';
    }
    return JSON.stringify(o === undefined ? null : o);
  }

  function hasLS() { try { return typeof localStorage !== 'undefined'; } catch (e) { return false; } }

  const Store = {
    doc: emptyDoc(),
    settings: { token: '', owner: 'Taaqz-13', repo: 'muscu-data', branch: 'main', path: 'data.json' },
    _l: {},

    on: function (ev, fn) { (this._l[ev] = this._l[ev] || []).push(fn); },
    emit: function (ev) { (this._l[ev] || []).forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); },

    load: function () {
      if (hasLS()) {
        try { this.doc = normalize(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { this.doc = emptyDoc(); }
        try { Object.assign(this.settings, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { /* defauts */ }
      }
      this.seed();
      this.saveLocal();
    },

    /* Ajoute les exercices de depart manquants (jamais ceux supprimes : leur
       pierre tombale existe deja sous le meme id). */
    seed: function () {
      const self = this;
      const Sd = root.Seed || (typeof Seed !== 'undefined' ? Seed : null);
      if (!Sd) return;
      Sd.exercises().forEach(function (e) { if (!self.doc.exercises[e.id]) self.doc.exercises[e.id] = e; });
    },

    saveLocal: function () {
      if (!hasLS()) return;
      try { localStorage.setItem(KEY, JSON.stringify(this.doc)); }
      catch (e) { console.error('stockage', e); this.emit('storage-error'); }
    },

    saveSettings: function () {
      if (hasLS()) localStorage.setItem(SKEY, JSON.stringify(this.settings));
    },

    put: function (coll, obj) {
      obj.updatedAt = Math.max(Date.now(), (obj.updatedAt || 0) + 1);
      this.doc[coll][obj.id] = obj;
      this.saveLocal();
      this.emit('change');
      if (root.Sync) root.Sync.schedule();
      return obj;
    },

    /* Pierre tombale : on garde nom et muscle pour l'historique. */
    remove: function (coll, id) {
      const o = this.doc[coll][id];
      if (!o) return;
      const t = Object.assign({}, o, { deleted: true });
      if (coll === 'sessions') { t.entries = []; }
      this.put(coll, t);
    },

    get: function (coll, id) { const o = this.doc[coll][id]; return o && !o.deleted ? o : null; },

    activeSession: function () {
      let best = null;
      Object.keys(this.doc.sessions).forEach(function (k) {
        const s = Store.doc.sessions[k];
        if (s.deleted || s.end) return;
        if (!best || s.start > best.start) best = s;
      });
      return best;
    },

    toDoc: function () { return this.doc; },

    /* Fusion avec l'etat local ACTUEL (et non une copie prise avant l'appel
       reseau) : une serie validee pendant la synchro n'est jamais ecrasee. */
    applyDoc: function (d) {
      this.doc = merge(this.doc, d);
      this.seed();
      this.saveLocal();
      this.emit('change');
    },

    emptyDoc: emptyDoc, merge: merge, stable: stable, uid: uid, normalize: normalize
  };

  root.Store = Store;
  if (typeof module !== 'undefined' && module.exports) module.exports = Store;
})(typeof self !== 'undefined' ? self : this);
