// Gesamttest im Browser: bedient die App wie ein Nutzer und meldet, was nicht stimmt.
// So ausführen: App im Browser öffnen (http://localhost:8768), diese Datei in der Konsole einfügen
// oder per Entwicklerwerkzeug ausführen, dann `await SB_TEST()` aufrufen. Ergebnis: { ok, fehler, schritte }.
// Teilen, Drucken und Herunterladen werden abgefangen. Die gespeicherten Daten (songbook-…) sichert der Test
// vorher und stellt sie danach wieder her.
window.SB_TEST = async function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var warte = function (ms) { return new Promise(function (r) { setTimeout(r, ms || 160); }); };
  var fehler = [], schritte = 0;
  function ok(b, t) { schritte++; if (!b) fehler.push(t); }
  async function geh(h) { location.hash = h; await warte(200); }
  async function klick(sel) { var el = typeof sel === 'string' ? $(sel) : sel; if (!el) { fehler.push('nicht gefunden: ' + sel); return; } el.click(); await warte(); }
  async function dialogKnopf(wert) {
    await warte(120);
    var d = $('#dlg');
    if (!d.open) { fehler.push('Dialog nicht offen (erwartet Knopf ' + wert + ')'); return; }
    var b = $$('#dlg-knoepfe button, #dlg-inhalt button').filter(function (x) { return x.value === wert; })[0];
    if (!b) { fehler.push('Dialogknopf fehlt: ' + wert); d.close(''); return; }
    b.click(); await warte(250);
  }
  function titel() { return $('#lied-titel').textContent; }
  function akkorde() { return $$('#lied .ak').map(function (a) { return a.textContent; }); }

  // ---- Sicherung der Daten und Abfangen von Teilen, Drucken, Herunterladen
  var sicherung = {};
  Object.keys(localStorage).forEach(function (k) { if (k.indexOf('songbook-') === 0) sicherung[k] = localStorage.getItem(k); });
  var geteilt = [], gedruckt = 0, geladen = [];
  var alt = { share: navigator.share, canShare: navigator.canShare, print: window.print, url: URL.createObjectURL };
  navigator.share = function (d) { geteilt.push(d); return Promise.resolve(); };
  navigator.canShare = function () { return true; };
  window.print = function () { gedruckt++; };
  var fehlerImFenster = [];
  var fang = function (e) { fehlerImFenster.push((e.message || e.reason || e) + ''); };
  window.addEventListener('error', fang); window.addEventListener('unhandledrejection', fang);
  localStorage.setItem('songbook-daten', JSON.stringify({ format: 1, songs: {}, eigene: [], setlisten: {} }));

  try {
    // ================================================================ Übersicht
    await geh('#/');
    ok(!$('#v-liste').hidden, 'Übersicht nicht sichtbar');
    await klick('#reiter [data-reiter="songs"]');
    var n = $$('#song-liste .eintrag').length;
    ok(n === SB_DATEN.songs.length, 'Songliste: ' + n + ' statt ' + SB_DATEN.songs.length);
    ok($$('#buchstaben a').length >= 20, 'Buchstabenleiste zu kurz');
    var titelListe = $$('#song-liste .e-titel').map(function (e) { return e.textContent; });
    var sortiert = titelListe.slice().sort(function (a, b) { return a.toLowerCase().replace(/[^a-z0-9äöü ]/g, '').localeCompare(b.toLowerCase().replace(/[^a-z0-9äöü ]/g, ''), 'de'); });
    ok(titelListe[0] === 'Alkohol' && /Zwei|Zuhause|Zombie/.test(titelListe[titelListe.length - 1]), 'Sortierung: ' + titelListe[0] + ' … ' + titelListe[titelListe.length - 1]);
    void sortiert;
    var s = $('#suche');
    s.value = 'riesling'; s.dispatchEvent(new Event('input')); await warte(250);
    var t = $$('#song-liste .e-titel').map(function (e) { return e.textContent; });
    ok(t.indexOf('Rieslingschorle') >= 0 && t.some(function (x) { return /Kän Riesling/.test(x); }), 'Suche riesling: ' + t.join(', '));
    s.value = 'Sanitäter'; s.dispatchEvent(new Event('input')); await warte(250);
    ok(/Im Liedtext/.test($('#song-liste').textContent) && /Alkohol/.test($('#song-liste').textContent), 'Suche im Liedtext findet Alkohol nicht');
    ok($('#buchstaben').hidden, 'Buchstabenleiste bei Suche sichtbar');
    s.value = 'xyzxyz'; s.dispatchEvent(new Event('input')); await warte(250);
    ok(/Kein Song gefunden/.test($('#song-liste').textContent), 'Leere Suche ohne Hinweis');
    s.value = ''; s.dispatchEvent(new Event('input')); await warte(250);
    ok($$('#song-liste .eintrag').length === SB_DATEN.songs.length, 'Suche leeren: Liste nicht vollständig');
    var h0 = location.hash; await klick('#buchstaben a[data-b="S"]');
    ok(location.hash === h0, 'Buchstabe ändert den Hash');
    ok(Math.abs($('#b-S').getBoundingClientRect().top) < 40, 'Buchstabe S springt nicht');
    window.scrollTo(0, 0);
    await klick('#reiter [data-reiter="setlisten"]');
    ok(!$('#t-setlisten').hidden && $$('#setlisten-liste .eintrag').length === SB_DATEN.setlisten.length, 'Setlisten-Reiter: ' + $$('#setlisten-liste .eintrag').length);
    await klick('#reiter [data-reiter="songs"]');
    var thema0 = document.documentElement.dataset.theme || '';
    await klick('#thema');
    ok((document.documentElement.dataset.theme || '') !== thema0, 'Hell/Dunkel schaltet nicht');
    await klick('#thema');

    // ================================================================ Song
    await klick($$('#song-liste .eintrag').filter(function (a) { return /an-deiner-seite/.test(a.getAttribute('href')); })[0]);
    ok(location.hash === '#/song/an-deiner-seite' && titel() === 'An deiner Seite', 'Song öffnen: ' + location.hash);
    ok(document.body.classList.contains('unterseite') && $('#kopf').offsetParent === null, 'Kopf im Song sichtbar');
    ok(akkorde().length > 20 && !/undefined|NaN/.test($('#lied').innerHTML), 'Akkorde fehlen im Song');
    ok($$('#lied .abschnitt').length >= 4, 'Abschnitte fehlen');
    // Farben: Akkorde rot, Abschnitte blau
    var cAk = getComputedStyle($('#lied .ak')).color, cAb = getComputedStyle($('#lied .abschnitt')).color;
    ok(cAk !== cAb && /^rgb\((1[5-9]\d|2\d\d), /.test(cAk), 'Farbe Akkord: ' + cAk + ' Abschnitt: ' + cAb);
    // Transponieren
    var a0 = akkorde().slice(0, 4).join(' ');
    await klick('#tr-plus');
    ok($('#tr-wert').textContent === '+1' && akkorde().slice(0, 4).join(' ') !== a0, 'Transponieren +1: ' + akkorde().slice(0, 4).join(' '));
    ok(/1 Halbton höher/.test($('#lied-info').textContent), 'Hinweis „1 Halbton höher“ fehlt');
    await klick('#tr-minus'); await klick('#tr-minus');
    ok($('#tr-wert').textContent === '−1', 'Transponieren −1: ' + $('#tr-wert').textContent);
    await klick('#tr-wert');
    ok($('#tr-wert').textContent === '±0' && akkorde().slice(0, 4).join(' ') === a0, 'Zurücksetzen der Transponierung');
    for (var k = 0; k < 12; k++) await klick('#tr-plus');
    ok(akkorde().slice(0, 4).join(' ') === a0 && $('#tr-wert').textContent === '±0', '12 Halbtöne höher ist nicht das Original: ' + $('#tr-wert').textContent);
    // Griffbilder
    await klick('#inst [data-inst="gitarre"]');
    ok(!$('#griffleiste').hidden && $$('#griffleiste .gl-griff svg').length === 4, 'Griffleiste Gitarre: ' + $$('#griffleiste .gl-griff svg').length);
    await klick('#inst [data-inst="ukulele"]');
    ok($$('#griffleiste .gl-griff.ukulele svg').length === 4, 'Griffleiste Ukulele');
    // Griff-Popup
    await klick($('#lied .ak[data-griff]'));
    ok(!$('#griff-pop').hidden && $('#gp-bild svg'), 'Griff-Popup öffnet nicht');
    var art0 = $('#gp-art').textContent;
    await klick('#gp-nach');
    ok($('#gp-art').textContent !== art0, 'Nächster Griff ändert nichts');
    await klick('#gp-vor');
    await klick('#gp-inst [data-inst="gitarre"]');
    ok($('#gp-inst [data-inst="gitarre"]').getAttribute('aria-checked') === 'true', 'Instrument im Popup');
    try { $('#gp-spielen').click(); ok(true, ''); } catch (e) { fehler.push('Anhören: ' + e.message); }
    await klick('#gp-zu');
    ok($('#griff-pop').hidden, 'Popup schließt nicht');
    await klick($('#griffleiste .gl-griff'));
    ok(!$('#griff-pop').hidden, 'Popup aus der Griffleiste öffnet nicht');
    document.body.click(); await warte();
    ok($('#griff-pop').hidden, 'Popup schließt nicht bei Klick daneben');
    await klick('#inst [data-inst="aus"]');
    ok($('#griffleiste').hidden, 'Griffleiste geht nicht aus');
    // Schrift
    var f0 = parseFloat($('#lied').style.getPropertyValue('--schrift'));
    await klick('#schrift-plus');
    ok(parseFloat($('#lied').style.getPropertyValue('--schrift')) === f0 + 1, 'Schrift größer');
    await klick('#schrift-minus');
    // Scrollen
    window.scrollTo(0, 0); await warte(100);
    await klick('#scroll-start');
    ok($('#scroll-start').getAttribute('aria-pressed') === 'true', 'Scrollen startet nicht');
    await warte(1600);
    ok(window.scrollY > 10, 'Scrollen bewegt die Seite nicht: ' + window.scrollY);
    window.dispatchEvent(new Event('pagehide')); await warte(100);
    ok($('#scroll-start').getAttribute('aria-pressed') === 'false', 'Scrollen hört im Hintergrund nicht auf');
    var y1 = window.scrollY; await warte(500);
    ok(window.scrollY === y1, 'Seite scrollt nach dem Stopp weiter');
    // Vor und zurück (alphabetisch)
    window.scrollTo(0, 0);
    var pos0 = $('#set-pos').textContent;
    ok(!$('#set-nav').hidden && /^\d+ \/ \d+$/.test(pos0), 'Vor/Zurück-Leiste fehlt: ' + pos0);
    var naechster = $('#set-weiter span').textContent;
    await klick('#set-weiter'); await warte(150);
    ok(titel() === naechster, 'Weiter: ' + titel() + ' statt ' + naechster);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' })); await warte(250);
    ok(titel() === 'An deiner Seite', 'Pfeil links: ' + titel());
    // Wischen
    try {
      var el = $('#lied-seite');
      var tp = function (x) { return new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 }); };
      el.dispatchEvent(new TouchEvent('touchstart', { touches: [tp(300)], changedTouches: [tp(300)], bubbles: true }));
      el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [tp(150)], bubbles: true }));
      await warte(250);
      ok(titel() === naechster, 'Wischen nach links: ' + titel());
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' })); await warte(250);
    } catch (e) { /* Touch-Ereignisse gibt es hier nicht */ }
    // Zurück zur Liste
    await klick('#song-zurueck'); await warte(150);
    ok(location.hash === '#/' || location.hash === '', 'Zurück aus dem Song: ' + location.hash);
    // Erster und letzter Song: Knöpfe gesperrt
    await geh('#/song/alkohol');
    ok($('#set-zurueck').disabled && !$('#set-weiter').disabled, 'Erster Song: Zurück nicht gesperrt');

    // ================================================================ Menü im Song
    await klick('#song-mehr');
    ok(!$('#song-menue').hidden, 'Menü öffnet nicht');
    ok($('#song-menue [data-aktion="loeschen"]').hidden, 'Löschen bei Song aus dem Songbook sichtbar');
    document.body.click(); await warte();
    ok($('#song-menue').hidden, 'Menü schließt nicht');
    // Drucken
    await klick('#song-mehr'); await klick('#song-menue [data-aktion="drucken"]');
    ok(gedruckt === 1, 'Drucken ruft print() nicht');
    // PDF teilen
    geteilt = [];
    await klick('#song-teilen'); await warte(300);
    var pdf = geteilt[0] && geteilt[0].files && geteilt[0].files[0];
    ok(pdf && pdf.type === 'application/pdf' && /^Alkohol\.pdf$/.test(pdf.name) && pdf.size > 2000, 'PDF teilen: ' + (pdf ? pdf.name + ' ' + pdf.size : 'nichts geteilt'));
    if (pdf) { var kopf = await pdf.slice(0, 8).text(); ok(kopf === '%PDF-1.4', 'PDF-Anfang: ' + kopf); }
    // Transponiert als neue Version speichern, Versionen
    await klick('#tr-plus'); await klick('#tr-plus');
    var aTr = akkorde().slice(0, 3).join(' ');
    await klick('#song-mehr');
    ok(!$('#song-menue [data-aktion="transp-speichern"]').hidden, 'Menüpunkt „Transponiert speichern“ fehlt');
    await klick('#song-menue [data-aktion="transp-speichern"]');
    ok($('#tr-wert').textContent === '±0' && akkorde().slice(0, 3).join(' ') === aTr, 'Transponiert gespeichert: ' + akkorde().slice(0, 3).join(' ') + ' statt ' + aTr);
    var D1 = JSON.parse(localStorage.getItem('songbook-daten'));
    ok(D1.songs.alkohol && D1.songs.alkohol.versionen.length === 1 && D1.songs.alkohol.aktiv === 0, 'Version nicht gespeichert');
    await klick('#song-mehr'); await klick('#song-menue [data-aktion="versionen"]');
    ok($('#dlg').open && $$('#dlg-inhalt input[name="ver"]').length === 2, 'Versionen-Dialog');
    $('#dlg-inhalt input[value="-1"]').checked = true;
    await dialogKnopf('ok');
    ok(akkorde().slice(0, 3).join(' ') === 'Em C D' || akkorde()[0] === 'Em', 'Original nicht zurück: ' + akkorde().slice(0, 3).join(' '));
    await klick('#song-mehr'); await klick('#song-menue [data-aktion="versionen"]');
    $('#dlg-inhalt input[value="0"]').checked = true;
    await dialogKnopf('loeschen'); await dialogKnopf('ja');
    ok(!JSON.parse(localStorage.getItem('songbook-daten')).songs.alkohol, 'Version nicht gelöscht');
    ok($('#song-menue [data-aktion="versionen"]').hidden, 'Menüpunkt Versionen bleibt ohne Versionen');

    // ================================================================ Setlisten
    await geh('#/set/amadeus-in-concert-2024');
    ok($('#setliste-name').textContent === 'Amadeus in Concert 2024' && $$('#setliste-eintraege a.eintrag').length === 18 && $$('#setliste-eintraege .trenner').length === 1, 'Amadeus-Setliste');
    await klick('#setliste-start');
    ok($('#set-pos').textContent === '1 / 18' && $('#song-zurueck-text').textContent === 'Amadeus in Concert 2024', 'Setliste starten: ' + $('#set-pos').textContent);
    await klick('#set-weiter');
    ok($('#set-pos').textContent === '2 / 18', 'In der Setliste weiter: ' + $('#set-pos').textContent);
    await klick('#song-zurueck'); await warte(150);
    ok(location.hash === '#/set/amadeus-in-concert-2024', 'Zurück zur Setliste: ' + location.hash);
    // Neue Setliste
    await geh('#/');
    await klick('#reiter [data-reiter="setlisten"]');
    await klick('#neue-setliste');
    $('#dlg-feld').value = 'Testliste'; await dialogKnopf('ja'); await warte(200);
    ok($('#setliste-name').textContent === 'Testliste' && /^#\/set\/eigen-/.test(location.hash), 'Neue Setliste: ' + location.hash);
    var slId = decodeURIComponent(location.hash.split('/')[2]);
    ok(!$('#setliste-leer').hidden && $('#setliste-start').disabled, 'Leere Setliste ohne Hinweis');
    await klick('#setliste-aendern');
    ok(!$('#aendern-leiste').hidden, 'Ändern-Leiste fehlt');
    await klick('#setliste-songs-dazu');
    var such = $('#dlg-suche'); such.value = 'zehn'; such.dispatchEvent(new Event('input')); await warte(100);
    var sichtbar = $$('#dlg-songs label').filter(function (l) { return !l.hidden; });
    ok(sichtbar.length === 2, 'Suche im Hinzufügen-Dialog: ' + sichtbar.length);
    sichtbar.forEach(function (l) { l.querySelector('input').checked = true; });
    await dialogKnopf('ok');
    await klick('#setliste-trenner-dazu');
    $('#dlg-feld').value = 'Pause'; await dialogKnopf('ja');
    var eintr = function () { return JSON.parse(localStorage.getItem('songbook-daten')).setlisten[slId].eintraege; };
    ok(eintr().length === 3 && eintr()[2].trenner === 'Pause', 'Einträge: ' + JSON.stringify(eintr()));
    await klick('#setliste-eintraege button[data-tun="hoch"][data-i="2"]');
    ok(eintr()[1].trenner === 'Pause', 'Nach oben verschieben');
    await klick('#setliste-eintraege button[data-tun="weg"][data-i="1"]');
    ok(eintr().length === 2 && !eintr().some(function (e) { return e.trenner; }), 'Entfernen');
    await klick('#setliste-aendern');
    ok($$('#setliste-eintraege a.eintrag').length === 2, 'Fertig: Einträge nicht als Links');
    await klick('#setliste-mehr'); await klick('#setliste-menue [data-aktion="umbenennen"]');
    $('#dlg-feld').value = 'Testliste 2'; await dialogKnopf('ja');
    ok($('#setliste-name').textContent === 'Testliste 2', 'Umbenennen');
    geteilt = [];
    await klick('#setliste-teilen'); await warte(400);
    var spdf = geteilt[0] && geteilt[0].files && geteilt[0].files[0];
    ok(spdf && /Testliste 2\.pdf/.test(spdf.name) && spdf.size > 3000, 'Setliste als PDF: ' + (spdf ? spdf.name : 'nichts'));
    await klick('#setliste-mehr'); await klick('#setliste-menue [data-aktion="kopieren"]'); await warte(200);
    ok($('#setliste-name').textContent === 'Testliste 2 (Kopie)', 'Kopie anlegen');
    await klick('#setliste-mehr'); await klick('#setliste-menue [data-aktion="loeschen"]'); await dialogKnopf('ja'); await warte(200);
    await geh('#/set/' + encodeURIComponent(slId));
    await klick('#setliste-mehr'); await klick('#setliste-menue [data-aktion="loeschen"]'); await dialogKnopf('ja'); await warte(200);
    ok(Object.keys(JSON.parse(localStorage.getItem('songbook-daten')).setlisten).length === 0, 'Setlisten nicht gelöscht');
    // Setliste aus dem Songbook ändern und zurücksetzen
    await geh('#/set/punschstand-2024');
    ok($('#setliste-menue [data-aktion="loeschen"]').hidden && $('#setliste-menue [data-aktion="zuruecksetzen"]').hidden, 'Menü bei unveränderter Songbook-Setliste');
    await klick('#setliste-aendern');
    await klick('#setliste-eintraege button[data-tun="runter"][data-i="0"]');
    await klick('#setliste-aendern');
    ok(/geändert/.test($('#setliste-info').textContent), 'Geänderte Songbook-Setliste ohne Hinweis');
    await klick('#setliste-mehr'); await klick('#setliste-menue [data-aktion="zuruecksetzen"]'); await dialogKnopf('ja');
    ok(!/geändert/.test($('#setliste-info').textContent) && $$('#setliste-eintraege .e-titel')[0].textContent === 'Ihr Kinderlein kommet', 'Zurücksetzen');
    // Song zu einer Setliste hinzufügen (neue Setliste aus dem Song)
    await geh('#/song/zombie');
    await klick('#song-mehr'); await klick('#song-menue [data-aktion="setliste"]');
    await dialogKnopf('--neu'); await warte(150);
    $('#dlg-feld').value = 'Aus dem Song'; await dialogKnopf('ja');
    var sl2 = JSON.parse(localStorage.getItem('songbook-daten')).setlisten;
    var neueId = Object.keys(sl2)[0];
    ok(neueId && sl2[neueId].eintraege[0].song === 'zombie', 'Neue Setliste aus dem Song');
    await klick('#song-mehr'); await klick('#song-menue [data-aktion="setliste"]');
    await dialogKnopf(neueId);
    ok(JSON.parse(localStorage.getItem('songbook-daten')).setlisten[neueId].eintraege.length === 2, 'Zu bestehender Setliste hinzufügen');
    await geh('#/set/' + encodeURIComponent(neueId));
    await klick('#setliste-mehr'); await klick('#setliste-menue [data-aktion="loeschen"]'); await dialogKnopf('ja'); await warte(200);

    // ================================================================ Editor: neuer Song
    await geh('#/');
    await klick('#neuer-song');
    ok(!$('#v-editor').hidden && $('#editor-ueberschrift').textContent === 'Neuer Song', 'Editor für neuen Song');
    $('#ed-titel').value = 'Testlied'; $('#ed-kuenstler').value = 'Testband';
    var ta = $('#ed-text');
    ta.value = '[Verse 1]\nG        D\nHallo Welt, wie geht es dir\n'; ta.dispatchEvent(new Event('input'));
    await klick('#ed-umwandeln');
    ok(/\[G\]Hallo Wel\[D\]t/.test(ta.value), 'Umwandeln: ' + JSON.stringify(ta.value));
    ta.selectionStart = ta.selectionEnd = ta.value.length;
    await klick($('#ed-akkorde button[data-akkord="Am"]'));
    ok(/\[Am\]$/.test(ta.value.trim()), 'Akkord aus der Leiste einfügen');
    $('#ed-akkord').value = 'Quatsch'; await klick('#ed-akkord-dazu');
    ok(/kein Akkord/.test($('#meldung').textContent), 'Falscher Akkord ohne Hinweis');
    $('#ed-akkord').value = 'F#m7'; await klick('#ed-akkord-dazu');
    ok(/\[F#m7\]/.test(ta.value), 'Eigener Akkord');
    var sel = $('#ed-abschnitt'); sel.value = 'Refrain'; sel.dispatchEvent(new Event('change')); await warte();
    ok(/\[Refrain\]\n/.test(ta.value), 'Abschnitt einfügen');
    await warte(250);
    ok($$('#ed-vorschau .ak').length >= 3 && /REFRAIN|Refrain/i.test($('#ed-vorschau').textContent), 'Vorschau');
    // Abbrechen mit Änderungen: erst nicht verwerfen
    await klick('#editor-abbrechen'); await dialogKnopf('');
    ok(!$('#v-editor').hidden, 'Abbrechen ohne Verwerfen verlässt den Editor');
    $('#ed-titel').value = ''; await klick('#editor-speichern');
    ok(!$('#v-editor').hidden && /Titel/.test($('#meldung').textContent), 'Speichern ohne Titel');
    $('#ed-titel').value = 'Testlied';
    await klick('#editor-speichern'); await warte(200);
    ok(/^#\/song\/eigen-/.test(location.hash) && titel() === 'Testlied' && /Testband/.test($('#lied-unter').textContent), 'Neuen Song speichern: ' + location.hash);
    var eigenId = decodeURIComponent(location.hash.split('/')[2]);
    ok(!$('#song-menue [data-aktion="loeschen"]').hidden, 'Löschen fehlt bei eigenem Song');
    // Bearbeiten: neue Version
    await klick('#song-bearbeiten');
    ok($('#ed-titel').value === 'Testlied' && $('#ed-kuenstler').value === 'Testband' && !/\{title/.test($('#ed-text').value), 'Editor übernimmt Titel und Interpret nicht sauber');
    $('#ed-text').value += '\n[C]Zweite Fassung'; await klick('#editor-speichern'); await warte(250);
    ok(location.hash === '#/song/' + encodeURIComponent(eigenId) && /Zweite Fassung/.test($('#lied').textContent), 'Neue Version anzeigen: ' + location.hash);
    var ver = JSON.parse(localStorage.getItem('songbook-daten')).songs[eigenId];
    ok(ver.versionen.length === 2 && ver.aktiv === 1, 'Versionen eigener Song: ' + JSON.stringify(ver).slice(0, 80));
    // Ohne Änderung speichern
    await klick('#song-bearbeiten'); await klick('#editor-speichern'); await warte(250);
    ok(/Keine Änderungen/.test($('#meldung').textContent) && JSON.parse(localStorage.getItem('songbook-daten')).songs[eigenId].versionen.length === 2, 'Speichern ohne Änderung legt Version an');
    // In der Liste mit Marke
    await geh('#/');
    ok($$('#song-liste .eintrag').some(function (a) { return /Testlied/.test(a.textContent) && /eigener Song/.test(a.textContent); }), 'Eigener Song fehlt in der Liste');
    ok($$('#song-liste .eintrag').length === SB_DATEN.songs.length + 1, 'Liste mit eigenem Song');
    // Songbook-Song bearbeiten: Marke „bearbeitet“
    await geh('#/edit/zombie');
    $('#ed-text').value += '\n{c: Testhinweis}'; await klick('#editor-speichern'); await warte(250);
    await geh('#/');
    ok($$('#song-liste .eintrag').some(function (a) { return /Zombie/.test(a.textContent) && /bearbeitet/.test(a.textContent); }), 'Marke „bearbeitet“ fehlt');
    // Abbrechen und verwerfen
    await geh('#/edit/zombie');
    $('#ed-text').value += 'xxx'; $('#ed-text').dispatchEvent(new Event('input'));
    await klick('#editor-abbrechen'); await dialogKnopf('ja'); await warte(200);
    ok(location.hash === '#/song/zombie' || location.hash === '#/', 'Verwerfen: ' + location.hash);
    ok(!/xxx/.test(JSON.parse(localStorage.getItem('songbook-daten')).songs.zombie.versionen.slice(-1)[0].text), 'Verworfenes gespeichert');
    // Eigenen Song löschen (auch aus Setlisten)
    await geh('#/song/' + encodeURIComponent(eigenId));
    await klick('#song-mehr'); await klick('#song-menue [data-aktion="loeschen"]'); await dialogKnopf('ja'); await warte(250);
    var D3 = JSON.parse(localStorage.getItem('songbook-daten'));
    ok(!D3.songs[eigenId] && D3.eigene.indexOf(eigenId) < 0, 'Eigener Song nicht gelöscht');
    // Link auf einen gelöschten oder unbekannten Song
    await geh('#/song/gibt-es-nicht');
    ok(!$('#v-liste').hidden, 'Unbekannter Song führt nicht zur Liste');

    // ================================================================ Einstellungen
    await geh('#/einstellungen');
    ok(!$('#v-einstellungen').hidden && /Songs aus dem Songbook/.test($('#e-stand').textContent), 'Einstellungen');
    await klick('#e-namen [data-wert="international"]');
    await geh('#/song/hand-in-hand');
    ok(akkorde().indexOf('B') >= 0 && akkorde().indexOf('H') < 0, 'International: B statt H fehlt: ' + akkorde().slice(0, 6).join(' '));
    await geh('#/einstellungen');
    await klick('#e-namen [data-wert="deutsch"]');
    await geh('#/song/hand-in-hand');
    ok(akkorde().indexOf('H') >= 0, 'Deutsch: H fehlt');
    await geh('#/einstellungen');
    await klick('#e-wach');
    ok($('#e-wach').getAttribute('aria-pressed') === 'false', 'Bildschirm anlassen ausschalten');
    await klick('#e-wach');
    geteilt = [];
    await klick('#e-export'); await warte(200);
    var js = geteilt[0] && geteilt[0].files && geteilt[0].files[0];
    var sich = js ? JSON.parse(await js.text()) : null;
    ok(sich && sich.app === 'songbook' && sich.format === 1 && sich.daten.songs.zombie, 'Sicherung teilen');
    // Sicherung laden: eine Version mehr
    if (sich) {
      sich.daten.songs.zombie.versionen.push({ zeit: Date.now() + 1000, text: '{title: Zombie}\n[Em]Importiert' });
      var dt = new DataTransfer(); dt.items.add(new File([JSON.stringify(sich)], 'sicherung.json', { type: 'application/json' }));
      var inp = $('#e-import'); inp.files = dt.files; inp.dispatchEvent(new Event('change')); await warte(400);
      ok(/1 Versionen/.test($('#e-meldung').textContent), 'Sicherung laden: ' + $('#e-meldung').textContent);
      var dt2 = new DataTransfer(); dt2.items.add(new File(['{"x":1}'], 'falsch.json', { type: 'application/json' }));
      inp.files = dt2.files; inp.dispatchEvent(new Event('change')); await warte(300);
      ok(/keine Sicherung/.test($('#e-meldung').textContent), 'Falsche Datei ohne Hinweis');
    }
    await klick('#einstellungen-zurueck'); await warte(150);

    // ================================================================ Neustart an der letzten Stelle
    await geh('#/set/amadeus-in-concert-2024/3');
    window.scrollTo(0, 300); await warte(100);
    window.dispatchEvent(new Event('pagehide'));
    var z = JSON.parse(localStorage.getItem('songbook-zustand'));
    ok(z.letzte === '#/set/amadeus-in-concert-2024/3' && z.letzteScroll === 300, 'Stelle merken: ' + z.letzte + ' ' + z.letzteScroll);

    // ================================================================ Darstellung: nichts ragt aus dem Bild, Klassen da
    await geh('#/song/backstreet-s-back');
    ok(document.documentElement.scrollWidth <= window.innerWidth + 1, 'Seite breiter als das Fenster: ' + document.documentElement.scrollWidth);
    ok(!/undefined|NaN|null/.test($('#v-song').innerText), 'undefined/NaN/null im Text');
    // alle Songs einmal öffnen
    var kaputt = [];
    for (var i = 0; i < SB_DATEN.songs.length; i++) {
      location.hash = '#/song/' + SB_DATEN.songs[i].id;
      await warte(40);
      if (titel() === '' || /undefined|NaN/.test($('#lied').innerHTML) || document.documentElement.scrollWidth > window.innerWidth + 1) kaputt.push(SB_DATEN.songs[i].id);
    }
    ok(!kaputt.length, 'Songs mit Fehlern in der Darstellung: ' + kaputt.join(', '));
  } catch (e) {
    fehler.push('Abbruch: ' + e.message + ' ' + (e.stack || '').split('\n')[1]);
  } finally {
    navigator.share = alt.share; navigator.canShare = alt.canShare; window.print = alt.print;
    window.removeEventListener('error', fang); window.removeEventListener('unhandledrejection', fang);
    Object.keys(localStorage).forEach(function (k) { if (k.indexOf('songbook-') === 0) localStorage.removeItem(k); });
    Object.keys(sicherung).forEach(function (k) { localStorage.setItem(k, sicherung[k]); });
    // Die Seite hält den Testzustand noch im Speicher und würde ihn beim Verlassen zurückschreiben:
    // Schreiben sperren und kurz nach dem Ergebnis neu laden, dann gilt wieder der gesicherte Stand.
    var schreiben = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (String(k).indexOf('songbook-') === 0) return; return schreiben.call(this, k, v); };
    var ziel = sicherung['songbook-zustand'] ? (JSON.parse(sicherung['songbook-zustand']).letzte || '#/') : '#/';
    setTimeout(function () { history.replaceState(null, '', ziel); location.reload(); }, 400);
  }
  fehlerImFenster.forEach(function (f) { fehler.push('Fehler im Fenster: ' + f); });
  return { ok: !fehler.length, schritte: schritte, fehler: fehler, gedruckt: gedruckt, geladen: geladen.length };
};
