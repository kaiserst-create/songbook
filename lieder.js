// Songbook: Songs lesen, Akkorde erkennen, transponieren und als HTML darstellen.
//
// Songformat (Dateien in songs/ und der Editor der App):
//   {title: Titel}  {artist: Interpret}  {subtitle: Untertitel}  {c: Hinweis}  {bild: bilder/x.png}  {akkorde: C G Am}
//   [Verse 1]              Zeile nur mit einem Namen in eckigen Klammern = Abschnitt
//   [G]Eine Welt liegt …   Akkord in eckigen Klammern direkt vor der Silbe
//   [C] [F] [G]            Zeile nur mit Akkorden = Akkordfolge
//   [*Text]                Anmerkung über dem Text (wird nicht transponiert)
// Akkorde: B wird als H gelesen (so steht es in den Vorlagen), Bb und B♭ sind B♭. Deutsche Kleinschreibung
// (e = Em) liest nur der Import aus Word, im Songformat stehen Akkorde immer groß.
//
// Läuft im Browser und in osascript (skripte/pruefen.js), daher ohne Zugriff auf die Seite beim Laden.

var SB_LIED = (function () {
  'use strict';
  var mod = function (a, n) { return ((a % n) + n) % n; };

  // ------------------------------------------------------------------ Akkorde lesen
  var STAMM = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, H: 11, B: 11 };
  // Was hinter dem Grundton stehen darf (sonst ist es kein Akkord, z. B. [Bridge])
  var ZUSATZ = /^(maj|min|m|M|dim|aug|sus|add|°|ø|Δ|\+|-|[0-9]|b5|#5|b9|#9|#11|♭5|♭9|b13|♭13|\(|\)|no3)*$/;
  var AKK = /^([A-H])(#|♭|b(?!$)|b(?=$))?(.*)$/;

  function einAkkord(s) {
    // „F#m7/C#“ → { pc, vz, zusatz, bass, bassVz } oder null
    if (!s) return null;
    var haelften = s.split('/');
    if (haelften.length > 2) return null;
    var m = AKK.exec(haelften[0]);
    if (!m) return null;
    var vz = m[2] === 'b' ? '♭' : (m[2] || '');
    // „Bb“: b als Vorzeichen. „B“ allein ist H, „Bb“ ist B♭ (B-Stamm 11, minus eins)
    var zusatz = m[3];
    if (!ZUSATZ.test(zusatz)) return null;
    var pc = mod(STAMM[m[1]] + (vz === '#' ? 1 : (vz === '♭' ? -1 : 0)), 12);
    var a = { pc: pc, vz: vz, zusatz: zusatz, bass: null, bassVz: '' };
    if (haelften.length === 2) {
      var b = /^([A-H])(#|♭|b)?$/.exec(haelften[1]);
      if (!b) return null;
      var bvz = b[2] === 'b' ? '♭' : (b[2] || '');
      a.bass = mod(STAMM[b[1]] + (bvz === '#' ? 1 : (bvz === '♭' ? -1 : 0)), 12);
      a.bassVz = bvz;
    }
    return a;
  }

  // Inhalt einer Klammer → Teile: Akkorde und Zeichen dazwischen.
  // Ketten C-Csus4-C, Alternativen C/C7 (ein „/“ vor einem ganzen Akkord), Basslauf /A, Klammern (Em)
  var memoT = {};
  function token(s) {
    if (memoT.hasOwnProperty(s)) return memoT[s];
    var out = [], rest = s, ok = true;
    var vorne = /^[\s(]+/.exec(rest);
    if (vorne) { out.push({ t: vorne[0] }); rest = rest.slice(vorne[0].length); }
    var hinten = /[\s)]+$/.exec(rest), ende = null;
    if (hinten && hinten[0].length < rest.length) { ende = hinten[0]; rest = rest.slice(0, rest.length - ende.length); }
    if (!rest) ok = false;
    else {
      var a = einAkkord(rest);
      if (a) out.push({ a: a });
      else {
        // in Teile zerlegen: zuerst an - und –, dann Alternativen mit /
        var stuecke = rest.split(/([-–])/);
        stuecke.forEach(function (st) {
          if (!ok) return;
          if (st === '-' || st === '–') { out.push({ t: st }); return; }
          if (!st) return;
          var x = einAkkord(st);
          if (x) { out.push({ a: x }); return; }
          // Alternativen „C/C7“ oder Basslauf „/A“ (nur ein Basston, kein eigener Akkord)
          var alt = st.split('/');
          alt.forEach(function (p, i) {
            if (!ok) return;
            if (!p) { if (i === 0) return; ok = false; return; }
            if (i === 1 && !alt[0]) {
              var b = /^([A-H])(#|♭|b)?$/.exec(p);
              if (!b) { ok = false; return; }
              var bvz = b[2] === 'b' ? '♭' : (b[2] || '');
              out.push({ a: { pc: mod(STAMM[b[1]] + (bvz === '#' ? 1 : (bvz === '♭' ? -1 : 0)), 12), vz: bvz, zusatz: '', bass: null, bassVz: '', lauf: true } });
              return;
            }
            if (i) out.push({ t: '/' });
            var y = einAkkord(p);
            if (y) out.push({ a: y }); else ok = false;
          });
        });
      }
    }
    if (ende) out.push({ t: ende });
    var erg = ok && out.some(function (x) { return x.a; }) ? out : null;
    return (memoT[s] = erg);
  }
  function istAkkord(s) { return !!token(s); }

  // ------------------------------------------------------------------ Namen und Transponieren
  var KREUZ = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H'];
  var BE = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'H'];
  var GEMISCHT = ['C', 'C#', 'D', 'E♭', 'E', 'F', 'F#', 'G', 'A♭', 'A', 'B♭', 'H'];   // wie SC.PC_NAME
  // Tonarten mit ♭ bzw. # (Grundton, Moll?)
  function vorzeichenArt(pc, moll) {
    if (moll) {
      if ([2, 7, 0, 5, 10, 3].indexOf(pc) >= 0) return 'be';
      if ([4, 11, 6, 1, 8].indexOf(pc) >= 0) return 'kreuz';
      return 'gemischt';
    }
    if ([5, 10, 3, 8, 1].indexOf(pc) >= 0) return 'be';
    if ([7, 2, 9, 4, 11, 6].indexOf(pc) >= 0) return 'kreuz';
    return 'gemischt';
  }

  // o: { n: Halbtöne, art: 'be'|'kreuz'|'gemischt' (nur wenn n ≠ 0), deutsch: true (H, B♭) oder false (B, B♭) }
  function tonName(pc, vz, o) {
    var p = mod(pc + (o.n || 0), 12), name;
    if (!o.n) {
      // wie geschrieben: das Vorzeichen bleibt, nur B wird H und b wird ♭
      name = vz === '♭' ? BE[p] : (vz === '#' ? KREUZ[p] : GEMISCHT[p]);
      if (vz === '' && p !== pc) name = GEMISCHT[p];
    } else {
      name = (o.art === 'be' ? BE : (o.art === 'kreuz' ? KREUZ : GEMISCHT))[p];
    }
    if (!o.deutsch) name = name === 'H' ? 'B' : name;
    return name;
  }
  function zusatzSchoen(z) { return z.replace(/b(5|9|13)/g, '♭$1'); }
  function akkordName(a, o) {
    if (a.lauf) return '/' + tonName(a.pc, a.vz, o);
    var s = tonName(a.pc, a.vz, o) + zusatzSchoen(a.zusatz);
    if (a.bass !== null) s += '/' + tonName(a.bass, a.bassVz, o);
    return s;
  }
  // Klammerinhalt transponiert als Text
  function tokenName(s, o) {
    var t = token(s);
    if (!t) return s;
    return t.map(function (x) { return x.a ? akkordName(x.a, o) : x.t; }).join('');
  }

  // Name für die Griffsuche in musik.js (SC.varianten): Grundton wie SC.PC_NAME, Typ aus SC.TYPES
  var TYP = {
    '': '', 'm': 'm', 'min': 'm', '-': 'm', '7': '7', 'm7': 'm7', 'min7': 'm7', '-7': 'm7',
    'maj7': 'maj7', 'M7': 'maj7', 'Δ': 'maj7', 'Δ7': 'maj7', 'maj': 'maj7', 'j7': 'maj7',
    '6': '6', 'm6': 'm6', '9': '9', 'm9': 'm9', 'maj9': 'maj9', 'add9': 'add9', 'add2': 'add9',
    'madd9': 'm(add9)', 'm(add9)': 'm(add9)', 'madd2': 'm(add9)',
    'sus4': 'sus4', 'sus': 'sus4', '4': 'sus4', 'sus2': 'sus2', '2': 'sus2', '7sus4': '7sus4', '7sus': '7sus4', 'sus7': '7sus4', 'sus47': '7sus4',
    '7b13': '7♭13', '7♭13': '7♭13',
    'dim': '°', '°': '°', 'o': '°', 'dim7': '°7', '°7': '°7', 'm7b5': 'm7♭5', 'm7♭5': 'm7♭5', 'ø': 'm7♭5', 'ø7': 'm7♭5',
    'aug': '+', '+': '+', '+5': '+', '#5': '+', '5': '5', '7#9': '7#9', '7b9': '7♭9', '7♭9': '7♭9',
  };
  function griffName(a, n) {
    if (a.lauf) return null;
    var typ = TYP[a.zusatz];
    if (typ === undefined) return null;
    var s = GEMISCHT[mod(a.pc + (n || 0), 12)] + typ;
    if (a.bass !== null) s += '/' + GEMISCHT[mod(a.bass + (n || 0), 12)];
    return s;
  }

  // ------------------------------------------------------------------ Song lesen
  var ANWEISUNG = /^\{\s*([a-zA-Z_äöü]+)\s*(?::\s*(.*?))?\s*\}$/;
  var NAMEN = { t: 'title', title: 'title', a: 'artist', artist: 'artist', st: 'subtitle', subtitle: 'subtitle',
    c: 'c', comment: 'c', ci: 'c', comment_italic: 'c', bild: 'bild', image: 'bild', akkorde: 'akkorde', chords: 'akkorde',
    key: 'key', capo: 'capo', soc: 'soc', start_of_chorus: 'soc', eoc: 'eoc', end_of_chorus: 'eoc' };

  // Zeile in Teile zerlegen: [{ch: Klammerinhalt oder null, tx: Text}]
  function teile(l) {
    var out = [], re = /\[([^\]]*)\]/g, m, pos = 0, ch = null;
    while ((m = re.exec(l))) {
      var tx = l.slice(pos, m.index);
      if (ch !== null || tx) out.push({ ch: ch, tx: tx });
      ch = m[1];
      pos = re.lastIndex;
    }
    var rest = l.slice(pos);
    if (ch !== null || rest) out.push({ ch: ch, tx: rest });
    return out;
  }
  var NUR_ZEICHEN = /^[\s|:()\-–,;.%/x0-9*]*$/i;

  function lies(text) {
    var lied = { titel: '', kuenstler: '', untertitel: '', zeilen: [], extra: [], key: '', capo: '' };
    String(text || '').replace(/\r\n?/g, '\n').split('\n').forEach(function (roh) {
      var l = roh.replace(/\s+$/, '');
      var m = ANWEISUNG.exec(l.trim());
      if (m) {
        var k = NAMEN[m[1].toLowerCase()], w = m[2] || '';
        if (k === 'title') lied.titel = w;
        else if (k === 'artist') lied.kuenstler = w;
        else if (k === 'subtitle') lied.untertitel = w;
        else if (k === 'c') lied.zeilen.push({ art: 'notiz', text: w });
        else if (k === 'bild') lied.zeilen.push({ art: 'bild', src: w });
        else if (k === 'akkorde') lied.extra = w.split(/[\s,]+/).filter(istAkkord);
        else if (k === 'key') lied.key = w;
        else if (k === 'capo') lied.capo = w;
        else if (k === 'soc') lied.zeilen.push({ art: 'abschnitt', text: 'Refrain' });
        return;   // unbekannte Anweisungen ({fassung: …}) übergehen
      }
      if (!l.trim()) { lied.zeilen.push({ art: 'leer' }); return; }
      var ab = /^\s*\[([^\]]+)\]\s*$/.exec(l);
      if (ab && !istAkkord(ab[1].trim()) && ab[1].trim().charAt(0) !== '*') {
        lied.zeilen.push({ art: 'abschnitt', text: ab[1].trim().replace(/:$/, '') });
        return;
      }
      var t = teile(l);
      var mitAkk = t.some(function (x) { return x.ch !== null; });
      if (!mitAkk) { lied.zeilen.push({ art: 'text', teile: t }); return; }
      var nurAkk = t.every(function (x) { return NUR_ZEICHEN.test(x.tx); });
      lied.zeilen.push({ art: nurAkk ? 'akkorde' : 'text', teile: t });
    });
    // Leerzeilen am Anfang und Ende weg
    while (lied.zeilen.length && lied.zeilen[0].art === 'leer') lied.zeilen.shift();
    while (lied.zeilen.length && lied.zeilen[lied.zeilen.length - 1].art === 'leer') lied.zeilen.pop();
    return lied;
  }
  function titelVon(text) {
    var m = /^\s*\{\s*(?:t|title)\s*:\s*(.*?)\s*\}\s*$/m.exec(String(text || ''));
    return m ? m[1] : '';
  }

  // Alle Akkorde des Songs in der Reihenfolge des ersten Auftretens (Objekte aus einAkkord)
  function akkorde(lied) {
    var gesehen = {}, out = [];
    function nimm(a) {
      var k = a.pc + '|' + a.zusatz + '|' + a.bass;
      if (gesehen[k]) return;
      gesehen[k] = 1;
      out.push(a);
    }
    lied.zeilen.forEach(function (z) {
      if (!z.teile) return;
      z.teile.forEach(function (x) {
        if (x.ch === null || x.ch.charAt(0) === '*') return;
        var tk = token(x.ch);
        if (tk) tk.forEach(function (p) { if (p.a && !p.a.lauf) nimm(p.a); });
      });
    });
    lied.extra.forEach(function (s) { (token(s) || []).forEach(function (p) { if (p.a) nimm(p.a); }); });
    return out;
  }

  // Tonart schätzen: häufigster Akkord, der erste zählt doppelt → { pc, moll }
  function tonart(lied) {
    var zahl = {}, erster = null;
    lied.zeilen.forEach(function (z) {
      if (!z.teile) return;
      z.teile.forEach(function (x) {
        if (x.ch === null) return;
        (token(x.ch) || []).forEach(function (p) {
          if (!p.a) return;
          var k = p.a.pc + (/^m(?!aj)/.test(p.a.zusatz) ? 'm' : '');
          zahl[k] = (zahl[k] || 0) + 1;
          if (erster === null) erster = k;
        });
      });
    });
    if (erster === null) (lied.extra || []).some(function (s) { var t = token(s); if (t && t[0].a) { erster = t[0].a.pc + (/^m(?!aj)/.test(t[0].a.zusatz) ? 'm' : ''); zahl[erster] = 1; } return erster !== null; });
    if (erster === null) return null;
    zahl[erster] += 2;
    var best = erster;
    Object.keys(zahl).forEach(function (k) { if (zahl[k] > zahl[best]) best = k; });
    return { pc: parseInt(best, 10), moll: best.slice(-1) === 'm' };
  }
  // Optionen für die Namen: o.n Halbtöne, o.deutsch
  function namenOpt(lied, n, deutsch) {
    var o = { n: mod(n || 0, 12), deutsch: deutsch !== false, art: 'gemischt' };
    if (o.n) {
      var k = tonart(lied);
      if (k) o.art = vorzeichenArt(mod(k.pc + o.n, 12), k.moll);
    }
    return o;
  }

  // ------------------------------------------------------------------ Hinweise im Text (wie Biene Meier)
  // Wiederholungen wie „2x“, „x2“, „(4x)“, „14×“ sind Hinweise (Nutzer). Davor und danach kein Buchstabe und keine Ziffer.
  var WDH_RE = /\(?(\d+\s?[xX×]|[xX×]\s?\d+)\)?/g;
  var ZEICHEN_WORT = /[A-Za-zÄÖÜäöüß0-9]/;
  function wdhTeile(t) {
    var out = [], pos = 0, m;
    t = String(t);
    WDH_RE.lastIndex = 0;
    while ((m = WDH_RE.exec(t))) {
      var a = m.index, b = a + m[0].length, w = m[0];
      // Klammer nur auf einer Seite („(repeat 1x)“): gehört nicht zum Hinweis
      if (w.charAt(0) === '(' && w.charAt(w.length - 1) !== ')') { a++; w = w.slice(1); }
      else if (w.charAt(w.length - 1) === ')' && w.charAt(0) !== '(') { b--; w = w.slice(0, -1); }
      var vor = a > 0 ? t.charAt(a - 1) : ' ', nach = b < t.length ? t.charAt(b) : ' ';
      if (ZEICHEN_WORT.test(vor) || ZEICHEN_WORT.test(nach)) continue;
      if (a > pos) out.push({ t: t.slice(pos, a) });
      out.push({ t: w, wdh: true });
      pos = b;
    }
    if (pos < t.length) out.push({ t: t.slice(pos) });
    return out;
  }
  function istWdh(t) { var x = wdhTeile(String(t).trim()); return x.length === 1 && !!x[0].wdh; }
  function textHtml(t) {
    return wdhTeile(t).map(function (x) { return x.wdh ? '<span class="wdh">' + esc(x.t) + '</span>' : esc(x.t); }).join('');
  }
  // Abschnitt „Strophe 2 (Gesang bissl später)“ → Name „Strophe 2“ und Notiz „Gesang bissl später“ (Nutzer: Notizen als Hinweis)
  var AB_WORT = /^((?:kurzes |langes )?(?:intro|outro|vers|verse|strophe|refrain|chorus|pre-?chorus|post-?chorus|bridge|minibridge|solo|instrumental|interlude|zwischenspiel|break|hook|ende|schluss|coda|riff|tag)(?![a-zäöüß])(?:\s*\d+(?![\dxX×]))?(?:\s+(?:solo|outro|intro|instrumental|break|riff|time|part|teil)(?![a-zäöüß]))?(?:\s*\+\s*\S+)?)(.*)$/i;
  function abschnittTeile(text) {
    var t = String(text), name = t, notiz = '', k = t.indexOf('('), d = t.indexOf(':');
    if (k > 0 && (d < 0 || k < d + 2)) { name = t.slice(0, k); notiz = t.slice(k); }
    else if (d > 0) { name = t.slice(0, d); notiz = t.slice(d + 1); }
    else {
      var m = AB_WORT.exec(t);
      if (m && m[2].trim() && !/^[\s!?.]+$/.test(m[2])) { name = m[1]; notiz = m[2]; }
    }
    name = name.replace(/[\s:–-]+$/, '').trim();
    notiz = notiz.replace(/[()]/g, '').replace(/^[\s:–-]+/, '').replace(/[\s:]+$/, '').trim();
    if (!name) return { name: t, notiz: '' };
    return { name: name, notiz: notiz };
  }

  // ------------------------------------------------------------------ Darstellung
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  // Akkord als HTML: jeder Akkord eines Klammerinhalts für sich antippbar
  function akkordHtml(ch, o) {
    if (ch.charAt(0) === '*') return '<span class="anm">' + esc(ch.slice(1)) + '</span>';
    var t = token(ch);
    if (!t) return '<span class="anm">' + esc(ch) + '</span>';
    return t.map(function (p) {
      if (!p.a) return '<span class="zw">' + esc(p.t) + '</span>';
      var g = griffName(p.a, o.n);
      return '<b class="ak"' + (g ? ' data-griff="' + esc(g) + '"' : '') + '>' + esc(akkordName(p.a, o)) + '</b>';
    }).join('');
  }
  // Textzeile mit Akkorden: Wörter bleiben zusammen (span.w), umbrochen wird nur zwischen Wörtern
  function zeileHtml(z, o) {
    var woerter = [], wort = [];
    z.teile.forEach(function (p) {
      var stuecke = (p.tx.match(/[^\s]*\s*/g) || []).filter(Boolean);   // „ab cd “ → „ab “, „cd “
      if (!stuecke.length) stuecke = [''];
      stuecke.forEach(function (st, i) {
        var ch = i === 0 ? p.ch : null;
        if (i > 0 || (wort.length && /\s$/.test(wort[wort.length - 1].tx) && st)) {
          if (wort.length) woerter.push(wort);
          wort = [];
        }
        wort.push({ ch: ch, tx: st });
      });
    });
    if (wort.length) woerter.push(wort);
    return '<div class="zeile mit">' + woerter.map(function (w) {
      return '<span class="w">' + w.map(function (s) {
        var leer = !s.tx.trim();
        return '<span class="s' + (s.ch !== null ? ' hat' : '') + (leer ? ' nur' : '') + '">' +
          '<span class="c">' + (s.ch !== null ? '<span class="ci">' + akkordHtml(s.ch, o) + '</span>' : '') + '</span>' +
          '<span class="t">' + (s.tx ? textHtml(s.tx) : '') + '</span></span>';
      }).join('') + '</span>';
    }).join('') + '</div>';
  }
  // Nur Akkorde: Liedtext fällt weg, Akkorde über dem Text werden zur Akkordzeile (eine je Textzeile, damit die
  // Phrasen erhalten bleiben). Abschnitte, Hinweise, Akkordfolgen und Bilder bleiben.
  function nurAkkorde(lied) {
    var z = [];
    lied.zeilen.forEach(function (x) {
      if (x.art === 'text') {
        var akk = x.teile.filter(function (p) { return p.ch !== null; });
        var wdh = [];
        x.teile.forEach(function (p) { wdhTeile(p.tx).forEach(function (w) { if (w.wdh) wdh.push({ ch: '*' + w.t, tx: ' ' }); }); });
        if (akk.length) z.push({ art: 'akkorde', teile: akk.map(function (p) { return { ch: p.ch, tx: ' ' }; }).concat(wdh) });
        return;
      }
      if (x.art === 'leer' && (!z.length || z[z.length - 1].art === 'leer')) return;
      z.push(x);
    });
    while (z.length && z[z.length - 1].art === 'leer') z.pop();
    var kopie = {};
    Object.keys(lied).forEach(function (k) { kopie[k] = lied[k]; });
    kopie.zeilen = z;
    return kopie;
  }

  // Akkordfolge in Gruppen, zwischen denen Abstand steht: „(“ hängt am nächsten Stück, „)“ und Satzzeichen am vorigen.
  // [C] [G] (Original [Eb] [Bb]) → C · G · (Original · E♭ · B♭)
  function folge(teile) {
    var stuecke = [];
    teile.forEach(function (p) {
      if (p.ch !== null) stuecke.push({ ch: p.ch });
      p.tx.split(/\s+/).forEach(function (w) { if (w) stuecke.push({ t: w }); });
    });
    var gruppen = [], kleben = false;
    stuecke.forEach(function (st) {
      var schliesst = st.t !== undefined && /^[),;:.]+$/.test(st.t);
      if (gruppen.length && (kleben || schliesst)) gruppen[gruppen.length - 1].push(st);
      else gruppen.push([st]);
      kleben = st.t !== undefined && /\($/.test(st.t);
    });
    return gruppen;
  }
  function html(lied, o) {
    o = o || namenOpt(lied, 0, true);
    var out = [], imRefrain = false;
    lied.zeilen.forEach(function (z) {
      if (z.art === 'leer') { out.push('<div class="leerzeile"></div>'); return; }
      if (z.art === 'abschnitt') {
        var ab = abschnittTeile(z.text);
        imRefrain = /^(chorus|refrain|ref\b|hook)/i.test(ab.name);
        out.push('<div class="abschnitt' + (imRefrain ? ' refrain' : '') + '"><span class="ab-name">' + esc(ab.name) + '</span>' +
          (ab.notiz ? ' <span class="ab-notiz">' + esc(ab.notiz) + '</span>' : '') + '</div>');
        return;
      }
      if (z.art === 'notiz') { out.push('<div class="notiz">' + esc(z.text) + '</div>'); return; }
      if (z.art === 'bild') { out.push('<img class="bild" src="' + esc(z.src) + '" alt="Notenblatt" loading="lazy">'); return; }
      if (z.art === 'akkorde') {
        out.push('<div class="zeile folge">' + folge(z.teile).map(function (gruppe) {
          return '<span class="fg">' + gruppe.map(function (st) {
            return st.ch !== undefined ? '<span class="fa">' + akkordHtml(st.ch, o) + '</span>' : '<span class="' + (istWdh(st.t) ? 'wdh' : 'zw') + '">' + esc(st.t) + '</span>';
          }).join('') + '</span>';
        }).join('') + '</div>');
        return;
      }
      if (z.teile.some(function (p) { return p.ch !== null; })) out.push(zeileHtml(z, o));
      else out.push('<div class="zeile">' + textHtml(z.teile.map(function (p) { return p.tx; }).join('')) + '</div>');
    });
    return out.join('');
  }

  // ------------------------------------------------------------------ Text umschreiben
  // Alle Akkorde im Text transponieren (für „Transponierung übernehmen“ im Editor). Schreibweise mit b und #, H für H.
  function transponiereText(text, n) {
    var lied = lies(text), o = namenOpt(lied, n, true);
    return String(text).split('\n').map(function (l) {
      var m = ANWEISUNG.exec(l.trim());
      if (m) {
        var k = NAMEN[m[1].toLowerCase()];
        if (k === 'akkorde') return '{akkorde: ' + (m[2] || '').split(/\s+/).map(function (s) { return istAkkord(s) ? tokenName(s, o).replace(/♭/g, 'b') : s; }).join(' ') + '}';
        return l;
      }
      if (/^\s*\[([^\]]+)\]\s*$/.test(l) && !istAkkord(l.trim().slice(1, -1))) return l;
      return l.replace(/\[([^\]*][^\]]*)\]/g, function (all, ch) {
        return istAkkord(ch) ? '[' + tokenName(ch, o).replace(/♭/g, 'b') + ']' : all;
      });
    }).join('\n');
  }

  // Text mit Akkorden über dem Text (wie aus dem Netz kopiert, gleich breite Schrift) ins Songformat bringen
  function istAkkordzeile(l) {
    var w = l.trim().split(/\s+/);
    if (!l.trim() || /^\[.*\]$/.test(l.trim())) return false;
    var akk = 0;
    for (var i = 0; i < w.length; i++) {
      if (istAkkord(w[i])) akk++;
      else if (!NUR_ZEICHEN.test(w[i])) return false;
    }
    return akk > 0;
  }
  function ueberText(text) {
    var z = String(text || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n'), out = [];
    for (var i = 0; i < z.length; i++) {
      var l = z[i];
      if (!istAkkordzeile(l)) {
        var lab = /^\s*\[?([A-Za-zÄÖÜäöü][^\]]*?)\]?\s*:?\s*$/.exec(l);
        if (/^\s*\[[^\]]+\]\s*$/.test(l) && !istAkkord(l.trim().slice(1, -1))) out.push(l.trim());
        else if (lab && /^(intro|outro|vers|verse|strophe|chorus|refrain|pre-?chorus|bridge|solo|interlude|instrumental|zwischenspiel|ende|schluss)\b/i.test(lab[1].trim()) && lab[1].trim().split(/\s+/).length <= 3) out.push('[' + lab[1].trim() + ']');
        else out.push(l.replace(/\s+$/, ''));
        continue;
      }
      var naechste = z[i + 1];
      // Akkorde mit Spaltenposition
      var akk = [], re = /\S+/g, m;
      while ((m = re.exec(l))) akk.push({ s: m[0], pos: m.index });
      if (naechste !== undefined && naechste.trim() && !istAkkordzeile(naechste) && !/^\s*\[.*\]\s*$/.test(naechste)) {
        var t = naechste.replace(/\s+$/, '');
        var laenge = Math.max(t.length, akk.length ? akk[akk.length - 1].pos + 1 : 0);
        while (t.length < laenge) t += ' ';
        var stuecke = [], vor = 0;
        akk.forEach(function (a) {
          var pos = Math.min(a.pos, t.length);
          stuecke.push(t.slice(vor, pos));
          stuecke.push(istAkkord(a.s) ? '[' + a.s + ']' : '[*' + a.s + ']');
          vor = pos;
        });
        stuecke.push(t.slice(vor));
        out.push(stuecke.join('').replace(/\s+$/, ''));
        i++;
      } else {
        out.push(akk.map(function (a) { return istAkkord(a.s) ? '[' + a.s + ']' : a.s; }).join(' '));
      }
    }
    return out.join('\n');
  }

  // Suchtext: Titel, Untertitel, Interpret und Liedtext ohne Akkorde
  function suchtext(text) {
    return String(text || '').replace(/\[[^\]]*\]/g, '').replace(/\{(?:title|t|artist|a|subtitle|st|c|comment)\s*:\s*/g, '').replace(/[{}]/g, ' ');
  }

  return {
    einAkkord: einAkkord, token: token, istAkkord: istAkkord, akkordName: akkordName, tokenName: tokenName, griffName: griffName,
    lies: lies, titelVon: titelVon, akkorde: akkorde, tonart: tonart, namenOpt: namenOpt, vorzeichenArt: vorzeichenArt,
    html: html, esc: esc, teile: teile, folge: folge, nurAkkorde: nurAkkorde, wdhTeile: wdhTeile, istWdh: istWdh, abschnittTeile: abschnittTeile, transponiereText: transponiereText, ueberText: ueberText, istAkkordzeile: istAkkordzeile, suchtext: suchtext,
  };
})();
