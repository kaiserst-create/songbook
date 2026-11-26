#!/usr/bin/env python3
# Legt aus dem Songbook-Ordner einmalig die Dateien in songs/ und setlisten.json an.
#
#   python3 skripte/word_einlesen.py /tmp/roh.json <alle .docx>
#   python3 skripte/songs_anlegen.py /tmp/roh.json "<Songbook-Ordner>"
#
# Danach sind songs/*.txt und setlisten.json die Quelle. Korrekturen dort machen, nicht hier,
# sonst überschreibt ein neuer Lauf sie. skripte/songs_bauen.py macht daraus songs.js für die App.
#
# Regeln für doppelte Songs (mit dem Nutzer abgestimmt am 26.11.2026):
# - Es gilt die neueste Fassung: Amadeus 2024 > Rock im Tennis 2025 > SCS 2023 > Rock im Tennis 2024 > Hauptsongbook (2019).
# - „Wake me up“ nur Amadeus, „Zehn“ nur Rock im Tennis 2025 (Nutzer gefragt).
# - Eigene Songs (Endlose Nacht, Hand in Hand, Hochprozentig, Urlaub): die Markdown-Fassung ist aktuell.
# - Nur die aktuellste Fassung, keine früheren Versionen.
# - Geschützte Texte, die nur als Bild vorliegen (Punschstand, Palzlied), werden nicht abgetippt und
#   nicht übernommen (Nutzer). Die gemeinfreien Punschstand-Lieder sind abgetippt.

import json, os, re, sys, unicodedata

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
roh = json.load(open(sys.argv[1]))
SB = sys.argv[2]

KURZ = {
    'Songbook Stephan_Amadeus Concert.docx': 'AMA',
    'Setliste Slibovitz - Rock im Tennis 2025.docx': 'RIT25',
    'Songbook Stephan_SCS Concert.docx': 'SCS',
    'Setliste Slibovitz - Rock im Tennis 2024.docx': 'RIT24',
    'Songbook Stephan_20250331.docx': 'HAUPT',
    'Fer Bier 500 Meile.docx': 'BIER',
    'Kän Riesling_Narcotic.docx': 'RIES',
}
RANG = ['AMA', 'RIT25', 'SCS', 'RIT24', 'HAUPT', 'BIER', 'RIES']
QUELLE = {'AMA': 'Songbook Stephan_Amadeus Concert.docx', 'RIT25': 'Setliste Slibovitz - Rock im Tennis 2025.docx',
          'SCS': 'Songbook Stephan_SCS Concert.docx', 'RIT24': 'Setliste Slibovitz - Rock im Tennis 2024.docx',
          'HAUPT': 'Songbook Stephan_20250331.docx', 'BIER': 'Fer Bier 500 Meile.docx', 'RIES': 'Kän Riesling_Narcotic.docx'}

# Titel → (Anzeigetitel, Interpret)
TITEL = {
    'Backstreet`s back': ("Backstreet's back", ''),
    'What´s up': ("What's up", ''),
    'Basket Case – Green Day': ('Basket Case', 'Green Day'),
    'Ein Kompliment (Sportfreunde Stiller)': ('Ein Kompliment', 'Sportfreunde Stiller'),
    'Your Song - Elton': ('Your Song', 'Elton John'),
    'Sandstorm - Darude': ('Sandstorm', 'Darude'),
    'Time Warp – Rocky Horror Picture Show': ('Time Warp', 'Rocky Horror Picture Show'),
    'Tribute – Tenacious D.': ('Tribute', 'Tenacious D'),
    'Cats In The Cradle - Ugly Kid Joe': ('Cats In The Cradle', 'Ugly Kid Joe'),
    'Ghostbusters - Ray Parker Jr': ('Ghostbusters', 'Ray Parker Jr.'),
    'Highway to Hell – AC/DC': ('Highway to Hell', 'AC/DC'),
    'Let there be rock – AC/DC': ('Let there be rock', 'AC/DC'),
    'König von Deutschland – Rio Reiser': ('König von Deutschland', 'Rio Reiser'),
    'Ride the Wind - Poison': ('Ride the Wind', 'Poison'),
    'Zuhause - Fynn Kliemann': ('Zuhause', 'Fynn Kliemann'),
    'HOCHPROZENTIG KONZENTRIERT!': ('HOCHPROZENTIG KONZENTRIERT!', 'Stephan Kaiser'),
    'Hand in Hand': ('Hand in Hand', 'Stephan Kaiser'),
    'Zwei alte Männer machen Urlaub': ('Urlaub', 'Stephan Kaiser'),
}


