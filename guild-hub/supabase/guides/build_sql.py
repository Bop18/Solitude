"""Builds the starter guides data file the website loads:
    public/data/classic-guides.json
Run:  python supabase/guides/build_sql.py   (after editing levelling.py / level60.py / raids.py)
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
G = []
for f in ['levelling.py', 'level60.py', 'raids.py']:
    ns = {}
    exec(open(os.path.join(HERE, f), encoding='utf-8').read(), ns)
    G += ns['GUIDES']

KIND = {"Zul'Gurub": 'raid', "Ruins of Ahn'Qiraj": 'raid', "Onyxia's Lair": 'raid', 'Molten Core': 'raid', 'Blackwing Lair': 'raid',
        "Temple of Ahn'Qiraj": 'raid', 'Naxxramas': 'raid', 'Upper Blackrock Spire': 'raid'}

data = [{
    'name': g['name'], 'kind': KIND.get(g['name'], 'dungeon'),
    'where': g['where'], 'overview': g['overview'], 'before': g['before'], 'route': g['route'], 'tips': g['tips'],
    'bosses': [{'boss': b, 'summary': s or None, 'tank': t or None, 'healer': h or None, 'dps': d or None} for (b, s, t, h, d) in g['bosses']],
} for g in G]

out = os.path.join(HERE, '..', '..', 'public', 'data', 'classic-guides.json')
json.dump(data, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('wrote public/data/classic-guides.json:', len(data), 'dungeons,', sum(len(g['bosses']) for g in data), 'bosses')
