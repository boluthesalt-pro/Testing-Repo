import numpy as np, json
from scipy import ndimage as ndi
K = 4
sk = np.load('sk.npy')
H, W = sk.shape
pts = set(map(tuple, np.argwhere(sk)))
def nbrs(p):
    y, x = p
    return [(y+dy, x+dx) for dy in (-1,0,1) for dx in (-1,0,1) if (dy or dx) and (y+dy, x+dx) in pts]
deg = {p: len(nbrs(p)) for p in pts}
special = {p for p in pts if deg[p] != 2}
# cluster special pixels into nodes
lab, n = ndi.label(np.isin(np.arange(H*W).reshape(H, W), [y*W+x for y, x in special]), np.ones((3,3)))
node_of = {p: lab[p] for p in special}
centers = {i: np.mean([p for p in special if node_of[p] == i], axis=0) for i in range(1, n+1)}
branches, seen = [], set()
for s in special:
    for nb in nbrs(s):
        if nb in special or (s, nb) in seen: continue
        path, prev, cur = [s], s, nb
        while cur not in special:
            path.append(cur)
            nxt = [q for q in nbrs(cur) if q != prev and q not in path[-3:]]
            prev, cur = cur, nxt[0]
        path.append(cur)
        seen.add((cur, path[-2]))
        a, b = node_of[s], node_of[cur]
        if a == b and len(path) < 5: continue
        branches.append((a, b, np.array(path, float)))
# dedupe (each branch traced from both ends)
uniq = []
for a, b, p in branches:
    if any({a, b} == {a2, b2} and abs(len(p) - len(p2)) < 5 for a2, b2, p2 in uniq): continue
    uniq.append((a, b, p))
for a, b, p in uniq:
    print(a, b, len(p), (centers[a][::-1] / K).round(1), (centers[b][::-1] / K).round(1))
json.dump({'nodes': {i: (c[::-1] / K).tolist() for i, c in centers.items()},
           'branches': [{'a': int(a), 'b': int(b), 'pts': (p[:, ::-1] / K).tolist()} for a, b, p in uniq]}, open('branches.json', 'w'))
