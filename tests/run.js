/* Tests sans dependance : node tests/run.js */
'use strict';
const assert = require('assert');
global.Seed = require('../js/seed.js');
const S = require('../js/stats.js');
const Store = require('../js/store.js');

let ok = 0, ko = 0;
function t(name, fn) {
  try { fn(); ok++; } catch (e) { ko++; console.error('ECHEC ' + name + '\n  ' + e.message); }
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, a + ' != ' + b);

/* Jeu de donnees : 2 seances de developpe couche, une la semaine d'avant. */
function sample() {
  const d = Store.emptyDoc();
  Seed.exercises().forEach(e => { d.exercises[e.id] = e; });
  const DC = 'x-developpe-couche-barre', TR = 'x-tractions';
  d.sessions.a = { id: 'a', name: 'Upper', start: '2026-11-04T18:00:00', end: '2026-11-04T19:00:00', updatedAt: 1,
    entries: [{ id: 'e1', exId: DC, target: 3, sets: [{ kg: 30, reps: 10, at: 1 }, { kg: 30, reps: 10, at: 2 }, { kg: 30, reps: 8, at: 3 }] },
      { id: 'e2', exId: TR, target: 3, sets: [{ kg: 0, reps: 8, at: 4 }] }] };
  d.sessions.b = { id: 'b', name: 'Upper', start: '2026-11-12T18:00:00', end: '2026-11-12T19:05:00', updatedAt: 1,
    entries: [{ id: 'e3', exId: DC, target: 3, sets: [{ kg: 32.5, reps: 8, at: 10 }, { kg: 30, reps: 12, at: 11 }] }] };
  d.sessions.z = { id: 'z', name: 'Supprimee', start: '2026-11-13T18:00:00', deleted: true, entries: [], updatedAt: 5 };
  return { d, DC, TR };
}

t('e1rm Epley, 1 rep = la charge, 0 = 0', () => {
  near(S.e1rm(100, 1), 100);
  near(S.e1rm(30, 10), 40);
  assert.strictEqual(S.e1rm(0, 10), 0);
  assert.strictEqual(S.e1rm(50, 0), 0);
});

t('derniere perf = seance la plus recente, hors seance exclue et supprimee', () => {
  const { d, DC } = sample();
  assert.strictEqual(S.lastPerf(d, DC).sessionId, 'b');
  assert.strictEqual(S.lastPerf(d, DC, 'b').sessionId, 'a');
  assert.strictEqual(S.lastPerf(d, DC, 'b').sets.length, 3);
  assert.strictEqual(S.lastPerf(d, 'x-hip-thrust'), null);
});

t('records : charge max et 1RM estime', () => {
  const { d, DC } = sample();
  const b = S.bests(d, DC);
  assert.strictEqual(b.maxKg, 32.5);
  near(b.maxE1rm, 42); /* 30 x 12 */
});

t('prCheck : charge battue, 1RM battu, egalite, premiere fois', () => {
  const { d, DC, TR } = sample();
  const b = d.sessions.b;
  assert.strictEqual(S.prCheck(d, DC, 'b', b.entries[0].sets[0]), 'kg');     /* 32,5 > 30 */
  assert.strictEqual(S.prCheck(d, DC, 'b', b.entries[0].sets[1]), 'e1rm');   /* 30x12 = 42 > 40 et > 32,5x8 = 41,2 */
  assert.strictEqual(S.prCheck(d, DC, 'a', d.sessions.a.entries[0].sets[1]), null); /* 30x10 apres 30x10 */
  assert.strictEqual(S.prCheck(d, DC, 'a', d.sessions.a.entries[0].sets[0]), null); /* premiere serie de toutes */
  assert.strictEqual(S.prCheck(d, TR, 'a', d.sessions.a.entries[1].sets[0]), null);
});

t('historique exercice chronologique avec volume et nombre de series', () => {
  const { d, DC } = sample();
  const hst = S.exerciseHistory(d, DC);
  assert.deepStrictEqual(hst.map(x => x.sessionId), ['a', 'b']);
  assert.strictEqual(hst[0].volume, 30 * 10 + 30 * 10 + 30 * 8);
  assert.strictEqual(hst[0].count, 3);
  assert.strictEqual(hst[1].maxKg, 32.5);
});

t('semaine = lundi 00:00, dimanche soir inclus dans la meme semaine', () => {
  const ws = S.weekStart('2026-11-16T23:30:00'); /* lundi */
  assert.strictEqual(ws.getDay(), 1); assert.strictEqual(ws.getDate(), 16);
  assert.strictEqual(S.weekStart('2026-11-22T22:00:00').getDate(), 16); /* dimanche */
  assert.strictEqual(S.weekStart('2026-11-15T10:00:00').getDate(), 9);
});

