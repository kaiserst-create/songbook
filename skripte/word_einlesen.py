#!/usr/bin/env python3
# Liest die Songs aus den Word-Dateien des Songbook-Ordners und schreibt sie im Songformat der App.
#
# In den Word-Dateien steht der Liedtext fett, die Akkorde nicht fett in einer eigenen Zeile darüber,
# ausgerichtet mit Leerzeichen und Tabulatoren in einer Proportionalschrift (meist Arial). Damit die
# Akkorde in der App über derselben Silbe stehen wie im Ausdruck, rechnet das Skript für jede Zeile die
# Position jedes Zeichens in Punkt aus (echte Zeichenbreiten aus den TTF-Dateien, Tabstopps, Einzug)
# und setzt jeden Akkord vor das Zeichen, über dem er im Ausdruck steht.
#
# Aufruf: python3 skripte/word_einlesen.py AUSGABE.json DATEI.docx [DATEI.docx …]
# Nur Python-Standardbibliothek. Das Ergebnis ist ein Rohentwurf: skripte/songs_bauen.py und die
# Dateien in songs/ sind danach die Quelle, nicht mehr die Word-Dateien.

import json, os, re, struct, sys, zipfile
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

# ------------------------------------------------------------------ Zeichenbreiten aus TTF-Dateien
class Schrift:
    def __init__(self, pfad):
        d = open(pfad, 'rb').read()
        n = struct.unpack('>H', d[4:6])[0]
        tab = {}
        for i in range(n):
            tag, _, off, ln = struct.unpack('>4sIII', d[12 + 16 * i: 28 + 16 * i])
            tab[tag.decode('latin1')] = (off, ln)
        self.upem = struct.unpack('>H', d[tab['head'][0] + 18: tab['head'][0] + 20])[0]
        nh = struct.unpack('>H', d[tab['hhea'][0] + 34: tab['hhea'][0] + 36])[0]
        ho = tab['hmtx'][0]
        self.adv = [struct.unpack('>H', d[ho + 4 * i: ho + 4 * i + 2])[0] for i in range(nh)]
        self.cmap = {}
        co = tab['cmap'][0]
        for i in range(struct.unpack('>H', d[co + 2: co + 4])[0]):
            pid, eid, off = struct.unpack('>HHI', d[co + 4 + 8 * i: co + 12 + 8 * i])
            st = co + off
            if pid == 3 and eid == 1 and struct.unpack('>H', d[st: st + 2])[0] == 4:
                segx2 = struct.unpack('>H', d[st + 6: st + 8])[0]
                seg = segx2 // 2
                ends = struct.unpack('>%dH' % seg, d[st + 14: st + 14 + segx2])
                starts = struct.unpack('>%dH' % seg, d[st + 16 + segx2: st + 16 + 2 * segx2])
                deltas = struct.unpack('>%dh' % seg, d[st + 16 + 2 * segx2: st + 16 + 3 * segx2])
                ro_pos = st + 16 + 3 * segx2
                ros = struct.unpack('>%dH' % seg, d[ro_pos: ro_pos + segx2])
                for k in range(seg):
                    for c in range(starts[k], ends[k] + 1):
                        if c == 0xFFFF:
                            continue
                        if ros[k] == 0:
                            g = (c + deltas[k]) & 0xFFFF
                        else:
                            a = ro_pos + 2 * k + ros[k] + 2 * (c - starts[k])
                            g = struct.unpack('>H', d[a: a + 2])[0]
                            if g:
                                g = (g + deltas[k]) & 0xFFFF
                        self.cmap[c] = g
                break

    def breite(self, ch, pt):
        g = self.cmap.get(ord(ch), 0)
        a = self.adv[g] if g < len(self.adv) else self.adv[-1]
        return a * pt / self.upem