def slug(t):
    t = t.lower().replace('ß', 'ss').replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue')
    t = unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')


def schluessel(t):
    t = t.replace('–', '-').split(' - ')[0]
    return re.sub(r'[^a-z0-9äöüß]', '', t.lower())


# ------------------------------------------------------------------ Word-Songs: neueste Fassung je Titel
gruppen = {}
for datei, songs in roh.items():
    q = KURZ[datei]
    for s in songs:
        if s.get('marke'):
            continue
        gruppen.setdefault(schluessel(s['titel']), []).append((RANG.index(q), q, s))

songs = {}   # id → dict(titel, kuenstler, text, quelle, alt=[])
for k, liste in gruppen.items():
    liste.sort(key=lambda x: x[0])
    _, q, s = liste[0]
    titel, kuenstler = TITEL.get(s['titel'], (s['titel'], ''))
    sid = slug(titel)
    songs[sid] = {'titel': titel, 'kuenstler': kuenstler, 'text': s['text'], 'quelle': QUELLE[q], 'alt': []}


# ------------------------------------------------------------------ Markdown-Songs
def md_zu_song(md):
    """Eigene Songs aus Markdown: **Abschnitt:**, **Akkorde**, Text, *(Echo)*"""
    zeilen = []
    for l in md.splitlines():
        l = l.rstrip().rstrip('\\').rstrip()
        roh_l = l
        l = l.strip()
        if l.startswith('# ') or l.lower().startswith(('song written', 'songtext')):
            continue
        if l.lower().startswith(('produced', 'mastered', 'vielen dank')):   # Danksagung und Produktion als Hinweis
            zeilen.append('{c: ' + re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', l) + '}')
            continue
        m = re.match(r'^\((\d+\. Strophe|Refrain|Bridge|Outro|Intro|Solo)\)$', l)
        if m:                                    # (1. Strophe) als Abschnitt
            zeilen.append('[' + m.group(1) + ']')
            continue
        if re.match(r'^\*\*Song \d+:', l):
            continue
        if not l:
            zeilen.append('')
            continue
        m = re.match(r'^\*\*([^*]+?):\s*\*\*\s*(.*)$', l)
        if m:                                    # **Verse 1: **E, A, H
            zeilen.append('[' + m.group(1).strip() + ']')
            rest = m.group(2).strip()
            if rest:
                zeilen.append(akkordreihe(rest))
            continue
        m = re.match(r'^\*{2,4}(.+?)\s*\*{2,4}\s*(\*\((.+)\)\*)?\s*(-\s*\*\*(.+)\*\*)?$', l)
        if m and re.match(r'^[A-H]', m.group(1).strip()):
            z = akkordreihe(m.group(1).strip())
            if m.group(3):
                z += '  [*(' + m.group(3) + ')]'
            zeilen.append(z)
            continue
        l = re.sub(r'\*\((.+?)\)\*', r'(\1)', l)
        l = l.replace('**', '').replace('TageTage*', 'Tage')
        zeilen.append(l)
    out = []
    for l in zeilen:
        if l == '' and (not out or out[-1] == ''):
            continue
        out.append(l)
    while out and out[-1] == '':
        out.pop()
    return '\n'.join(out)


def akkordreihe(t):
    """„Db, Fm, Bbm, Gb (C, Em, Am, F)“ → „[Db] [Fm] [Bbm] [Gb] ([C] [Em] [Am] [F])“"""
    def ersetze(m):
        return '[' + m.group(0) + ']'
    t = t.replace(',', ' ')
    t = re.sub(r'(?<![\w\[])[A-H](#|b)?(m|maj7|7|sus4|sus2|add9|6|9)*(?![\w\]])', ersetze, t)
    return re.sub(r'\s+', ' ', t).strip()


