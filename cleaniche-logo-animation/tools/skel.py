import numpy as np, json
from PIL import Image, ImageDraw
from skimage.morphology import skeletonize
from scipy import ndimage as ndi
K = 4
im = np.array(Image.open('sym4.png').convert('L')) < 128
sk = skeletonize(im)
nb = ndi.convolve(sk.astype(int), np.ones((3, 3), int), mode='constant') - 1
nb = nb * sk
ends = np.argwhere(nb == 1); juncs = np.argwhere(nb >= 3)
print('pixels', sk.sum(), 'ends', (ends / K).round(1).tolist())
print('juncs', (juncs / K).round(1).tolist())
dist = ndi.distance_transform_edt(im)
print('half-width median (units)', np.median(dist[sk]) / K)
vis = Image.fromarray(np.where(im, 200, 255).astype(np.uint8)).convert('RGB')
px = vis.load()
for y, x in np.argwhere(sk): px[x, y] = (255, 0, 0)
dr = ImageDraw.Draw(vis)
for y, x in ends: dr.ellipse([x-12, y-12, x+12, y+12], outline=(0, 0, 255), width=4)
for y, x in juncs: dr.ellipse([x-12, y-12, x+12, y+12], outline=(0, 160, 0), width=4)
vis.resize((1400, 810)).save('skel.png')
np.save('sk.npy', sk); np.save('dist.npy', dist)