SUP = '/System/Library/Fonts/Supplemental/'
SCHRIFTEN = {
    ('arial', False): Schrift(SUP + 'Arial.ttf'),
    ('arial', True): Schrift(SUP + 'Arial Bold.ttf'),
    ('courier', False): Schrift(SUP + 'Courier New.ttf'),
    ('courier', True): Schrift(SUP + 'Courier New Bold.ttf'),
    ('times', False): Schrift(SUP + 'Times New Roman.ttf'),
    ('times', True): Schrift(SUP + 'Times New Roman Bold.ttf'),
}


def schrift_fuer(name, fett):
    n = (name or '').lower()
    art = 'courier' if 'courier' in n else ('times' if 'times' in n else 'arial')   # Helvetica, Calibri ≈ Arial
    return SCHRIFTEN[(art, fett)]


# ------------------------------------------------------------------ Word-Datei lesen
def an(el, name):
    """Schalter wie <w:b/> oder <w:b w:val="0"/>"""
    if el is None:
        return None
    x = el.find(W + name)
    if x is None:
        return None
    return x.get(W + 'val') not in ('0', 'false', 'off')


class Dokument:
    def __init__(self, pfad):
        z = zipfile.ZipFile(pfad)
        self.root = ET.fromstring(z.read('word/document.xml'))
        styles = ET.fromstring(z.read('word/styles.xml'))
        settings = ET.fromstring(z.read('word/settings.xml'))
        dt = settings.find(W + 'defaultTabStop')
        self.tabweite = int(dt.get(W + 'val')) / 20 if dt is not None else 35.4
        self.styles = {}
        for s in styles.iter(W + 'style'):
            self.styles[s.get(W + 'styleId')] = s
        dd = styles.find(W + 'docDefaults')
        self.def_rpr = dd.find('.//' + W + 'rPr') if dd is not None else None
        self.default_para = None
        for sid, s in self.styles.items():
            if s.get(W + 'type') == 'paragraph' and s.get(W + 'default') == '1':
                self.default_para = sid

    def style_kette(self, sid):
        kette = []
        while sid and sid in self.styles and len(kette) < 10:
            s = self.styles[sid]
            kette.append(s)
            b = s.find(W + 'basedOn')
            sid = b.get(W + 'val') if b is not None else None
        return kette

    def eigenschaft(self, rpr, kette, finde):
        if rpr is not None:
            v = finde(rpr)
            if v is not None:
                return v
        for s in kette:
            r = s.find(W + 'rPr')
            if r is not None:
                v = finde(r)
                if v is not None:
                    return v
        if self.def_rpr is not None:
            v = finde(self.def_rpr)
            if v is not None:
                return v
        return None

    def absaetze(self):
        body = self.root.find(W + 'body')
        for p in body.iter(W + 'p'):
            yield self.absatz(p)

    def absatz(self, p):
        ppr = p.find(W + 'pPr')
        sid = None
        if ppr is not None and ppr.find(W + 'pStyle') is not None:
            sid = ppr.find(W + 'pStyle').get(W + 'val')
        kette = self.style_kette(sid or self.default_para)
        # Einzug und Tabstopps: direkt am Absatz, sonst aus der Formatvorlage
        ind = ppr.find(W + 'ind') if ppr is not None else None
        if ind is None:
            for s in kette:
                sp = s.find(W + 'pPr')
                if sp is not None and sp.find(W + 'ind') is not None:
                    ind = sp.find(W + 'ind')
                    break
        links = erste = 0.0
        if ind is not None:
            links = int(ind.get(W + 'left', ind.get(W + 'start', '0')) or 0) / 20
            if ind.get(W + 'hanging'):
                erste = -int(ind.get(W + 'hanging')) / 20
            elif ind.get(W + 'firstLine'):
                erste = int(ind.get(W + 'firstLine')) / 20
        stopps = {}
        for quelle in list(reversed(kette)) + [ppr]:
            sp = quelle if quelle is ppr else (quelle.find(W + 'pPr') if quelle is not None else None)
            if sp is None:
                continue
            t = sp.find(W + 'tabs')
            if t is None:
                continue
            for x in t.findall(W + 'tab'):
                pos = int(x.get(W + 'pos')) / 20
                if x.get(W + 'val') == 'clear':
                    stopps.pop(pos, None)
                else:
                    stopps[pos] = x.get(W + 'val')
        stopps = sorted(p for p, v in stopps.items() if v in ('left', 'start', 'center', 'right', 'decimal', 'num'))
        if erste < 0:
            stopps = sorted(set(stopps + [links]))     # hängender Einzug wirkt wie ein Tabstopp
        x = links + erste
        zeichen = []   # (zeichen, x_start, x_ende, fett, punkt)
        seitenumbruch = an(ppr, 'pageBreakBefore') or False
        for r in p.iter(W + 'r'):
            rpr = r.find(W + 'rPr')
            fett = self.eigenschaft(rpr, kette, lambda e: an(e, 'b'))
            sz = self.eigenschaft(rpr, kette, lambda e: e.find(W + 'sz').get(W + 'val') if e.find(W + 'sz') is not None else None)
            pt = int(sz) / 2 if sz else 12.0

            def font(e):
                f = e.find(W + 'rFonts')
                if f is None:
                    return None
                if f.get(W + 'ascii'):
                    return f.get(W + 'ascii')
                if f.get(W + 'asciiTheme'):
                    return 'Arial'          # Designschrift dieser Dokumente ist Arial
                return None
            name = self.eigenschaft(rpr, kette, font) or 'Arial'
            sch = schrift_fuer(name, bool(fett))
            for c in r:
                if c.tag == W + 't':
                    for ch in (c.text or ''):
                        b = sch.breite(ch, pt)
                        zeichen.append((ch, x, x + b, bool(fett), pt))
                        x += b
                elif c.tag == W + 'tab':
                    ziel = next((s for s in stopps if s > x + 0.01), None)
                    if ziel is None:
                        ziel = (int(x / self.tabweite + 1e-6) + 1) * self.tabweite
                    zeichen.append(('\t', x, ziel, bool(fett), pt))
                    x = ziel
                elif c.tag == W + 'br':
                    if c.get(W + 'type') == 'page':
                        seitenumbruch = True
                    else:
                        zeichen.append(('\n', x, x, bool(fett), pt))
                        x = links
        return {'stil': sid or '', 'zeichen': zeichen, 'umbruch': seitenumbruch}




