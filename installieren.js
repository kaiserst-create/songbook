// Songbook: Hinweis zum Installieren auf iPhone, iPad und Android (wie im Tuner und in „Songwriting & Chords“)
// Oben die Erkennung von Gerät und Browser ohne Bezug zur Seite (skripte/pruefen.js testet sie),
// unten der Hinweis selbst. Er erscheint einmal von selbst. Wer ihn schließt, findet ihn unten im Fuß wieder.
var SB_INSTALL = (function () {
  'use strict';

  // ------------------------------------------------------------------ Gerät und Browser erkennen
  // g: { ua, touch (maxTouchPoints), installiert, protokoll }
  // Ergebnis:
  //   'ios'          Safari auf iPhone oder iPad
  //   'ios-anders'   anderer Browser auf iPhone oder iPad (Chrome, Firefox, Edge …)
  //   'ios-app'      Browser in einer App (Instagram, Facebook …), dort geht Installieren nicht
  //   'android'      Browser auf Android
  //   'android-app'  Browser in einer App auf Android
  //   ''             kein Hinweis: Computer, schon installiert oder als Datei geöffnet
  var IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|LinkedInApp|Snapchat|TikTok|musical_ly|Bytedance|Pinterest|; wv\)/;
  var IOS_ANDERE = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|DuckDuckGo|Brave|GSA\//;

  function art(g) {
    var ua = String(g.ua || '');
    if (g.installiert || !/^https?:$/.test(g.protokoll || '')) return '';
    var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (g.touch || 0) > 1);   // iPad meldet sich als Mac
    var android = /Android/.test(ua);
    if (!ios && !android) return '';
    if (android) return IN_APP.test(ua) ? 'android-app' : 'android';
    if (IN_APP.test(ua) || !/Safari\//.test(ua)) return 'ios-app';   // ohne „Safari/“ ist es eine eingebettete Ansicht
    return IOS_ANDERE.test(ua) ? 'ios-anders' : 'ios';
  }

  // Was im Hinweis steht. knopf: Android hat ein eigenes Installationsfenster angeboten.
  var TEILEN = '<svg class="ih-symbol" viewBox="0 0 24 24" role="img" aria-label="Teilen-Symbol"><path d="M12 14.5V3.5M8 7.2l4-3.7 4 3.7M8.5 10H6.2C5.5 10 5 10.5 5 11.2v8.6c0 .7.5 1.2 1.2 1.2h11.6c.7 0 1.2-.5 1.2-1.2v-8.6c0-.7-.5-1.2-1.2-1.2h-2.3"/></svg>';
  function inhalt(a, knopf) {
    var home = a.indexOf('ios') === 0 ? 'Home-Bildschirm' : 'Startbildschirm';
    var nutzen = 'Dann startet das Songbook vom ' + home + ' wie eine App und läuft auch offline.';
    if (a === 'ios') return { nutzen: nutzen, schritte: [
      'Tippe auf Teilen ' + TEILEN + '. Siehst du es nicht, tippe zuerst auf <b>•••</b>.',
      'Wähle <b>Zum Home-Bildschirm</b>, eventuell weiter unten in der Liste.',
      'Tippe auf <b>Hinzufügen</b>.',
    ] };
    if (a === 'ios-anders') return { nutzen: nutzen, schritte: [
      'Tippe auf Teilen ' + TEILEN + ', in Chrome oben in der Adresszeile, sonst im Menü <b>•••</b>.',
      'Wähle <b>Zum Home-Bildschirm</b> und tippe auf <b>Hinzufügen</b>.',
    ], notiz: 'Findest du das nicht, öffne die Seite in Safari.' };
    if (a === 'android' && knopf) return { nutzen: nutzen, schritte: [], knopf: true };
    if (a === 'android') return { nutzen: nutzen, schritte: [
      'Öffne das Menü des Browsers, meist <b>⋮</b> oben rechts oder <b>☰</b> unten.',
      'Tippe auf <b>App installieren</b> oder <b>Zum Startbildschirm hinzufügen</b>.',
    ] };
    if (a === 'ios-app' || a === 'android-app') return {
      nutzen: 'Im Browser einer anderen App lässt sich das Songbook nicht installieren.',
      schritte: ['Öffne die Seite in ' + (a === 'ios-app' ? 'Safari' : 'Chrome') + ', meist über das Menü <b>•••</b> und <b>Im Browser öffnen</b>.'],
      notiz: 'Dort erscheint dieser Hinweis wieder.',
    };
    return null;
  }

  // ------------------------------------------------------------------ Hinweis auf der Seite
  var app = null, geraet = '', ereignis = null, el = {}, zeitgeber = 0;

  function installiert() {
    try {
      if (navigator.standalone === true) return true;
      return ['standalone', 'fullscreen', 'minimal-ui'].some(function (m) { return matchMedia('(display-mode: ' + m + ')').matches; });
    } catch (e) { return false; }
  }

  function anpassen() {   // Platz unter dem Inhalt, damit der Hinweis nichts verdeckt
    if (el.box.hidden) return;
    document.documentElement.style.setProperty('--ih-hoehe', (el.box.offsetHeight + 16) + 'px');
  }

  function fuellen() {
    var x = inhalt(geraet, !!ereignis);
    if (!x) return;
    el.nutzen.textContent = x.nutzen;
    el.schritte.innerHTML = x.schritte.map(function (s) { return '<li>' + s + '</li>'; }).join('');
    el.schritte.hidden = !x.schritte.length;
    el.notiz.textContent = x.notiz || '';
    el.notiz.hidden = !x.notiz;
    el.knopf.hidden = !x.knopf;
    anpassen();
  }

  function zeigen() {
    clearTimeout(zeitgeber);
    if (!geraet) return;
    fuellen();
    el.box.hidden = false;
    document.documentElement.classList.add('ih-offen');
    anpassen();
    window.addEventListener('resize', anpassen);
    requestAnimationFrame(function () { el.box.classList.add('da'); });
  }

  function schliessen() {
    clearTimeout(zeitgeber);
    el.box.classList.remove('da');
    el.box.hidden = true;
    document.documentElement.classList.remove('ih-offen');
    window.removeEventListener('resize', anpassen);
    if (!app.S.installZu) { app.S.installZu = true; app.speichern(); }
  }

  function installieren() {
    if (!ereignis) return;
    var e = ereignis;
    ereignis = null;   // das Fenster darf nur einmal kommen
    e.prompt();
    Promise.resolve(e.userChoice).then(function (r) {
      if (r && r.outcome === 'accepted') schliessen();
      else fuellen();   // abgelehnt: Weg über das Menü zeigen
    }, fuellen);
  }

  function einrichten(a) {
    app = a;
    el = {
      box: document.getElementById('install-hinweis'),
      nutzen: document.getElementById('ih-nutzen'),
      schritte: document.getElementById('ih-schritte'),
      notiz: document.getElementById('ih-notiz'),
      knopf: document.getElementById('ih-installieren'),
      zu: document.getElementById('ih-zu'),
      zeile: document.getElementById('install-zeile'),
      oeffnen: document.getElementById('install-oeffnen'),
    };
    geraet = art({ ua: navigator.userAgent, touch: navigator.maxTouchPoints, installiert: installiert(), protokoll: location.protocol });

    el.zu.addEventListener('click', schliessen);
    el.knopf.addEventListener('click', installieren);
    el.oeffnen.addEventListener('click', zeigen);

    // Chrome, Edge und Samsung Internet auf Android bieten ein eigenes Installationsfenster an
    window.addEventListener('beforeinstallprompt', function (e) {
      if (geraet !== 'android') return;
      e.preventDefault();   // statt der Leiste des Browsers kommt unser Hinweis
      ereignis = e;
      if (!el.box.hidden) fuellen();
    });
    window.addEventListener('appinstalled', function () {
      ereignis = null;
      geraet = '';
      el.zeile.hidden = true;
      if (!el.box.hidden) schliessen();
      app.S.installZu = true; app.speichern();
    });

    if (!geraet) return;
    el.zeile.hidden = false;
    if (!app.S.installZu) zeitgeber = setTimeout(zeigen, 1500);   // einmalig, kurz nach dem Start
  }

  return { art: art, inhalt: inhalt, einrichten: einrichten, zeigen: zeigen, schliessen: schliessen };
})();
