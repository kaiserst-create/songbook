#!/usr/bin/env python3
# Baut songs.js aus songs/*.txt und setlisten.json. Nach jeder Änderung an einem Song oder einer Setliste ausführen:
#
#   python3 skripte/songs_bauen.py
#
# Danach VERSION in sw.js erhöhen, damit installierte Apps die neuen Songs bekommen.
import json, os, re, datetime

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORDNER = os.path.join(APP, 'songs')

songs = []
for f in sorted(os.listdir(ORDNER)):
    if not f.endswith('.txt'):
        continue
    text = open(os.path.join(ORDNER, f), encoding='utf-8').read().strip()
    if not re.search(r'^\{title:', text, re.M):
        raise SystemExit(f + ': {title: …} fehlt')
    songs.append({'id': f[:-4], 'text': text})

ids = {s['id'] for s in songs}
setlisten = json.load(open(os.path.join(APP, 'setlisten.json'), encoding='utf-8'))
for l in setlisten:
    for e in l['eintraege']:
        if 'song' in e and e['song'] not in ids:
            raise SystemExit('Setliste ' + l['name'] + ': Song ' + e['song'] + ' fehlt')

bilder = sorted(set(re.findall(r'\{bild:\s*([^}]+?)\s*\}', '\n'.join(s['text'] for s in songs))))
for b in bilder:
    if not os.path.exists(os.path.join(APP, b)):
        raise SystemExit('Bild fehlt: ' + b)

js = ('// Erzeugt mit: python3 skripte/songs_bauen.py (Quelle: songs/*.txt und setlisten.json). Nicht von Hand bearbeiten.\n'
      'var SB_DATEN = ' + json.dumps({'stand': datetime.date.today().isoformat(), 'songs': songs, 'setlisten': setlisten, 'bilder': bilder},
                                     ensure_ascii=False, indent=0) + ';\n')
open(os.path.join(APP, 'songs.js'), 'w', encoding='utf-8').write(js)
print(len(songs), 'Songs,', len(setlisten), 'Setlisten,', len(bilder), 'Bilder,', len(js) // 1024, 'KB')
