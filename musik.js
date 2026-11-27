// Songbook: Musiktheorie, Griffe, Griffbilder und Klang.
// Kopie von web/musik.js aus „Songwriting & Chords“ (../Akkordfolgen-fuer-Songwriter), dazu die Akkordtypen 7sus4 und maj9,
// die in den Songs vorkommen. Wer dort an Griffen, Griffbildern oder Klang etwas verbessert, prüft, ob es hierher gehört.
//
// Die Regeln stammen aus den Python-Skripten des Projekts:
//   skripte/akkorde.py          Akkordtypen, Stimmungen, check(), fingers()
//   skripte/griffe_erzeugen.py  Barré-Formen, ohne Barré, leere Saiten, Ukulele-Suche
//   skripte/folgen_tabelle.py   Stufen → Akkordnamen in jeder Tonart
//   skripte/zeichnen.py         Aussehen der Griffbilder
// Die festen Griffe kommen über web/daten.js aus skripte/griffe_*.py.
// Die Datei läuft im Browser und in osascript (skripte/web_pruefen.js), daher ohne DOM-Zugriff beim Laden.

var SC = (function () {
  'use strict';
  var D = (typeof SC_DATEN !== 'undefined') ? SC_DATEN : null;
  var mod = function (a, n) { return ((a % n) + n) % n; };

  // ------------------------------------------------------------------ Grundlagen (akkorde.py)
  var PC_NAME = ['C', 'C#', 'D', 'E♭', 'E', 'F', 'F#', 'G', 'A♭', 'A', 'B♭', 'H'];
  var ROOT_LABELS = ['C', 'C# / D♭', 'D', 'E♭ / D#', 'E', 'F', 'F# / G♭', 'G', 'A♭ / G#', 'A', 'B♭', 'H'];
  var LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, H: 11, B: 11 };
  // Intervalle, Pflichttöne (die übrigen dürfen fehlen)
  var TYPES = {
    '':       [[0, 4, 7], [0, 4, 7]],
    'm':      [[0, 3, 7], [0, 3, 7]],
    '7':      [[0, 4, 7, 10], [0, 4, 10]],
    'm7':     [[0, 3, 7, 10], [0, 3, 10]],
    'maj7':   [[0, 4, 7, 11], [0, 4, 11]],
    '6':      [[0, 4, 7, 9], [0, 4, 9]],
    'm6':     [[0, 3, 7, 9], [0, 3, 9]],
    '9':      [[0, 4, 7, 10, 2], [0, 4, 10, 2]],
    'sus4':   [[0, 5, 7], [0, 5, 7]],
    '°7':     [[0, 3, 6, 9], [0, 3, 6, 9]],
    '+':      [[0, 4, 8], [0, 4, 8]],
    '5':      [[0, 7], [0, 7]],
    'sus2':   [[0, 2, 7], [0, 2, 7]],
    'add9':   [[0, 4, 7, 2], [0, 4, 2]],
    'm9':     [[0, 3, 7, 10, 2], [0, 3, 10, 2]],
    'm7♭5':   [[0, 3, 6, 10], [0, 3, 6, 10]],
    '7#9':    [[0, 4, 7, 10, 3], [0, 4, 10, 3]],
    // zusätzlich für die Web-App
    '°':      [[0, 3, 6], [0, 3, 6]],
    '7♭9':    [[0, 4, 7, 10, 1], [0, 4, 10, 1]],
    'm(add9)': [[0, 3, 7, 2], [0, 3, 2]],
    // zusätzlich für das Songbook
    '7sus4':  [[0, 5, 7, 10], [0, 5, 10]],
    'maj9':   [[0, 4, 7, 11, 2], [0, 4, 11, 2]],
    // zusätzlich für Songbook und Biene Meier
    '7♭13':   [[0, 4, 7, 10, 8], [0, 4, 10, 8]],
  };
  var TYPE_NAMES = {
    '': 'Dur', 'm': 'Moll', '7': '7', 'm7': 'm7', 'maj7': 'maj7', '6': '6', 'm6': 'm6', '9': '9',
    'sus4': 'sus4', 'sus2': 'sus2', 'add9': 'add9', 'm(add9)': 'm(add9)', 'm9': 'm9', '5': '5 (Power)',
    '°': '° (vermindert)', '°7': '°7 (dim7)', 'm7♭5': 'm7♭5 (ø)', '+': '+ (aug)', '7#9': '7#9', '7♭9': '7♭9', '7sus4': '7sus4', 'maj9': 'maj9', '7♭13': '7♭13',
  };
  var TUNING = { gitarre: [4, 9, 2, 7, 11, 4], ukulele: [7, 0, 4, 9] };
  var MIDI = { gitarre: [40, 45, 50, 55, 59, 64], ukulele: [67, 60, 64, 69] };
  var SAITEN = { gitarre: 'E A D G H e', ukulele: 'G C E A' };
  var GUITAR = TUNING.gitarre, UKE = TUNING.ukulele;

  function parse(s, n) {
    var parts = s.trim().indexOf(' ') >= 0 ? s.trim().split(/\s+/) : s.trim().split('');
    if (parts.length !== n) throw new Error('Griff ' + s + ' hat nicht ' + n + ' Saiten');
    return parts.map(function (p) { return (p === 'x' || p === 'X') ? null : parseInt(p, 10); });
  }
  function fs(frets) { return frets.map(function (f) { return f === null ? 'x' : String(f); }).join(' '); }
  function fretted(frets) { return frets.filter(function (f) { return f; }); }
  function sounding(frets) { return frets.filter(function (f) { return f !== null; }).length; }
  function same(a, b) { return a.length === b.length && a.every(function (x, i) { return x === b[i]; }); }
  function bassPc(frets, tuning) {
    for (var i = 0; i < frets.length; i++) if (frets[i] !== null) return mod(tuning[i] + frets[i], 12);
    return null;
  }
  function lexLess(a, b) {
    for (var i = 0; i < Math.min(a.length, b.length); i++) {
      var x = a[i], y = b[i];
      if (x === y) continue;
      if (x === null) return true;
      if (y === null) return false;
      return x < y;
    }
    return a.length < b.length;
  }
  function lexCmp(a, b) { return lexLess(a, b) ? -1 : (lexLess(b, a) ? 1 : 0); }
  function max(a) { return Math.max.apply(null, a); }
  function min(a) { return Math.min.apply(null, a); }

  function check(root, typ, frets, tuning, rootBass, allowNoRoot) {
    if (rootBass === undefined) rootBass = true;
    var t = TYPES[typ];
    var tones = t[0].map(function (i) { return mod(root + i, 12); });
    var reqt = t[1].map(function (i) { return mod(root + i, 12); });
    var played = [];
    frets.forEach(function (f, i) { if (f !== null) played.push(mod(tuning[i] + f, 12)); });
    var errs = [];
    if (played.some(function (p) { return tones.indexOf(p) < 0; })) errs.push('falsche Töne');
    var missing = reqt.filter(function (r) { return played.indexOf(r) < 0; });
    if (missing.length && !(allowNoRoot && missing.every(function (m) { return m === root; }))) errs.push('fehlende Töne');
    if (rootBass && bassPc(frets, tuning) !== root) errs.push('Grundton nicht im Bass');
    var fr = fretted(frets);
    if (fr.length && max(fr) - min(fr) > 4) errs.push('Spannweite > 4');
    return errs;
  }

  function fingers(frets) {
    var fr = fretted(frets);
    if (!fr.length) return 0;
    var best = fr.length, n = frets.length;
    var vals = fr.filter(function (v, i) { return fr.indexOf(v) === i; });
    vals.forEach(function (v) {
      for (var a = 0; a < n; a++) for (var b = a + 1; b < n; b++) {
        if (frets[a] !== v || frets[b] !== v) continue;
        var ok = true, cov = 0;
        for (var k = a; k <= b; k++) {
          if (frets[k] === null || frets[k] < v) { ok = false; break; }
          if (frets[k] === v) cov++;
        }
        if (ok) best = Math.min(best, 1 + fr.length - cov);
      }
    });
    return best;
  }

  // Alle Kombinationen wie itertools.product (erste Stelle läuft am langsamsten)
  function product(values, repeat, cb) {
    var cur = new Array(repeat);
    (function rec(i) {
      if (i === repeat) { cb(cur.slice()); return; }
      for (var j = 0; j < values.length; j++) { cur[i] = values[j]; rec(i + 1); }
    })(0);
  }
  function combinations(arr, k, cb) {
    var cur = [];
    (function rec(start) {
      if (cur.length === k) { cb(cur.slice()); return; }
      for (var i = start; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1); cur.pop(); }
    })(0);
  }
  function range(a, b) { var r = []; for (var i = a; i <= b; i++) r.push(i); return r; }

  // ------------------------------------------------------------------ Barré-Formen (griffe_erzeugen.py)
  var E_FORM = { '': [0, 2, 2, 1, 0, 0], 'm': [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0], 'm7': [0, 2, 0, 0, 0, 0], 'maj7': [0, null, 1, 1, 0, null], 'sus4': [0, 2, 2, 2, 0, 0] };
  var A_FORM = { '': [null, 0, 2, 2, 2, 0], 'm': [null, 0, 2, 2, 1, 0], '7': [null, 0, 2, 0, 2, 0], 'm7': [null, 0, 2, 0, 1, 0], 'maj7': [null, 0, 2, 1, 2, 0], 'sus4': [null, 0, 2, 2, 3, 0] };
  var BARRE_TYPES = ['', 'm', '7', 'm7', 'maj7', 'sus4'];
  function pos(root, openPc) { var r = mod(root - openPc, 12); return r === 0 ? 12 : r; }
  function shape(form, r) { return form.map(function (v) { return v === null ? null : v + r; }); }

  // ------------------------------------------------------------------ ohne Barré (Gitarre)
  function triadVoicing(root, minor, strings, inv) {
    var tones = [root, mod(root + (minor ? 3 : 4), 12), mod(root + 7, 12)];
    var sortedT = tones.slice().sort(function (a, b) { return a - b; });
    var best = null;
    product(range(1, 16), 3, function (fr) {
      var pcs = strings.map(function (s, i) { return mod(GUITAR[s] + fr[i], 12); });
      var sp = pcs.slice().sort(function (a, b) { return a - b; });
      if (!same(sp, sortedT) || pcs[0] !== tones[inv]) return;
      var lo = min(fr), hi = max(fr);
      if (hi - lo > 3 || !(lo >= 2 && lo <= 13)) return;
      var key = [hi - lo, lo];
      if (best === null || lexLess(key, best.key)) best = { key: key, fr: fr };
    });
    var frets = [null, null, null, null, null, null];
    strings.forEach(function (s, i) { frets[s] = best.fr[i]; });
    return frets;
  }
  function dform(root, minor) {
    var r = mod(root - 2, 12);
    if (r < 2) r += 12;
    return [null, null, r, r + 2, r + 3, r + (minor ? 1 : 2)];
  }
  var TOP = [3, 4, 5], MID = [2, 3, 4];
  var NOBARRE_COLS = [
    ['G H e · Grundstellung', function (k, m) { return triadVoicing(k, m, TOP, 0); }],
    ['G H e · 1. Umkehrung', function (k, m) { return triadVoicing(k, m, TOP, 1); }],
    ['G H e · 2. Umkehrung', function (k, m) { return triadVoicing(k, m, TOP, 2); }],
    ['D G H · Grundstellung', function (k, m) { return triadVoicing(k, m, MID, 0); }],
    ['D G H · 1. Umkehrung', function (k, m) { return triadVoicing(k, m, MID, 1); }],
    ['D G H · 2. Umkehrung', function (k, m) { return triadVoicing(k, m, MID, 2); }],
    ['D-Form · 4 Saiten', function (k, m) { return dform(k, m); }],
  ];

  // ------------------------------------------------------------------ Ukulele-Suche
  function ukeSearch(root, typ, maxfret, minpos, noOpen, exclude, allowNoRoot) {
    if (maxfret === undefined) maxfret = 12;
    minpos = minpos || 0;
    var res = [];
    product(range(0, maxfret), 4, function (frets) {
      if (noOpen && frets.indexOf(0) >= 0) return;
      var fr = fretted(frets);
      if (fr.length && max(fr) - min(fr) > 3) return;
      if (fr.length && min(fr) < minpos) return;
      if (check(root, typ, frets, UKE, false, allowNoRoot).length) return;
      var n = fingers(frets);
      if (n > 4) return;
      if (exclude && same(frets, exclude)) return;
      res.push({ key: [fr.length ? max(fr) : 0, n, fr.length ? max(fr) - min(fr) : 0], f: frets });
    });
    res.sort(function (a, b) { return lexCmp(a.key, b.key) || lexCmp(a.f, b.f); });
    return res.map(function (r) { return r.f; });
  }
  function uke9(root) {
    var withRoot = ukeSearch(root, '9');
    if (withRoot.length && max(fretted(withRoot[0])) <= 4) return [withRoot[0], false];
    return [ukeSearch(root, '9', 12, 0, false, null, true)[0], true];
  }
  function ukeAlt(root, typ) {
    var base = parse(D.ukulele.griffe[PC_NAME[root]][D.ukulele.typen.indexOf(typ)], 4);
    var r = ukeSearch(root, typ, 14, 3, true);
    for (var i = 0; i < r.length; i++) if (!same(r[i], base)) return r[i];
    return null;
  }
  function ukeNobarre(root, minor, lo, hi, sameMax) {
    sameMax = sameMax || 2;
    var typ = minor ? 'm' : '';
    var best = null;
    product(range(1, 15), 4, function (fr) {
      var a = min(fr), b = max(fr);
      if (b - a > 3 || !(lo <= a && a <= hi)) return;
      if (check(root, typ, fr, UKE, false).length) return;
      var cnt = max(fr.map(function (f) { return fr.filter(function (x) { return x === f; }).length; }));
      if (cnt > sameMax) return;
      var key = [b - a, a];
      if (best === null || lexLess(key, best.key)) best = { key: key, fr: fr };
    });
    if (best === null && sameMax === 2) return ukeNobarre(root, minor, lo, hi, 3);
    return best ? best.fr : null;
  }

  // ------------------------------------------------------------------ leere Saiten
  function openSearch(root, typ, tuning, minSound, maxFingers, maxfret, span, bassMute) {
    if (maxFingers === undefined) maxFingers = 3;
    if (maxfret === undefined) maxfret = 15;
    if (span === undefined) span = 3;
    if (bassMute === undefined) bassMute = 2;
    var n = tuning.length, t = TYPES[typ];
    var tones = t[0].map(function (i) { return mod(root + i, 12); });
    var reqt = t[1].map(function (i) { return mod(root + i, 12); });
    var out = [];
    for (var m = 0; m <= bassMute; m++) {
      if (n - m < minSound) break;
      var strings = range(m, n - 1);
      for (var k = 2; k <= maxFingers; k++) {
        combinations(strings, k, function (subset) {
          product(range(1, maxfret), k, function (fr) {
            if (max(fr) - min(fr) > span) return;
            var frets = [];
            for (var i = 0; i < n; i++) frets.push(i < m ? null : 0);
            subset.forEach(function (s, i) { frets[s] = fr[i]; });
            var played = [];
            for (var j = 0; j < n; j++) if (frets[j] !== null) played.push(mod(tuning[j] + frets[j], 12));
            if (played.some(function (p) { return tones.indexOf(p) < 0; })) return;
            if (!reqt.every(function (r) { return played.indexOf(r) >= 0; })) return;
            out.push(frets);
          });
        });
      }
    }
    return out;
  }
  var KNOWN = {};
  function known(inst) {
    if (KNOWN[inst]) return KNOWN[inst];
    var list = [];
    if (inst === 'gitarre') {
      [D.gitarre.griffe, D.gitarre.erw].forEach(function (tab) {
        Object.keys(tab).forEach(function (k) { tab[k].forEach(function (s) { list.push(parse(s, 6)); }); });
      });
    } else {
      Object.keys(D.ukulele.griffe).forEach(function (k) {
        D.ukulele.griffe[k].forEach(function (s) { if (s) list.push(parse(s, 4)); });
      });
    }
    return (KNOWN[inst] = list);
  }
  function score(frets, tuning, root) {
    var fr = fretted(frets);
    return [-sounding(frets), bassPc(frets, tuning) === root ? 0 : 1, fr.length, max(fr) - min(fr)];
  }
  function isKnown(c, knownList) {
    for (var i = 0; i < knownList.length; i++) {
      var k = knownList[i];
      if (c.every(function (f, j) { return f === null || f === k[j]; }) && sounding(c) >= sounding(k) - 1) return true;
    }
    return false;
  }
  function pick(cands, tuning, root, knownList, n, gap) {
    n = n || 4; gap = gap || 3;
    cands = cands.filter(function (c) { return !isKnown(c, knownList); });
    var scored = cands.map(function (c) { return { s: score(c, tuning, root), f: c }; });
    scored.sort(function (a, b) { return lexCmp(a.s, b.s); });
    var chosen = [];
    for (var i = 0; i < scored.length; i++) {
      var c = scored[i].f, p = min(fretted(c));
      if (chosen.every(function (x) { return Math.abs(p - min(fretted(x))) >= gap; })) chosen.push(c);
      if (chosen.length === n) break;
    }
    chosen.sort(function (a, b) { return min(fretted(a)) - min(fretted(b)); });
    return chosen;
  }
  var OPEN_COLOUR_TYPES = ['sus2', 'sus4', 'add9', 'maj7', '7', 'm7', '6'];
  function openColour(root, typ) {
    var cands = openSearch(root, typ, GUITAR, 5);
    var keyed = cands.map(function (f) {
      var fr = fretted(f);
      return { k: [-sounding(f), bassPc(f, GUITAR) === root ? 0 : 1, max(fr) > 12 ? 1 : 0, fr.length, max(fr) - min(fr), min(fr)], f: f };
    });
    keyed.sort(function (a, b) { return lexCmp(a.k, b.k); });
    for (var i = 0; i < keyed.length; i++) if (max(fretted(keyed[i].f)) <= 12) return keyed[i].f;
    return null;
  }

  // ------------------------------------------------------------------ Griffe aus dem Projekt, je Grundton und Typ
  // k: grund | barre | ohne | leer | hoch | extra
  var KAT_NAMEN = { grund: 'Grundgriffe', barre: 'Barré', ohne: 'ohne Barré', leer: 'leere Saiten', hoch: 'höhere Lage', extra: 'weitere Lagen' };
  var memoK = {};
  function kuratiert(inst, root, typ) {
    var key = inst + '|' + root + '|' + typ;
    if (memoK[key]) return memoK[key];
    var list = [];
    function add(frets, k, q, og) {
      if (!frets) return;
      if (list.some(function (v) { return same(v.f, frets); })) return;
      var v = { f: frets, k: k, q: q };
      if (og) v.og = true;
      list.push(v);
    }
    var rk = PC_NAME[root], i;
    if (inst === 'gitarre') {
      i = D.gitarre.typen.indexOf(typ);
      if (i >= 0) add(parse(D.gitarre.griffe[rk][i], 6), 'grund', 'Grundgriff');
      i = D.gitarre.erwTypen.indexOf(typ);
      if (i >= 0) add(parse(D.gitarre.erw[rk][i], 6), 'grund', 'Grundgriff');
      if (BARRE_TYPES.indexOf(typ) >= 0) {
        add(shape(E_FORM[typ], pos(root, 4)), 'barre', 'Barré E-Form');
        add(shape(A_FORM[typ], pos(root, 9)), 'barre', 'Barré A-Form');
      }
      if (typ === '' || typ === 'm') {
        var minor = typ === 'm';
        NOBARRE_COLS.forEach(function (c) { add(c[1](root, minor), 'ohne', 'ohne Barré · ' + c[0]); });
        pick(openSearch(root, typ, GUITAR, 5), GUITAR, root, known('gitarre')).forEach(function (f) { add(f, 'leer', 'leere Saiten'); });
      }
      if (OPEN_COLOUR_TYPES.indexOf(typ) >= 0) add(openColour(root, typ), 'leer', 'leere Saiten');
    } else {
      i = D.ukulele.typen.indexOf(typ);
      if (i >= 0 && D.ukulele.griffe[rk][i]) add(parse(D.ukulele.griffe[rk][i], 4), 'grund', 'Grundgriff');
      if (typ === '9') { var u9 = uke9(root); add(u9[0], 'grund', u9[1] ? 'Grundgriff · ohne Grundton' : 'Grundgriff', u9[1]); }
      if (['', 'm', '7', 'm7'].indexOf(typ) >= 0) add(ukeAlt(root, typ), 'hoch', 'höhere Lage');
      if (typ === '' || typ === 'm') {
        add(ukeNobarre(root, typ === 'm', 2, 6), 'ohne', 'ohne Barré · mittlere Lage');
        add(ukeNobarre(root, typ === 'm', 7, 12), 'ohne', 'ohne Barré · hohe Lage');
        pick(openSearch(root, typ, UKE, 4, 3, 15, 3, 0), UKE, root, known('ukulele'), 2, 4).forEach(function (f) { add(f, 'leer', 'leere Saiten'); });
      }
    }
    return (memoK[key] = list);
  }

  // ------------------------------------------------------------------ freie Griffsuche (für alles, was das Projekt nicht abdeckt)
  // Sucht spielbare Griffe in Fenstern von vier Bünden, prüft wie check() und fingers().
  function suche(inst, tones, req, bass, minSound, isPower) {
    var tuning = TUNING[inst], n = tuning.length, uke = inst === 'ukulele';
    var seen = {}, res = [];
    for (var p = 0; p <= 11; p++) {
      var lo = p === 0 ? 1 : p;
      var opts = uke ? [0] : [null, 0];
      for (var f = lo; f <= lo + 3; f++) opts.push(f);
      var cur = new Array(n);
      (function rec(i, started) {
        if (i === n) { bewerte(cur.slice()); return; }
        for (var j = 0; j < opts.length; j++) {
          var o = opts[j];
          if (o !== null) {
            var pc = mod(tuning[i] + o, 12);
            if (tones.indexOf(pc) < 0) continue;
            if (!uke && !started && bass !== null && pc !== bass) continue;
          }
          cur[i] = o;
          rec(i + 1, started || o !== null);
        }
      })(0, false);
    }
    function bewerte(fr) {
      var key = fr.join(',');
      if (seen[key]) return;
      seen[key] = 1;
      var played = [];
      fr.forEach(function (f, i) { if (f !== null) played.push(mod(tuning[i] + f, 12)); });
      if (played.length < minSound) return;
      if (!req.every(function (r) { return played.indexOf(r) >= 0; })) return;
      var first = fr.findIndex(function (f) { return f !== null; });
      var last = n - 1 - fr.slice().reverse().findIndex(function (f) { return f !== null; });
      var lead = first, trail = n - 1 - last, inner = 0;
      for (var i = first; i <= last; i++) if (fr[i] === null) inner++;
      if (!uke && (lead > (isPower ? 3 : 2) || trail > (isPower ? 3 : 1) || inner > 1)) return;
      var nf = fingers(fr);
      if (nf > 4) return;
      var frd = fretted(fr);
      if (frd.length && max(frd) - min(frd) > 3) return;
      var posi = frd.length ? min(frd) : 0;
      var opens = fr.filter(function (f) { return f === 0; }).length;
      if (inner && opens) return;                   // abgedämpfte Saite mitten im Griff plus leere Saiten: kaum spielbar
      var s = posi * 1.1 + nf * 0.9 + inner * 4 + (lead + trail) * 0.6 - played.length * 0.7 + (posi <= 3 ? -opens * 0.4 : opens * 0.9);
      if (bass !== null && !uke && played[0] !== bass) s += 5;
      res.push({ f: fr, s: s, p: posi });
    }
    res.sort(function (a, b) { return a.s - b.s; });
    return res;
  }
  function vielfalt(cands, vorhanden, anzahl) {
    var out = [];
    for (var i = 0; i < cands.length && out.length < anzahl; i++) {
      var c = cands[i];
      if (vorhanden.some(function (v) { return same(v, c.f); })) continue;
      if (out.some(function (o) { return Math.abs(o.p - c.p) < 2; })) continue;
      out.push(c);
    }
    return out.map(function (c) { return c.f; });
  }

  // ------------------------------------------------------------------ Akkordnamen lesen
  function parseAkkord(name) {
    var m = name.match(/^([A-H])(#|♭)?([^/]*)(?:\/([A-H])(#|♭)?)?$/);
    if (!m) return null;
    var acc = function (a) { return a === '#' ? 1 : (a === '♭' ? -1 : 0); };
    var root = mod(LETTER_PC[m[1]] + acc(m[2]), 12);
    var bass = m[4] ? mod(LETTER_PC[m[4]] + acc(m[5]), 12) : null;
    if (bass === root) bass = null;
    return { root: root, rootName: m[1] + (m[2] || ''), typ: m[3], bass: bass, bassName: m[4] ? m[4] + (m[5] || '') : null };
  }
  function tonesOf(a) {
    var t = TYPES[a.typ];
    if (!t) return null;
    var tones = t[0].map(function (i) { return mod(a.root + i, 12); });
    var req = t[1].map(function (i) { return mod(a.root + i, 12); });
    if (a.bass !== null && tones.indexOf(a.bass) < 0) { tones.push(a.bass); req.push(a.bass); }
    return { tones: tones, req: req };
  }

  // Alle Griffe für einen Akkordnamen. Ergebnis: Liste von {f, k, q, og?, n?} plus .hinweis
  var memoV = {};
  function varianten(inst, name) {
    var key = inst + '|' + name;
    if (memoV[key]) return memoV[key];
    var a = parseAkkord(name), list = [], hinweis = null;
    if (!a || !TYPES[a.typ]) { list.hinweis = 'unbekannter Akkord'; return (memoV[key] = list); }
    var tuning = TUNING[inst];
    var kur = kuratiert(inst, a.root, a.typ);
    if (a.bass === null || inst === 'ukulele') {
      list = kur.slice();
      if (a.bass !== null) hinweis = 'Auf der Ukulele greifst du ' + a.rootName + a.typ + '. Den Basston ' + a.bassName + ' übernimmt der Bass oder die Gitarre.';
    } else {
      list = kur.filter(function (v) { return bassPc(v.f, tuning) === a.bass; });
    }
    var ziel = inst === 'gitarre' ? 6 : 5;
    if (list.length < ziel) {
      var t = tonesOf(inst === 'ukulele' ? { root: a.root, typ: a.typ, bass: null } : a);
      var minSound = inst === 'ukulele' ? 4 : ((a.typ === '5' || a.typ === '°') ? 3 : 4);
      var bass = inst === 'gitarre' ? (a.bass !== null ? a.bass : a.root) : null;
      var gen = suche(inst, t.tones, t.req, bass, minSound, a.typ === '5');
      vielfalt(gen, list.map(function (v) { return v.f; }), ziel - list.length).forEach(function (f) {
        list.push({ f: f, k: 'extra', q: 'weitere Lage' });
      });
    }
    // Name, wie der Griff klingt (z. B. C/E bei leeren Saiten)
    list = list.map(function (v) {
      var b = bassPc(v.f, tuning);
      var c = { f: v.f, k: v.k, q: v.q };
      if (v.og) c.og = true;
      if (inst === 'gitarre' && b !== null && b !== a.root && (a.bass === null || b !== a.bass)) c.n = a.rootName + a.typ + '/' + bassName(a.rootName, b);
      return c;
    });
    list.hinweis = hinweis;
    return (memoV[key] = list);
  }

  // Nur der erste Griff, ohne alles durchzurechnen (für den Kapo-Vorschlag)
  function grundgriff(inst, name) {
    var a = parseAkkord(name);
    if (!a || !TYPES[a.typ]) return null;
    if (a.bass === null || inst === 'ukulele') {
      var rk = PC_NAME[a.root], i;
      if (inst === 'gitarre') {
        i = D.gitarre.typen.indexOf(a.typ);
        if (i >= 0) return { f: parse(D.gitarre.griffe[rk][i], 6), k: 'grund' };
        i = D.gitarre.erwTypen.indexOf(a.typ);
        if (i >= 0) return { f: parse(D.gitarre.erw[rk][i], 6), k: 'grund' };
      } else {
        i = D.ukulele.typen.indexOf(a.typ);
        if (i >= 0 && D.ukulele.griffe[rk][i]) return { f: parse(D.ukulele.griffe[rk][i], 4), k: 'grund' };
      }
    }
    return varianten(inst, name)[0] || null;
  }

  // ------------------------------------------------------------------ Stufen → Akkordnamen (folgen_tabelle.py)
  var LETTERS = 'CDEFGAB';
  var NAT = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  var MAJOR = [0, 2, 4, 5, 7, 9, 11];
  var ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7 };
  var ROMAN_PC = ['I', '♭II', 'II', '♭III', 'III', 'IV', '#IV', 'V', '♭VI', 'VI', '♭VII', 'VII'];
  // Tonarten wie im Dokument: Dur C G D A E H Fis Des As Es B F, Moll c g d a e h fis cis gis dis b f
  var DUR_KEYS = [['C', 0, 'C-Dur'], ['D', -1, 'Des-Dur'], ['D', 0, 'D-Dur'], ['E', -1, 'Es-Dur'], ['E', 0, 'E-Dur'], ['F', 0, 'F-Dur'],
    ['F', 1, 'Fis-Dur'], ['G', 0, 'G-Dur'], ['A', -1, 'As-Dur'], ['A', 0, 'A-Dur'], ['B', -1, 'B-Dur (B♭)'], ['B', 0, 'H-Dur']];
  var MOLL_KEYS = [['C', 0, 'c-Moll'], ['C', 1, 'cis-Moll'], ['D', 0, 'd-Moll'], ['D', 1, 'dis-Moll'], ['E', 0, 'e-Moll'], ['F', 0, 'f-Moll'],
    ['F', 1, 'fis-Moll'], ['G', 0, 'g-Moll'], ['G', 1, 'gis-Moll'], ['A', 0, 'a-Moll'], ['B', -1, 'b-Moll (B♭m)'], ['B', 0, 'h-Moll']];

  function spell(letter, acc) {
    var pc = mod(NAT[letter] + acc, 12);
    if (Math.abs(acc) > 1 || (letter === 'C' && acc === -1) || (letter === 'F' && acc === -1) ||
        (letter === 'E' && acc === 1) || (letter === 'B' && acc === 1)) return PC_NAME[pc];
    if (letter === 'B') return acc === 0 ? 'H' : 'B♭';
    return letter + (acc === 1 ? '#' : (acc === -1 ? '♭' : ''));
  }
  function letterOf(name) { return name[0] === 'H' ? 'B' : (name[0] === 'B' ? 'B' : name[0]); }
  // Basston eines Slash-Akkords passend zum Akkord benennen (E/G#, nicht E/A♭)
  function bassName(rootName, bpc, stufe) {
    var rpc = mod(LETTER_PC[rootName[0]] + (rootName[1] === '#' ? 1 : (rootName[1] === '♭' ? -1 : 0)), 12);
    var iv = mod(bpc - rpc, 12);
    var step = stufe !== undefined ? stufe : [0, 1, 1, 2, 2, 3, 4, 4, 4, 5, 6, 6][iv];
    var L = LETTERS[(LETTERS.indexOf(letterOf(rootName)) + step) % 7];
    var a = mod(bpc - NAT[L], 12);
    if (a > 6) a -= 12;
    return spell(L, a);
  }
  function key(pc, moll) { var k = (moll ? MOLL_KEYS : DUR_KEYS)[mod(pc, 12)]; return { letter: k[0], acc: k[1], name: k[2], pc: mod(pc, 12), moll: !!moll }; }
  function relDur(k) {
    var L = LETTERS[(LETTERS.indexOf(k.letter) + 2) % 7];
    var a = mod(k.pc + 3 - NAT[L], 12);
    if (a > 6) a -= 12;
    return { letter: L, acc: a, pc: mod(k.pc + 3, 12), name: DUR_KEYS[mod(k.pc + 3, 12)][2], moll: false };
  }
  function parseStufe(tok) {
    var m = tok.match(/^([♭b#]?)([IViv]+)(\S*)$/);
    if (!m || !ROMAN[m[2].toUpperCase()]) throw new Error('Stufe nicht erkannt: ' + tok);
    return { acc: m[1] === '#' ? 1 : (m[1] ? -1 : 0), num: m[2], suffix: m[3] };
  }
  function stufenTon(acc, num, k) {
    var deg = ROMAN[num.toUpperCase()];
    var L = LETTERS[(LETTERS.indexOf(k.letter) + deg - 1) % 7];
    var target = mod(NAT[k.letter] + k.acc + MAJOR[deg - 1] + acc, 12);
    var a = mod(target - NAT[L], 12);
    if (a > 6) a -= 12;
    return spell(L, a);
  }
  function stufeZuAkkord(tok, k) {
    var teile = tok.split('/');
    var p = parseStufe(teile[0]);
    var name = stufenTon(p.acc, p.num, k);
    var minor = p.num === p.num.toLowerCase();
    var s = p.suffix, q;
    if (s.charAt(0) === '°') q = s;
    else if (s.charAt(0) === 'ø') q = 'm7♭5' + s.replace(/^ø7?/, '');
    else if (s.charAt(0) === '5') q = s;
    else if (minor && /^m(?!aj)/.test(s)) q = s;          // im7, ivm9: das m steht schon da
    else q = (minor ? 'm' : '') + s;
    var out = name + q;
    if (teile[1]) { var b = parseStufe(teile[1]); out += '/' + stufenTon(b.acc, b.num, k); }
    return out;
  }
  // Stufe von der Dur-Tonart aus → vom Moll-Grundton (vi) aus, z. B. IV → ♭VI
  function stufeMoll(tok) {
    return tok.split('/').map(function (t) {
      var p = parseStufe(t);
      var pc = mod(MAJOR[ROMAN[p.num.toUpperCase()] - 1] + p.acc - 9, 12);
      var r = ROMAN_PC[pc];
      var lower = p.num === p.num.toLowerCase();
      var acc = r.replace(/[IV]+/, ''), num = r.replace(/^[♭#]/, '');
      return acc + (lower ? num.toLowerCase() : num) + p.suffix;
    }).join('/');
  }
  // Akkordname → Stufe in einer Tonart, Gegenstück zu stufeZuAkkord (Am in C-Dur → vi, F/A → IV/VI)
  function akkordZuStufe(name, k) {
    var a = parseAkkord(name);
    if (!a || !TYPES[a.typ]) return null;
    var typ = a.typ, dim = typ === '°' || typ === '°7';
    var moll = dim || /^m(?!aj)/.test(typ);
    var iv = mod(a.root - k.pc, 12);
    var r = (iv === 6 && !moll) ? '♭V' : ROMAN_PC[iv];      // Tritonus: Dur als ♭V, Moll und vermindert als #iv
    var acc = r.replace(/[IV]+$/, ''), num = r.replace(/^[♭#]/, '');
    var suffix = typ === 'm7♭5' ? 'ø7' : (moll && typ.charAt(0) === 'm' ? typ.slice(1) : typ);
    var tok = acc + (moll ? num.toLowerCase() : num) + suffix;
    if (a.bass !== null) tok += '/' + ROMAN_PC[mod(a.bass - k.pc, 12)];
    return tok;
  }
  // Akkordtöne mit passenden Namen, z. B. Cmaj7 → C E G H
  // Akkordtöne mit passendem Buchstaben: die #9 von C7#9 heißt D#, die Septime von C#°7 heißt B♭.
  // Wo das Doppelvorzeichen oder Ces/Fes/Eis/His bräuchte, nimmt spell() den gleich klingenden Namen.
  var TON_STUFE = { '7#9': { 3: 1 }, '°7': { 9: 6 } };
  function akkordToene(name) {
    var a = parseAkkord(name);
    if (!a || !TYPES[a.typ]) return [];
    var sonder = TON_STUFE[a.typ] || {};
    return TYPES[a.typ][0].map(function (i) { return i === 0 ? a.rootName : bassName(a.rootName, mod(a.root + i, 12), sonder[i]); });
  }
  function tonleiter(k) {
    var accs = k.moll ? [0, 0, -1, 0, 0, -1, -1] : [0, 0, 0, 0, 0, 0, 0];
    return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'].map(function (r, i) { return stufenTon(accs[i], r, k); });
  }

  // ------------------------------------------------------------------ Griffbild als SVG (wie zeichnen.py)
  function barres(frets) {
    var out = [], n = frets.length;
    var vals = fretted(frets).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
    vals.forEach(function (v) {
      for (var a = 0; a < n; a++) for (var b = a + 1; b < n; b++) {
        if (frets[a] !== v || frets[b] !== v) continue;
        var ok = true, cov = 0;
        for (var k = a; k <= b; k++) {
          if (frets[k] === null || frets[k] < v) { ok = false; break; }
          if (frets[k] === v) cov++;
        }
        if (ok) out.push([v, a, b, cov]);
      }
    });
    return out;
  }
  function bestBarre(frets) {
    var fr = fretted(frets);
    if (!fr.length) return null;
    var bs = barres(frets);
    if (!bs.length) return null;
    var f0 = min(fr);
    var atMin = bs.filter(function (b) { return b[0] === f0; }).sort(function (x, y) { return (y[3] - x[3]) || ((y[2] - y[1]) - (x[2] - x[1])); });
    if (fr.length <= 4) return atMin.length && atMin[0][3] >= 3 ? atMin[0] : null;
    if (atMin.length) return atMin[0];
    bs.sort(function (x, y) { return (y[3] - x[3]) || (x[0] - y[0]); });
    return bs[0];
  }
  function startBund(frets) {
    var fr = fretted(frets), nf = 5;
    if (!fr.length) return 1;
    if (frets.indexOf(0) < 0 && min(fr) >= 3) return min(fr);
    if (max(fr) <= nf) return 1;
    return min(fr);
  }
  function svg(frets, opts) {
    opts = opts || {};
    var n = frets.length, W = 100, nf = 5;
    var gw = n === 6 ? 62 : 44, sp = gw / (n - 1), fh = 17.5;
    var gx = (W - gw) / 2 + 5, my = 8, gy = 18;
    var rad = Math.min(sp * 0.38, fh * 0.36);
    var base = startBund(frets);
    var o = [];
    o.push('<svg class="griffbild" viewBox="0 0 ' + W + ' ' + (gy + nf * fh + 4) + '" role="img" aria-label="' + (opts.label || 'Griff') + ' ' + fs(frets) + '">');
    for (var s = 0; s < n; s++) {
      var x = gx + s * sp;
      o.push('<line class="gb-l" x1="' + x + '" y1="' + gy + '" x2="' + x + '" y2="' + (gy + nf * fh) + '"/>');
    }
    for (var k = 0; k <= nf; k++) {
      var y = gy + k * fh;
      if (k === 0 && base === 1) o.push('<rect class="gb-sattel" x="' + (gx - 0.8) + '" y="' + (gy - 3.2) + '" width="' + (gw + 1.6) + '" height="3.8" rx="0.6"/>');
      else o.push('<line class="gb-l" x1="' + gx + '" y1="' + y + '" x2="' + (gx + gw) + '" y2="' + y + '"/>');
    }
    if (base > 1) o.push('<text class="gb-bund" x="' + (gx - rad - 3.5) + '" y="' + (gy + 0.5 * fh) + '">' + base + '</text>');
    frets.forEach(function (f, s) {
      var x = gx + s * sp;
      if (f === null) {
        var r = 2.9;
        o.push('<path class="gb-x" d="M' + (x - r) + ' ' + (my - r) + 'L' + (x + r) + ' ' + (my + r) + 'M' + (x - r) + ' ' + (my + r) + 'L' + (x + r) + ' ' + (my - r) + '"/>');
      } else if (f === 0) {
        o.push('<circle class="gb-o" cx="' + x + '" cy="' + my + '" r="3.1"/>');
      }
    });
    var bb = opts.noBarre ? null : bestBarre(frets);
    var drawn = {};
    if (bb) {
      var yb = gy + (bb[0] - base + 0.5) * fh;
      o.push('<rect class="gb-p" x="' + (gx + bb[1] * sp - rad) + '" y="' + (yb - rad) + '" width="' + ((bb[2] - bb[1]) * sp + 2 * rad) + '" height="' + (2 * rad) + '" rx="' + rad + '"/>');
      for (var j = bb[1]; j <= bb[2]; j++) if (frets[j] === bb[0]) drawn[j] = 1;
    }
    frets.forEach(function (f, s) {
      if (f && !drawn[s]) o.push('<circle class="gb-p" cx="' + (gx + s * sp) + '" cy="' + (gy + (f - base + 0.5) * fh) + '" r="' + rad + '"/>');
    });
    o.push('</svg>');
    return o.join('');
  }

  // Wie schwer ist ein Griff? Für den Kapo-Vorschlag.
  function schwierigkeit(v) {
    if (!v) return 4;
    var fr = fretted(v.f), d = 0;
    if (v.f.indexOf(0) < 0 && fr.length >= 4) d += 2;
    if (fr.length && max(fr) > 5) d += 1;
    if (v.k === 'extra') d += 1;
    return d;
  }

  // ------------------------------------------------------------------ Klang (Karplus-Strong-Zupfsaite)
  var Klang = (function () {
    var ctx = null, master = null, cache = {}, aktiv = [], kt = 440, sitzungTyp = 'playback', ruheTimer = null;
    var MAX_PUFFER = 32;   // höchstens so viele fertige Saitenklänge behalten (je 0,3 bis 0,6 MB)
    var RUHE_NACH = 20000; // so lange nach dem letzten Ton schaltet sich die Klangausgabe ab
    var saite = {};        // letzter Ton je Saite: wird die Saite neu angeschlagen, verklingt er
    // Nachklang in Sekunden, bis ein Ton um 60 dB leiser ist. Gleich für tiefe und hohe Saiten,
    // damit die Basssaiten nicht lange nachdröhnen (klang sonst wie Hall).
    var NACHKLANG = { gitarre: 2.6, ukulele: 1.4 };
    // iPhone/iPad: 'playback' spielt auch bei eingeschaltetem Stummschalter (Safari 17+),
    // das Stimmgerät schaltet für das Mikrofon auf 'play-and-record'
    function sitzung(typ) {
      sitzungTyp = typ;
      try { if (typeof navigator !== 'undefined' && navigator.audioSession) navigator.audioSession.type = typ; } catch (e) { /* ältere Geräte */ }
    }
    function init() {
      if (typeof window === 'undefined') return false;
      sitzung(sitzungTyp);
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.55;
        var comp = ctx.createDynamicsCompressor();
        // sanft: fängt nur Spitzen ab und hebt das Ausklingen nicht an
        comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
        master.connect(comp);
        comp.connect(ctx.destination);
      }
      if (ctx.state !== 'running' && ctx.state !== 'closed' && ctx.resume) ctx.resume();
      wachBleiben();
      return true;
    }
    // Die Klangausgabe läuft nur, solange etwas erklingt. Danach schläft sie, damit die App
    // nichts rechnet und das iPhone sie im Hintergrund wirklich anhält.
    function wachBleiben() {
      clearTimeout(ruheTimer);
      ruheTimer = setTimeout(function () { if (aktiv.length) wachBleiben(); else schlafen(); }, RUHE_NACH);
    }
    function schlafen() {
      clearTimeout(ruheTimer);
      if (ctx && ctx.state === 'running' && ctx.suspend) {
        var p = ctx.suspend();
        if (p && p.catch) p.catch(function () { /* egal */ });
      }
    }
    // sofort Ruhe: alle Töne aus, Klangausgabe schlafen legen (App geht in den Hintergrund)
    function ruhe() { stopp(); schlafen(); }
    function zustand() { return ctx ? ctx.state : 'aus'; }
    function puffer(midi, inst) {
      var k = inst + midi + '@' + kt, b = cache[k];
      if (b) { delete cache[k]; cache[k] = b; return b; }   // nach hinten: zuletzt benutzt
      var alt = Object.keys(cache);
      if (alt.length >= MAX_PUFFER) delete cache[alt[0]];  // den am längsten unbenutzten Klang vergessen
      var sr = ctx.sampleRate, freq = kt * Math.pow(2, (midi - 69) / 12);
      var dauer = NACHKLANG[inst] * 0.9;
      var len = Math.floor(sr * dauer), buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
      var N = Math.max(2, Math.round(sr / freq)), ring = new Float32Array(N), prev = 0;
      for (var i = 0; i < N; i++) { var r = Math.random() * 2 - 1; prev = 0.6 * r + 0.4 * prev; ring[i] = prev; }
      var decay = Math.min(inst === 'ukulele' ? 0.9955 : 0.9975, Math.pow(10, -3 / (NACHKLANG[inst] * freq))), idx = 0;
      for (var j = 0; j < len; j++) {
        var nx = idx + 1 === N ? 0 : idx + 1, v = ring[idx];
        d[j] = v;
        ring[idx] = decay * 0.5 * (v + ring[nx]);
        idx = nx;
      }
      var fade = Math.floor(sr * (inst === 'ukulele' ? 0.2 : 0.3));
      for (var q = 0; q < fade; q++) d[len - 1 - q] *= q / fade;
      return (cache[k] = buf);
    }
    // Saiten anschlagen. frets: ein Wert je Saite, null = diese Saite nicht spielen.
    // aufwaerts: von der hohen zur tiefen Saite (Aufschlag).
    function anschlag(frets, inst, kapo, wann, laut, aufwaerts) {
      if (!init()) return;
      var t0 = wann || ctx.currentTime + 0.02;
      var noten = [];
      frets.forEach(function (f, i) { if (f !== null) noten.push({ s: i, m: MIDI[inst][i] + f + (kapo || 0) }); });
      if (aufwaerts) noten.reverse();
      noten.forEach(function (n, i) {
        var src = ctx.createBufferSource(), g = ctx.createGain(), t = t0 + i * (inst === 'ukulele' ? 0.018 : 0.024);
        src.buffer = puffer(n.m, inst);
        g.gain.value = (laut || 1) * (inst === 'ukulele' ? 0.32 : 0.26);
        src.connect(g); g.connect(master);
        src.start(t);
        // die Saite klingt nur einmal: der vorige Ton auf ihr verklingt, sobald der neue kommt
        var k = inst + n.s, vor = saite[k];
        if (vor && vor.t < t) {
          try { vor.g.gain.setTargetAtTime(0, t, 0.012); vor.src.stop(t + 0.12); } catch (e) { /* schon vorbei */ }
        }
        saite[k] = { src: src, g: g, t: t };
        aktiv.push(src);
        src.onended = function () {
          var x = aktiv.indexOf(src); if (x >= 0) aktiv.splice(x, 1);
          if (saite[k] && saite[k].src === src) delete saite[k];
        };
      });
    }
    // Akkordwechsel: die Greifhand löst den alten Akkord, alle Saiten verklingen kurz vor dem neuen
    function daempfen(wann) {
      if (!ctx) return;
      Object.keys(saite).forEach(function (k) {
        var v = saite[k];
        if (v.t >= wann) return;
        try { v.g.gain.setTargetAtTime(0, wann, 0.025); v.src.stop(wann + 0.25); } catch (e) { /* schon vorbei */ }
        delete saite[k];
      });
    }
    function stopp() {
      aktiv.slice().forEach(function (s) { try { s.stop(); } catch (e) { /* schon beendet */ } });
      aktiv = [];
      saite = {};
    }
    function zeit() { return ctx ? ctx.currentTime : 0; }
    // fertigen Puffer abspielen (Referenzton des Stimmgeräts), gibt die Quelle zurück
    function spiele(buf, laut) {
      if (!init()) return null;
      var src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = buf; g.gain.value = laut || 0.5;
      src.connect(g); g.connect(master);
      src.start(ctx.currentTime + 0.02);
      aktiv.push(src);
      src.onended = function () { var x = aktiv.indexOf(src); if (x >= 0) aktiv.splice(x, 1); };
      return src;
    }
    // Dauerton wie eine Stimmgabel (Kammerton im Stimmgerät): fast reiner Sinus, etwas Oberton,
    // damit er auch aus kleinen Lautsprechern klingt. Läuft, bis stopp() kommt; stopp() und ruhe()
    // der Klangausgabe beenden ihn ebenfalls, dann meldet er sich über fertig().
    function dauerton(hz, laut, fertig) {
      if (!init()) return null;
      var t = ctx.currentTime, osc = ctx.createOscillator(), g = ctx.createGain(), aus = false;
      osc.setPeriodicWave(ctx.createPeriodicWave(new Float32Array([0, 0, 0, 0]), new Float32Array([0, 1, 0.12, 0.03])));
      osc.frequency.value = hz;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(laut || 0.3, t + 0.05);   // weich einsetzen, ohne Knacken
      osc.connect(g); g.connect(master);
      osc.start(t);
      aktiv.push(osc);
      osc.onended = function () {
        aus = true;
        var x = aktiv.indexOf(osc); if (x >= 0) aktiv.splice(x, 1);
        osc.disconnect(); g.disconnect();
        if (fertig) fertig();
      };
      return {
        frequenz: function (f) { if (!aus) osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.015); },
        jetzt: function () { return osc.frequency.value; },
        stopp: function () {
          if (aus) return;
          aus = true;
          var n = ctx.currentTime;
          g.gain.cancelScheduledValues(n);
          g.gain.setValueAtTime(g.gain.value, n);
          g.gain.linearRampToValueAtTime(0, n + 0.12);   // weich ausklingen
          try { osc.stop(n + 0.13); } catch (e) { /* schon beendet */ }
        },
      };
    }
    function kontext() { return init() ? ctx : null; }
    // Kammerton A4 in Hz, gilt für alle Klänge der App
    function kammerton(hz) { if (hz !== kt) { kt = hz; cache = {}; } }   // alte Klänge passen nicht mehr
    function puffer_anzahl() { return Object.keys(cache).length; }
    return { init: init, anschlag: anschlag, daempfen: daempfen, stopp: stopp, zeit: zeit, spiele: spiele, dauerton: dauerton, kontext: kontext, kammerton: kammerton, sitzung: sitzung,
      ruhe: ruhe, zustand: zustand, _pufferAnzahl: puffer_anzahl };
  })();

  return {
    PC_NAME: PC_NAME, ROOT_LABELS: ROOT_LABELS, TYPES: TYPES, TYPE_NAMES: TYPE_NAMES, TUNING: TUNING, SAITEN: SAITEN,
    KAT_NAMEN: KAT_NAMEN, DUR_KEYS: DUR_KEYS, MOLL_KEYS: MOLL_KEYS,
    parse: parse, fs: fs, check: check, fingers: fingers, bassPc: bassPc,
    kuratiert: kuratiert, varianten: varianten, grundgriff: grundgriff, parseAkkord: parseAkkord,
    key: key, relDur: relDur, stufeZuAkkord: stufeZuAkkord, stufeMoll: stufeMoll, tonleiter: tonleiter,
    akkordZuStufe: akkordZuStufe, akkordToene: akkordToene,
    svg: svg, schwierigkeit: schwierigkeit, Klang: Klang,
    _intern: { triadVoicing: triadVoicing, dform: dform, ukeAlt: ukeAlt, ukeNobarre: ukeNobarre, uke9: uke9, openSearch: openSearch, pick: pick, openColour: openColour, known: known },
  };
})();
