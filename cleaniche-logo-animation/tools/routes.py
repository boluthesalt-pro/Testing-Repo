import numpy as np, json
d = json.load(open('branches.json'))
N = {int(k): np.array(v) for k, v in d['nodes'].items()}
def get(a, b, pick=None):
    c = [np.array(x['pts']) for x in d['branches'] if {x['a'], x['b']} == {a, b}]
    if pick: c = [pick(c)]
    p = c[0]
    if np.linalg.norm(p[0] - N[a]) > np.linalg.norm(p[-1] - N[a]): p = p[::-1]
    return p
def smooth_resample(p, step=1.5, win=15):
    k = np.ones(win) / win
    pad = np.vstack([np.repeat(p[:1], win//2, 0), p, np.repeat(p[-1:], win//2, 0)])
    q = np.stack([np.convolve(pad[:, i], k, 'valid') for i in range(2)], 1)
    q[0], q[-1] = p[0], p[-1]
    s = np.r_[0, np.cumsum(np.linalg.norm(np.diff(q, axis=0), axis=1))]
    t = np.arange(0, s[-1], step)
    return np.stack([np.interp(t, s, q[:, 0]), np.interp(t, s, q[:, 1])], 1)
A, B, C, D = 1, 2, 3, 4
waves = [np.array(x['pts']) for x in d['branches'] if {x['a'], x['b']} == {B, C}]
upper = min(waves, key=lambda p: p[:, 1].mean()); lower = max(waves, key=lambda p: p[:, 1].mean())
tail = np.array([585.0, 271.5])
outB = get(A, D)
outB = np.vstack([outB, np.linspace(N[D], tail, 12)[1:]])
R = {
  'outA': get(A, C),                                         # A -> left -> bottom -> C
  'upper': get(C, B, lambda c: min(c, key=lambda p: p[:, 1].mean())),
  'lower': get(C, B, lambda c: max(c, key=lambda p: p[:, 1].mean())),
  'link': get(B, A),
  'outB': outB,                                              # A -> top -> right -> tail
}
out = {k: np.round(smooth_resample(v), 2).tolist() for k, v in R.items()}
for k, v in out.items(): print(k, len(v), v[0], v[-1])
json.dump(out, open('/home/user/Testing-Repo/cleaniche-logo-animation/src/routes.json', 'w'))