# Die Markdown-Fassungen der eigenen Songs sind die aktuellen (Nutzer, 26.11.2026).
# Frühere Fassungen kommen nicht mit (Nutzer: nur die aktuellsten).
def md(pfad):
    return md_zu_song(open(os.path.join(SB, pfad)).read())


songs['endlose-nacht'] = {'titel': 'Endlose Nacht', 'kuenstler': 'Stephan Kaiser', 'text': md('Endlose Nacht/Song 1 Endlose Nacht.md'),
                          'quelle': 'Endlose Nacht/Song 1 Endlose Nacht.md', 'alt': []}
for sid, pfad, titel, unter in [
        ('hand-in-hand', 'Hand in Hand/!Song 5 Hand in Hand.md', 'Hand in Hand', ''),
        ('hochprozentig-konzentriert', 'HOCHPROZENTIG KONZENTRIERT!/!Song 7 HOCHPROZENTIG KONZENTRIERT!.md', 'HOCHPROZENTIG KONZENTRIERT!', ''),
        ('urlaub', 'Urlaub/!Song 6 Urlaub.md', 'Urlaub', 'Zwei alte Männer machen Urlaub')]:
    alt = songs.pop(sid)
    neu = md(pfad)
    if unter:
        neu = '{subtitle: ' + unter + '}\n' + neu
    nid = slug(titel)
    songs[nid] = {'titel': titel, 'kuenstler': 'Stephan Kaiser', 'text': neu, 'quelle': pfad, 'alt': []}

# ------------------------------------------------------------------ Gemeinfreie Weihnachtslieder (Punschstand 2024)
GEMEINFREI = {
    'ihr-kinderlein-kommet': ('Ihr Kinderlein kommet', '''[Strophe 1]
[C]Ihr Kinderlein kommet, oh [G7]kommet doch [C]all
Zur Krippe her kommet, in [G7]Betlehem [C]Stall
Und [G]seht was in [G7]dieser [C7]hochheiligen [F]Nacht
Der [C]Vater im Himmel für [G7]Freude uns [C]macht

[Strophe 2]
[C]Oh seht in der Krippe, im [G7]nächtlichen [C]Stall
Seht hier bei des Lichtlein's, hell [G7]glänzendem [C]Strahl
In [G]reinlichen [G7]Windeln, das [C7]himmlische [F]Kind
Viel [C]schöner und holder als [G7]Engel es [C]sind

[Strophe 3]
[C]Da liegt es das Kindlein, auf [G7]Heu und auf [C]Stroh
Maria und Josef, be[G7]trachten es [C]froh
Die [G]redlichen [G7]Hirten, die [C7]beten [F]davor
Hoch [C]oben schwebt jubelnd der [G7]Engelein [C]Chor'''),
    'leise-rieselt-der-schnee': ('Leise rieselt der Schnee', '''[Strophe 1]
[C]Leise [G7]rieselt der [C]Schnee
[F]Still und [F]starr ruht der [C]See
[G7]Weihnachtlich [E7]glänzet der [Am]Wald
[F]Freue dich [G7]Christkind kommt [C]bald

[Strophe 2]
[C]In den [G7]Herzen wird's [C]warm
[F]Still schweigt [F]Kummer und [C]Harm
[G7]Sorge des [E7]Lebens ver[Am]hallt
[F]Freu dich [G7]Christkind kommt [C]bald

[Strophe 3]
[C]Bald ist [G7]Heilige [C]Nacht
[F]Chor der [F]Engel er[C]wacht
[G7]Hört nur wie [E7]lieblich es [Am]schallt
[F]Freue dich [G7]Christkind kommt [C]bald'''),
    'alle-jahre-wieder': ('Alle Jahre wieder', '''[Strophe 1]
[C]Alle [G]Jahre [C]wieder [G]
[Am]kommt das [F]Christus[C]kind [G]
[C]auf die [F]Er[C]de [Am]nie[F]der,
[C]wo wir Men[G]schen [C]sind.

[Strophe 2]
[C]Kehrt mit [G]seinem [C]Segen [G]
[Am]ein in [F]je[C]des [G]Haus,
[C]geht auf [F]al[C]len [Am]We[F]gen
[C]mit uns ein [G]und [C]aus.

[Strophe 3]
[C]Steht auch mir [G]zur [C]Seite [G]
[Am]still und [F]un[C]er[G]kannt,
[C]dass es [F]treu [C]mich [Am]lei[F]te
[C]an der lie[G]ben [C]Hand.'''),
}
for sid, (titel, text) in GEMEINFREI.items():
    songs[sid] = {'titel': titel, 'kuenstler': 'Volkslied', 'text': text, 'quelle': 'Punchstand 2024 (abgetippt)', 'alt': []}

