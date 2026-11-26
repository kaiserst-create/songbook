// Prüft das Songbook ohne Browser. Aufruf im Projektordner:
//   osascript -l JavaScript skripte/pruefen.js [Ordner für Test-PDFs]
// Muss mit 0 Fehlern enden.
ObjC.import('Foundation');
ObjC.import('AppKit');

function run(argv) {
  var args = ObjC.deepUnwrap($.NSProcessInfo.processInfo.arguments);
  var cwd = $.NSFileManager.defaultManager.currentDirectoryPath.js;
  var skript = args.find(function (a) { return /pruefen\.js$/.test(a); }) || 'skripte/pruefen.js';
  if (skript.charAt(0) !== '/') skript = cwd + '/' + skript;
  var A = $(skript).stringByStandardizingPath.stringByDeletingLastPathComponent.stringByDeletingLastPathComponent.js;
  var pdfOrdner = argv && argv[0];
  var fehler = [], hinweise = [], tests = 0;
  function melde(t) { fehler.push(t); }
  function pruefe(ok, t) { tests++; if (!ok) melde(t); }
  function lade(p) {
    var s = $.NSString.stringWithContentsOfFileEncodingError(A + '/' + p, $.NSUTF8StringEncoding, null);
    if (s.isNil()) { melde('Datei fehlt: ' + p); return ''; }
    return s.js;
  }
  function gibt(p) { return $.NSFileManager.defaultManager.fileExistsAtPath(A + '/' + p); }

  // ------------------------------------------------------------------ Syntax aller Skripte
  var DATEIEN = ['griffe.js', 'musik.js', 'lieder.js', 'songs.js', 'pdf.js', 'installieren.js', 'app.js', 'sw.js'];
  var code = {};
  DATEIEN.forEach(function (d) {
    code[d] = lade(d);
    try { new Function(code[d]); tests++; } catch (e) { melde('Syntaxfehler in ' + d + ': ' + e.message); }
  });
  var g = {};
  try {
    (new Function('g', code['griffe.js'] + '\n' + code['musik.js'] + '\n' + code['lieder.js'] + '\n' + code['songs.js'] + '\n' + code['pdf.js'] + '\n' + code['installieren.js'] +
      '\ng.SC = SC; g.L = SB_LIED; g.D = SB_DATEN; g.PDF = SB_PDF; g.INSTALL = SB_INSTALL;'))(g);
  } catch (e) { melde('Laden: ' + e.message); return fehler.join('\n'); }
  var SC = g.SC, L = g.L, D = g.D, PDF = g.PDF;

  // ------------------------------------------------------------------ Akkorde lesen
  function name(s, n, deutsch) {
    var lied = L.lies('[' + s + ']x');
    return L.tokenName(s, L.namenOpt(lied, n || 0, deutsch !== false));
  }
  [
    ['C', 'C'], ['B', 'H'], ['Bb', 'B♭'], ['B♭', 'B♭'], ['Bbm', 'B♭m'], ['H7', 'H7'], ['F#m7', 'F#m7'], ['Eb', 'E♭'], ['Ab', 'A♭'], ['Db', 'D♭'], ['Gb', 'G♭'],
    ['G/B', 'G/H'], ['D/F#', 'D/F#'], ['Dm/B', 'Dm/H'], ['Cadd9', 'Cadd9'], ['A7sus4', 'A7sus4'], ['Bb6', 'B♭6'], ['C#5', 'C#5'],
    ['C-Csus4-C', 'C-Csus4-C'], ['(Em)', '(Em)'], ['C/C7', 'C/C7'], ['/A', '/A'], ['(C/C7)', '(C/C7)'], ['E2', 'E2'], ['G4', 'G4'],
  ].forEach(function (f) { pruefe(name(f[0]) === f[1], 'Akkordname ' + f[0] + ' → ' + name(f[0]) + ' statt ' + f[1]); });
  pruefe(name('B', 0, false) === 'B', 'international: B bleibt B');
  pruefe(name('H7', 0, false) === 'B7', 'international: H7 wird B7');
  ['Bridge', 'Chorus', 'Ending', 'Coda', '2x', 'SOLO', 'Refrain', 'Am Schluss', 'Hm Hm', '', 'x'].forEach(function (s) {
    pruefe(!L.istAkkord(s), '„' + s + '“ darf kein Akkord sein');
  });
  // Transponieren mit passender Schreibweise
  function trans(akk, n) { var lied = L.lies(akk.map(function (a) { return '[' + a + ']'; }).join(' ')); var o = L.namenOpt(lied, n, true); return L.akkorde(lied).map(function (a) { return L.akkordName(a, o); }).join(' '); }
  [
    [['C', 'F', 'G', 'Am'], 2, 'D G A Hm'], [['C', 'F', 'G', 'Am'], 5, 'F B♭ C Dm'], [['C', 'F', 'G', 'Am'], 1, 'D♭ G♭ A♭ B♭m'],
    [['G', 'C', 'D', 'Em'], -2, 'F B♭ C Dm'], [['Am', 'F', 'C', 'G'], 1, 'B♭m G♭ D♭ A♭'], [['E', 'A', 'H'], 2, 'F# H C#'],
    [['Bbm', 'Gb', 'F'], 2, 'Cm A♭ G'], [['Em', 'C', 'D'], 3, 'Gm E♭ F'], [['D', 'G', 'A'], -1, 'D♭ G♭ A♭'],
  ].forEach(function (f) { var r = trans(f[0], f[1]); pruefe(r === f[2], 'Transponieren ' + f[0].join(' ') + ' um ' + f[1] + ': ' + r + ' statt ' + f[2]); });
  pruefe(L.transponiereText('{title: X}\n[Verse]\n[G]Hal[D/F#]lo [*2x] [Em]', 2) === '{title: X}\n[Verse]\n[A]Hal[E/G#]lo [*2x] [F#m]', 'transponiereText: ' + L.transponiereText('{title: X}\n[Verse]\n[G]Hal[D/F#]lo [*2x] [Em]', 2));
  // Akkordfolgen: Klammern hängen am Akkord
  var fg = L.folge(L.teile('[C] [G] (Original [Eb] [Bb]) ([Am] [F]), x2')).map(function (gr) { return gr.map(function (st) { return st.ch !== undefined ? st.ch : st.t; }).join('|'); });
  pruefe(JSON.stringify(fg) === JSON.stringify(['C', 'G', '(Original', 'Eb', 'Bb|)', '(|Am', 'F|),', 'x2']), 'Akkordfolge mit Klammern: ' + JSON.stringify(fg));
  // Akkorde über dem Text umwandeln
  var ue = L.ueberText('[Verse 1]\nG       C\nEine Welt liegt\nAm  F  C  G\n\nRefrain:\nD\nHallo');
  pruefe(ue === '[Verse 1]\n[G]Eine Wel[C]t liegt\n[Am] [F] [C] [G]\n\n[Refrain]\n[D]Hallo', 'ueberText: ' + JSON.stringify(ue));
  // Darstellung
  var h = L.html(L.lies('{title: T}\n[Refrain]\n[G]Eine [C]Welt\n[C] [F] - [G]\n{c: Hinweis}\nohne'), null);
  pruefe(/class="abschnitt refrain"/.test(h) && /data-griff="G"/.test(h) && /class="zeile folge"/.test(h) && /class="notiz"/.test(h), 'HTML-Darstellung unvollständig');

  // ------------------------------------------------------------------ Alle Songs
  var ids = {}, ohneGriff = [], akkorde = 0;
  D.songs.forEach(function (s) {
    pruefe(!ids[s.id], 'Song-ID doppelt: ' + s.id);
    ids[s.id] = 1;
    var lied = L.lies(s.text);
    pruefe(!!lied.titel, s.id + ': ohne Titel');
    pruefe(/^[a-z0-9-]+$/.test(s.id), s.id + ': ID mit Sonderzeichen');
    var html = L.html(lied, L.namenOpt(lied, 0, true));
    pruefe(html.indexOf('undefined') < 0 && html.indexOf('NaN') < 0, s.id + ': HTML enthält undefined');
    L.akkorde(lied).forEach(function (a) {
      akkorde++;
      var gn = L.griffName(a, 0);
      if (!gn) { ohneGriff.push(s.id + ' ' + L.akkordName(a, L.namenOpt(lied, 0, true))); return; }
      ['gitarre', 'ukulele'].forEach(function (inst) {
        var v = SC.varianten(inst, gn);
        if (!v.length) ohneGriff.push(s.id + ' ' + inst + ' ' + gn);
        v.forEach(function (x) {
          var p = SC.parseAkkord(gn), basis = inst === 'ukulele' || p.bass === null ? null : p.bass;
          var t = SC.TYPES[p.typ];
          var toene = t[0].map(function (i) { return (p.root + i) % 12; });
          if (basis !== null && toene.indexOf(basis) < 0) toene.push(basis);
          var gespielt = x.f.map(function (f, i) { return f === null ? null : (SC.TUNING[inst][i] + f) % 12; }).filter(function (t) { return t !== null; });
          if (gespielt.some(function (t) { return toene.indexOf(t) < 0; })) ohneGriff.push(s.id + ' ' + inst + ' ' + gn + ' falscher Ton in ' + SC.fs(x.f));
        });
      });
    });
    // Transponieren: zwölf Halbtöne weiter ist wieder das Original, jeder Schritt erhält die Tonhöhen
    var o0 = L.namenOpt(lied, 0, true);
    L.akkorde(lied).forEach(function (a) {
      for (var n = 1; n < 12; n++) {
        var on = L.namenOpt(lied, n, true), nm = L.akkordName(a, on), b = L.einAkkord(nm.replace(/♭/g, 'b').replace(/^\//, ''));
        var erwartet = (a.pc + n) % 12;
        if (!b || b.pc !== erwartet) { melde(s.id + ': ' + L.akkordName(a, o0) + ' um ' + n + ' → ' + nm); break; }
      }
    });
    var t12 = L.transponiereText(s.text, 12);
    pruefe(L.akkorde(L.lies(t12)).length === L.akkorde(lied).length, s.id + ': transponiereText ändert die Zahl der Akkorde');
  });
  pruefe(!ohneGriff.length, 'Ohne Griff oder falsch: ' + ohneGriff.slice(0, 12).join('; '));
  pruefe(D.songs.length >= 80, 'Zu wenige Songs: ' + D.songs.length);

  // Setlisten
  D.setlisten.forEach(function (l) {
    pruefe(l.eintraege.length > 0, 'Setliste leer: ' + l.name);
    l.eintraege.forEach(function (e) { if (e.song) pruefe(!!ids[e.song], 'Setliste ' + l.name + ': Song fehlt ' + e.song); });
  });
  ['Amadeus in Concert 2024', 'Slibovitz – Rock im Tennis 2024', 'Slibovitz – Rock im Tennis 2025', 'Punschstand 2024', 'Eigene Songs'].forEach(function (n) {
    pruefe(D.setlisten.some(function (l) { return l.name === n; }), 'Setliste fehlt: ' + n);
  });

  // ------------------------------------------------------------------ PDF
  function pdfPruefen(bytes, wofuer) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    pruefe(s.indexOf('%PDF-1.4') === 0 && /%%EOF\n$/.test(s), wofuer + ': Anfang oder Ende falsch');
    var sx = parseInt(/startxref\n(\d+)/.exec(s)[1], 10);
    pruefe(s.slice(sx, sx + 4) === 'xref', wofuer + ': startxref zeigt nicht auf xref');
    var zeilen = s.slice(sx).split('\n'), anzahl = parseInt(zeilen[1].split(' ')[1], 10);
    for (var k = 1; k < anzahl; k++) {
      var off = parseInt(zeilen[2 + k].slice(0, 10), 10);
      if (s.slice(off, off + (k + ' 0 obj').length) !== k + ' 0 obj') { melde(wofuer + ': xref von Objekt ' + k + ' falsch'); break; }
    }
    (s.match(/\/Length (\d+) >>\nstream\n/g) || []).forEach(function () { tests++; });
    var re = /\/Length (\d+) >>\nstream\n/g, m;
    while ((m = re.exec(s))) {
      var start = m.index + m[0].length, len = parseInt(m[1], 10);
      if (s.slice(start + len, start + len + 10) !== '\nendstream') { melde(wofuer + ': Stream-Länge falsch'); break; }
    }
    return s;
  }
  function pdfSong(id, inst, n) {
    var t = D.songs.filter(function (s) { return s.id === id; })[0].text, lied = L.lies(t), o = L.namenOpt(lied, n || 0, true);
    var griffe = inst ? L.akkorde(lied).map(function (a) { var gn = L.griffName(a, o.n), v = gn ? SC.varianten(inst, gn) : []; return { name: L.akkordName(a, o), f: v.length ? v[0].f : null }; }) : null;
    return { lied: lied, o: o, titel: lied.titel, griffe: griffe, inst: inst, n: n || 0 };
  }
  var p1 = PDF.erzeuge({ titel: 'Backstreet', songs: [pdfSong('backstreet-s-back', 'gitarre', 2)] });
  pdfPruefen(p1, 'PDF Song');
  var sl = D.setlisten.filter(function (l) { return l.id === 'punschstand-2024'; })[0];   // kurz genug zum Ansehen
  var songsSl = sl.eintraege.filter(function (e) { return e.song; }).map(function (e) { return pdfSong(e.song, 'ukulele', 0); });
  var p2 = PDF.erzeuge({ titel: sl.name, songs: songsSl, inhalt: sl.eintraege.map(function (e) { return e.trenner ? { trenner: e.trenner } : { titel: L.lies(D.songs.filter(function (s) { return s.id === e.song; })[0].text).titel }; }) });
  var s2 = pdfPruefen(p2, 'PDF Setliste');
  pruefe((s2.match(/\/Type \/Page /g) || []).length >= songsSl.length + 1, 'PDF Setliste: zu wenige Seiten');
  // jeder Song einzeln, mit und ohne Griffe
  D.songs.forEach(function (s, i) {
    try { pdfPruefen(PDF.erzeuge({ titel: s.id, songs: [pdfSong(s.id, i % 2 ? 'gitarre' : null, i % 5 - 2)] }), 'PDF ' + s.id); }
    catch (e) { melde('PDF ' + s.id + ': ' + e.message); }
  });
  if (pdfOrdner) {
    [['test-song.pdf', p1], ['test-setliste.pdf', p2]].forEach(function (x) {
      var d = $.NSMutableData.dataWithLength(x[1].length), ptr = d.mutableBytes;
      var b64 = '', bin = '';
      for (var i = 0; i < x[1].length; i++) bin += String.fromCharCode(x[1][i]);
      // über Base64, weil JXA keine Bytes direkt schreibt
      b64 = $(bin).dataUsingEncoding($.NSISOLatin1StringEncoding);
      b64.writeToFileAtomically(pdfOrdner + '/' + x[0], true);
      void d; void ptr;
    });
    hinweise.push('Test-PDFs in ' + pdfOrdner);
  }

  // ------------------------------------------------------------------ Seite, Offline-Liste, IDs, Texte
  var index = lade('index.html');
  var sw = code['sw.js'];
  var liste = /var DATEIEN = \[([\s\S]*?)\];/.exec(sw)[1];
  var eingebunden = [];
  index.replace(/(?:src|href)="([^"#:]+)"/g, function (a, p) { eingebunden.push(p); });
  eingebunden.forEach(function (p) {
    pruefe(liste.indexOf("'" + p + "'") >= 0, 'Nicht in der Offline-Liste (sw.js): ' + p);
    pruefe(gibt(p), 'Eingebunden, aber fehlt: ' + p);
  });
  liste.replace(/'([^']+)'/g, function (a, p) { if (p !== './') pruefe(gibt(p), 'In sw.js, aber fehlt: ' + p); });
  ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'].forEach(function (p) {
    pruefe(liste.indexOf("'" + p + "'") >= 0, 'Icon nicht offline: ' + p);
    var rep = $.NSBitmapImageRep.imageRepWithContentsOfFile(A + '/' + p);
    if (rep.isNil()) { melde('Icon fehlt: ' + p); return; }
    var soll = /192/.test(p) ? 192 : (/apple/.test(p) ? 180 : 512);
    pruefe(Number(rep.pixelsWide) === soll && Number(rep.pixelsHigh) === soll, 'Icon ' + p + ' hat ' + rep.pixelsWide + 'x' + rep.pixelsHigh + ' statt ' + soll + ' Pixel');
    var ecke = Number(rep.colorAtXY(2, 2).alphaComponent), randlos = /maskable|apple/.test(p);
    pruefe(randlos ? ecke === 1 : ecke === 0, 'Icon ' + p + ': Ecke ' + (randlos ? 'nicht randlos' : 'nicht durchsichtig'));
  });
  pruefe(/var VERSION = 'songbook-\d{4}-\d\d-\d\d-\d+'/.test(sw), 'VERSION in sw.js fehlt oder falsch');
  pruefe(/k\.indexOf\('songbook-'\) === 0/.test(sw), 'sw.js löscht nicht nur eigene Speicher');
  // Jede gesuchte ID muss es geben
  var idsSeite = {};
  index.replace(/\sid="([^"]+)"/g, function (a, i) { pruefe(!idsSeite[i], 'ID doppelt in index.html: ' + i); idsSeite[i] = 1; });
  [code['app.js'], code['installieren.js']].forEach(function (c) {
    // dlg-… erzeugen die Dialoge selbst, #v- wird mit dem Namen der Ansicht ergänzt
    c.replace(/\$\('#([a-zA-Z0-9-]+)/g, function (a, i) { if (/^dlg-(feld|suche|songs)$/.test(i) || /-$/.test(i)) return; pruefe(!!idsSeite[i], 'ID fehlt in index.html: #' + i); });
    c.replace(/getElementById\('([a-zA-Z0-9-]+)'\)/g, function (a, i) { pruefe(!!idsSeite[i], 'ID fehlt in index.html: ' + i); });
  });
  // Speicherschlüssel nur mit songbook-
  code['app.js'].replace(/localStorage\.(?:getItem|setItem)\('([^']+)'/g, function (a, k) { pruefe(k.indexOf('songbook-') === 0, 'Speicherschlüssel ohne songbook-: ' + k); });
  code['app.js'].replace(/var (?:D?SCHLUESSEL) = '([^']+)'/g, function (a, k) { pruefe(k.indexOf('songbook-') === 0, 'Speicherschlüssel ohne songbook-: ' + k); });
  // Keine Gedankenstriche in sichtbaren Texten
  var sichtbar = index.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
  pruefe(!/\s[–—]\s/.test(sichtbar), 'Gedankenstrich in index.html: ' + (/.{0,30}\s[–—]\s.{0,30}/.exec(sichtbar) || [''])[0]);
  (code['app.js'].match(/'[^'\n]*'/g) || []).forEach(function (s) { pruefe(!/\s[–—]\s/.test(s), 'Gedankenstrich in app.js: ' + s); });

  // ------------------------------------------------------------------ Hinweis zum Installieren (Testgeräte wie im Tuner)
  var I = g.INSTALL;
  var IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';
  var ANDROID = 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko)';
  var geraete = [
    ['iPhone Safari', IPHONE + ' Version/18.5 Mobile/15E148 Safari/604.1', 5, 'ios'],
    ['iPad Safari (meldet sich als Mac)', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15', 5, 'ios'],
    ['altes iPad Safari', 'Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1', 5, 'ios'],
    ['iPhone Chrome', IPHONE + ' CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1', 5, 'ios-anders'],
    ['iPhone Firefox', IPHONE + ' FxiOS/133.0 Mobile/15E148 Safari/605.1.15', 5, 'ios-anders'],
    ['iPhone Edge', IPHONE + ' Version/18.0 EdgiOS/131.0.2903.68 Mobile/15E148 Safari/605.1.15', 5, 'ios-anders'],
    ['iPhone Instagram', IPHONE + ' Mobile/15E148 Instagram 357.0.0.25.101 (iPhone14,5; iOS 18_5; de_DE; de; scale=3.00; 1170x2532)', 5, 'ios-app'],
    ['iPhone Facebook', IPHONE + ' Mobile/15E148 [FBAN/FBIOS;FBAV/490.0.0.38.107;FBBV/123;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS]', 5, 'ios-app'],
    ['iPhone eingebettete Ansicht', IPHONE + ' Mobile/15E148', 5, 'ios-app'],
    ['Android Chrome', ANDROID + ' Chrome/131.0.0.0 Mobile Safari/537.36', 5, 'android'],
    ['Android Samsung Internet', 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36', 5, 'android'],
    ['Android Firefox', 'Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0', 5, 'android'],
    ['Android-Tablet Chrome', 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', 5, 'android'],
    ['Android eingebettete Ansicht', 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.81 Mobile Safari/537.36', 5, 'android-app'],
    ['Android Instagram', 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.81 Mobile Safari/537.36 Instagram 357.0.0.13.112 Android', 5, 'android-app'],
    ['Mac Safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15', 0, ''],
    ['Windows Chrome', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', 0, ''],
    ['Linux Firefox', 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0', 0, ''],
  ];
  geraete.forEach(function (x) {
    var ist = I.art({ ua: x[1], touch: x[2], installiert: false, protokoll: 'https:' });
    pruefe(ist === x[3], 'Installieren: ' + x[0] + ' erkannt als „' + ist + '“ statt „' + x[3] + '“');
    if (x[3]) {
      pruefe(!I.art({ ua: x[1], touch: x[2], installiert: true, protokoll: 'https:' }), 'Installieren: ' + x[0] + ' schon installiert, trotzdem Hinweis');
      pruefe(!I.art({ ua: x[1], touch: x[2], installiert: false, protokoll: 'file:' }), 'Installieren: ' + x[0] + ' als Datei geöffnet, trotzdem Hinweis');
    }
  });
  ['ios', 'ios-anders', 'ios-app', 'android', 'android-app'].forEach(function (a) {
    [false, true].forEach(function (knopf) {
      var x = I.inhalt(a, knopf);
      if (!x || !x.nutzen || (!x.schritte.length && !x.knopf)) { melde('Installieren: Hinweis für ' + a + ' leer'); return; }
      pruefe(!!x.knopf === (a === 'android' && knopf), 'Installieren: Knopf bei ' + a + ' falsch');
      var text = [x.nutzen, x.notiz || ''].concat(x.schritte).join(' ').replace(/<[^>]+>/g, '');
      pruefe(!/ [–—] /.test(text), 'Installieren: Gedankenstrich im Hinweis für ' + a);
      pruefe(a.indexOf('ios') === 0 ? !/Startbildschirm/.test(text) : !/Home-Bildschirm/.test(text), 'Installieren: falscher Name des Bildschirms bei ' + a);
      pruefe(/Songbook/.test(x.nutzen) && !/Tuner|Chords/.test(text), 'Installieren: falscher App-Name im Hinweis für ' + a);
    });
  });
  pruefe(!I.inhalt('', false), 'Installieren: Hinweis ohne Gerät');
  ['install-hinweis', 'ih-nutzen', 'ih-schritte', 'ih-notiz', 'ih-installieren', 'ih-zu', 'install-zeile', 'install-oeffnen'].forEach(function (i) {
    pruefe(!!idsSeite[i], 'Installieren: ' + i + ' fehlt in index.html');
  });
  pruefe(/SB_INSTALL\.einrichten\(/.test(code['app.js']), 'Installieren: Hinweis wird nicht eingerichtet');
  pruefe(/installZu: false/.test(code['app.js']), 'Installieren: installZu fehlt im Zustand');
  hinweise.push(geraete.length + ' Geräte für den Hinweis zum Installieren geprüft');

  // ------------------------------------------------------------------ Im Hintergrund läuft nichts
  DATEIEN.forEach(function (d) { pruefe(!/setInterval\s*\(/.test(code[d]), 'setInterval in ' + d + ' (nicht erlaubt)'); });
  pruefe(!/addEventListener\('(sync|periodicsync|push|backgroundfetch\w*|notificationclick)'/.test(sw), 'sw.js: Push oder Hintergrund-Sync (nicht erlaubt)');
  pruefe(!/(periodicSync|pushManager|backgroundFetch|Notification\.requestPermission)/.test(code['app.js'] + sw), 'Push, Hintergrund-Sync oder Benachrichtigungen (nicht erlaubt)');
  var ruheFn = /function ruhe\(\) \{([\s\S]*?)\n  \}/.exec(code['app.js']);
  pruefe(!!ruheFn, 'ruhe() fehlt in app.js');
  if (ruheFn) ['merkeOrt()', 'stoppScroll()', 'SC.Klang.ruhe()', 'wachHalten(false)', 'adressenFrei()', 'clearTimeout(suchZeit)', 'clearTimeout(vorschauZeit)', 'clearTimeout(abstandZeit)'].forEach(function (x) {
    pruefe(ruheFn[1].indexOf(x) >= 0, 'ruhe() ruft ' + x + ' nicht auf');
  });
  pruefe(/visibilitychange', function \(\) \{\s*if \(document\.hidden\) ruhe\(\);/.test(code['app.js']), 'visibilitychange ruft ruhe() nicht auf');
  pruefe(/addEventListener\('pagehide', ruhe\)/.test(code['app.js']), 'pagehide ruft ruhe() nicht auf');
  pruefe(/requestAnimationFrame\(scrollSchritt\)/.test(code['app.js']) && !/setTimeout\(scrollSchritt/.test(code['app.js']), 'Scrollen soll requestAnimationFrame nutzen (pausiert im Hintergrund)');
  pruefe(!/setTimeout\(function \(\) \{ URL\.revokeObjectURL/.test(code['app.js']), 'Timer zum Freigeben der Download-Adresse läuft im Hintergrund weiter');

  // ------------------------------------------------------------------ Keine Variable überschreibt eine Funktion gleichen Namens
  // (so war „startScroll“ einmal kaputt: eine Variable gleichen Namens hat die Funktion ersetzt)
  ['app.js', 'lieder.js', 'pdf.js', 'installieren.js'].forEach(function (d) {
    var c = code[d], namen = [];
    c.replace(/^ {2}function ([A-Za-z_$][\w$]*)\s*\(/gm, function (a, n) { namen.push(n); });
    namen.forEach(function (n) {
      pruefe(namen.filter(function (x) { return x === n; }).length === 1, d + ': Funktion ' + n + ' doppelt');
      var re = new RegExp('^ {2}var [^;]*?(^|[\\s,])' + n.replace(/\$/g, '\\$') + '\\s*=', 'm');
      pruefe(!re.test(c) && !new RegExp('^ {2}' + n + '\\s*=[^=]', 'm').test(c), d + ': Variable überschreibt Funktion ' + n);
    });
  });

  // ------------------------------------------------------------------ Neustart: dort weiter, wo die App war
  pruefe(/history\.replaceState\(null, '', S\.letzte\)/.test(code['app.js']), 'Start öffnet nicht die letzte Ansicht');
  pruefe(/letzte: '',/.test(code['app.js']) && /letzteScroll: 0,/.test(code['app.js']) && /entwurf: \{\},/.test(code['app.js']), 'Zustand für die letzte Ansicht fehlt');
  pruefe(/!\/\^#\\\/\.\/\.test\(location\.hash\)/.test(code['app.js']), 'Ein Link mit Ziel darf nicht von der letzten Ansicht überschrieben werden');

  // ------------------------------------------------------------------ Offline-Speicher wie in den anderen Apps
  pruefe(/req\.mode === 'navigate'[\s\S]*cache\.match\('index\.html'\)[\s\S]*allesLaden\(cache\)/.test(sw), 'sw.js: füllt den eigenen Speicher nicht wieder auf, wenn eine andere App ihn geleert hat');
  pruefe(/caches\.open\(VERSION\)/.test(sw) && /cache: 'reload'/.test(sw), 'sw.js: Speicher oder frisches Laden fehlt');
  pruefe(/skipWaiting\(\)/.test(sw) && /clients\.claim\(\)/.test(sw), 'sw.js: neue Fassung übernimmt nicht');
  pruefe(/!APP_DATEIEN\[new URL\(req\.url\)\.pathname\]\) return;/.test(sw), 'sw.js: speichert auch Dateien, die nicht zur App gehören');
  pruefe(/function imSpeicher\(\)/.test(code['app.js']), 'Offline-Anzeige prüft den Speicher nicht');
  pruefe(/navigator\.storage\.persist\(\)/.test(code['app.js']), 'eigene Daten werden nicht dauerhaft gespeichert');
  var mf = JSON.parse(lade('manifest.webmanifest'));
  pruefe(mf.start_url === './' && mf.scope === './' && mf.display === 'standalone', 'Manifest: start_url, scope oder display falsch');
  mf.icons.forEach(function (ic) { pruefe(liste.indexOf("'" + ic.src + "'") >= 0, 'Manifest-Icon nicht offline: ' + ic.src); });

  var out = [tests + ' Prüfungen, ' + D.songs.length + ' Songs, ' + akkorde + ' Akkorde, ' + D.setlisten.length + ' Setlisten'];
  out = out.concat(hinweise);
  out.push(fehler.length ? fehler.length + ' Fehler:\n' + fehler.slice(0, 40).join('\n') : '0 Fehler');
  return out.join('\n');
}