# ------------------------------------------------------------------ Akkorde erkennen
# Akkordname, wie er in den Dokumenten vorkommt: C, F#m, Bb, Asus4, Cadd9, G/H, D/F#, A7sus4, Bb6 …
AKKORD = re.compile(r'^[A-H](#|b|♭)?(maj|min|m|M|dim|aug|sus|add|°|ø|\+|[0-9]|b5|#5|b9|#9|#11)*(/[A-H](#|b|♭)?)?$')
# deutsche Schreibweise in Kleinbuchstaben = Moll (e, a, e7, h), Basston klein (G/h, C/g, D/fis)
DEUTSCH = re.compile(r'^([a-h])(is|es|s)?(7|m7|sus4|sus2|add9)?$')
BASS_DEUTSCH = re.compile(r'^([A-H](?:#|b)?[^/]*)/([a-h])(is|es|s)?$')
TRENNER = re.compile(r'^(\||\|\||-|–|/|\.\.\.|…|x\d+|\d+x|\[?\d+x\]?|\(x?\d+x?\)|:|\|:|:\||N\.?C\.?|%|,|;|\*)$', re.I)
ABSCHNITT = re.compile(r'^(intro|outro|vers|verse|strophe|chorus|refrain|pre-?chorus|post-?chorus|bridge|solo|interlude|instrumental|'
                       r'zwischenspiel|riff|main riff|break|hook|ende|schluss|coda|tag|\d+\.\s*strophe)\b', re.I)


