// Songbook: PDF aus einem Song oder einer Setliste, ohne Bibliothek und offline.
// Schrift: Helvetica (in jedem PDF-Programm vorhanden, nicht eingebettet) mit WinAnsi-Zeichensatz.
// Die Breiten unten stammen aus Arial, das dieselben Zeichenbreiten wie Helvetica hat (skripte/README im Projekt).
// Das ♭ fehlt im Zeichensatz und wird als kleine Linie gezeichnet. Läuft ohne Zugriff auf die Seite (skripte/pruefen.js).

var SB_PDF = (function () {
  'use strict';

  // Breiten in 1/1000 Schriftgröße für die Zeichen 32 bis 255 (WinAnsi)
  var B_NORMAL = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,750,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,552,400,549,333,333,333,576,537,333,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,549,611,556,556,556,556,500,556,500];
  var B_FETT = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,750,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,552,400,549,333,333,333,576,556,333,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,549,611,611,611,611,611,556,611,556];
  var SPEZIAL = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8A, '‹': 0x8B, 'Œ': 0x8C,
    'Ž': 0x8E, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C, 'ž': 0x9E, 'Ÿ': 0x9F };

  function code(ch) {
    var c = ch.charCodeAt(0);
    if (c >= 32 && c < 127) return c;
    if (c >= 160 && c <= 255) return c;
    if (SPEZIAL.hasOwnProperty(ch)) return SPEZIAL[ch];
    if (ch === '´' || ch === '`') return 39;
    if (ch === '\t') return 32;
    return 63;   // ?
  }
  function breite(s, groesse, fett) {
    var t = fett ? B_FETT : B_NORMAL, b = 0;
    for (var i = 0; i < s.length; i++) b += t[code(s.charAt(i)) - 32] || 556;
    return b * groesse / 1000;
  }
  function pdfText(s) {
    var o = '';
    for (var i = 0; i < s.length; i++) {
      var c = code(s.charAt(i));
      if (c === 40 || c === 41 || c === 92) o += '\\' + String.fromCharCode(c);
      else o += String.fromCharCode(c);
    }
    return '(' + o + ')';
  }
  function zahl(x) { return (Math.round(x * 100) / 100).toString(); }

  // ------------------------------------------------------------------ Seite mit Zeichenbefehlen
  var BREITE = 595.28, HOEHE = 841.89, RAND_L = 50, RAND_R = 50, OBEN = 54, UNTEN = 56;
  // wie in der App: Akkorde im Rot, Abschnitte (Chorus, Verse …) im Blau
  var FARBE = { text: [0.11, 0.11, 0.13], leise: [0.42, 0.43, 0.47], akkord: [0.66, 0.29, 0.14], abschnitt: [0.18, 0.37, 0.72], warm: [0.68, 0.32, 0.17], linie: [0.62, 0.62, 0.62] };
  function farbe(f, strich) { return zahl(f[0]) + ' ' + zahl(f[1]) + ' ' + zahl(f[2]) + (strich ? ' RG' : ' rg'); }

  function Seite() { this.ops = []; }
  Seite.prototype.text = function (x, y, s, groesse, schrift, f) {
    if (!s) return;
    this.ops.push('BT /' + schrift + ' ' + zahl(groesse) + ' Tf ' + farbe(f || FARBE.text) + ' ' + zahl(x) + ' ' + zahl(y) + ' Td ' + pdfText(s) + ' Tj ET');
  };
  Seite.prototype.linie = function (x1, y1, x2, y2, dicke, f, rund) {
    this.ops.push(farbe(f || FARBE.linie, true) + ' ' + zahl(dicke) + ' w ' + (rund ? '1 J ' : '0 J ') + zahl(x1) + ' ' + zahl(y1) + ' m ' + zahl(x2) + ' ' + zahl(y2) + ' l S');
  };
  Seite.prototype.kreis = function (x, y, r, fuellen, f, dicke) {
    var k = 0.5523 * r;
    var p = zahl(x + r) + ' ' + zahl(y) + ' m ' +
      [[x + r, y + k, x + k, y + r, x, y + r], [x - k, y + r, x - r, y + k, x - r, y], [x - r, y - k, x - k, y - r, x, y - r], [x + k, y - r, x + r, y - k, x + r, y]]
        .map(function (c) { return c.map(zahl).join(' ') + ' c'; }).join(' ');
    this.ops.push((fuellen ? farbe(f || FARBE.text) + ' ' + p + ' f' : farbe(f || FARBE.text, true) + ' ' + zahl(dicke || 0.8) + ' w ' + p + ' S'));
  };
  // ♭ als Linie: senkrechter Strich mit Bauch
  Seite.prototype.be = function (x, y, groesse, f) {
    var s = groesse, x0 = x + 0.1 * s;
    this.ops.push(farbe(f, true) + ' ' + zahl(0.085 * s) + ' w 1 J 1 j ' + zahl(x0) + ' ' + zahl(y + 0.74 * s) + ' m ' + zahl(x0) + ' ' + zahl(y) + ' l ' +
      zahl(x0) + ' ' + zahl(y + 0.3 * s) + ' m ' + zahl(x0 + 0.34 * s) + ' ' + zahl(y + 0.48 * s) + ' ' + zahl(x0 + 0.38 * s) + ' ' + zahl(y + 0.14 * s) + ' ' + zahl(x0) + ' ' + zahl(y) + ' c S');
  };

  // Akkordname mit ♭: Breite und Zeichnen
  var BE_BREITE = 0.5;
  function akkBreite(s, groesse) {
    var teile = s.split('♭');
    return teile.reduce(function (b, t) { return b + breite(t, groesse, true); }, 0) + (teile.length - 1) * BE_BREITE * groesse;
  }
  function akkZeichnen(seite, x, y, s, groesse, f) {
    var teile = s.split('♭');
    teile.forEach(function (t, i) {
      if (i) { seite.be(x, y, groesse, f); x += BE_BREITE * groesse; }
      seite.text(x, y, t, groesse, 'F2', f);
      x += breite(t, groesse, true);
    });
  }

  // ------------------------------------------------------------------ Griffbild
  function griffbild(seite, x, oben, w, frets, name) {
    var n = frets.length, nf = 5, gw = w * 0.72, sp = gw / (n - 1), fh = w * 0.19, gx = x + (w - gw) / 2;
    var fr = frets.filter(function (f) { return f; });
    var min = fr.length ? Math.min.apply(null, fr) : 0, max = fr.length ? Math.max.apply(null, fr) : 0;
    var basis = !fr.length ? 1 : (frets.indexOf(0) < 0 && min >= 3 ? min : (max <= nf ? 1 : min));
    var gs = 9.5;
    akkZeichnen(seite, x + (w - akkBreite(name, gs)) / 2, oben - gs, name, gs, FARBE.akkord);
    var top = oben - gs - 12, my = top + 5;
    for (var s = 0; s < n; s++) seite.linie(gx + s * sp, top, gx + s * sp, top - nf * fh, 0.6);
    for (var k = 0; k <= nf; k++) seite.linie(gx, top - k * fh, gx + gw, top - k * fh, k === 0 && basis === 1 ? 2.4 : 0.6, k === 0 && basis === 1 ? FARBE.text : FARBE.linie);
    if (basis > 1) seite.text(gx - 9 - (basis > 9 ? 4 : 0), top - fh * 0.5 - 3, String(basis), 7.5, 'F1', FARBE.text);
    var rad = Math.min(sp * 0.36, fh * 0.36);
    frets.forEach(function (f, i) {
      var cx = gx + i * sp;
      if (f === null) {
        var r = 2.1;
        seite.linie(cx - r, my - r, cx + r, my + r, 0.8, FARBE.leise);
        seite.linie(cx - r, my + r, cx + r, my - r, 0.8, FARBE.leise);
      } else if (f === 0) seite.kreis(cx, my, 2.2, false, FARBE.text, 0.7);
    });
    // Barré: tiefster Bund auf mehreren Saiten, dazwischen nichts tiefer oder stumm
    var gezeichnet = {};
    if (min > 0) {
      var auf = [];
      frets.forEach(function (f, i) { if (f === min) auf.push(i); });
      // wie bestBarre() in musik.js: bei höchstens vier gegriffenen Saiten erst ab drei im selben Bund
      var a = auf[0], b = auf[auf.length - 1], ok = auf.length >= (fr.length <= 4 ? 3 : 2);
      for (var j = a; ok && j <= b; j++) if (frets[j] === null || frets[j] < min) ok = false;
      if (ok) {
        var yb = top - (min - basis + 0.5) * fh;
        seite.linie(gx + a * sp, yb, gx + b * sp, yb, rad * 2, FARBE.text, true);
        auf.forEach(function (i) { gezeichnet[i] = 1; });
      }
    }
    frets.forEach(function (f, i) {
      if (f && !gezeichnet[i]) seite.kreis(gx + i * sp, top - (f - basis + 0.5) * fh, rad, true, FARBE.text);
    });
    return gs + 12 + nf * fh + 6;
  }

  // ------------------------------------------------------------------ Song setzen
  var GR = 11, AKK_GR = 10, ZEILE = 14.2, AKK_ZEILE = 11.8, LUFT = 4.5;

  function Satz() { this.seiten = []; this.neueSeite(); }
  Satz.prototype.neueSeite = function () {
    this.seite = new Seite();
    this.seiten.push(this.seite);
    this.y = HOEHE - OBEN;
  };
  Satz.prototype.platz = function (h, fortsetzung) {
    if (this.y - h >= UNTEN) return;
    this.neueSeite();
    if (fortsetzung) {
      this.seite.text(RAND_L, this.y - 9, fortsetzung + ' (Fortsetzung)', 9, 'F3', FARBE.leise);
      this.y -= 22;
    }
  };

  // Textzeile mit Akkorden in Wörter zerlegen wie in der App (lieder.js zeileHtml)
  function woerter(teile, o, L) {
    var out = [], wort = [];
    teile.forEach(function (p) {
      var stuecke = (p.tx.match(/[^\s]*\s*/g) || []).filter(Boolean);
      if (!stuecke.length) stuecke = [''];
      stuecke.forEach(function (st, i) {
        var ch = i === 0 ? p.ch : null;
        if (i > 0 || (wort.length && /\s$/.test(wort[wort.length - 1].tx) && st)) { if (wort.length) out.push(wort); wort = []; }
        var akk = null;
        if (ch !== null) akk = ch.charAt(0) === '*' ? { anm: ch.slice(1) } : (L.istAkkord(ch) ? { name: L.tokenName(ch, o) } : { anm: ch });
        wort.push({ akk: akk, tx: st.replace(/\t/g, ' ') });
      });
    });
    if (wort.length) out.push(wort);
    // Akkorde dürfen über ihre Silbe hinausragen. Nur wenn sie den nächsten Akkord berühren, rückt die Silbe davor weiter.
    return out.map(function (w) {
      var x = 0, ende = null, erst = null;
      var teile2 = w.map(function (s) {
        var tb = breite(s.tx, GR, false);
        var aw = s.akk ? (s.akk.name ? akkBreite(s.akk.name, AKK_GR) : breite(s.akk.anm, AKK_GR - 1, false)) : 0;
        return { akk: s.akk, tx: s.tx, b: tb, aw: aw };
      });
      teile2.forEach(function (t, k) {
        if (t.akk) {
          if (ende !== null && x < ende && k > 0) { teile2[k - 1].b += ende - x; x = ende; }
          if (erst === null) erst = x;
          ende = x + t.aw + LUFT;
        }
        t.x = x;
        x += t.b;
      });
      return { teile: teile2, b: x, erst: erst, ende: ende };
    });
  }

  Satz.prototype.song = function (s, L) {
    var lied = s.lied, o = s.o, sp = this, breiteNutz = BREITE - RAND_L - RAND_R;
    // Kopf
    sp.platz(60);
    sp.seite.text(RAND_L, sp.y - 18, s.titel, 19, 'F2', FARBE.text);
    sp.y -= 26;
    var unter = [lied.untertitel, lied.kuenstler].filter(Boolean).join(' · ');
    if (unter) { sp.seite.text(RAND_L, sp.y - 11, unter, 11, 'F1', FARBE.leise); sp.y -= 16; }
    if (s.n) {
      sp.seite.text(RAND_L, sp.y - 10, (s.n > 0 ? s.n + ' Halbt' + (s.n === 1 ? 'on' : 'öne') + ' höher' : (-s.n) + ' Halbt' + (s.n === -1 ? 'on' : 'öne') + ' tiefer') + ' als im Original', 9.5, 'F1', FARBE.akkord);
      sp.y -= 14;
    }
    sp.y -= 8;
    // Griffbilder
    if (s.griffe && s.griffe.length) {
      var w = s.inst === 'ukulele' ? 40 : 48, abstand = 10, proZeile = Math.max(1, Math.floor((breiteNutz + abstand) / (w + abstand)));
      for (var i = 0; i < s.griffe.length; i += proZeile) {
        var reihe = s.griffe.slice(i, i + proZeile), h = 0;
        sp.platz(80);
        reihe.forEach(function (g, k) {
          var x = RAND_L + k * (w + abstand);
          if (g.f) h = Math.max(h, griffbild(sp.seite, x, sp.y, w, g.f, g.name));
          else akkZeichnen(sp.seite, x, sp.y - 9.5, g.name, 9.5, FARBE.akkord);
        });
        sp.y -= Math.max(h, 20) + 4;
      }
      sp.y -= 6;
    }
    // Text
    lied.zeilen.forEach(function (z) {
      if (z.art === 'leer') { sp.y -= 7; return; }
      if (z.art === 'abschnitt') {
        sp.platz(ZEILE * 2 + 8, s.titel);
        sp.y -= 5;
        sp.seite.text(RAND_L, sp.y - 9, z.text.toUpperCase(), 8.5, 'F2', FARBE.abschnitt);
        sp.y -= 13;
        return;
      }
      if (z.art === 'notiz') {
        umbrechen(z.text, breiteNutz, 10, false).forEach(function (t) {
          sp.platz(ZEILE, s.titel);
          sp.seite.text(RAND_L, sp.y - 10, t, 10, 'F3', FARBE.leise);
          sp.y -= ZEILE;
        });
        return;
      }
      if (z.art === 'bild') return;
      if (z.art === 'akkorde') {
        // wie in der App (SB_LIED.folge): Klammern und Satzzeichen hängen ohne Abstand am Akkord
        var x = RAND_L;
        sp.platz(ZEILE, s.titel);
        L.folge(z.teile).forEach(function (gruppe) {
          var teile = gruppe.map(function (st) {
            var t = st.ch !== undefined ? (st.ch.charAt(0) === '*' ? { anm: st.ch.slice(1) } : (L.istAkkord(st.ch) ? { name: L.tokenName(st.ch, o) } : { anm: st.ch })) : { zw: st.t };
            t.b = t.name ? akkBreite(t.name, AKK_GR + 0.5) : breite(t.anm || t.zw, 9.5, false);
            return t;
          });
          var gb = teile.reduce(function (a, t) { return a + t.b; }, 0) + (teile.length - 1) * 1.5;
          if (x + gb > BREITE - RAND_R && x > RAND_L) { sp.y -= ZEILE; sp.platz(ZEILE, s.titel); x = RAND_L; }
          teile.forEach(function (t) {
            if (t.name) akkZeichnen(sp.seite, x, sp.y - 10.5, t.name, AKK_GR + 0.5, FARBE.akkord);
            else sp.seite.text(x, sp.y - 10.5, t.anm || t.zw, 9.5, t.anm ? 'F3' : 'F1', FARBE.leise);
            x += t.b + 1.5;
          });
          x += 7.5;
        });
        sp.y -= ZEILE;
        return;
      }
      var mitAkk = z.teile.some(function (p) { return p.ch !== null; });
      if (!mitAkk) {
        umbrechen(z.teile.map(function (p) { return p.tx; }).join('').replace(/\t/g, ' '), breiteNutz, GR, false).forEach(function (t) {
          sp.platz(ZEILE, s.titel);
          sp.seite.text(RAND_L, sp.y - GR, t, GR, 'F1', FARBE.text);
          sp.y -= ZEILE;
        });
        return;
      }
      // Zeile mit Akkorden über der Silbe, bei Bedarf zwischen Wörtern umbrochen
      var ws = woerter(z.teile, o, L), zeilen = [[]], b = 0, akkEnde = null;
      ws.forEach(function (w) {
        var schub = akkEnde !== null && w.erst !== null && b + w.erst < akkEnde ? akkEnde - (b + w.erst) : 0;
        if (b + schub + w.b > breiteNutz && zeilen[zeilen.length - 1].length) { zeilen.push([]); b = 0; schub = 0; akkEnde = null; }
        zeilen[zeilen.length - 1].push({ w: w, x: b + schub });
        if (w.ende !== null) akkEnde = b + schub + w.ende;
        b += schub + w.b;
      });
      zeilen.forEach(function (zl) {
        var hatAkk = zl.some(function (e) { return e.w.teile.some(function (t) { return t.akk; }); });
        var h = (hatAkk ? AKK_ZEILE : 0) + ZEILE;
        sp.platz(h, s.titel);
        var yA = sp.y - AKK_GR, yT = sp.y - (hatAkk ? AKK_ZEILE : 0) - GR;
        zl.forEach(function (e) {
          e.w.teile.forEach(function (t) {
            var x = RAND_L + e.x + t.x;
            if (t.akk && t.akk.name) akkZeichnen(sp.seite, x, yA, t.akk.name, AKK_GR, FARBE.akkord);
            else if (t.akk) sp.seite.text(x, yA, t.akk.anm, AKK_GR - 1, 'F3', FARBE.leise);
            if (t.tx.trim()) sp.seite.text(x, yT, t.tx.replace(/\s+$/, ''), GR, 'F1', FARBE.text);
          });
        });
        sp.y -= h;
      });
    });
  };

  function umbrechen(text, max, groesse, fett) {
    var w = text.split(/(\s+)/), zeilen = [], z = '';
    w.forEach(function (t) {
      if (breite(z + t, groesse, fett) > max && z.trim()) { zeilen.push(z.replace(/\s+$/, '')); z = t.replace(/^\s+/, ''); }
      else z += t;
    });
    if (z.trim() || !zeilen.length) zeilen.push(z.replace(/\s+$/, ''));
    return zeilen;
  }

  // ------------------------------------------------------------------ Datei
  // o: { titel, songs: [{ lied, o, titel, griffe, inst, n }], inhalt: [{ titel } | { trenner }] (nur Setlisten) }
  function erzeuge(o, L) {
    L = L || SB_LIED;
    var satz = new Satz(), start = [];
    o.songs.forEach(function (s, i) {
      if (i) satz.neueSeite();
      start.push(satz.seiten.length);
      satz.song(s, L);
    });
    var seiten = satz.seiten;
    // Setliste: Inhaltsverzeichnis vorne. Die Seitenzahlen hängen davon ab, wie lang es selbst wird.
    if (o.inhalt) {
      var baue = function (vorne) {
        var iv = new Satz(), nr = 0, k = 0;
        iv.seite.text(RAND_L, iv.y - 22, o.titel, 22, 'F2', FARBE.text);
        iv.y -= 32;
        iv.seite.text(RAND_L, iv.y - 10, o.songs.length === 1 ? 'Ein Song' : o.songs.length + ' Songs', 10, 'F1', FARBE.leise);
        iv.y -= 26;
        o.inhalt.forEach(function (e) {
          iv.platz(19);
          if (e.trenner !== undefined) {
            iv.y -= 4;
            iv.seite.text(RAND_L, iv.y - 10, e.trenner.toUpperCase(), 9, 'F2', FARBE.warm);
            iv.y -= 17;
            return;
          }
          nr++;
          var seite = String(start[k++] + vorne);
          iv.seite.text(RAND_L, iv.y - 11.5, nr + '.', 11.5, 'F1', FARBE.leise);
          iv.seite.text(RAND_L + 26, iv.y - 11.5, e.titel, 11.5, 'F1', FARBE.text);
          iv.seite.text(BREITE - RAND_R - breite(seite, 11, false), iv.y - 11.5, seite, 11, 'F1', FARBE.leise);
          iv.y -= 19;
        });
        return iv;
      };
      var iv = baue(1);
      if (iv.seiten.length !== 1) iv = baue(iv.seiten.length);
      seiten = iv.seiten.concat(seiten);
    }
    // Fußzeile
    seiten.forEach(function (s, i) {
      var r = 'Seite ' + (i + 1) + ' von ' + seiten.length;
      s.text(RAND_L, 30, o.titel, 8, 'F1', FARBE.leise);
      s.text(BREITE - RAND_R - breite(r, 8, false), 30, r, 8, 'F1', FARBE.leise);
    });
    return datei(seiten, o.titel);
  }

  function datei(seiten, titel) {
    var teile = ['%PDF-1.4\n%âãÏÓ\n'], laenge = teile[0].length, xref = [];
    function obj(nr, inhalt) {
      xref[nr] = laenge;
      var s = nr + ' 0 obj\n' + inhalt + '\nendobj\n';
      teile.push(s);
      laenge += s.length;
    }
    var n = seiten.length, fonts = 3, ersteSeite = 7;
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    var kids = [];
    for (var i = 0; i < n; i++) kids.push((ersteSeite + 2 * i) + ' 0 R');
    obj(2, '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>');
    obj(fonts, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj(fonts + 1, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    obj(fonts + 2, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');
    obj(6, '<< /Title ' + pdfText(titel || 'Songbook') + ' /Creator (Songbook) /Producer (Songbook) >>');
    seiten.forEach(function (s, i) {
      var inhalt = s.ops.join('\n');
      obj(ersteSeite + 2 * i, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + zahl(BREITE) + ' ' + zahl(HOEHE) + '] ' +
        '/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ' + (ersteSeite + 2 * i + 1) + ' 0 R >>');
      obj(ersteSeite + 2 * i + 1, '<< /Length ' + inhalt.length + ' >>\nstream\n' + inhalt + '\nendstream');
    });
    var anzahl = ersteSeite + 2 * n;
    var x = 'xref\n0 ' + anzahl + '\n0000000000 65535 f \n';
    for (var k = 1; k < anzahl; k++) x += ('0000000000' + xref[k]).slice(-10) + ' 00000 n \n';
    teile.push(x + 'trailer\n<< /Size ' + anzahl + ' /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + laenge + '\n%%EOF\n');
    var str = teile.join(''), bytes = new Uint8Array(str.length);
    for (var j = 0; j < str.length; j++) bytes[j] = str.charCodeAt(j) & 255;
    return bytes;
  }

  return { erzeuge: erzeuge, breite: breite, _code: code };
})();