# Lieder, die nur als Bild vorliegen (Weihnachtsbäckerei, White Christmas, Rudolph, Feliz Navidad, Palzlied),
# kommen nicht in die App: Text geschützt, der Nutzer wollte sie nicht als Bild (26.11.2026).

# ------------------------------------------------------------------ Dateien schreiben
ORDNER = os.path.join(APP, 'songs')
os.makedirs(ORDNER, exist_ok=True)
for f in os.listdir(ORDNER):
    if f.endswith('.txt'):
        os.remove(os.path.join(ORDNER, f))


def kopf(s, extra=''):
    k = '{title: ' + s['titel'] + '}\n'
    if s['kuenstler']:
        k += '{artist: ' + s['kuenstler'] + '}\n'
    return k + extra


for sid, s in sorted(songs.items()):
    open(os.path.join(ORDNER, sid + '.txt'), 'w').write(kopf(s) + s['text'].strip() + '\n')

# ------------------------------------------------------------------ Setlisten
def finde(titel):
    titel = TITEL.get(titel, (titel, ''))[0]
    k = schluessel(titel)
    for sid, s in songs.items():
        if schluessel(s['titel']) == k or sid == slug(titel):
            return sid
    raise SystemExit('Song für Setliste nicht gefunden: ' + titel)


def liste(name, titel):
    out = []
    for t in titel:
        if t.startswith('--'):
            out.append({'trenner': t[2:].strip()})
        else:
            out.append({'song': finde(t)})
    return {'id': slug(name), 'name': name, 'eintraege': out}


SETLISTEN = [
    liste('Amadeus in Concert 2024', ['-- Pause' if s['titel'] == 'Pause' else s['titel']
                                      for s in roh['Songbook Stephan_Amadeus Concert.docx'] if not s.get('marke') or s['titel'] == 'Pause']),
    liste('Slibovitz – Rock im Tennis 2024', [s['titel'] if not s.get('marke') else '-- Zugaben' for s in roh['Setliste Slibovitz - Rock im Tennis 2024.docx']]),
    liste('Slibovitz – Rock im Tennis 2025', [s['titel'] if not s.get('marke') else '-- Zugaben' for s in roh['Setliste Slibovitz - Rock im Tennis 2025.docx']]),
    liste('Punschstand 2024', ['Ihr Kinderlein kommet', 'Leise rieselt der Schnee', 'Zwei alte Männer machen Urlaub', 'Alle Jahre wieder']),
    # Wunsch des Nutzers (26.11.2026)
    liste('Eigene Songs', ['HOCHPROZENTIG KONZENTRIERT!', 'Urlaub', 'Endlose Nacht', 'Hand in Hand', 'Kän Riesling (Narcotic)', 'Fer Bier 500 Meile']),
]
json.dump(SETLISTEN, open(os.path.join(APP, 'setlisten.json'), 'w'), ensure_ascii=False, indent=1)
print(len(songs), 'Songs,', len(SETLISTEN), 'Setlisten')
for l in SETLISTEN:
    print(' ', l['name'], len([e for e in l['eintraege'] if 'song' in e]), 'Songs')