def ton_deutsch(b, z):
    """e → E, fis → F#, es → Eb, b → Bb, h → H"""
    if b == 'b' and not z:
        return 'Bb'
    if z == 'is':
        return b.upper() + '#'
    if z in ('es', 's'):
        return b.upper() + 'b'
    return b.upper()


def einzelakkord(t, deutsch):
    """Ein Akkord ohne Klammern → normierter Name oder None."""
    if AKKORD.match(t):
        return t
    if not deutsch:
        return None
    m = DEUTSCH.match(t)
    if m:
        art = m.group(3) or ''
        if art.startswith('m'):
            art = art[1:]
        return ton_deutsch(m.group(1), m.group(2)) + 'm' + art
    m = BASS_DEUTSCH.match(t)
    if m and AKKORD.match(m.group(1)):
        return m.group(1) + '/' + ton_deutsch(m.group(2), m.group(3))
    return None


def akkord(tok, deutsch=False):
    """Akkord-Wort → normierter Text (Klammern, Ketten C-Csus4-C und Alternativen C/C7 bleiben) oder None."""
    t = tok.rstrip(',;')
    vorne = ''
    hinten = ''
    while t.startswith('('):
        vorne += '('
        t = t[1:]
    while t.endswith(')'):
        hinten = ')' + hinten
        t = t[:-1]
    if not t:
        return None
    e = einzelakkord(t, deutsch)
    if e:
        return vorne + e + hinten
    # Ketten: C-Csus4-C, Alternativen: C/C7, Basslauf: /A
    for sep in ('-', '–', '/'):
        if sep in t:
            teile = t.split(sep)
            norm = [einzelakkord(x, deutsch) if x else '' for x in teile]
            if all(n is not None for n in norm) and any(norm):
                return vorne + sep.join(norm) + hinten
    return None


def label_von(text):
    """Abschnittsname am Zeilenanfang: [Verse 1], (Chorus), {Intro:} → (name, länge) oder (None, 0)"""
    m = re.match(r'^\s*\[([^\]]+)\]\s*', text)
    if m and not akkord(m.group(1).strip()):
        return m.group(1).strip(), m.end()
    m = re.match(r'^\s*[\(\{]([^\)\}]+)[\)\}]\s*', text)
    if m and ABSCHNITT.match(m.group(1).strip()):
        return m.group(1).strip(), m.end()
    return None, 0


def text_von(zeichen):
    return ''.join(c[0] for c in zeichen)


def zerlege(zeichen):
    """Zeichenliste → Wörter: [{w, x0, x1, fett, i0, i1}] (i = Index in der Zeichenliste)"""
    out, cur = [], None
    for i, (ch, xs, xe, f, pt) in enumerate(zeichen):
        if ch in ' \t\n ':
            if cur:
                out.append(cur)
            cur = None
            continue
        if cur is None:
            cur = {'w': '', 'x0': xs, 'x1': xe, 'fett': f, 'i0': i, 'i1': i + 1}
        cur['w'] += ch
        cur['x1'] = xe
        cur['i1'] = i + 1
    if cur:
        out.append(cur)
    # „C j7“ ist Cmaj7
    zus = []
    for w in out:
        if w['w'] == 'j7' and zus and akkord(zus[-1]['w'], True):
            zus[-1] = dict(zus[-1], w=zus[-1]['w'] + 'maj7', x1=w['x1'], i1=w['i1'])
            continue
        if w['w'].endswith('j7') and len(w['w']) > 2 and akkord(w['w'][:-2]):
            w = dict(w, w=w['w'][:-2] + 'maj7')
        zus.append(w)
    return zus


