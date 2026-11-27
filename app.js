// Songbook: Zustand, eigene Daten, Navigation und alle Ansichten (gleiche Funktionen wie Biene Meier: „nur Akkorde“, B♭/E♭, Spielzeiten).
// Songs lesen und darstellen: lieder.js. Griffe, Griffbilder und Klang: musik.js. PDF: pdf.js.
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var L = SB_LIED;
  var esc = L.esc;
  var enc = encodeURIComponent;

  // ------------------------------------------------------------------ Instrumente in B♭ und E♭
  // B♭-Instrumente (Trompete, Tenorsax, Klarinette) klingen einen Ganzton tiefer als notiert: sie lesen 2 Halbtöne höher.
  // E♭-Instrumente (Altsax, Baritonsax) klingen eine große Sexte tiefer: sie lesen 9 Halbtöne höher (gleich 3 tiefer).
  var STIMMUNG = {
    c: { n: 0, kurz: 'C', name: '' },
    b: { n: 2, kurz: 'B♭', name: 'für B♭-Instrumente' },
    es: { n: 9, kurz: 'E♭', name: 'für E♭-Instrumente' },
  };

  // ------------------------------------------------------------------ Einstellungen (bleiben im Browser)
  var SCHLUESSEL = 'songbook-zustand';
  var S = {
    reiter: 'songs',      // songs oder setlisten
    inst: 'aus',          // Griffbilder im Song: aus, gitarre, ukulele
    popInst: 'gitarre',   // Instrument im Griff-Popup, wenn die Griffleiste aus ist
    schrift: 17,          // Schriftgröße im Song (13 bis 32)
    scrollTempo: 3,       // 1 bis 10
    deutsch: true,        // Akkordnamen mit H (sonst B)
    wach: true,           // Bildschirm anlassen, solange ein Song offen ist
    transp: {},           // Song-ID → Halbtöne
    griffVar: {},         // 'gitarre|Am' → gewählter Griff
    installZu: false,
    // Wo die App zuletzt war: beim nächsten Start geht es genau dort weiter
    letzte: '',           // Hash der Ansicht, z. B. #/set/amadeus-in-concert-2024/3
    letzteScroll: 0,      // Scrollposition dort
    suche: '',            // Suchbegriff in der Songliste
    entwurf: {},          // offener Editor: { id, titel, kuenstler, text }
    transInst: 'c',       // alle Songs für c (klingend), b (B♭-Instrumente) oder es (E♭-Instrumente)
    nurAkkorde: false,    // Liedtext ausblenden: nur Akkorde, Abschnitte und Hinweise
  };
  try {
    var gespeichert = JSON.parse(localStorage.getItem(SCHLUESSEL) || '{}') || {};
    Object.keys(S).forEach(function (k) {
      var v = gespeichert[k];
      if (v === null || v === undefined || typeof v !== typeof S[k] || Array.isArray(v) !== Array.isArray(S[k]) || (typeof v === 'number' && !isFinite(v))) return;
      S[k] = v;
    });
  } catch (e) { /* ohne Speicher geht es auch */ }
  if (['songs', 'setlisten'].indexOf(S.reiter) < 0) S.reiter = 'songs';
  if (['aus', 'gitarre', 'ukulele'].indexOf(S.inst) < 0) S.inst = 'aus';
  if (!STIMMUNG.hasOwnProperty(S.transInst)) S.transInst = 'c';
  if (['gitarre', 'ukulele'].indexOf(S.popInst) < 0) S.popInst = 'gitarre';
  S.schrift = Math.min(32, Math.max(13, Math.round(S.schrift)));
  S.scrollTempo = Math.min(10, Math.max(1, Math.round(S.scrollTempo)));
  function speichern() { try { localStorage.setItem(SCHLUESSEL, JSON.stringify(S)); } catch (e) { /* egal */ } }

  // ------------------------------------------------------------------ Eigene Daten: Versionen, eigene Songs, Setlisten
  // songs: { id: { versionen: [{ zeit, text }], aktiv: Index oder -1 (Original aus dem Songbook) } }
  // eigene: IDs selbst angelegter Songs. setlisten: { id: Setliste } (eigene und geänderte aus dem Songbook)
  var DSCHLUESSEL = 'songbook-daten';
  var D = { format: 1, songs: {}, eigene: [], setlisten: {} };
  try {
    var dg = JSON.parse(localStorage.getItem(DSCHLUESSEL) || 'null');
    if (dg && dg.format === 1) D = pruefeDaten(dg);
  } catch (e) { /* kaputte Daten: neu anfangen */ }
  function pruefeDaten(x) {
    var d = { format: 1, songs: {}, eigene: [], setlisten: {} };
    if (x.songs && typeof x.songs === 'object') Object.keys(x.songs).forEach(function (id) {
      var s = x.songs[id];
      if (!s || !Array.isArray(s.versionen)) return;
      var v = s.versionen.filter(function (v) { return v && typeof v.text === 'string' && typeof v.zeit === 'number'; });
      var aktiv = typeof s.aktiv === 'number' ? Math.max(-1, Math.min(v.length - 1, Math.round(s.aktiv))) : v.length - 1;
      d.songs[id] = { versionen: v, aktiv: aktiv };
    });
    if (Array.isArray(x.eigene)) d.eigene = x.eigene.filter(function (id) { return typeof id === 'string' && d.songs[id] && d.songs[id].versionen.length; });
    if (x.setlisten && typeof x.setlisten === 'object') Object.keys(x.setlisten).forEach(function (id) {
      var l = x.setlisten[id];
      if (!l || typeof l.name !== 'string' || !Array.isArray(l.eintraege)) return;
      d.setlisten[id] = {
        id: id, name: l.name, eigen: !!l.eigen, erstellt: +l.erstellt || 0, geaendert: +l.geaendert || 0,
        eintraege: l.eintraege.filter(function (e) { return e && (typeof e.song === 'string' || typeof e.trenner === 'string'); })
          .map(function (e) {
            if (typeof e.song !== 'string') return { trenner: e.trenner };
            var x = { song: e.song };
            if (typeof e.dauer === 'number' && isFinite(e.dauer) && e.dauer > 0) x.dauer = e.dauer;
            return x;
          }),
      };
    });
    return d;
  }
  function datenSpeichern() {
    try { localStorage.setItem(DSCHLUESSEL, JSON.stringify(D)); }
    catch (e) { melde('Speichern ging nicht: Der Speicher des Browsers ist voll.'); return false; }
    dauerhaft();
    return true;
  }
  // Sobald es eigene Daten gibt, den Browser bitten, sie nicht von selbst zu löschen. Safari löscht sonst
  // im Browser (nicht installiert) nach sieben Tagen ohne Besuch alles, was eine Seite gespeichert hat.
  var dauerhaftGefragt = false;
  function dauerhaft() {
    if (dauerhaftGefragt || !navigator.storage || !navigator.storage.persist) return;
    dauerhaftGefragt = true;
    navigator.storage.persisted().then(function (ja) { return ja || navigator.storage.persist(); }).catch(function () { /* egal */ });
  }

  // ------------------------------------------------------------------ Songs
  var EINGEBAUT = {};
  SB_DATEN.songs.forEach(function (s) { EINGEBAUT[s.id] = s.text; });
  function gibtSong(id) { return EINGEBAUT.hasOwnProperty(id) || D.eigene.indexOf(id) >= 0; }
  function songIds() { return Object.keys(EINGEBAUT).concat(D.eigene.filter(function (id) { return !EINGEBAUT.hasOwnProperty(id); })); }
  function songText(id) {
    var e = D.songs[id];
    if (e && e.aktiv >= 0 && e.versionen[e.aktiv]) return e.versionen[e.aktiv].text;
    return EINGEBAUT.hasOwnProperty(id) ? EINGEBAUT[id] : '';
  }
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9#]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  var CACHE = {};
  function song(id) {
    var t = songText(id), c = CACHE[id];
    if (!c || c.text !== t) {
      var lied = L.lies(t);
      c = CACHE[id] = { id: id, text: t, lied: lied, titel: lied.titel || 'Ohne Titel', such: norm(L.suchtext(t)),
        sortier: norm(lied.titel).replace(/^[^a-z0-9]+/, '') || 'zzz' };
    }
    return c;
  }
  function neueVersion(id, text) {
    var e = D.songs[id] || (D.songs[id] = { versionen: [], aktiv: -1 });
    e.versionen.push({ zeit: Date.now(), text: text });
    e.aktiv = e.versionen.length - 1;
    return datenSpeichern();
  }

  // ------------------------------------------------------------------ Setlisten
  var SL_EINGEBAUT = {};
  SB_DATEN.setlisten.forEach(function (l) { SL_EINGEBAUT[l.id] = l; });
  function kopie(l) { return JSON.parse(JSON.stringify(l)); }
  function setliste(id) {
    if (D.setlisten[id]) return D.setlisten[id];
    return SL_EINGEBAUT[id] ? kopie(SL_EINGEBAUT[id]) : null;
  }
  function setlistenAlle() {
    var eigene = Object.keys(D.setlisten).map(function (k) { return D.setlisten[k]; }).filter(function (l) { return l.eigen; })
      .sort(function (a, b) { return b.erstellt - a.erstellt; });
    return eigene.concat(SB_DATEN.setlisten.map(function (l) { return setliste(l.id); }));
  }
  function setlisteSpeichern(l) {
    l.geaendert = Date.now();
    D.setlisten[l.id] = kopie(l);
    return datenSpeichern();
  }
  function songsIn(l) { return l.eintraege.filter(function (e) { return e.song && gibtSong(e.song); }); }
  // Spielzeiten in Minuten (im Ändern-Modus eintragbar)
  function dauerSumme(eintraege) {
    return eintraege.reduce(function (a, e) { return a + (e.song && gibtSong(e.song) && e.dauer ? e.dauer : 0); }, 0);
  }
  function minuten(x) { return (Math.round(x * 10) / 10).toString().replace('.', ',') + ' Min.'; }
  function liesMinuten(t) {
    var x = parseFloat(String(t).replace(',', '.'));
    return isFinite(x) && x > 0 ? Math.round(x * 10) / 10 : 0;
  }

  // ------------------------------------------------------------------ Kleinigkeiten: Meldung, Dialog, Teilen
  var meldungZeit = 0;
  function melde(text) {
    var m = $('#meldung');
    m.textContent = text;
    m.hidden = false;
    clearTimeout(meldungZeit);
    meldungZeit = setTimeout(function () { m.hidden = true; }, 2800);
  }
  // Dialog: o = { titel, html, knoepfe: [{ text, wert, art }], vorbereiten(el) } → Promise mit dem Wert des Knopfs
  function dialog(o) {
    var d = $('#dlg');
    $('#dlg-titel').textContent = o.titel || '';
    $('#dlg-inhalt').innerHTML = o.html || '';
    $('#dlg-knoepfe').innerHTML = (o.knoepfe || [{ text: 'OK', wert: 'ok' }]).map(function (k) {
      return '<button type="submit" class="knopf' + (k.art === 'zweit' ? ' zweit' : '') + (k.art === 'warm' ? ' warm-knopf' : '') + '" value="' + esc(k.wert) + '">' + esc(k.text) + '</button>';
    }).join('');
    if (o.vorbereiten) o.vorbereiten($('#dlg-inhalt'));
    return new Promise(function (fertig) {
      function zu() {
        d.removeEventListener('close', zu);
        fertig(d.returnValue || '');
      }
      d.returnValue = '';
      d.addEventListener('close', zu);
      if (d.showModal) d.showModal(); else d.setAttribute('open', '');
      var f = d.querySelector('input[type="text"], input[type="search"]');
      if (f) setTimeout(function () { f.focus(); if (f.select) f.select(); }, 30);
    });
  }
  function frage(titel, text, ja, warm) {
    return dialog({ titel: titel, html: '<p>' + esc(text) + '</p>', knoepfe: [{ text: 'Abbrechen', wert: '', art: 'zweit' }, { text: ja, wert: 'ja', art: warm ? 'warm' : '' }] })
      .then(function (w) { return w === 'ja'; });
  }
  function eingabe(titel, beschriftung, wert, ja) {
    return dialog({
      titel: titel,
      html: '<label class="feld"><span>' + esc(beschriftung) + '</span><input type="text" id="dlg-feld" value="' + esc(wert || '') + '" autocomplete="off"></label>',
      knoepfe: [{ text: 'Abbrechen', wert: '', art: 'zweit' }, { text: ja, wert: 'ja' }],
    }).then(function (w) { return w === 'ja' ? ($('#dlg-feld').value || '').trim() : null; });
  }
  // Datei teilen (iPhone, iPad, Android) oder herunterladen (Computer)
  function teileDatei(daten, name, typ) {
    var blob = new Blob([daten], { type: typ });
    var datei = null;
    try { datei = new File([blob], name, { type: typ }); } catch (e) { /* alte Browser */ }
    if (datei && navigator.canShare && navigator.share && navigator.canShare({ files: [datei] })) {
      return navigator.share({ files: [datei], title: name.replace(/\.[a-z]+$/, '') }).catch(function (e) {
        if (e && e.name === 'AbortError') return;
        laden(blob, name);
      });
    }
    laden(blob, name);
    return Promise.resolve();
  }
  // Datei-Adressen für den Download bleiben, bis die App in den Hintergrund geht (dann ist der Download längst gestartet)
  var adressen = [];
  function adressenFrei() { adressen.forEach(function (u) { URL.revokeObjectURL(u); }); adressen = []; }
  function laden(blob, name) {
    adressenFrei();
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    adressen.push(url);
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    melde('Gespeichert: ' + name);
  }
  function dateiname(t) { return String(t || 'Song').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Song'; }
  function datum(z) {
    var d = new Date(z);
    var zwei = function (n) { return (n < 10 ? '0' : '') + n; };
    return zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '.' + d.getFullYear() + ', ' + zwei(d.getHours()) + ':' + zwei(d.getMinutes());
  }

  // ------------------------------------------------------------------ Thema
  function istDunkel() {
    var t = document.documentElement.dataset.theme;
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function themaFarbe() {
    if (!document.documentElement.dataset.theme) return;
    var farbe = istDunkel() ? '#14161b' : '#f5f3ee';
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) { m.setAttribute('content', farbe); });
  }
  $('#thema').onclick = function () {
    var dunkel = !istDunkel();
    document.documentElement.dataset.theme = dunkel ? 'dark' : 'light';
    try { localStorage.setItem('songbook-thema', dunkel ? 'dunkel' : 'hell'); } catch (e) { /* egal */ }
    themaFarbe();
  };
  themaFarbe();

  // ------------------------------------------------------------------ Navigation (#/song/id, #/set/id, #/set/id/3, #/edit/id, #/neu, #/einstellungen)
  var verlauf = [], ansicht = '', listenScroll = { liste: 0, setliste: 0 };
  function geheZu(h) { if (location.hash !== h) location.hash = h; else route(); }
  function zurueck(eltern) {
    if (verlauf.length >= 2) history.back();
    else { verlauf = []; location.replace(eltern); }
  }
  window.addEventListener('hashchange', function () {
    var h = location.hash || '#/';
    S.letzte = h; S.letzteScroll = 0; speichern();
    if (verlauf.length >= 2 && verlauf[verlauf.length - 2] === h) verlauf.pop();
    else if (verlauf[verlauf.length - 1] !== h) verlauf.push(h);
    route();
  });
  function zeige(name) {
    if (ansicht === 'liste') listenScroll.liste = window.scrollY;
    if (ansicht === 'setliste') listenScroll.setliste = window.scrollY;
    if (ansicht === 'song' && name !== 'song') verlasseSong();
    ['liste', 'song', 'setliste', 'editor', 'einstellungen'].forEach(function (v) { $('#v-' + v).hidden = v !== name; });
    document.body.classList.toggle('unterseite', name !== 'liste');
    menueZu();
    griffZu();
    ansicht = name;
  }
  function route() {
    var p = (location.hash || '').replace(/^#\/?/, '').split('/').map(function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } });
    if (p[0] === 'song' && p[1] && gibtSong(p[1])) return zeigeSong(p[1], null);
    if (p[0] === 'set' && p[1] && setliste(p[1])) {
      if (p[2] !== undefined && p[2] !== '') {
        var l = setliste(p[1]), i = parseInt(p[2], 10);
        if (l.eintraege[i] && l.eintraege[i].song && gibtSong(l.eintraege[i].song)) return zeigeSong(l.eintraege[i].song, { set: p[1], idx: i });
      }
      return zeigeSetliste(p[1]);
    }
    if (p[0] === 'edit' && p[1] && gibtSong(p[1])) return zeigeEditor(p[1]);
    if (p[0] === 'neu') return zeigeEditor(null);
    if (p[0] === 'einstellungen') return zeigeEinstellungen();
    zeigeListe();
  }

  // ------------------------------------------------------------------ Übersicht
  function setzeReiter() {
    document.querySelectorAll('#reiter button').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.reiter === S.reiter)); });
    $('#t-songs').hidden = S.reiter !== 'songs';
    $('#t-setlisten').hidden = S.reiter !== 'setlisten';
  }
  $('#reiter').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || b.dataset.reiter === S.reiter) return;
    S.reiter = b.dataset.reiter; speichern();
    setzeReiter();
    if (S.reiter === 'songs') zeichneSongs(); else zeichneSetlisten();
  });
  function zeigeListe() {
    zeige('liste');
    setzeReiter();
    zeichneSongs();
    zeichneSetlisten();
    window.scrollTo(0, listenScroll.liste);
  }

  var PFEIL = '<svg class="e-pfeil" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  function sortiert(ids) {
    return ids.map(song).sort(function (a, b) { return a.sortier.localeCompare(b.sortier, 'de'); });
  }
  function songZeile(s, href, unter) {
    var l = s.lied, marke = '';
    if (D.eigene.indexOf(s.id) >= 0) marke = '<span class="marke-klein">eigener Song</span>';
    else if (D.songs[s.id] && D.songs[s.id].aktiv >= 0) marke = '<span class="marke-klein warm">bearbeitet</span>';
    var u = unter !== undefined ? unter : esc([l.kuenstler, l.untertitel].filter(Boolean).join(' · '));
    return '<a class="eintrag" href="' + href + '"><span class="e-haupt"><span class="e-titel">' + esc(s.titel) + '</span>' +
      (u ? '<span class="e-unter">' + u + '</span>' : '') + '</span>' + marke + PFEIL + '</a>';
  }
  function ausschnitt(text, wort) {
    // Textzeile mit dem Suchwort für die Trefferliste
    var zeilen = String(text).split('\n');
    for (var i = 0; i < zeilen.length; i++) {
      if (/^\s*\{/.test(zeilen[i])) continue;
      var z = zeilen[i].replace(/\[[^\]]*\]/g, '').trim();
      if (z && norm(z).indexOf(wort) >= 0) return esc(z.length > 90 ? z.slice(0, 90) + '…' : z);
    }
    return '';
  }
  function zeichneSongs() {
    var q = norm($('#suche').value), liste = sortiert(songIds()), html = [], buchst = [];
    if (q) {
      var woerter = q.split(' ');
      var titelT = [], textT = [];
      liste.forEach(function (s) {
        var kopf = norm(s.titel + ' ' + s.lied.kuenstler + ' ' + s.lied.untertitel);
        if (woerter.every(function (w) { return kopf.indexOf(w) >= 0; })) titelT.push(s);
        else if (woerter.every(function (w) { return s.such.indexOf(w) >= 0; })) textT.push(s);
      });
      titelT.forEach(function (s) { html.push(songZeile(s, '#/song/' + enc(s.id))); });
      if (textT.length) {
        html.push('<div class="gruppe">Im Liedtext</div>');
        textT.forEach(function (s) { html.push(songZeile(s, '#/song/' + enc(s.id), ausschnitt(s.text, woerter[0]))); });
      }
      var n = titelT.length + textT.length;
      $('#treffer').textContent = n ? (n === 1 ? 'Ein Song gefunden' : n + ' Songs gefunden') : '';
      if (!n) html.push('<p class="leer-hinweis">Kein Song gefunden. Mit „Neuer Song“ legst du ihn an.</p>');
    } else {
      $('#treffer').textContent = '';
      var letzter = '';
      liste.forEach(function (s) {
        var b = s.sortier.charAt(0).toUpperCase();
        if (!/[A-Z]/.test(b)) b = '#';
        if (b !== letzter) {
          html.push('<div class="gruppe" id="b-' + (b === '#' ? 'zahl' : b) + '">' + b + '</div>');
          buchst.push(b);
          letzter = b;
        }
        html.push(songZeile(s, '#/song/' + enc(s.id)));
      });
    }
    $('#song-liste').innerHTML = html.join('');
    $('#buchstaben').innerHTML = buchst.map(function (b) { return '<a href="#b-' + (b === '#' ? 'zahl' : b) + '" data-b="' + b + '">' + b + '</a>'; }).join('');
    $('#buchstaben').hidden = !!q;
  }
  $('#buchstaben').addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a) return;
    e.preventDefault();   // kein neuer Eintrag im Verlauf
    var g = document.getElementById(a.getAttribute('href').slice(1));
    if (g) g.scrollIntoView({ block: 'start' });
  });
  var suchZeit = 0;
  $('#suche').addEventListener('input', function () { clearTimeout(suchZeit); suchZeit = setTimeout(zeichneSongs, 80); });
  $('#neuer-song').onclick = function () { geheZu('#/neu'); };

  function zeichneSetlisten() {
    var html = setlistenAlle().map(function (l) {
      var n = songsIn(l).length;
      var dz = dauerSumme(l.eintraege);
      var info = (n === 1 ? 'ein Song' : n + ' Songs') + (dz ? ' · ' + minuten(dz) : '') + (l.eigen ? ' · eigene Setliste' : (D.setlisten[l.id] ? ' · geändert' : ''));
      return '<a class="eintrag" href="#/set/' + enc(l.id) + '"><span class="e-haupt"><span class="e-titel">' + esc(l.name) + '</span><span class="e-unter">' + esc(info) + '</span></span>' + PFEIL + '</a>';
    });
    $('#setlisten-liste').innerHTML = html.join('') || '<p class="leer-hinweis">Noch keine Setlisten.</p>';
  }
  function neueSetlisteAnlegen(name, eintraege) {
    var id = 'eigen-' + Date.now().toString(36);
    var l = { id: id, name: name, eigen: true, erstellt: Date.now(), geaendert: Date.now(), eintraege: eintraege || [] };
    D.setlisten[id] = l;
    datenSpeichern();
    return l;
  }
  $('#neue-setliste').onclick = function () {
    eingabe('Neue Setliste', 'Name', '', 'Anlegen').then(function (name) {
      if (!name) return;
      var l = neueSetlisteAnlegen(name);
      geheZu('#/set/' + enc(l.id));
    });
  };

  // ------------------------------------------------------------------ Song
  var aktSong = null, aktKontext = null;
  function opt(s) { return L.namenOpt(s.lied, (S.transp[s.id] || 0) + STIMMUNG[S.transInst].n, S.deutsch); }
  function anzeige(s) { return S.nurAkkorde ? L.nurAkkorde(s.lied) : s.lied; }
  function zeigeSong(id, kontext) {
    var neu = !aktSong || aktSong !== id || JSON.stringify(aktKontext) !== JSON.stringify(kontext) || ansicht !== 'song';
    zeige('song');
    aktSong = id; aktKontext = kontext;
    zeichneSong();
    if (neu) window.scrollTo(0, 0);
    wachHalten(true);
  }
  // Akkorde dürfen über ihre Silbe hinausragen. Stehen zwei in einer Zeile zu dicht, bekommt die Silbe davor mehr Platz.
  function akkordAbstand(wurzel) {
    wurzel.querySelectorAll('.zeile.mit').forEach(function (z) {
      var segs = z.querySelectorAll('.s.hat');
      segs.forEach(function (s) { s.style.paddingRight = ''; s.style.minWidth = ''; });
      var luft = parseFloat(getComputedStyle(z).fontSize) * 0.45, vor = null;
      segs.forEach(function (s) {
        var ci = s.querySelector('.ci');
        if (!ci) return;
        var r = s.getBoundingClientRect(), w = ci.getBoundingClientRect().width;
        if (vor) {
          var vr = vor.s.getBoundingClientRect();
          if (Math.abs(vr.top - r.top) < 2) {
            var noetig = vr.left + vor.w + luft - r.left;
            if (noetig > 0.5) {
              vor.s.style.paddingRight = (parseFloat(vor.s.style.paddingRight || 0) + noetig) + 'px';
              r = s.getBoundingClientRect();
            }
          }
        }
        vor = { s: s, w: w };
      });
      // Ragt ein Akkord über den rechten Rand, nimmt er seine volle Breite ein (und rutscht notfalls in die nächste Zeile)
      var rechts = z.getBoundingClientRect().right;
      segs.forEach(function (s) {
        var ci = s.querySelector('.ci');
        if (!ci) return;
        var r = ci.getBoundingClientRect();
        if (r.right > rechts + 0.5) s.style.minWidth = Math.ceil(r.width) + 'px';
      });
    });
  }
  var abstandZeit = 0;
  window.addEventListener('resize', function () {
    clearTimeout(abstandZeit);
    abstandZeit = setTimeout(function () {
      if (ansicht === 'song') akkordAbstand($('#lied'));
      if (ansicht === 'editor') akkordAbstand($('#ed-vorschau'));
    }, 120);
  });

  function zeichneSong() {
    var s = song(aktSong), lied = s.lied, n = S.transp[s.id] || 0, o = opt(s);
    var l = aktKontext ? setliste(aktKontext.set) : null;
    $('#song-zurueck-text').textContent = l ? l.name : 'Songs';
    $('#lied-titel').textContent = s.titel;
    $('#lied-unter').textContent = [lied.untertitel, lied.kuenstler].filter(Boolean).join(' · ');
    var info = [];
    if (n) info.push('<span class="tr">' + (n > 0 ? n + ' Halbt' + (n === 1 ? 'on' : 'öne') + ' höher' : (-n) + ' Halbt' + (n === -1 ? 'on' : 'öne') + ' tiefer') + '</span>');
    if (S.transInst !== 'c') info.push('<span class="ti-info">' + STIMMUNG[S.transInst].name + '</span>');
    if (S.nurAkkorde) info.push('nur Akkorde');
    if (lied.capo) info.push('Kapo ' + esc(lied.capo));
    $('#lied-info').innerHTML = info.join(' · ');
    var lw = $('#lied');
    lw.innerHTML = L.html(anzeige(s), o);
    lw.classList.toggle('nur-akkorde', S.nurAkkorde);
    $('#text-knopf').setAttribute('aria-pressed', String(S.nurAkkorde));
    lw.style.setProperty('--schrift', S.schrift + 'px');
    akkordAbstand(lw);
    // Werkzeuge
    $('#tr-wert').textContent = n > 0 ? '+' + n : (n < 0 ? '−' + (-n) : '±0');
    $('#tr-wert').classList.toggle('an', !!n);
    document.querySelectorAll('#inst button').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.inst === S.inst)); });
    $('#scroll-wert').textContent = S.scrollTempo;
    var hatAkkorde = L.akkorde(lied).length > 0;
    $('#tr-minus').disabled = $('#tr-plus').disabled = !hatAkkorde;
    zeichneGriffleiste();
    // Menü
    var eigen = D.eigene.indexOf(s.id) >= 0;
    $('#song-menue [data-aktion="loeschen"]').hidden = !eigen;
    $('#song-menue [data-aktion="transp-speichern"]').hidden = !n;
    $('#song-menue [data-aktion="versionen"]').hidden = !(D.songs[s.id] && D.songs[s.id].versionen.length);
    // Vor und zurück: in der Setliste in ihrer Reihenfolge, sonst alphabetisch durch alle Songs wie in der Liste
    var reihe;
    if (l) {
      reihe = l.eintraege.map(function (e, i) { return { id: e.song, ziel: '#/set/' + enc(l.id) + '/' + i, i: i }; })
        .filter(function (x) { return x.id && gibtSong(x.id); });
    } else {
      reihe = sortiert(songIds()).map(function (x) { return { id: x.id, ziel: '#/song/' + enc(x.id) }; });
    }
    var pos = reihe.findIndex(function (x) { return l ? x.i === aktKontext.idx : x.id === s.id; });
    var vor = reihe[pos - 1], nach = reihe[pos + 1];
    $('#set-nav').hidden = reihe.length < 2;
    $('#set-pos').textContent = (pos + 1) + ' / ' + reihe.length;
    var bv = $('#set-zurueck'), bn = $('#set-weiter');
    bv.disabled = !vor; bn.disabled = !nach;
    bv.querySelector('span').textContent = vor ? song(vor.id).titel : '';
    bn.querySelector('span').textContent = nach ? song(nach.id).titel : '';
    bv.dataset.ziel = vor ? vor.ziel : '';
    bn.dataset.ziel = nach ? nach.ziel : '';
    bv.setAttribute('aria-label', vor ? 'Vorheriger Song: ' + song(vor.id).titel : 'Kein vorheriger Song');
    bn.setAttribute('aria-label', nach ? 'Nächster Song: ' + song(nach.id).titel : 'Kein nächster Song');
  }
  function blaettern(richtung) {
    if (ansicht !== 'song') return;
    var b = richtung > 0 ? $('#set-weiter') : $('#set-zurueck');
    if (b.disabled || !b.dataset.ziel) return;
    stoppScroll();
    // Blättern landet nicht im Verlauf: Zurück führt zur Liste oder Setliste, aus der du gekommen bist
    verlauf[verlauf.length - 1] = b.dataset.ziel;
    location.replace(b.dataset.ziel);
  }
  $('#set-zurueck').onclick = function () { blaettern(-1); };
  $('#set-weiter').onclick = function () { blaettern(1); };
  $('#song-zurueck').onclick = function () {
    stoppScroll();
    zurueck(aktKontext ? '#/set/' + enc(aktKontext.set) : '#/');
  };
  function verlasseSong() { stoppScroll(); wachHalten(false); }

  // Transponieren
  function transponiere(d) {
    var s = song(aktSong), n = (S.transp[s.id] || 0) + d;
    if (n > 11) n -= 12;
    if (n < -11) n += 12;
    if (n) S.transp[s.id] = n; else delete S.transp[s.id];
    speichern();
    zeichneSong();
  }
  $('#tr-minus').onclick = function () { transponiere(-1); };
  $('#tr-plus').onclick = function () { transponiere(1); };
  $('#tr-wert').onclick = function () { if (S.transp[aktSong]) transponiere(-S.transp[aktSong]); };

  // Griffbilder
  $('#inst').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    S.inst = b.dataset.inst;
    if (S.inst !== 'aus') S.popInst = S.inst;
    speichern();
    zeichneSong();
  });
  // Griffe für einen Akkord. Bei Slash-Akkorden auf der Gitarre zuerst volle Griffe in tiefer Lage
  // (G/H als x20003 statt als Dreiklang im 4. Bund, Cm/G im 1. Bund statt im 11.).
  var griffMemo = {};
  function griffe(inst, name) {
    var k = inst + '|' + name;
    if (griffMemo[k]) return griffMemo[k];
    var v;
    try { v = (SC.varianten(inst, name) || []).slice(); } catch (e) { v = []; }
    if (inst === 'gitarre' && name.indexOf('/') > 0 && v.length > 1) {
      var klang = function (f) { return f.filter(function (x) { return x !== null; }).length; };
      var lage = function (f) { var fr = f.filter(function (x) { return x; }); return fr.length ? Math.min.apply(null, fr) : 0; };
      v = v.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) {
        return ((klang(b.x.f) >= 5) - (klang(a.x.f) >= 5)) || lage(a.x.f) - lage(b.x.f) || a.i - b.i;
      }).map(function (y) { return y.x; });
    }
    v.hinweis = (SC.varianten(inst, name) || {}).hinweis;
    return (griffMemo[k] = v);
  }
  function griffWahl(inst, name) {
    var v = griffe(inst, name);
    if (!v.length) return null;
    var i = S.griffVar[inst + '|' + name] || 0;
    return v[Math.min(i, v.length - 1)];
  }
  function zeichneGriffleiste() {
    var gl = $('#griffleiste'), s = song(aktSong);
    if (S.inst === 'aus') { gl.hidden = true; gl.innerHTML = ''; return; }
    var o = opt(s), akk = L.akkorde(s.lied);
    gl.hidden = !akk.length;
    gl.innerHTML = akk.map(function (a) {
      var name = L.akkordName(a, o), g = L.griffName(a, o.n), w = g ? griffWahl(S.inst, g) : null;
      return '<button type="button" class="gl-griff ' + S.inst + '"' + (g ? ' data-griff="' + esc(g) + '"' : '') + ' data-name="' + esc(name) + '">' +
        '<b>' + esc(name) + '</b>' + (w ? SC.svg(w.f, { label: name }) : '<span class="ohne">kein Griff</span>') + '</button>';
    }).join('');
  }

  // Schrift
  function schrift(d) {
    S.schrift = Math.min(32, Math.max(13, S.schrift + d));
    speichern();
    $('#lied').style.setProperty('--schrift', S.schrift + 'px');
    akkordAbstand($('#lied'));
  }
  $('#schrift-minus').onclick = function () { schrift(-1); };
  $('#schrift-plus').onclick = function () { schrift(1); };

  // Automatisch scrollen
  var TEMPO = [8, 12, 17, 23, 30, 38, 48, 60, 75, 95];   // Pixel pro Sekunde
  var scrollAn = false, scrollRest = 0, scrollZeit = 0, scrollRahmen = 0, scrollSelbst = false;
  function scrollSchritt(t) {
    if (!scrollAn) return;
    if (scrollZeit) {
      var dt = Math.min(0.1, (t - scrollZeit) / 1000);
      scrollRest += TEMPO[S.scrollTempo - 1] * dt;
      var px = Math.floor(scrollRest);
      if (px >= 1) {
        scrollRest -= px;
        scrollSelbst = true;
        window.scrollBy(0, px);
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) { stoppScroll(); return; }
    }
    scrollZeit = t;
    scrollRahmen = requestAnimationFrame(scrollSchritt);
  }
  function startScroll() {
    if (scrollAn) return;
    scrollAn = true; scrollZeit = 0; scrollRest = 0;
    $('#scroll-start').setAttribute('aria-pressed', 'true');
    scrollRahmen = requestAnimationFrame(scrollSchritt);
  }
  function stoppScroll() {
    scrollAn = false;
    cancelAnimationFrame(scrollRahmen);
    $('#scroll-start').setAttribute('aria-pressed', 'false');
  }
  $('#scroll-start').onclick = function () { if (scrollAn) stoppScroll(); else startScroll(); };

  // Liedtext ausblenden: gilt für alle Songs, bleibt gespeichert
  $('#text-knopf').onclick = function () {
    S.nurAkkorde = !S.nurAkkorde;
    speichern();
    zeichneSong();
  };

  // ------------------------------------------------------------------ Zentraler Umschalter C, B♭, E♭ (in jeder Ansicht oben)
  function tiAktualisieren() {
    var st = STIMMUNG[S.transInst];
    document.querySelectorAll('.ti-knopf').forEach(function (b) {
      b.textContent = st.kurz;
      b.classList.toggle('an', S.transInst !== 'c');
      b.setAttribute('aria-label', 'Alle Songs transponieren, jetzt ' + (S.transInst === 'c' ? 'klingend in C' : st.name));
    });
    document.querySelectorAll('#ti-menue [data-ti], #e-ti [data-ti]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.ti === S.transInst)); });
  }
  function tiZu() {
    $('#ti-menue').hidden = true;
    document.querySelectorAll('.ti-knopf').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
  }
  function tiWaehlen(w) {
    if (!STIMMUNG.hasOwnProperty(w)) return;
    S.transInst = w;
    speichern();
    tiAktualisieren();
    tiZu();
    if (ansicht === 'song') zeichneSong();
    if (ansicht === 'editor') edVorschau();
    melde(w === 'c' ? 'Alle Songs klingend in C' : 'Alle Songs ' + STIMMUNG[w].name);
  }
  document.addEventListener('click', function (e) {
    var k = e.target.closest('.ti-knopf');
    if (k) {
      e.stopPropagation();
      var m = $('#ti-menue'), war = !m.hidden;
      menueZu(); griffZu(); tiZu();
      if (war) return;
      m.hidden = false;
      k.setAttribute('aria-expanded', 'true');
      var r = k.getBoundingClientRect();
      m.style.top = Math.round(r.bottom + 6) + 'px';
      m.style.left = Math.round(Math.max(8, Math.min(window.innerWidth - m.offsetWidth - 8, r.right - m.offsetWidth))) + 'px';
      return;
    }
    var b = e.target.closest('#ti-menue [data-ti], #e-ti [data-ti]');
    if (b) { tiWaehlen(b.dataset.ti); return; }
    if (!$('#ti-menue').hidden && !e.target.closest('#ti-menue')) tiZu();
  }, true);
  function tempo(d) {
    S.scrollTempo = Math.min(10, Math.max(1, S.scrollTempo + d));
    speichern();
    $('#scroll-wert').textContent = S.scrollTempo;
  }
  $('#scroll-minus').onclick = function () { tempo(-1); };
  $('#scroll-plus').onclick = function () { tempo(1); };

  // Bildschirm anlassen, solange ein Song offen ist
  var sperre = null, sperreWird = false;
  function wachHalten(an) {
    if (an && S.wach && ansicht === 'song' && !document.hidden && 'wakeLock' in navigator) {
      if (sperre || sperreWird) return;
      sperreWird = true;
      navigator.wakeLock.request('screen').then(function (l) {
        sperreWird = false;
        if (ansicht !== 'song' || !S.wach) { l.release(); return; }
        sperre = l;
        l.addEventListener('release', function () { if (sperre === l) sperre = null; });
      }).catch(function () { sperreWird = false; });
    } else if (!an && sperre) {
      var x = sperre; sperre = null;
      x.release().catch(function () { /* egal */ });
    }
  }

  // Wischen blättert zum nächsten oder vorigen Song
  var wisch = null;
  $('#lied-seite').addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1 || e.target.closest('.griffleiste')) { wisch = null; return; }
    wisch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }, { passive: true });
  $('#lied-seite').addEventListener('touchend', function (e) {
    if (!wisch) return;
    var t = e.changedTouches[0], dx = t.clientX - wisch.x, dy = t.clientY - wisch.y;
    var schnell = Date.now() - wisch.t < 600;
    wisch = null;
    if (schnell && Math.abs(dx) > 70 && Math.abs(dy) < 45) blaettern(dx < 0 ? 1 : -1);
  }, { passive: true });

  // Tasten: Pfeile blättern zum nächsten oder vorigen Song (auch Bluetooth-Pedale), Esc schließt
  document.addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'Escape') {
      if (!$('#ti-menue').hidden) { tiZu(); return; }
      if (!$('#griff-pop').hidden) { griffZu(); return; }
      if (!$('#song-menue').hidden || !$('#setliste-menue').hidden) { menueZu(); return; }
    }
    if (ansicht !== 'song') return;
    if (e.key === 'ArrowRight') { blaettern(1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { blaettern(-1); e.preventDefault(); }
  });

  // Menüs
  function menueZu() {
    ['#song-menue', '#setliste-menue'].forEach(function (m) { $(m).hidden = true; });
    ['#song-mehr', '#setliste-mehr'].forEach(function (b) { $(b).setAttribute('aria-expanded', 'false'); });
  }
  function menueAuf(knopf, menue) {
    var war = !$(menue).hidden;
    menueZu();
    if (war) return;
    var m = $(menue);
    m.hidden = false;
    $(knopf).setAttribute('aria-expanded', 'true');
    if (menue === '#setliste-menue') {
      var r = $(knopf).getBoundingClientRect();
      m.style.top = (r.bottom + window.scrollY + 6) + 'px';
    }
  }
  $('#song-mehr').onclick = function (e) { e.stopPropagation(); menueAuf('#song-mehr', '#song-menue'); };
  $('#setliste-mehr').onclick = function (e) { e.stopPropagation(); menueAuf('#setliste-mehr', '#setliste-menue'); };
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.menue')) menueZu();
    if (!$('#griff-pop').hidden && !e.target.closest('#griff-pop') && !e.target.closest('[data-griff]')) griffZu();
  });

  $('#song-bearbeiten').onclick = function () { stoppScroll(); geheZu('#/edit/' + enc(aktSong)); };
  $('#song-teilen').onclick = function () { songPdf(aktSong); };
  $('#song-menue').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    menueZu();
    var a = b.dataset.aktion, id = aktSong;
    if (a === 'setliste') zuSetliste(id);
    else if (a === 'versionen') versionen(id);
    else if (a === 'drucken') { stoppScroll(); window.print(); }
    else if (a === 'transp-speichern') {
      var n = S.transp[id] || 0;
      if (!n) return;
      if (neueVersion(id, L.transponiereText(songText(id), n))) {
        delete S.transp[id]; speichern();
        zeichneSong();
        melde('Als neue Version gespeichert');
      }
    } else if (a === 'loeschen') {
      frage('Song löschen?', '„' + song(id).titel + '“ und alle seine Versionen werden gelöscht. Das lässt sich nicht rückgängig machen.', 'Löschen', true).then(function (ja) {
        if (!ja) return;
        D.eigene = D.eigene.filter(function (x) { return x !== id; });
        delete D.songs[id];
        Object.keys(D.setlisten).forEach(function (k) {
          D.setlisten[k].eintraege = D.setlisten[k].eintraege.filter(function (e) { return e.song !== id; });
        });
        delete S.transp[id]; speichern();
        datenSpeichern();
        melde('Song gelöscht');
        zurueck('#/');
      });
    }
  });

  function zuSetliste(id) {
    var listen = setlistenAlle();
    dialog({
      titel: 'Zu einer Setliste hinzufügen',
      html: '<div class="dlg-liste">' + listen.map(function (l) {
        var drin = l.eintraege.some(function (e) { return e.song === id; });
        return '<button type="submit" value="' + esc(l.id) + '"><span class="e-haupt"><span>' + esc(l.name) + '</span>' +
          '<span class="e-unter">' + (drin ? 'schon enthalten' : songsIn(l).length + ' Songs') + '</span></span></button>';
      }).join('') + '<button type="submit" value="--neu"><span class="e-haupt"><b>Neue Setliste anlegen</b></span></button></div>',
      knoepfe: [{ text: 'Abbrechen', wert: '', art: 'zweit' }],
    }).then(function (w) {
      if (!w) return;
      if (w === '--neu') {
        eingabe('Neue Setliste', 'Name', '', 'Anlegen').then(function (name) {
          if (!name) return;
          neueSetlisteAnlegen(name, [{ song: id }]);
          melde('Setliste „' + name + '“ angelegt');
        });
        return;
      }
      var l = setliste(w);
      l.eintraege.push({ song: id });
      if (setlisteSpeichern(l)) melde('Hinzugefügt zu „' + l.name + '“');
    });
  }

  function versionen(id) {
    var e = D.songs[id];
    if (!e) return;
    var eingebaut = EINGEBAUT.hasOwnProperty(id);
    function liste() {
      var z = [];
      for (var i = e.versionen.length - 1; i >= 0; i--) {
        z.push('<label class="' + (e.aktiv === i ? 'aktiv' : '') + '"><input type="radio" name="ver" value="' + i + '"' + (e.aktiv === i ? ' checked' : '') + '>' +
          '<span class="e-haupt"><span>Version ' + (i + 1) + (i === e.versionen.length - 1 ? ' (neueste)' : '') + '</span><span class="e-unter">' + datum(e.versionen[i].zeit) + '</span></span></label>');
      }
      if (eingebaut) z.push('<label class="' + (e.aktiv === -1 ? 'aktiv' : '') + '"><input type="radio" name="ver" value="-1"' + (e.aktiv === -1 ? ' checked' : '') + '>' +
        '<span class="e-haupt"><span>Original aus dem Songbook</span><span class="e-unter">wie in deinen Word-Dateien</span></span></label>');
      return '<p class="leise">Die gewählte Version zeigt die App überall an, auch in Setlisten und im PDF.</p><div class="dlg-liste">' + z.join('') + '</div>';
    }
    dialog({
      titel: 'Versionen von „' + song(id).titel + '“',
      html: liste(),
      knoepfe: [{ text: 'Gewählte löschen', wert: 'loeschen', art: 'zweit' }, { text: 'Abbrechen', wert: '', art: 'zweit' }, { text: 'Diese verwenden', wert: 'ok' }],
    }).then(function (w) {
      var r = document.querySelector('#dlg-inhalt input[name="ver"]:checked');
      if (!w || !r) return;
      var i = parseInt(r.value, 10);
      if (w === 'ok') {
        e.aktiv = i;
        datenSpeichern();
        zeichneSong();
        melde(i < 0 ? 'Original wird angezeigt' : 'Version ' + (i + 1) + ' wird angezeigt');
      } else if (w === 'loeschen') {
        if (i < 0) { melde('Das Original bleibt immer erhalten'); return; }
        if (!eingebaut && e.versionen.length === 1) { melde('Die einzige Version löschst du über „Song löschen“'); return; }
        frage('Version löschen?', 'Version ' + (i + 1) + ' vom ' + datum(e.versionen[i].zeit) + ' wird gelöscht.', 'Löschen', true).then(function (ja) {
          if (!ja) return;
          e.versionen.splice(i, 1);
          if (e.aktiv === i) e.aktiv = e.versionen.length - 1;
          else if (e.aktiv > i) e.aktiv--;
          if (!e.versionen.length && eingebaut) delete D.songs[id];
          datenSpeichern();
          zeichneSong();
          melde('Version gelöscht');
        });
      }
    });
  }

  // ------------------------------------------------------------------ Griff zum Antippen
  var pop = { griff: '', name: '', inst: 'gitarre', idx: 0, anker: null };
  function griffAuf(el) {
    pop.griff = el.dataset.griff;
    pop.name = el.dataset.name || el.textContent;
    pop.inst = S.inst !== 'aus' ? S.inst : S.popInst;
    pop.idx = S.griffVar[pop.inst + '|' + pop.griff] || 0;
    pop.anker = el.getBoundingClientRect();
    $('#griff-pop').hidden = false;
    zeichnePop();
  }
  // Unter (oder über) dem Akkord, immer ganz im Fenster; nach jedem Neuzeichnen, weil sich die Größe ändern kann
  function popPlatzieren() {
    var p = $('#griff-pop'), r = pop.anker;
    if (p.hidden || !r) return;
    var w = p.offsetWidth, h = p.offsetHeight;
    var x = Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2));
    var y = r.bottom + 8;
    if (y + h > window.innerHeight - 8) y = r.top - h - 8;
    y = Math.max(8, Math.min(y, window.innerHeight - h - 8));
    p.style.left = Math.max(8, x) + 'px';
    p.style.top = y + 'px';
  }
  function zeichnePop() {
    var v = griffe(pop.inst, pop.griff);
    if (pop.idx >= v.length) pop.idx = 0;
    var w = v[pop.idx];
    $('#gp-name').textContent = pop.name;
    document.querySelectorAll('#gp-inst button').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.inst === pop.inst)); });
    $('#gp-bild').innerHTML = w ? SC.svg(w.f, { label: pop.name }) : '<p class="leise klein-text">Kein Griff gefunden.</p>';
    $('#gp-art').textContent = w ? (w.q || '') + (v.length > 1 ? ' · ' + (pop.idx + 1) + ' von ' + v.length : '') : '';
    $('#gp-vor').disabled = $('#gp-nach').disabled = v.length < 2;
    $('#gp-spielen').disabled = !w;
    if (v.hinweis) $('#gp-art').textContent += ' ' + v.hinweis;
    popPlatzieren();
  }
  function griffZu() { $('#griff-pop').hidden = true; }
  function waehleGriff(d) {
    var v = griffe(pop.inst, pop.griff);
    if (v.length < 2) return;
    pop.idx = (pop.idx + d + v.length) % v.length;
    S.griffVar[pop.inst + '|' + pop.griff] = pop.idx;
    if (!pop.idx) delete S.griffVar[pop.inst + '|' + pop.griff];
    speichern();
    zeichnePop();
    if (ansicht === 'song' && pop.inst === S.inst) zeichneGriffleiste();
  }
  $('#gp-vor').onclick = function () { waehleGriff(-1); };
  $('#gp-nach').onclick = function () { waehleGriff(1); };
  $('#gp-zu').onclick = griffZu;
  $('#gp-inst').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    pop.inst = b.dataset.inst;
    S.popInst = pop.inst; speichern();
    pop.idx = S.griffVar[pop.inst + '|' + pop.griff] || 0;
    zeichnePop();
  });
  $('#gp-spielen').onclick = function () {
    var w = griffe(pop.inst, pop.griff)[pop.idx];
    if (w) SC.Klang.anschlag(w.f, pop.inst, 0);
  };
  document.addEventListener('click', function (e) {
    var el = e.target.closest('#lied .ak[data-griff], #ed-vorschau .ak[data-griff], .gl-griff[data-griff]');
    if (!el) return;
    if (el.classList.contains('ak')) el.dataset.name = el.textContent;
    griffAuf(el);
  });
  window.addEventListener('scroll', function () {
    if (scrollSelbst) { scrollSelbst = false; return; }
    if (!$('#griff-pop').hidden) griffZu();
  }, { passive: true });

  // ------------------------------------------------------------------ Setliste
  var aktSet = null, aendern = false;
  function zeigeSetliste(id) {
    var neu = aktSet !== id;
    zeige('setliste');
    if (neu) aendern = false;
    aktSet = id;
    zeichneSetliste();
    window.scrollTo(0, neu ? 0 : listenScroll.setliste);
  }
  var KNOPF_HOCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
  var KNOPF_RUNTER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var KNOPF_WEG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  function zeichneSetliste() {
    var l = setliste(aktSet);
    if (!l) { zurueck('#/'); return; }
    $('#setliste-name').textContent = l.name;
    var n = songsIn(l).length;
    var gesamt = dauerSumme(l.eintraege);
    $('#setliste-info').textContent = (n === 1 ? 'Ein Song' : n + ' Songs') + (gesamt ? ' · ' + minuten(gesamt) : '') + (l.eigen ? ' · eigene Setliste' : ' · aus dem Songbook' + (D.setlisten[l.id] ? ', geändert' : ''));
    // Summe der Songs vor jedem Trenner (das Set davor)
    var setSumme = [], lauf = 0;
    l.eintraege.forEach(function (e, i) {
      if (e.trenner !== undefined) { setSumme[i] = lauf; lauf = 0; } else if (e.song && gibtSong(e.song) && e.dauer) lauf += e.dauer;
    });
    $('#setliste-aendern').setAttribute('aria-pressed', String(aendern));
    $('#setliste-aendern').textContent = aendern ? 'Fertig' : 'Ändern';
    $('#aendern-leiste').hidden = !aendern;
    $('#setliste-start').disabled = !n;
    var nr = 0;
    $('#setliste-eintraege').innerHTML = l.eintraege.map(function (e, i) {
      var akt = aendern ? '<span class="e-aktionen">' +
        '<button type="button" class="icon-knopf" data-tun="hoch" data-i="' + i + '" aria-label="Nach oben"' + (i === 0 ? ' disabled' : '') + '>' + KNOPF_HOCH + '</button>' +
        '<button type="button" class="icon-knopf" data-tun="runter" data-i="' + i + '" aria-label="Nach unten"' + (i === l.eintraege.length - 1 ? ' disabled' : '') + '>' + KNOPF_RUNTER + '</button>' +
        '<button type="button" class="icon-knopf" data-tun="weg" data-i="' + i + '" aria-label="Entfernen">' + KNOPF_WEG + '</button></span>' : '';
      if (e.trenner !== undefined) {
        return '<li><div class="eintrag trenner"><span class="e-haupt"><span class="e-titel">' + esc(e.trenner) + '</span></span>' +
          (setSumme[i] ? '<span class="e-dauer" title="Spielzeit des Sets davor">davor ' + minuten(setSumme[i]) + '</span>' : '') + akt + '</div></li>';
      }
      if (!gibtSong(e.song)) return '<li><div class="eintrag"><span class="nr">–</span><span class="e-haupt"><span class="e-titel leise">Song fehlt</span></span>' + akt + '</div></li>';
      nr++;
      var s = song(e.song), u = [s.lied.kuenstler, S.transp[s.id] ? 'transponiert' : ''].filter(Boolean).join(' · ');
      var inhalt = '<span class="nr">' + nr + '</span><span class="e-haupt"><span class="e-titel">' + esc(s.titel) + '</span>' + (u ? '<span class="e-unter">' + esc(u) + '</span>' : '') + '</span>';
      var dauer = aendern
        ? '<input type="text" class="e-dauer-feld" inputmode="decimal" data-dauer="' + i + '" value="' + (e.dauer ? String(e.dauer).replace('.', ',') : '') + '" placeholder="Min." aria-label="Spielzeit in Minuten">'
        : (e.dauer ? '<span class="e-dauer">' + minuten(e.dauer) + '</span>' : '');
      return aendern ? '<li><div class="eintrag">' + inhalt + dauer + akt + '</div></li>'
        : '<li><a class="eintrag" href="#/set/' + enc(l.id) + '/' + i + '">' + inhalt + dauer + PFEIL + '</a></li>';
    }).join('');
    $('#setliste-leer').hidden = l.eintraege.length > 0;
    $('#setliste-menue [data-aktion="loeschen"]').hidden = !l.eigen;
    $('#setliste-menue [data-aktion="zuruecksetzen"]').hidden = l.eigen || !D.setlisten[l.id];
  }
  $('#setliste-zurueck').onclick = function () { zurueck('#/'); };
  $('#setliste-aendern').onclick = function () { aendern = !aendern; zeichneSetliste(); };
  $('#setliste-start').onclick = function () {
    var l = setliste(aktSet), i = l.eintraege.findIndex(function (e) { return e.song && gibtSong(e.song); });
    if (i >= 0) geheZu('#/set/' + enc(l.id) + '/' + i);
  };
  $('#setliste-eintraege').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-tun]');
    if (!b) return;
    var l = setliste(aktSet), i = parseInt(b.dataset.i, 10), x = l.eintraege;
    if (b.dataset.tun === 'hoch' && i > 0) x.splice(i - 1, 0, x.splice(i, 1)[0]);
    else if (b.dataset.tun === 'runter' && i < x.length - 1) x.splice(i + 1, 0, x.splice(i, 1)[0]);
    else if (b.dataset.tun === 'weg') x.splice(i, 1);
    setlisteSpeichern(l);
    zeichneSetliste();
  });
  $('#setliste-eintraege').addEventListener('change', function (e) {
    var f = e.target.closest('input[data-dauer]');
    if (!f) return;
    var l = setliste(aktSet), x = l.eintraege[parseInt(f.dataset.dauer, 10)];
    if (!x || !x.song) return;
    var m = liesMinuten(f.value);
    if (m) x.dauer = m; else delete x.dauer;
    setlisteSpeichern(l);
    var gesamt = dauerSumme(l.eintraege), n = songsIn(l).length;
    $('#setliste-info').textContent = (n === 1 ? 'Ein Song' : n + ' Songs') + (gesamt ? ' · ' + minuten(gesamt) : '') + (l.eigen ? ' · eigene Setliste' : ' · aus dem Songbook, geändert');
  });
  $('#setliste-songs-dazu').onclick = function () {
    var l = setliste(aktSet);
    var alle = sortiert(songIds());
    dialog({
      titel: 'Songs hinzufügen',
      html: '<input type="search" id="dlg-suche" placeholder="Suchen" autocomplete="off" aria-label="Songs suchen">' +
        '<div class="dlg-liste" id="dlg-songs">' + alle.map(function (s) {
          var drin = l.eintraege.some(function (e) { return e.song === s.id; });
          return '<label data-such="' + esc(norm(s.titel + ' ' + s.lied.kuenstler)) + '"><input type="checkbox" value="' + esc(s.id) + '">' +
            '<span class="e-haupt"><span>' + esc(s.titel) + '</span><span class="e-unter">' + esc([s.lied.kuenstler, drin ? 'schon in der Setliste' : ''].filter(Boolean).join(' · ')) + '</span></span></label>';
        }).join('') + '</div>',
      knoepfe: [{ text: 'Abbrechen', wert: '', art: 'zweit' }, { text: 'Hinzufügen', wert: 'ok' }],
      vorbereiten: function (el) {
        var f = el.querySelector('#dlg-suche');
        f.addEventListener('input', function () {
          var q = norm(f.value);
          el.querySelectorAll('#dlg-songs label').forEach(function (z) { z.hidden = !!q && z.dataset.such.indexOf(q) < 0; });
        });
        f.addEventListener('keydown', function (e) { if (e.key === 'Enter') e.preventDefault(); });
      },
    }).then(function (w) {
      if (w !== 'ok') return;
      var ids = [];
      document.querySelectorAll('#dlg-songs input:checked').forEach(function (c) { ids.push(c.value); });
      if (!ids.length) return;
      ids.forEach(function (id) { l.eintraege.push({ song: id }); });
      setlisteSpeichern(l);
      zeichneSetliste();
      melde(ids.length === 1 ? 'Ein Song hinzugefügt' : ids.length + ' Songs hinzugefügt');
    });
  };
  $('#setliste-trenner-dazu').onclick = function () {
    eingabe('Trenner einfügen', 'Text, z. B. Pause oder Zugaben', 'Pause', 'Einfügen').then(function (t) {
      if (!t) return;
      var l = setliste(aktSet);
      l.eintraege.push({ trenner: t });
      setlisteSpeichern(l);
      zeichneSetliste();
    });
  };
  $('#setliste-teilen').onclick = function () { setlistePdf(aktSet); };
  $('#setliste-menue').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    menueZu();
    var l = setliste(aktSet), a = b.dataset.aktion;
    if (a === 'umbenennen') {
      eingabe('Setliste umbenennen', 'Name', l.name, 'Umbenennen').then(function (name) {
        if (!name) return;
        l.name = name; setlisteSpeichern(l); zeichneSetliste();
      });
    } else if (a === 'kopieren') {
      var k = neueSetlisteAnlegen(l.name + ' (Kopie)', kopie(l.eintraege));
      melde('Kopie angelegt');
      location.replace('#/set/' + enc(k.id));
    } else if (a === 'zuruecksetzen') {
      frage('Zurücksetzen?', 'Deine Änderungen an „' + l.name + '“ gehen verloren.', 'Zurücksetzen', true).then(function (ja) {
        if (!ja) return;
        delete D.setlisten[l.id]; datenSpeichern(); zeichneSetliste();
      });
    } else if (a === 'loeschen') {
      frage('Setliste löschen?', '„' + l.name + '“ wird gelöscht. Die Songs bleiben erhalten.', 'Löschen', true).then(function (ja) {
        if (!ja) return;
        delete D.setlisten[l.id]; datenSpeichern();
        melde('Setliste gelöscht');
        zurueck('#/');
      });
    }
  });

  // ------------------------------------------------------------------ Editor
  var edId = null, edStart = '';
  function trenneKopf(text) {
    var titel = '', kuenstler = '';
    var rest = String(text || '').split('\n').filter(function (l) {
      var m = /^\s*\{\s*(t|title|a|artist)\s*:\s*(.*?)\s*\}\s*$/.exec(l);
      if (!m) return true;
      if (m[1] === 't' || m[1] === 'title') titel = m[2]; else kuenstler = m[2];
      return false;
    });
    while (rest.length && !rest[0].trim()) rest.shift();
    return { titel: titel, kuenstler: kuenstler, text: rest.join('\n') };
  }
  function edZusammen() {
    var t = $('#ed-titel').value.trim(), k = $('#ed-kuenstler').value.trim();
    return '{title: ' + t.replace(/[{}]/g, '') + '}\n' + (k ? '{artist: ' + k.replace(/[{}]/g, '') + '}\n' : '') + $('#ed-text').value.replace(/\s+$/, '') + '\n';
  }
  function zeigeEditor(id) {
    zeige('editor');
    edId = id;
    var k = trenneKopf(id ? songText(id) : '');
    $('#editor-ueberschrift').textContent = id ? 'Song bearbeiten' : 'Neuer Song';
    $('#editor-speichern').textContent = id ? 'Als neue Version speichern' : 'Song speichern';
    $('#editor-abbrechen span').textContent = 'Abbrechen';
    $('#ed-titel').value = k.titel;
    $('#ed-kuenstler').value = k.kuenstler;
    $('#ed-text').value = k.text;
    edStart = edZusammen();
    // Nach einem Neustart mitten im Bearbeiten: der ungespeicherte Stand ist wieder da (und gilt als Änderung)
    var e = startEntwurf;
    startEntwurf = null;
    if (e && e.id === (id || '') && typeof e.text === 'string') {
      $('#ed-titel').value = e.titel || '';
      $('#ed-kuenstler').value = e.kuenstler || '';
      $('#ed-text').value = e.text;
    }
    edVorschau();
    window.scrollTo(0, 0);
    if (!id && !e) setTimeout(function () { $('#ed-titel').focus(); }, 50);
  }
  var GAENGIG = ['C', 'D', 'E', 'F', 'G', 'A', 'H', 'Am', 'Dm', 'Em', 'Hm', 'C7', 'D7', 'E7', 'G7', 'A7'];
  var vorschauZeit = 0;
  function edVorschau() {
    var lied = L.lies(edZusammen());
    $('#ed-vorschau').innerHTML = L.html(lied, L.namenOpt(lied, STIMMUNG[S.transInst].n, S.deutsch)) || '<p class="leise">Hier erscheint dein Song.</p>';
    $('#ed-vorschau-titel').textContent = 'Vorschau' + (S.transInst !== 'c' ? ' ' + STIMMUNG[S.transInst].name : '');
    akkordAbstand($('#ed-vorschau'));
    var o = { n: 0, deutsch: true, art: 'gemischt' };
    var im = L.akkorde(lied).map(function (a) { return L.akkordName(a, o).replace(/♭/g, 'b'); });
    var alle = im.concat(GAENGIG.filter(function (g) { return im.indexOf(g) < 0; })).slice(0, 28);
    $('#ed-akkorde').innerHTML = alle.map(function (a) { return '<button type="button" data-akkord="' + esc(a) + '">' + esc(a.replace(/b(?=$|m|7|\/|s|a|d|6|9|5)/, '♭')) + '</button>'; }).join('');
  }
  $('#ed-text').addEventListener('input', function () { clearTimeout(vorschauZeit); vorschauZeit = setTimeout(edVorschau, 160); });
  $('#ed-titel').addEventListener('input', function () { clearTimeout(vorschauZeit); vorschauZeit = setTimeout(edVorschau, 160); });
  function einfuegen(text, zeilenanfang) {
    var t = $('#ed-text'), a = t.selectionStart, b = t.selectionEnd, v = t.value;
    if (zeilenanfang) {
      var anfang = v.lastIndexOf('\n', a - 1) + 1;
      a = b = anfang;
    }
    t.focus();
    t.value = v.slice(0, a) + text + v.slice(b);
    t.selectionStart = t.selectionEnd = a + text.length;
    edVorschau();
  }
  $('#ed-akkorde').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-akkord]');
    if (b) einfuegen('[' + b.dataset.akkord + ']');
  });
  // Knöpfe der Akkordleiste sollen den Cursor im Textfeld nicht wegnehmen
  $('#ed-akkorde').addEventListener('mousedown', function (e) { if (e.target.closest('button')) e.preventDefault(); });
  $('#ed-akkord-dazu').onclick = function () {
    var a = $('#ed-akkord').value.trim().replace(/♭/g, 'b');
    if (!a) return;
    if (!L.istAkkord(a)) { melde('„' + a + '“ ist kein Akkord, den die App kennt'); return; }
    einfuegen('[' + a + ']');
    $('#ed-akkord').value = '';
  };
  $('#ed-akkord').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('#ed-akkord-dazu').click(); } });
  $('#ed-abschnitt').onchange = function () {
    var v = this.value;
    this.value = '';
    if (v) einfuegen('[' + v + ']\n', true);
  };
  $('#ed-umwandeln').onclick = function () {
    var t = $('#ed-text'), a = t.selectionStart, b = t.selectionEnd, v = t.value;
    if (b > a) t.value = v.slice(0, a) + L.ueberText(v.slice(a, b)) + v.slice(b);
    else t.value = L.ueberText(v);
    edVorschau();
    melde('Akkorde an die Silben gesetzt');
  };
  $('#editor-speichern').onclick = function () {
    var titel = $('#ed-titel').value.trim();
    if (!titel) { melde('Bitte gib einen Titel ein'); $('#ed-titel').focus(); return; }
    var text = edZusammen();
    if (edId) {
      if (text === edStart) { melde('Keine Änderungen'); zurueckZumSong(edId); return; }
      if (!neueVersion(edId, text)) return;
      melde('Neue Version gespeichert');
      zurueckZumSong(edId);
    } else {
      var id = 'eigen-' + Date.now().toString(36);
      D.songs[id] = { versionen: [{ zeit: Date.now(), text: text }], aktiv: 0 };
      D.eigene.push(id);
      if (!datenSpeichern()) { D.eigene.pop(); delete D.songs[id]; return; }
      melde('Song gespeichert');
      verlauf.pop();
      edStart = text;
      location.replace('#/song/' + enc(id));
    }
  };
  function zurueckZumSong(id) {
    edStart = edZusammen();
    var ziel = '#/song/' + enc(id);
    if (verlauf.length >= 2 && verlauf[verlauf.length - 2] === ziel) history.back();
    else { verlauf.pop(); location.replace(ziel); }
  }
  $('#editor-abbrechen').onclick = function () {
    var weg = function () { edStart = edZusammen(); zurueck(edId ? '#/song/' + enc(edId) : '#/'); };
    if (edZusammen() === edStart) { weg(); return; }
    frage('Änderungen verwerfen?', 'Was du hier geändert hast, wird nicht gespeichert.', 'Verwerfen', true).then(function (ja) { if (ja) weg(); });
  };
  window.addEventListener('beforeunload', function (e) {
    if (ansicht === 'editor' && edZusammen() !== edStart) { e.preventDefault(); e.returnValue = ''; }
  });

  // ------------------------------------------------------------------ Einstellungen
  function zeigeEinstellungen() {
    zeige('einstellungen');
    document.querySelectorAll('#e-namen button').forEach(function (b) { b.setAttribute('aria-checked', String((b.dataset.wert === 'deutsch') === S.deutsch)); });
    $('#e-wach').setAttribute('aria-pressed', String(S.wach));
    $('#e-wach').textContent = S.wach ? 'An' : 'Aus';
    var ver = 0, bearb = 0;
    Object.keys(D.songs).forEach(function (id) { ver += D.songs[id].versionen.length; if (EINGEBAUT.hasOwnProperty(id)) bearb++; });
    var eigeneSl = Object.keys(D.setlisten).filter(function (k) { return D.setlisten[k].eigen; }).length;
    $('#e-statistik').textContent = 'Auf diesem Gerät: ' + D.eigene.length + ' eigene Songs, ' + bearb + ' bearbeitete Songs mit zusammen ' + ver + ' Versionen, ' + eigeneSl + ' eigene Setlisten.';
    $('#e-stand').textContent = SB_DATEN.songs.length + ' Songs aus dem Songbook, Stand ' + SB_DATEN.stand.split('-').reverse().join('.');
    var ed = $('#e-dauerhaft');
    if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then(function (ja) {
        ed.hidden = false;
        ed.textContent = ja ? 'Der Browser behält deine Daten dauerhaft.'
          : 'Der Browser darf deine Daten löschen, wenn der Platz knapp wird. Safari tut das im Browser nach sieben Tagen ohne Besuch. Installiere die App auf dem Home-Bildschirm oder lege regelmäßig eine Sicherung an.';
      }).catch(function () { ed.hidden = true; });
    }
    window.scrollTo(0, 0);
  }
  $('#einstellungen-knopf').onclick = function () { geheZu('#/einstellungen'); };
  $('#einstellungen-zurueck').onclick = function () { zurueck('#/'); };
  $('#e-namen').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    S.deutsch = b.dataset.wert === 'deutsch'; speichern();
    zeigeEinstellungen();
  });
  $('#e-wach').onclick = function () { S.wach = !S.wach; speichern(); zeigeEinstellungen(); };
  $('#e-export').onclick = function () {
    var heute = new Date().toISOString().slice(0, 10);
    teileDatei(JSON.stringify({ app: 'songbook', format: 1, erstellt: new Date().toISOString(), daten: D }, null, 1), 'Songbook-Sicherung-' + heute + '.json', 'application/json');
  };
  $('#e-import').onchange = function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var x;
      try { x = JSON.parse(r.result); } catch (e) { x = null; }
      if (!x || x.app !== 'songbook' || x.format !== 1 || !x.daten) { $('#e-meldung').textContent = 'Das ist keine Sicherung aus dem Songbook.'; return; }
      var neu = pruefeDaten(x.daten), z = { ver: 0, songs: 0, sl: 0 };
      Object.keys(neu.songs).forEach(function (id) {
        var e = D.songs[id] || (D.songs[id] = { versionen: [], aktiv: -1 });
        neu.songs[id].versionen.forEach(function (v) {
          if (e.versionen.some(function (w) { return w.zeit === v.zeit && w.text === v.text; })) return;
          e.versionen.push(v); z.ver++;
        });
        e.versionen.sort(function (a, b) { return a.zeit - b.zeit; });
        if (neu.songs[id].aktiv >= 0) e.aktiv = e.versionen.length - 1;
      });
      neu.eigene.forEach(function (id) { if (D.eigene.indexOf(id) < 0) { D.eigene.push(id); z.songs++; } });
      Object.keys(neu.setlisten).forEach(function (id) {
        var a = D.setlisten[id], b = neu.setlisten[id];
        if (!a || b.geaendert > a.geaendert) { D.setlisten[id] = b; z.sl++; }
      });
      datenSpeichern();
      CACHE = {};
      $('#e-meldung').textContent = 'Geladen: ' + z.songs + ' neue Songs, ' + z.ver + ' Versionen, ' + z.sl + ' Setlisten.';
      zeigeEinstellungen();
    };
    r.readAsText(f);
  };

  // ------------------------------------------------------------------ PDF
  function pdfSong(id) {
    var s = song(id), o = opt(s), inst = S.inst !== 'aus' ? S.inst : null;
    var griffBilder = null;
    if (inst) griffBilder = L.akkorde(s.lied).map(function (a) {
      var g = L.griffName(a, o.n), w = g ? griffWahl(inst, g) : null;
      return { name: L.akkordName(a, o), f: w ? w.f : null };
    });
    return { lied: anzeige(s), o: o, titel: s.titel, griffe: griffBilder, inst: inst, n: S.transp[id] || 0, stimmung: STIMMUNG[S.transInst].name };
  }
  function songPdf(id) {
    try {
      var daten = SB_PDF.erzeuge({ titel: song(id).titel, songs: [pdfSong(id)] });
      teileDatei(daten, dateiname(song(id).titel) + '.pdf', 'application/pdf');
    } catch (e) { melde('PDF ging nicht: ' + e.message); }
  }
  function setlistePdf(sid) {
    var l = setliste(sid), songs = songsIn(l).map(function (e) { return pdfSong(e.song); });
    if (!songs.length) { melde('Die Setliste ist leer'); return; }
    try {
      var daten = SB_PDF.erzeuge({
        titel: l.name, songs: songs,
        inhalt: l.eintraege.filter(function (e) { return e.trenner !== undefined || (e.song && gibtSong(e.song)); })
          .map(function (e) { return e.trenner !== undefined ? { trenner: e.trenner } : { titel: song(e.song).titel, dauer: e.dauer }; }),
        dauer: dauerSumme(l.eintraege), stimmung: STIMMUNG[S.transInst].name,
      });
      teileDatei(daten, dateiname(l.name) + '.pdf', 'application/pdf');
    } catch (e) { melde('PDF ging nicht: ' + e.message); }
  }

  // ------------------------------------------------------------------ Hintergrund: nichts läuft weiter
  // Geht die App in den Hintergrund oder wird sie geschlossen: Scrollen aus, Klangausgabe schlafen,
  // Bildschirmsperre frei, offene Timer und Datei-Adressen weg. Beim Zurückkommen holt sich nur der
  // offene Song die Bildschirmsperre wieder. Kein Push, kein Hintergrund-Sync, kein setInterval.
  // Stelle merken (Ansicht, Scrollposition, Suche, Editor-Entwurf), damit der nächste Start genau dort weitermacht
  function merkeOrt() {
    S.letzte = location.hash || '#/';
    S.letzteScroll = Math.max(0, Math.round(window.scrollY));
    S.suche = $('#suche').value;
    S.entwurf = ansicht === 'editor' && edZusammen() !== edStart
      ? { id: edId || '', titel: $('#ed-titel').value, kuenstler: $('#ed-kuenstler').value, text: $('#ed-text').value } : {};
    speichern();
  }
  function ruhe() {
    merkeOrt();
    stoppScroll();
    SC.Klang.ruhe();
    wachHalten(false);
    griffZu();
    tiZu();
    clearTimeout(suchZeit); clearTimeout(vorschauZeit); clearTimeout(abstandZeit);
    adressenFrei();
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) ruhe();
    else if (ansicht === 'song') wachHalten(true);
  });
  window.addEventListener('pagehide', ruhe);

  // ------------------------------------------------------------------ Start
  SB_INSTALL.einrichten({ S: S, speichern: speichern });
  tiAktualisieren();
  // Öffnet die App ohne Ziel (vom Home-Bildschirm, nach einem Neustart), geht es dort weiter, wo du warst
  var startEntwurf = null, startPos = null;
  if (!/^#\/./.test(location.hash) && typeof S.letzte === 'string' && /^#\/./.test(S.letzte)) {
    history.replaceState(null, '', S.letzte);
    startPos = S.letzteScroll;
    if (S.entwurf && typeof S.entwurf.text === 'string') startEntwurf = S.entwurf;
  }
  if (S.suche) $('#suche').value = S.suche;
  verlauf.push(location.hash || '#/');
  route();
  // Scrollposition: gleich nach dem Zeichnen und noch einmal im nächsten Bild (falls Schriften die Höhe ändern)
  if (!startPos && ansicht === 'liste' && S.letzte === '#/') startPos = S.letzteScroll;
  if (startPos) {
    window.scrollTo(0, startPos);
    requestAnimationFrame(function () { if (Math.abs(window.scrollY - startPos) > 2) window.scrollTo(0, startPos); });
  }

  // Offline (Service Worker). „Offline verfügbar“ erst, wenn Startseite und Songs wirklich im Speicher liegen:
  // Auf GitHub Pages teilen sich alle Apps eines Kontos den Speicher, eine andere App kann ihn geleert haben.
  // Dann füllt sw.js ihn beim Öffnen im Hintergrund wieder auf, die Anzeige schaut einmal nach.
  var status = $('#offline-status');
  function imSpeicher() {
    if (!window.caches) return Promise.resolve(false);
    return Promise.all(['index.html', 'songs.js', 'app.js'].map(function (d) { return caches.match(new URL(d, location.href).href); }))
      .then(function (t) { return t.every(Boolean); }).catch(function () { return false; });
  }
  function offlineAnzeigen(nochmal) {
    imSpeicher().then(function (ja) {
      if (ja) { status.textContent = 'Offline verfügbar'; return; }
      status.textContent = 'Wird für offline gespeichert …';
      if (nochmal && !document.hidden) setTimeout(function () { offlineAnzeigen(false); }, 4000);
      else if (!nochmal) status.textContent = '';
    });
  }
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').then(function () {
      return navigator.serviceWorker.ready;
    }).then(function () {
      offlineAnzeigen(true);
    }).catch(function () {
      status.textContent = '';
    });
  } else {
    status.textContent = 'Lokal geöffnet, läuft ohne Internet';
  }
})();