t('bilan hebdo : seances, series, tonnage, series par muscle', () => {
  const { d } = sample();
  const w = S.weekSummary(d, '2026-11-12T00:00:00');
  assert.strictEqual(w.sessions, 1);
  assert.strictEqual(w.sets, 2);
  assert.strictEqual(w.tonnage, 32.5 * 8 + 30 * 12);
  assert.deepStrictEqual(w.byMuscle, { Pectoraux: 2 });
  const p = S.weekSummary(d, '2026-11-04T00:00:00');
  assert.deepStrictEqual(p.byMuscle, { Pectoraux: 3, Dos: 1 });
  assert.strictEqual(p.tonnage, 840); /* traction au poids du corps = 0 */
});

t('resume de seance : records et duree', () => {
  const { d } = sample();
  const r = S.sessionSummary(d, d.sessions.b);
  assert.strictEqual(r.prs, 2);
  assert.strictEqual(r.duration, 65 * 60000);
});

t('fusion : le plus recent gagne, les deux cotes sont gardes, suppression propagee', () => {
  const a = Store.emptyDoc(), b = Store.emptyDoc();
  a.sessions.s1 = { id: 's1', name: 'local', updatedAt: 20 };
  b.sessions.s1 = { id: 's1', name: 'distant', updatedAt: 10 };
  a.templates.t1 = { id: 't1', name: 'Upper', updatedAt: 5 };
  b.templates.t1 = { id: 't1', deleted: true, updatedAt: 8 };
  b.exercises.x9 = { id: 'x9', name: 'Perso', updatedAt: 3 };
  const m = Store.merge(a, b);
  assert.strictEqual(m.sessions.s1.name, 'local');
  assert.strictEqual(m.templates.t1.deleted, true);
  assert.strictEqual(m.exercises.x9.name, 'Perso');
  assert.strictEqual(Store.merge(a, null).sessions.s1.name, 'local');
});

t('fusion commutative et idempotente', () => {
  const a = Store.emptyDoc(), b = Store.emptyDoc();
  a.sessions.s1 = { id: 's1', v: 1, updatedAt: 1 }; b.sessions.s2 = { id: 's2', v: 2, updatedAt: 2 };
  b.sessions.s1 = { id: 's1', v: 3, updatedAt: 3 };
  assert.strictEqual(Store.stable(Store.merge(a, b)), Store.stable(Store.merge(b, a)));
  const m = Store.merge(a, b);
  assert.strictEqual(Store.stable(Store.merge(m, m)), Store.stable(m));
});

t('stable ignore l\'ordre des cles', () => {
  assert.strictEqual(Store.stable({ b: 1, a: [2, { y: 1, x: 2 }] }), Store.stable({ a: [2, { x: 2, y: 1 }], b: 1 }));
});

t('bibliotheque : ~80 exercices, ids uniques, muscles connus', () => {
  const ex = Seed.exercises();
  assert.ok(ex.length >= 75, ex.length + ' exercices');
  assert.strictEqual(new Set(ex.map(e => e.id)).size, ex.length);
  ex.forEach(e => assert.ok(Seed.MUSCLES.includes(e.muscle)));
});

t('store.load ajoute les exercices manquants sans ressusciter un supprime', () => {
  const ls = {};
  global.localStorage = { getItem: k => ls[k] || null, setItem: (k, v) => { ls[k] = v; } };
  const d = Store.emptyDoc();
  d.exercises['x-curl-barre'] = { id: 'x-curl-barre', name: 'Curl barre', muscle: 'Biceps', deleted: true, updatedAt: 99 };
  ls['muscu.data.v1'] = JSON.stringify(d);
  Store.load();
  assert.strictEqual(Store.doc.exercises['x-curl-barre'].deleted, true);
  assert.ok(Store.doc.exercises['x-tractions']);
  delete global.localStorage;
});


t('records dans historique : une seance plus recente ne retire pas le badge', () => {
  const { d, DC } = sample();
  d.sessions.c = { id: 'c', name: 'Upper', start: '2026-11-15T18:00:00', end: '2026-11-15T19:00:00', updatedAt: 1,
    entries: [{ id: 'e9', exId: DC, target: 3, sets: [{ kg: 40, reps: 8, at: 20 }] }] };
  assert.strictEqual(S.prCheck(d, DC, 'b', d.sessions.b.entries[0].sets[0]), 'kg'); /* 32,5 reste un record le 12/11 */
  assert.strictEqual(S.prCheck(d, DC, 'c', d.sessions.c.entries[0].sets[0]), 'kg');
});

t('donnees mal formees (import) : jamais de plantage', () => {
  const n = Store.normalize({ sessions: { s: { id: 's', start: '2026-11-01T10:00:00', entries: [{ id: 'e', exId: 'x', sets: null }, null, { foo: 1 }] }, s2: { id: 's2' } },
    templates: { t: { id: 't', name: 'A' } } });
  assert.deepStrictEqual(n.sessions.s.entries.map(e => e.sets), [[]]);
  assert.deepStrictEqual(n.sessions.s2.entries, []);
  assert.ok(n.sessions.s2.start);
  assert.deepStrictEqual(n.templates.t.items, []);
});

console.log(ok + ' tests OK' + (ko ? ', ' + ko + ' en echec' : ''));
process.exit(ko ? 1 : 0);