def analyse(zeichen):
    """Zerlegt eine Zeile: Label, Wörter dahinter, Art der Zeile."""
    t = text_von(zeichen).replace(' ', ' ')
    if not t.strip():
        return {'art': 'leer'}
    label, lang = label_von(t)
    rest = zeichen[lang:] if label else zeichen
    # das Label nicht fett: sonst gehört es zum Liedtext ([Chorus] mitten in fettem Text bleibt Label)
    woerter = zerlege(rest)
    fett_n = sum(len(w['w']) for w in woerter if w['fett'])
    alle_n = sum(len(w['w']) for w in woerter) or 1
    nicht_fett = fett_n * 2 < alle_n
    akk = sonst = 0
    # deutsche Kleinschreibung (e, G/h, D/fis) nur in nicht fetten Zeilen oder wenn die Zeile sonst klar aus Akkorden besteht
    standard = sum(1 for w in woerter if akkord(w['w']))
    deutsch = nicht_fett or (len(woerter) >= 3 and standard * 2 >= len(woerter))
    for w in woerter:
        w['akk'] = akkord(w['w'], deutsch=deutsch)
        if w['akk']:
            akk += 1
        elif TRENNER.match(w['w'].strip('()')):
            w['trenner'] = True
        else:
            sonst += 1
    info = {'label': label, 'woerter': woerter, 'rest': rest, 'nicht_fett': nicht_fett}
    if akk and (sonst == 0 or (nicht_fett and akk >= 3 and sonst <= 1)):
        info['art'] = 'akkorde'
    elif label and not woerter:
        info['art'] = 'label'
    elif not nicht_fett:
        info['art'] = 'text'
    else:
        info['art'] = 'notiz'
    return info


# ------------------------------------------------------------------ Zeilen zusammenführen
def setze(text_zeichen, akkorde):
    """Akkorde [(name, x)] über die Textzeile setzen: Ergebnis im Format [G]Text."""
    t = [(' ' if c[0] == '\t' else c[0],) + tuple(c[1:]) for c in text_zeichen if c[0] != '\n']
    while t and not t[-1][0].strip():
        t.pop()
    einfuegen, hinten = {}, []
    ende = t[-1][2] if t else 0
    for w, x in akkorde:
        if not t or x >= ende - 0.5:
            hinten.append(w)
            continue
        idx = 0
        for i, c in enumerate(t):
            if c[1] <= x + 1.0:
                idx = i
            else:
                break
        c = t[idx]
        if x > (c[1] + c[2]) / 2 and idx + 1 < len(t):
            idx += 1
        if t[idx][0] == ' ' and idx + 1 < len(t):
            idx += 1
        # knapp hinter dem Wortanfang (höchstens zwei Zeichen): auf den Wortanfang ziehen
        ws = idx
        while ws > 0 and t[ws - 1][0] != ' ':
            ws -= 1
        if 0 < idx - ws <= 2:
            idx = ws
        einfuegen.setdefault(idx, []).append(w)
    out = ''
    for i, c in enumerate(t):
        if i in einfuegen:
            out += ''.join('[' + w + ']' for w in einfuegen[i])
        out += c[0]
    out = out.rstrip()
    if hinten:
        out += ('  ' if out else '') + ' '.join(hinten_text(w) for w in hinten)
    return out


def hinten_text(w):
    return w if w.startswith('[') else '[' + w + ']'


def als_klammer(w):
    """Wort einer Akkordzeile → [Akkord], [*Notiz] oder Trenner"""
    if w.get('akk'):
        return '[' + w['akk'] + ']'
    if w.get('trenner'):
        return w['w']
    return '[*' + w['w'] + ']'


def akkordzeile(woerter):
    """Akkorde ohne Text darunter: [C] [F] [G], Trenner und Notizen bleiben Text."""
    teile = []
    for w in woerter:
        if w.get('akk'):
            a = w['akk']
            vorne = re.match(r'^\(*', a).group(0)
            hinten = re.search(r'\)*$', a).group(0)
            kern = a[len(vorne): len(a) - len(hinten)] if hinten else a[len(vorne):]
            teile.append(vorne + '[' + kern + ']' + hinten)
        else:
            teile.append(w['w'])
    return ' '.join(teile)


