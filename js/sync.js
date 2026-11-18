/* Copie en ligne : le fichier data.json d'un depot GitHub PRIVE.
   Repris de l'app Taches (~/todo-app/js/sync.js), eprouve depuis juillet 2026.
   - Sans jeton ou hors ligne : tout reste sur le telephone, rien n'est perdu.
   - Chaque synchro : lecture distante -> fusion -> ecriture si difference.
   - Conflit d'ecriture (sha perime) : relecture + refusion, 3 tentatives.
   - Fichier > 1 Mo : l'API ne renvoie plus le contenu inline, on le relit en brut. */
(function (root) {
  'use strict';

  const API = 'https://api.github.com';

  const Sync = {
    status: 'off',          /* off | syncing | ok | error */
    lastSync: null,
    lastError: '',
    _timer: null,
    _running: false,
    _pending: false,

    enabled: function () { const s = Store.settings; return !!(s.token && s.repo && s.owner); },

    schedule: function (delay) {
      if (!this.enabled()) return;
      clearTimeout(this._timer);
      const self = this;
      this._timer = setTimeout(function () { self.now('auto'); }, delay == null ? 3000 : delay);
    },

    now: async function () {
      if (!this.enabled()) { this.status = 'off'; this._emit(); return; }
      if (this._running) { this._pending = true; return; }
      clearTimeout(this._timer);
      this._running = true;
      this.status = 'syncing';
      this._emit();
      try {
        let remote = await this._get();
        let merged = Store.merge(Store.toDoc(), remote.doc);
        if (!remote.doc || Store.stable(Store.normalize(remote.doc)) !== Store.stable(merged)) {
          let sha = remote.sha;
          for (let i = 0; i < 3; i++) {
            try {
              await this._put(JSON.stringify(merged), sha);
              break;
            } catch (e) {
              if ((e.status === 409 || e.status === 422) && i < 2) {
                remote = await this._get();
                merged = Store.merge(Store.toDoc(), remote.doc);
                sha = remote.sha;
              } else { throw e; }
            }
          }
        }
        Store.applyDoc(merged);
        this.lastSync = new Date().toISOString();
        localStorage.setItem('muscu.lastSync', this.lastSync);
        this.status = 'ok';
        this.lastError = '';
      } catch (e) {
        this.status = 'error';
        this.lastError = this._explain(e);
        console.warn('sync', e);
      }
      this._running = false;
      this._emit();
      if (this._pending) {
        this._pending = false;
        const self = this;
        setTimeout(function () { self.now(); }, 1000);
      }
    },

    _headers: function (accept) {
      return {
        'Authorization': 'Bearer ' + Store.settings.token,
        'Accept': accept || 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      };
    },
    _url: function () {
      const s = Store.settings;
      return API + '/repos/' + s.owner + '/' + s.repo + '/contents/' + s.path;
    },

    _get: async function () {
      const url = this._url() + '?ref=' + encodeURIComponent(Store.settings.branch) + '&t=' + Date.now();
      const r = await this._fetch(url, { headers: this._headers(), cache: 'no-store' });
      if (r.status === 404) return { doc: null, sha: null };
      if (!r.ok) throw this._err(r);
      const j = await r.json();
      let text;
      if (j.content) {
        const bytes = Uint8Array.from(atob(j.content.replace(/\n/g, '')), function (c) { return c.charCodeAt(0); });
        text = new TextDecoder('utf-8').decode(bytes);
      } else if (j.size > 0) {
        const raw = await this._fetch(url, { headers: this._headers('application/vnd.github.raw+json'), cache: 'no-store' });
        if (!raw.ok) throw this._err(raw);
        text = await raw.text();
      } else { text = ''; }
      let doc = null;
      try { doc = JSON.parse(text); } catch (e) { doc = null; }
      /* Le fichier existe mais il est illisible : surtout ne pas l'ecraser avec les seules donnees du telephone. */
      if (!doc && text.trim()) { const err = new Error('illisible'); err.status = 'unreadable'; throw err; }
      return { doc: doc, sha: j.sha };
    },

    _put: async function (text, sha) {
      const bytes = new TextEncoder().encode(text);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      }
      const body = { message: 'sync ' + new Date().toISOString(), content: btoa(bin), branch: Store.settings.branch };
      if (sha) body.sha = sha;
      const r = await this._fetch(this._url(), { method: 'PUT', headers: this._headers(), body: JSON.stringify(body) });
      if (!r.ok) throw this._err(r);
      return r.json();
    },

    /* Reseau de salle de sport : un appel qui ne repond pas ne doit pas bloquer la copie pour toujours. */
    _fetch: async function (url, opts) {
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const t = ctl ? setTimeout(function () { ctl.abort(); }, 20000) : null;
      try { return await fetch(url, Object.assign({}, opts, ctl ? { signal: ctl.signal } : {})); }
      catch (e) { if (e && e.name === 'AbortError') { const err = new Error('délai dépassé'); err.status = 'timeout'; throw err; } throw e; }
      finally { if (t) clearTimeout(t); }
    },

    _err: function (r) { const e = new Error('GitHub ' + r.status); e.status = r.status; return e; },

    _explain: function (e) {
      if (!navigator.onLine) return 'Hors ligne : la copie reprendra toute seule.';
      if (e.status === 'timeout') return 'Réseau trop lent : la copie réessaiera toute seule.';
      if (e.status === 'unreadable') return 'Le fichier en ligne est illisible : rien n\'a été écrasé. Préviens Claude.';
      if (e.status === 401) return 'Jeton invalide ou expiré : vérifie-le ci-dessous.';
      if (e.status === 403) return 'Accès refusé par GitHub (droits du jeton ou limite atteinte).';
      if (e.status === 404) return 'Dépôt introuvable : le jeton a-t-il accès à ' + Store.settings.owner + '/' + Store.settings.repo + ' ?';
      return 'Erreur de copie (' + (e.message || e) + ').';
    },

    _emit: function () { Store.emit('sync-status'); },

    init: function () {
      this.lastSync = localStorage.getItem('muscu.lastSync') || null;
      const self = this;
      document.addEventListener('visibilitychange', function () {
        /* Au retour : on recupere. En quittant : on tente d'envoyer tout de suite. */
        if (self.enabled()) self.now();
      });
      window.addEventListener('online', function () { self.now(); });
      setInterval(function () { if (document.visibilityState === 'visible') self.now(); }, 5 * 60 * 1000);
      if (this.enabled()) this.now(); else this.status = 'off';
    }
  };

  root.Sync = Sync;
})(typeof self !== 'undefined' ? self : this);
