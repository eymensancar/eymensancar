"""Ortak harita izdüşümü: küresel Lambert konik konform (LCC), www/js/geo.js ile birebir aynı.
Standart paraleller 37° ve 41°, merkez İstanbul (41.085 K, 28.97 D) = (0, 0). x doğu, y kuzey (m).
Türkiye genelinde ölçek hatası binde 3'ün altında, açılar korunur (pist yönleri doğru)."""
import math
R = 6371008.8
LAT0, LON0 = 41.085, 28.97
P1, P2 = math.radians(37.0), math.radians(41.0)
_t = lambda p: math.tan(math.pi / 4 + p / 2)
N = math.log(math.cos(P1) / math.cos(P2)) / math.log(_t(P2) / _t(P1))
F = math.cos(P1) * _t(P1) ** N / N
RHO0 = R * F / _t(math.radians(LAT0)) ** N

def proj(lat, lon):
    rho = R * F / _t(math.radians(lat)) ** N
    th = N * math.radians(lon - LON0)
    return (rho * math.sin(th), RHO0 - rho * math.cos(th))

def inv(x, y):
    dy = RHO0 - y
    rho = math.copysign(math.hypot(x, dy), N)
    th = math.atan2(x, dy)
    lon = LON0 + math.degrees(th / N)
    lat = math.degrees(2 * math.atan((R * F / rho) ** (1 / N)) - math.pi / 2)
    return lat, lon

def inv_np(x, y):
    import numpy as np
    dy = RHO0 - y
    rho = np.hypot(x, dy)
    th = np.arctan2(x, dy)
    lon = LON0 + np.degrees(th / N)
    lat = np.degrees(2 * np.arctan((R * F / rho) ** (1 / N)) - np.pi / 2)
    return lat, lon

def proj_np(lat, lon):
    import numpy as np
    rho = R * F / np.tan(np.pi / 4 + np.radians(lat) / 2) ** N
    th = N * np.radians(lon - LON0)
    return rho * np.sin(th), RHO0 - rho * np.cos(th)

if __name__ == '__main__':
    for la, lo in [(41.085, 28.97), (36, 26), (36, 45), (42.2, 26), (42.2, 45), (39.93, 32.85), (39.7, 44.3)]:
        x, y = proj(la, lo); print(la, lo, round(x), round(y), [round(v, 6) for v in inv(x, y)])
    print('n', N)