def ist_reihe(info, z):
    """Akkordzeile über Text: als Folge (Reihe) zeigen statt über die Silben setzen?"""
    akk = [w for w in info['woerter'] if w.get('akk')]
    if not akk:
        return True
    pt = z[0][4]
    sp = 0.278 * pt
    luecken = [b['x0'] - a['x1'] for a, b in zip(akk, akk[1:])]
    tabs = '\t' in text_von(info['rest'])
    if info['label']:
        return tabs or (luecken and max(luecken) <= 4.5 * sp)
    vorne_frei = not text_von(z)[:1].strip()
    if tabs and not vorne_frei and not re.search(r'\S {2,}\S', text_von(z)):
        return True
    return bool(luecken) and max(luecken) <= 2.5 * sp and not vorne_frei


def song_text(absaetze):
    zeilen = []
    i, n = 0, len(absaetze)
    while i < n:
        z = absaetze[i]['zeichen']
        info = analyse(z)
        art = info['art']
        if art == 'leer':
            zeilen.append('')
        elif art == 'label':
            zeilen.append('[' + info['label'] + ']')
        elif art == 'akkorde':
            if info['label']:
                zeilen.append('[' + info['label'] + ']')
            nxt = absaetze[i + 1]['zeichen'] if i + 1 < n else []
            ninfo = analyse(nxt) if nxt else {'art': 'leer'}
            if ninfo['art'] == 'text' and not ist_reihe(info, z):
                if ninfo['label']:
                    zeilen.append('[' + ninfo['label'] + ']')
                nz = list(ninfo['rest'])
                akk = [(als_klammer(w)[1:-1] if w.get('akk') else als_klammer(w), w['x0']) for w in info['woerter'] if not w.get('trenner')]
                # nicht fette Akkorde in der Textzeile (z. B. hinter einem Tab) kommen mit dazu
                weg = set()
                for w in ninfo['woerter']:
                    if not w['fett'] and w.get('akk'):
                        akk.append((w['akk'], w['x0']))
                        weg.update(range(w['i0'], w['i1']))
                nz = [c for k, c in enumerate(nz) if k not in weg]
                # „[Chorus] Em …“: der erste Akkord direkt hinter dem Abschnittsnamen gehört an den Zeilenanfang
                if info['label'] and akk:
                    lab_ende = info['rest'][0][1] if info['rest'] else None
                    erster = info['woerter'][0]['x0'] if info['woerter'] else None
                    if lab_ende is not None and erster is not None and erster - lab_ende < 2.2 * 0.278 * z[0][4]:
                        akk[0] = (akk[0][0], -1)
                akk.sort(key=lambda a: a[1])
                zeilen.append(setze(nz, akk))
                i += 1
            else:
                zeilen.append(akkordzeile(info['woerter']))
        elif art == 'text':
            if info['label']:
                zeilen.append('[' + info['label'] + ']')
            rest = list(info['rest'])
            akk, weg = [], set()
            for w in info['woerter']:
                if not w['fett'] and w.get('akk'):
                    akk.append((w['akk'], w['x0']))
                    weg.update(range(w['i0'], w['i1']))
            rest = [c for k, c in enumerate(rest) if k not in weg]
            while rest and not rest[0][0].strip():
                rest.pop(0)
            t = setze(rest, akk) if akk else text_von(rest).replace('\t', ' ').strip()
            if t:
                zeilen.append(t)
        else:  # Notiz
            if info['label']:
                zeilen.append('[' + info['label'] + ']')
            t = re.sub(r'\s+', ' ', text_von(info['rest'])).strip()
            if t:
                zeilen.append('{c: ' + t + '}')
        i += 1
    out = []
    for l in zeilen:
        l = l.replace(' ', ' ').rstrip()
        if l == '' and (not out or out[-1] == ''):
            continue
        out.append(l)
    while out and out[-1] == '':
        out.pop()
    return '\n'.join(out)


