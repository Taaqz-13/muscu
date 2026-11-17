/* Calculs purs (aucun acces au DOM ni au stockage) : derniere perf, records,
   1RM estime, bilans hebdomadaires, historique d'un exercice.
   Teste par tests/stats.test.js. */
(function (root) {
  'use strict';

  const DAY = 86400000;

  function live(map) {
    return Object.keys(map || {}).map(function (k) { return map[k]; })
      .filter(function (o) { return o && !o.deleted; });
  }

  /* Seances visibles, de la plus ancienne a la plus recente. */
  function sessions(doc) {
    return live(doc.sessions).sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
  }

  /* 1RM estime (Epley). Une serie a 1 rep vaut sa charge. */
  function e1rm(kg, reps) {
    kg = +kg || 0; reps = +reps || 0;
    if (kg <= 0 || reps <= 0) return 0;
    return reps === 1 ? kg : kg * (1 + reps / 30);
  }

  function setsOf(session, exId) {
    let out = [];
    (session.entries || []).forEach(function (e) {
      if (e.exId === exId) out = out.concat(e.sets || []);
    });
    return out;
  }

  /* Derniere seance (hors seance exclue) ou l'exercice a au moins une serie. */
  function lastPerf(doc, exId, excludeSessionId) {
    const list = sessions(doc);
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (s.id === excludeSessionId) continue;
      const sets = setsOf(s, exId);
      if (sets.length) return { sessionId: s.id, date: s.start, sets: sets };
    }
    return null;
  }

  function bestsFrom(sets) {
    let maxKg = 0, maxE1 = 0;
    sets.forEach(function (st) {
      if ((+st.kg || 0) > maxKg) maxKg = +st.kg;
      const e = e1rm(st.kg, st.reps);
      if (e > maxE1) maxE1 = e;
    });
    return { maxKg: maxKg, maxE1rm: maxE1 };
  }

  function allSets(doc, exId) {
    let out = [];
    sessions(doc).forEach(function (s) { out = out.concat(setsOf(s, exId)); });
    return out;
  }

  function bests(doc, exId) { return bestsFrom(allSets(doc, exId)); }

  /* Record battu par `set` ? On compare a tout ce qui precede : les autres
     seances, plus les series de la seance en cours enregistrees avant elle.
     Premiere fois sur l'exercice = pas de record (rien a battre). */
  function prCheck(doc, exId, sessionId, set) {
    let prior = [];
    sessions(doc).forEach(function (s) {
      const sets = setsOf(s, exId);
      if (s.id !== sessionId) prior = prior.concat(sets);
      else prior = prior.concat(sets.filter(function (x) { return x !== set && x.at < set.at; }));
    });
    if (!prior.length) return null;
    const b = bestsFrom(prior);
    if ((+set.kg || 0) > b.maxKg) return 'kg';
    if (e1rm(set.kg, set.reps) > b.maxE1rm + 0.01) return 'e1rm';
    return null;
  }

  function volume(sets) {
    return sets.reduce(function (a, st) { return a + (+st.kg || 0) * (+st.reps || 0); }, 0);
  }

  /* Une ligne par seance ou l'exercice a ete fait, dans l'ordre chronologique. */
  function exerciseHistory(doc, exId) {
    const out = [];
    sessions(doc).forEach(function (s) {
      const sets = setsOf(s, exId);
      if (!sets.length) return;
      const b = bestsFrom(sets);
      out.push({
        sessionId: s.id, date: s.start, sets: sets,
        maxKg: b.maxKg, e1rm: b.maxE1rm, volume: volume(sets), count: sets.length,
        reps: sets.reduce(function (a, st) { return a + (+st.reps || 0); }, 0)
      });
    });
    return out;
  }

  /* Lundi 00:00 (heure locale) de la semaine contenant d. */
  function weekStart(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  /* Bilan d'une semaine : seances avec au moins une serie, series, tonnage,
     series par muscle principal. */
  function weekSummary(doc, ws) {
    const from = weekStart(ws).getTime();
    const to = addDays(new Date(from), 7).getTime();
    const res = { sessions: 0, sets: 0, tonnage: 0, reps: 0, byMuscle: {} };
    sessions(doc).forEach(function (s) {
      const t = new Date(s.start).getTime();
      if (t < from || t >= to) return;
      let n = 0;
      (s.entries || []).forEach(function (e) {
        const sets = e.sets || [];
        if (!sets.length) return;
        n += sets.length;
        const ex = doc.exercises[e.exId];
        const m = ex ? ex.muscle : 'Autre';
        res.byMuscle[m] = (res.byMuscle[m] || 0) + sets.length;
        res.tonnage += volume(sets);
        res.reps += sets.reduce(function (a, st) { return a + (+st.reps || 0); }, 0);
      });
      if (n) { res.sessions++; res.sets += n; }
    });
    return res;
  }

  function sessionSummary(doc, s) {
    let sets = 0, tonnage = 0, exos = 0, prs = 0;
    (s.entries || []).forEach(function (e) {
      const st = e.sets || [];
      if (st.length) exos++;
      sets += st.length;
      tonnage += volume(st);
      st.forEach(function (x) { if (prCheck(doc, e.exId, s.id, x)) prs++; });
    });
    const end = s.end ? new Date(s.end).getTime() : Date.now();
    return { sets: sets, tonnage: tonnage, exercises: exos, prs: prs, duration: Math.max(0, end - new Date(s.start).getTime()) };
  }

  const Stats = {
    DAY: DAY, live: live, sessions: sessions, e1rm: e1rm, setsOf: setsOf, lastPerf: lastPerf,
    bests: bests, prCheck: prCheck, volume: volume, exerciseHistory: exerciseHistory,
    weekStart: weekStart, addDays: addDays, weekSummary: weekSummary, sessionSummary: sessionSummary
  };
  root.Stats = Stats;
  if (typeof module !== 'undefined' && module.exports) module.exports = Stats;
})(typeof self !== 'undefined' ? self : this);