# ------------------------------------------------------------------ Songs aus einem Dokument
UEBERSPRINGEN = re.compile(r'^(chords vibe cheatsheet|guitar chords|ukulele chords|pause|zugaben|inhaltsverzeichnis)$', re.I)
KEIN_TITEL = {'The cats in the cradle and the silver spoon…'}   # Refrainzeile, versehentlich als Überschrift formatiert


def norm_titel(t):
    return re.sub(r'[^a-z0-9äöüß]', '', t.lower())


def songs_aus(pfad):
    d = Dokument(pfad)
    alle = list(d.absaetze())
    # Titel aus dem Inhaltsverzeichnis: manche Songs haben keine Überschrift
    verzeichnis = set()
    for a in alle:
        if a['stil'].lower().startswith(('verzeichnis', 'toc')):
            t = text_von(a['zeichen']).split('\t')[0].strip()
            if t:
                verzeichnis.add(norm_titel(t))
    verzeichnis -= {norm_titel(t) for t in KEIN_TITEL}
    verzeichnis -= {norm_titel(text_von(a['zeichen'])) for a in alle if a['stil'].lower().startswith(('berschrift1', 'heading1'))}
    starts = []   # (index, titel, rest-zeichen)
    gesehen = set()
    for i, a in enumerate(alle):
        t = re.sub(r'\s+', ' ', text_von(a['zeichen'])).strip()
        if not t or a['stil'].lower().startswith(('verzeichnis', 'toc')):
            continue
        if a['stil'].lower().startswith(('berschrift1', 'heading1')):
            if t in KEIN_TITEL:
                continue
            starts.append((i, t, []))
            gesehen.add(norm_titel(t))
            continue
        # Titel ohne Überschrift: der Absatz beginnt mit einem Titel aus dem Verzeichnis
        roh = text_von(a['zeichen'])
        for vt in verzeichnis - gesehen:
            kopf = roh.split('\t')[0].strip()
            if norm_titel(kopf) == vt and starts:
                starts.append((i, kopf, a['zeichen'][len(roh.split('\t')[0]):]))
                gesehen.add(vt)
                break
    if not starts:
        k = next(i for i, a in enumerate(alle) if text_von(a['zeichen']).strip())
        starts = [(k, re.sub(r'\s+', ' ', text_von(alle[k]['zeichen'])).strip(), [])]
    songs = []
    for k, (i, titel, rest) in enumerate(starts):
        ende = starts[k + 1][0] if k + 1 < len(starts) else len(alle)
        nr = re.match(r'^(\d+)\s*-\s*', titel)
        if nr:
            titel = titel[nr.end():]
        if UEBERSPRINGEN.match(titel):
            songs.append({'titel': titel, 'nr': None, 'text': '', 'marke': True})
            continue
        absaetze = alle[i + 1: ende]
        # Refrainzeile mit Überschrift-Format: als fetten Text behandeln
        absaetze = [dict(a, zeichen=[(c[0], c[1], c[2], True, c[4]) for c in a['zeichen']]) if text_von(a['zeichen']).strip() in KEIN_TITEL else a for a in absaetze]
        if rest and text_von(rest).strip():
            absaetze = [{'stil': '', 'zeichen': list(rest), 'umbruch': False}] + absaetze
        songs.append({'titel': titel, 'nr': int(nr.group(1)) if nr else None, 'text': song_text(absaetze)})
    return songs


if __name__ == '__main__':
    ziel = sys.argv[1]
    erg = {}
    for p in sys.argv[2:]:
        erg[os.path.basename(p)] = songs_aus(p)
    json.dump(erg, open(ziel, 'w'), ensure_ascii=False, indent=1)
    for k, v in erg.items():
        print(k, len(v))
