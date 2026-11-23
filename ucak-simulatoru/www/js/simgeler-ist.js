// İstanbul simge yapıları (gerçek ölçülerle, hacimli 3B): Galata Kulesi, Kız Kulesi, Ayasofya, Sultanahmet, Süleymaniye,
// Dolmabahçe Sarayı, Topkapı Sarayı (ana hatlar), Rumeli Hisarı, Ortaköy Camii, köprüler (15 Temmuz Şehitler, Fatih Sultan
// Mehmet, Yavuz Sultan Selim, Galata, Atatürk, Haliç Metro) ve Levent'teki gökdelenler (İstanbul Sapphire, Kanyon, İş Kulesi).
// world.js'teki eski basit modellerin (Çamlıca'dakiler hariç) ve eski köprülerin yerini alır; Çamlıca Kulesi ve Büyük Çamlıca
// Camii'ne dokunulmaz. Her yapı uzaklığa göre iki ayrıntı düzeyinde (THREE.LOD), malzemeye göre birleştirilmiş örgüdür
// (yapı başına 2-4 çizim çağrısı). Gece aydınlatması: world.gece (0-1) ya da ?gece=1; taş cepheler sıcak ışıkla yıkanır,
// pencereler, şerefeler, köprü halatları ve uçak ikaz lambaları yanar.
// Aynı yerdeki OSM binaları (Dolmabahçe, Topkapı, Kanyon, Sapphire, Ortaköy) bina gölgelendiricisinde köşe düzeyinde
// gizlenir ve tabanları buradan doğru yükseklik ve çatıyla yeniden çizilir (OSM_* verisi bina paketlerinden alındı).
import * as THREE from '../vendor/three.module.min.js';
import { geo } from './geo.js';

const D2R = Math.PI / 180;
const QIBLA = 151.6;  // İstanbul'dan kıble (gerçek baş, derece)
// gerçek baştan (kuzeyden saat yönü) yerel +x eksenine dönüş açısı (doğudan saat yönünün tersi, radyan)
const bearing = (b) => (90 - b) * D2R;

// ---------- OSM tabanları (bina paketlerinden; x, y: çapa; R: gizleme dikdörtgenleri [cx, cy, cos, sin, yarı en, yarı boy];
// P: [no, tür, yükseklik, düz köşe dizisi (çapaya göre, m)]) ----------
const OSM_DATA = {"topkapi":{"x":1124.3,"y":-8173.0,"R":[[941.0,-8113.4,-0.82748,0.5615,20.3,16.9],[960.9,-8157.9,0.54325,0.83957,91.4,44.0],[1060.7,-8102.9,0.56451,0.82542,59.1,27.5],[1117.7,-7987.7,-0.85193,0.52366,48.7,80.4],[1132.3,-8063.0,0.45478,0.89061,13.9,6.5],[1147.5,-8037.5,0.45942,0.88822,17.1,9.5],[1183.5,-7996.0,0.76822,0.64018,14.4,7.5],[1189.2,-7974.6,-0.88287,0.46961,13.9,29.4],[1219.2,-8031.5,0.46193,0.88691,15.0,16.4],[1204.3,-8052.2,-0.88705,0.46168,49.0,11.3],[1264.1,-8068.5,-0.89443,0.44721,13.0,12.3],[1213.8,-8152.9,0.45643,0.88976,87.1,19.4],[1036.7,-8140.2,-0.8,0.6,6.8,6.8],[1221.3,-8002.9,-0.87416,0.48564,10.0,8.9],[1108.6,-8185.3,-0.88516,0.46528,22.7,14.3],[1144.0,-8214.7,-0.89221,0.45161,23.3,9.0],[1213.9,-7934.8,-0.87622,0.48192,25.4,18.5],[1252.6,-7954.7,0.46401,0.88583,12.5,17.4],[1281.8,-7970.0,-0.89043,0.45511,13.5,12.2],[1294.8,-8004.8,0.44721,0.89443,30.5,15.2],[1276.7,-8043.3,0.45305,0.89149,17.7,14.0],[1309.5,-8029.8,-0.92848,0.37139,7.5,6.3],[1218.8,-7876.4,0.60604,0.79543,13.9,13.3],[1248.9,-7898.5,0.53505,0.84482,9.6,11.0],[1225.5,-7914.2,0.48192,0.87622,6.4,10.6],[1319.5,-7923.4,0.45223,0.8919,20.7,8.9],[1068.7,-8169.2,-0.88775,0.46032,23.5,3.7],[1125.0,-8258.7,0.50028,0.86587,13.6,11.6],[1192.5,-7910.8,0.5241,0.85166,8.4,6.6],[1128.3,-8239.2,0.47885,0.8779,7.0,5.0],[1078.5,-8029.5,0.58817,0.80874,17.6,4.3],[1119.3,-8066.4,0.44721,0.89443,5.1,4.8],[1064.8,-8014.2,0.5547,0.83205,13.2,4.6],[1117.7,-7987.7,-0.85193,0.52366,48.7,80.4],[1139.4,-7998.8,-0.87251,0.4886,7.8,8.4]],"P":[[1,4,0.0,[-205.0,54.5,-176.0,35.5,-158.0,62.0,-186.0,81.0,-192.5,71.0,-196.5,72.5,-199.5,71.0,-200.5,67.5,-198.5,64.5]],[28,4,0.0,[-240.0,-42.0,-201.5,-68.5,-196.0,-60.0,-190.0,-64.0,-194.5,-70.5,-177.0,-82.5,-180.0,-76.0,-176.0,-70.0,-171.0,-73.5,-136.5,-23.0,-141.5,-19.5,-119.0,14.0,-139.5,23.0,-100.5,80.5,-150.0,114.5,-163.0,96.0,-123.0,69.0,-181.5,-11.0,-178.0,-13.5,-197.5,-41.5,-226.5,-22.0]],[232,4,0.0,[-119.0,37.0,-107.5,29.5,-57.5,103.5,-51.0,99.5,-54.5,94.0,-33.5,82.0,-21.5,101.0,-13.5,96.0,-9.0,103.5,-30.5,116.0,-35.0,109.0,-59.5,124.0]],[298,4,0.0,[-89.5,142.5,-35.0,109.0,-30.5,116.0,-11.0,104.5,0.5,108.5,6.5,120.5,-2.0,125.5,7.0,142.0,20.0,137.0,66.5,230.0,48.5,245.0,42.5,235.0,52.5,228.5,42.5,211.5,-21.0,239.5,-31.5,233.5,-38.5,214.0,-24.0,193.5,-28.0,176.0,-32.5,169.0,-57.0,186.5]],[234,4,0.0,[-3.5,101.0,7.0,95.5,18.5,119.5,8.5,124.5]],[258,0,0.0,[8.5,124.5,23.5,117.0,38.5,146.0,27.0,152.0,20.0,137.0,14.5,138.5]],[277,1,10.0,[44.0,173.5,53.0,163.0,74.0,180.5,65.0,191.0]],[282,4,4.5,[40.0,179.5,46.5,175.5,65.0,191.0,70.0,185.0,75.5,196.5,78.5,196.5,90.0,217.5,66.5,230.0]],[242,4,0.0,[74.0,136.0,102.0,121.5,114.5,145.5,113.0,148.0,89.5,160.5,87.0,160.0]],[231,4,0.0,[36.0,141.5,57.5,130.5,56.5,128.5,73.5,119.5,70.5,113.5,85.0,106.0,88.0,112.0,109.5,101.0,110.5,102.5,116.5,99.0,118.0,102.5,123.5,100.0,127.5,108.0,42.0,152.5]],[267,4,0.0,[123.5,100.0,145.5,88.5,156.0,109.5,146.0,114.5,141.0,105.0,129.0,111.0]],[230,4,0.0,[37.0,-41.0,47.0,-46.0,119.5,92.5,123.0,91.0,74.5,-3.5,81.5,-7.0,55.0,-59.5,66.5,-65.5,145.5,88.5,118.0,102.5,116.5,99.0,110.5,102.5]],[255,1,10.0,[-96.5,31.5,-86.5,24.0,-79.0,34.0,-89.0,41.5]],[233,4,0.0,[86.0,170.0,90.5,167.5,89.0,165.0,97.0,160.5,98.5,163.5,102.5,161.0,107.5,170.0,103.5,172.0,105.0,175.0,97.0,179.0,95.5,176.5,91.0,179.0]],[257,4,0.0,[-38.0,-12.0,-33.0,-15.0,-34.0,-16.5,-33.5,-18.5,-31.5,-19.0,-30.0,-18.5,-29.0,-17.0,-17.0,-23.5,-17.5,-25.0,-17.0,-26.5,-15.5,-27.5,-13.5,-27.0,-13.0,-25.5,-1.0,-31.5,10.0,-10.5,-29.0,10.0,-36.0,-3.0,-34.0,-4.0]],[262,4,0.0,[-4.5,-39.0,25.0,-53.5,29.0,-45.5,40.0,-51.0,43.5,-44.5,3.0,-24.0]],[276,0,0.0,[59.0,234.5,90.0,217.5,93.5,223.5,106.0,217.0,115.0,234.5,103.0,241.0,107.0,249.0,77.0,265.5]],[281,0,0.0,[108.0,216.0,137.5,200.0,148.5,221.0,137.0,227.0,136.0,225.0,117.5,234.0]],[279,0,0.0,[140.5,198.5,163.0,187.0,174.0,207.5,151.0,219.0]],[260,0,0.0,[148.0,151.0,154.5,147.5,158.5,141.5,170.0,135.0,196.5,188.0,170.5,201.5,164.0,188.0,166.0,187.0]],[268,0,0.0,[132.5,120.5,156.0,109.5,170.0,135.0,158.5,141.5,154.5,147.5,148.0,151.0]],[250,5,0.0,[176.5,140.5,189.0,135.5,193.5,146.0,181.0,151.0]],[280,4,0.0,[79.0,297.5,83.5,294.5,80.5,290.5,96.5,278.5,112.5,299.5,96.5,311.5,94.0,308.0,89.5,311.0]],[283,4,0.0,[113.0,276.0,120.0,271.5,121.5,273.5,124.5,272.0,121.0,266.0,128.5,261.5,138.0,276.5,130.0,281.0,128.0,277.0,124.5,279.0,127.0,283.0,120.0,287.0]],[303,4,0.0,[89.5,258.5,107.0,249.0,112.5,259.0,95.5,268.5]],[278,4,0.0,[178.5,235.5,192.0,229.0,194.5,234.0,196.0,233.5,198.5,239.0,197.5,239.5,205.0,254.5,206.5,254.0,209.0,259.5,208.0,260.0,210.0,264.5,196.5,271.0]],[236,4,0.0,[-77.5,11.5,-37.0,-9.5,-34.0,-4.0,-74.5,16.5]],[235,0,0.0,[-15.5,-91.5,3.5,-102.5,16.5,-80.0,9.5,-76.0,1.0,-91.0,-3.5,-88.0,3.5,-76.0,-4.0,-71.5]],[299,0,0.0,[59.0,259.0,69.0,252.5,77.0,265.5,67.0,272.0]],[243,0,0.0,[-3.0,-69.5,4.5,-74.0,10.5,-63.0,3.0,-58.5]],[256,0,0.0,[-59.0,132.0,-52.5,128.5,-33.0,155.0,-39.0,159.5]],[259,0,0.0,[-11.0,104.5,-3.5,101.0,0.5,108.5,-7.0,112.5]],[263,0,0.0,[-70.0,150.5,-63.5,146.5,-49.5,167.0,-56.0,171.5]],[275,0,0.0,[-89.5,142.5,-35.0,109.0,-30.5,116.0,-11.0,104.5,0.5,108.5,6.5,120.5,-2.0,125.5,7.0,142.0,20.0,137.0,66.5,230.0,48.5,245.0,42.5,235.0,52.5,228.5,42.5,211.5,-21.0,239.5,-31.5,233.5,-38.5,214.0,-24.0,193.5,-28.0,176.0,-32.5,169.0,-57.0,186.5]],[293,0,0.0,[5.0,171.0,17.0,164.0,25.0,177.5,12.5,184.5]]]},"dolma":{"x":2541.3,"y":-5103.6,"R":[[2474.4,-5138.5,-0.35898,0.93335,24.5,49.3],[2744.3,-5040.5,0.932,0.36245,41.6,20.2],[2635.8,-5027.2,-0.35937,0.9332,70.6,51.2],[2562.3,-5104.6,0.92996,0.36766,46.9,33.9],[2294.8,-5242.2,-0.34665,0.93799,15.3,23.1],[2272.0,-5164.5,0.94119,0.33786,28.9,26.1],[2388.1,-5106.0,0.94055,0.33964,10.2,2.5],[2274.0,-5215.7,0.93633,0.35112,4.9,10.5],[2272.4,-5234.7,0.94868,0.31623,4.6,3.3],[2258.8,-5199.2,0.94868,0.31623,4.7,3.3],[2487.4,-5057.7,-0.32393,0.94608,49.4,10.0],[2483.5,-5056.4,0.94569,0.32508,9.2,6.4],[2478.8,-4989.4,-0.29598,0.9552,19.4,13.0],[2512.1,-4964.2,0.94006,0.341,27.8,6.5],[2553.8,-4950.2,0.95016,0.31177,17.5,5.9]],"P":[[0,5,0.0,[-117.5,-29.0,-112.5,-42.0,-116.0,-43.5,-100.5,-73.5,-92.0,-70.0,-93.0,-66.5,-44.0,-51.5,-45.5,-46.5,-24.0,-38.5,-22.5,-43.0,-14.0,-39.5,-29.5,3.0,-40.5,-1.5,-38.5,-7.0,-82.0,-18.0,-88.5,-22.5,-87.0,-26.0,-106.0,-33.5,-109.0,-25.5]],[1,5,0.0,[160.0,67.0,164.0,57.0,161.5,56.0,173.5,30.5,182.5,34.0,181.5,36.5,197.0,40.0,196.5,42.5,202.0,44.5,202.5,43.0,222.5,52.0,223.5,50.0,238.5,58.0,239.0,56.0,245.5,58.5,238.5,84.5,236.0,83.5,232.0,94.5,224.5,91.5,225.5,89.0,216.5,86.0,216.0,88.5,177.0,74.0,178.0,71.0]],[2,5,0.0,[55.0,37.5,75.0,-6.0,84.5,-2.5,83.0,2.0,162.0,27.5,158.5,49.5,143.0,65.5,147.5,79.0,116.5,159.5,78.0,145.0,111.0,54.5,81.5,47.0,84.0,41.0,75.5,38.0,73.0,44.5]],[3,5,0.0,[-28.0,-1.0,-16.5,-32.5,0.0,-25.5,1.5,-29.5,13.0,-25.0,15.5,-31.0,24.0,-28.0,29.5,-33.5,33.5,-30.5,32.5,-24.5,41.0,-21.0,38.5,-15.5,60.5,-7.0,59.0,-3.0,69.0,1.0,56.5,34.5,43.5,29.5,54.0,3.5,49.0,1.5,34.0,40.0,-9.0,23.0,-2.0,5.5,-20.0,-2.0,-21.5,2.0]],[4,5,7.5,[-272.0,-135.0,-263.5,-158.0,-253.0,-154.0,-253.5,-153.0,-244.0,-149.5,-243.0,-153.0,-235.5,-150.0,-236.5,-147.0,-221.5,-142.0,-230.0,-119.5,-240.0,-123.0,-240.5,-121.0,-246.5,-123.5,-246.0,-125.5,-251.0,-127.5,-252.0,-125.0,-259.0,-127.5,-258.0,-130.0]],[5,5,7.5,[-297.0,-68.0,-287.5,-94.5,-268.0,-87.5,-275.5,-67.5,-253.0,-59.5,-257.0,-48.5,-245.5,-44.0,-251.5,-27.5,-267.0,-33.0,-259.5,-54.0]],[10,5,0.0,[-163.0,-4.0,-161.5,-7.5,-144.0,-1.0,-145.0,2.5]],[11,5,0.0,[-274.5,-105.0,-268.0,-123.0,-260.0,-120.0,-267.0,-101.5]],[8,0,11.0,[-273.5,-130.0,-272.0,-135.0,-264.5,-132.5,-266.5,-127.5]],[9,0,11.0,[-287.5,-94.5,-285.5,-99.5,-278.0,-97.0,-280.0,-92.0]],[12,4,7.5,[-65.5,93.5,-53.0,53.5,-51.5,54.0,-48.0,44.5,-61.5,40.0,-54.0,16.5,-41.0,20.5,-34.5,1.0,-29.5,3.0,-61.0,95.0]],[13,4,0.0,[-68.0,49.5,-64.0,39.0,-48.0,44.5,-51.5,54.0,-56.0,52.5,-57.5,50.0,-61.0,48.5,-64.5,51.0]],[67,0,7.5,[-80.0,128.0,-69.0,92.5,-61.0,95.0,-68.5,118.5,-53.0,124.5,-57.0,135.5]],[68,4,0.0,[-57.0,135.5,-53.0,124.5,-2.0,143.0,-5.5,153.0]],[58,5,4.5,[-5.5,153.0,-2.0,143.0,30.0,153.5,26.5,163.5]]]},"kanyon":{"x":3420.0,"y":-777.6,"R":[[3430.4,-856.0,0.99158,0.1295,166.2,36.5]],"P":[[185,3,275.0,[-151.5,-118.0,-149.5,-125.0,-135.0,-120.5,-131.0,-133.0,16.5,-104.0,96.0,-103.0,173.0,-93.5,161.5,-71.5,139.0,-72.5,152.0,-69.5,152.0,-58.5,138.0,-59.0,167.0,-43.0,170.0,-21.5,-86.5,-55.0,-134.0,-72.5,-132.5,-78.0,-139.0,-79.5,-133.5,-96.5,-114.0,-102.5]]]},"sapphire":{"x":3003.1,"y":0.6,"R":[[3008.7,75.1,-0.94055,0.33964,24.2,14.7],[3009.4,56.2,0.99924,0.03903,32.6,16.6],[3059.6,79.8,0.99992,0.01266,20.4,15.6],[3056.3,45.4,0.99966,0.02597,19.9,4.2]],"P":[[30,7,85.0,[-16.5,82.5,-12.0,71.0,-5.0,63.5,13.0,57.0,25.0,59.5,27.5,65.5,26.0,72.0,22.0,80.0,15.0,85.5,6.0,89.5,-3.5,92.0,-12.5,89.5]],[31,7,9.0,[-25.0,38.5,39.0,41.0,25.0,59.5,13.0,57.0,-5.0,63.5,-12.0,71.0]],[28,8,14.0,[37.0,94.0,37.0,64.0,76.5,64.5,76.0,94.5]],[32,0,0.0,[34.0,48.0,40.0,41.0,72.5,42.0,72.5,49.0]]]},"ortakoy":{"x":4780.1,"y":-4190.7,"R":[[4765.2,-4191.7,-0.61887,0.78549,20.8,18.2]],"P":[[1,1,10.0,[-41.0,3.5,-32.5,-7.0,-30.5,-5.5,-27.0,-10.0,-23.5,-7.5,-10.5,-23.5,6.0,-10.5,-7.0,6.0,-3.5,9.0,-7.5,13.5,-5.5,15.0,-13.5,25.5,-21.5,19.0,-15.5,11.5,-27.0,2.0,-33.0,10.0]]]}};

// ---------- yapı kiti: yerel çerçevede ilkel şekiller, malzeme kovalarına (op: taş/boya, gl: cam, lamp: lamba) birleşir ----------
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
const _c = new THREE.Color();
const col = (h) => { _c.set(h); return [_c.r, _c.g, _c.b]; };
class Buf { constructor() { this.p = []; this.n = []; this.c = []; this.l = []; this.i = []; } }
class Kit {
  // ox, oy: LOD nesnesinin harita konumu; yerel örgü koordinatı (X - ox, h, -(Y - oy))
  constructor(ox, oy, q) { this.ox = ox; this.oy = oy; this.q = q; this.B = { op: new Buf(), gl: new Buf(), lamp: new Buf() }; this.F = new THREE.Matrix4(); this.lines = []; this.seg = q ? 8 : 16; }
  // çerçeve: harita (x, y), taban yüksekliği h, yerel +x'in yönü (radyan, doğudan saat yönünün tersi). Yerel +z = sağ (eksene göre)
  frame(x, y, h, ang = 0) { this.F.makeRotationY(ang).setPosition(x - this.ox, h, -(y - this.oy)); this.fa = ang; this.fx = x; this.fy = y; this.fh = h; return this; }
  // yerel noktanın harita konumu
  mapAt(lx, lz) { const c = Math.cos(this.fa), s = Math.sin(this.fa); return { x: this.fx + lx * c + lz * s, y: this.fy + lx * s - lz * c }; }
  add(g, m, c, lit = 0, bk = 'op') {
    const M = m ? _m.multiplyMatrices(this.F, m) : this.F;
    _n.getNormalMatrix(M);
    const P = g.attributes.position, N = g.attributes.normal, b = this.B[bk], base = b.p.length / 3;
    if (typeof c === 'number') c = col(c);
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(M); b.p.push(_v.x, _v.y, _v.z);
      _w.fromBufferAttribute(N, i).applyMatrix3(_n).normalize(); b.n.push(_w.x, _w.y, _w.z);
      b.c.push(c[0], c[1], c[2]); b.l.push(lit);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) b.i.push(base + g.index.array[i]);
    else for (let i = 0; i < P.count; i++) b.i.push(base + i);
    g.dispose();
  }
  // dörtgen (yerel köşeler), yüzü n yönüne bakacak şekilde
  quad(a, b2, c, d, n, cc, lit = 0, bk = 'op') {
    const ab = _v.set(b2[0] - a[0], b2[1] - a[1], b2[2] - a[2]), ac = _w.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    const cr = new THREE.Vector3().crossVectors(ab, ac);
    let P = [a, b2, c, d];
    if (cr.x * n[0] + cr.y * n[1] + cr.z * n[2] < 0) P = [a, d, c, b2];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P.flat(), 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([...n, ...n, ...n, ...n], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.add(g, null, cc, lit, bk);
  }
  box(w, h, d, x, y, z, c, lit = 0, ry = 0, bk = 'op') { this.add(new THREE.BoxGeometry(w, h, d), M4(x, y + h / 2, z, ry), c, lit, bk); }
  cyl(rb, rt, h, x, y, z, c, lit = 0, seg = this.seg, bk = 'op', open = false, ry = 0) { this.add(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), M4(x, y + h / 2, z, ry), c, lit, bk); }
  cone(r, h, x, y, z, c, lit = 0, seg = this.seg, ry = 0) { this.add(new THREE.ConeGeometry(r, h, seg), M4(x, y + h / 2, z, ry), c, lit); }
  dome(r, x, y, z, c, lit = 0, sy = 1, seg = this.seg + 4) { this.add(new THREE.SphereGeometry(r, seg, Math.max(4, seg >> 2), 0, Math.PI * 2, 0, Math.PI / 2), M4(x, y, z, 0, 1, sy, 1), c, lit); }
  // yarım kubbe: dışa doğru (dx, dz) yönünde şişer
  half(r, x, y, z, dx, dz, c, lit = 0, sy = 1, seg = this.seg) { this.add(new THREE.SphereGeometry(r, seg, Math.max(3, seg >> 2), 0, Math.PI, 0, Math.PI / 2), M4(x, y, z, Math.atan2(dx, dz), 1, sy, 1), c, lit); }
  lathe(pts, x, y, z, c, lit = 0, seg = this.seg) { this.add(new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(Math.max(r, 0.001), h)), seg), M4(x, y, z), c, lit); }
  // a'dan b'ye kalınlığı w olan kiriş (yerel koordinat)
  beam(a, b2, w, c, lit = 0, bk = 'op', d = w) {
    const L = Math.hypot(b2[0] - a[0], b2[1] - a[1], b2[2] - a[2]); if (L < 0.01) return;
    const up = Math.abs(b2[1] - a[1]) > L * 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    _m2.lookAt(new THREE.Vector3(...a), new THREE.Vector3(...b2), up).setPosition((a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2, (a[2] + b2[2]) / 2);
    this.add(new THREE.BoxGeometry(w, d, L), _m2, c, lit, bk);
  }
  // çokgen prizma: yerel (x, z) noktaları, y0..y1; kapak isteğe bağlı başka renk
  prism(P, y0, y1, c, lit = 0, cap = c, bk = 'op', capBk = bk) {
    const n = P.length; let ar = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; ar += P[i][0] * P[j][1] - P[j][0] * P[i][1]; }
    const s = ar > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const [x0, z0] = P[i], [x1, z1] = P[(i + 1) % n]; const L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.01) continue;
      // dış normal (x-z düzleminde, z aşağı yönlü çokgen için s ile)
      const nx = -(z1 - z0) / L * s, nz = (x1 - x0) / L * s;
      this.quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], [-nx, 0, -nz], c, lit, bk);
    }
    if (cap) {
      const sh = new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(x, -z)));
      const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); g.translate(0, y1, 0);
      this.add(g, null, cap, lit, capBk);
    }
  }
  // çokgen kenarları boyunca pencereler (lamba kovası: gündüz koyu cam, gece sıcak ışık)
  windows(P, y0, y1, rows, sp = 4, ww = 1.6, wh = 2.2, rnd = 1) {
    const n = P.length; let ar = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; ar += P[i][0] * P[j][1] - P[j][0] * P[i][1]; }
    const s = ar > 0 ? 1 : -1;
    let k = rnd * 977;
    for (let i = 0; i < n; i++) {
      const [x0, z0] = P[i], [x1, z1] = P[(i + 1) % n]; const L = Math.hypot(x1 - x0, z1 - z0); if (L < sp * 1.2) continue;
      const ux = (x1 - x0) / L, uz = (z1 - z0) / L, nx = uz * s, nz = -ux * s;
      const cnt = Math.floor(L / sp);
      for (let r = 0; r < rows; r++) {
        const yc = y0 + (y1 - y0) * (r + 0.5) / rows;
        for (let c = 0; c < cnt; c++) {
          const t = (c + 0.5) * L / cnt, cx = x0 + ux * t + nx * 0.12, cz = z0 + uz * t + nz * 0.12;
          k = (k * 16807) % 2147483647; const on = (k % 100) < 72;
          const cc = on ? [1.0, 0.62, 0.3] : [0.05, 0.04, 0.03];
          this.quad([cx - ux * ww / 2, yc - wh / 2, cz - uz * ww / 2], [cx + ux * ww / 2, yc - wh / 2, cz + uz * ww / 2], [cx + ux * ww / 2, yc + wh / 2, cz + uz * ww / 2], [cx - ux * ww / 2, yc + wh / 2, cz - uz * ww / 2], [nx, 0, nz], cc, 0.1, 'lamp');
        }
      }
    }
  }
  line(a, b2) { this.lines.push(a[0], a[1], a[2], b2[0], b2[1], b2[2]); }
  build(mats) {
    const g = new THREE.Group();
    for (const k of ['op', 'gl', 'lamp']) {
      const b = this.B[k]; if (!b.i.length) continue;
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
      geom.setAttribute('lit', new THREE.Float32BufferAttribute(b.l, 1));
      geom.setIndex(b.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(b.i, 1) : new THREE.Uint16BufferAttribute(b.i, 1));
      geom.computeBoundingSphere();
      const m = new THREE.Mesh(geom, mats[k]); m.matrixAutoUpdate = false;
      g.add(m);
    }
    if (this.lines.length) {
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(this.lines, 3)); lg.computeBoundingSphere();
      const l = new THREE.LineSegments(lg, mats.line); l.matrixAutoUpdate = false; g.add(l);
    }
    return g;
  }
  tris() { let t = 0; for (const k in this.B) t += this.B[k].i.length / 3; return t; }
}
function M4(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4().makeRotationY(ry); m.scale(new THREE.Vector3(sx, sy, sz)); m.setPosition(x, y, z); return m;
}

// ---------- malzemeler ----------
const U = { night: { value: 0 }, hideO: { value: new THREE.Vector2() } };
function materials() {
  const op = new THREE.MeshLambertMaterial({ vertexColors: true });
  op.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = U.night;
    sh.vertexShader = 'attribute float lit; varying float vLit;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vLit = lit;');
    sh.fragmentShader = 'uniform float uNight; varying float vLit;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       // gece: taş cepheler alttan sıcak ışıkla yıkanır
       totalEmissiveRadiance += vColor.rgb * vLit * uNight * vec3(1.0, 0.78, 0.52) * 0.85;`);
  };
  op.customProgramCacheKey = () => 'simist-op';
  const gl = new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0x9db0c4, shininess: 70 });
  gl.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = U.night;
    sh.vertexShader = 'attribute float lit; varying float vLit; varying vec3 vLp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vLit = lit; vLp = position;');
    sh.fragmentShader = 'uniform float uNight; varying float vLit; varying vec3 vLp;\n float hb3(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       // camın gökyüzü yansıması (yukarı bakan yüzlerde daha açık) ve gece ofis pencereleri
       vec3 nW = normalize(vNormal);
       totalEmissiveRadiance += vec3(0.05, 0.075, 0.1) * (1.0 - uNight) * (0.6 + 0.4 * nW.y);
       vec2 cell = floor(vec2((vLp.x + vLp.z) / 3.0, vLp.y / 3.6));
       float on = step(0.42, hb3(cell)) * step(0.12, fract(vLp.y / 3.6));
       totalEmissiveRadiance += vec3(1.0, 0.86, 0.62) * on * vLit * uNight * (0.5 + 0.5 * hb3(cell + 7.0));`);
  };
  gl.customProgramCacheKey = () => 'simist-gl';
  const lamp = new THREE.MeshBasicMaterial({ vertexColors: true });
  lamp.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = U.night;
    sh.vertexShader = 'attribute float lit; varying float vLit;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vLit = lit;');
    // gündüz: lit = gri düzeyi (cam ya da metal görünümü); gece: köşe rengi (ışık)
    sh.fragmentShader = 'uniform float uNight; varying float vLit;\n' + sh.fragmentShader.replace('#include <color_fragment>', 'diffuseColor.rgb = mix(vec3(vLit), vColor.rgb * 1.4, uNight);');
  };
  lamp.customProgramCacheKey = () => 'simist-lamp';
  const line = new THREE.LineBasicMaterial({ color: 0x9ca3aa });
  return { op, gl, lamp, line };
}

// ---------- renkler ----------
const C = {
  stone: 0xd9d1c1, stoneD: 0xb8ad98, lead: 0x86929c, leadD: 0x6c7780, white: 0xeeebe3, pink: 0xc9906c, pinkD: 0xa8735a,
  brick: 0xa4553c, gold: 0xc9a54a, marble: 0xece6d8, roofZ: 0x7b8288, steel: 0xa9b0b6, steelD: 0x7d858c, asph: 0x45474b,
  conc: 0xc4c2bc, galata: 0xc8bba4, rock: 0x6e6a62, glass: 0x5f7486, glassB: 0x48627a, red: 0xb24a36, cream: 0xe6dcc8,
};

// ---------- Osmanlı minaresi ----------
function minaret(k, x, z, h, balc, c = C.white, base = 0) {
  const q = k.q, sg = q ? 8 : 12;
  const pl = h * 0.07;
  k.box(4.8, pl + 1, 4.8, x, base - 1, z, c, 1);
  k.cyl(2.7, 2.4, 2.2, x, base + pl, z, c, 1, sg);
  const top = h * 0.80;
  const ys = balc === 1 ? [0.70] : balc === 2 ? [0.56, 0.72] : [0.50, 0.62, 0.74];
  k.cyl(2.3, 2.05, h * ys[0] - pl - 2.2 - 1.4, x, base + pl + 2.2, z, c, 1, sg);
  let y = base + pl + 2.2 + h * ys[0] - pl - 2.2 - 1.4;
  for (let i = 0; i < ys.length; i++) {
    const yb = base + h * ys[i];
    if (i > 0) { k.cyl(2.0, 1.95, yb - 1.4 - y, x, y, z, c, 1, sg); }
    k.cyl(2.05, 3.1, 1.4, x, yb - 1.4, z, c, 1, sg);   // mukarnas (şerefe altı)
    k.cyl(3.15, 3.15, 0.35, x, yb, z, c, 1, sg);
    if (!q) { k.cyl(3.05, 3.05, 1.05, x, yb + 0.35, z, c, 1, sg, 'op', true); k.cyl(3.13, 3.13, 0.16, x, yb + 1.25, z, [1, 0.85, 0.55], 0.82, sg, 'lamp', true); }
    y = yb + 0.35;
  }
  k.cyl(1.85, 1.8, base + top - y, x, y, z, c, 1, sg);   // petek
  k.cone(2.25, h * 0.18, x, base + top, z, C.lead, 0.6, sg);
  if (!q) { k.cyl(0.12, 0.12, 2.4, x, base + top + h * 0.18 - 0.3, z, C.gold, 0.4, 4); k.dome(0.45, x, base + top + h * 0.18 + 1.0, z, C.gold, 0.4, 1, 6); }
}

// ---------- Osmanlı camisi (yerel +x kıbleye; avlu -x yönünde) ----------
function camii(k, o) {
  const q = k.q, S = o.stone || C.stone, L = C.lead;
  const { L: HL, W: HW, wallH } = o;
  // ana gövde (yamaçta kalmasın diye aşağıdan başlar)
  k.box(HL, wallH + 4, HW, 0, -4, 0, S, 1);
  k.box(HL + 0.8, 0.8, HW + 0.8, 0, wallH - 0.8, 0, o.stoneD || C.stoneD, 1);   // saçak silmesi
  if (!q) {
    const P = [[-HL / 2, -HW / 2], [HL / 2, -HW / 2], [HL / 2, HW / 2], [-HL / 2, HW / 2]];
    k.windows(P, 2, wallH - 2, 2, 4.2, 1.5, 2.8, 3);
  }
  const R = o.domeR, dTop = o.domeTop, sy = o.domeSy || 0.92;
  const drumTop = dTop - R * sy, drumH = o.drumH || 4, y0 = drumTop - drumH;
  // kubbe kasnağı altındaki kare kütle ve ağırlık kuleleri
  const sq = 2 * R + 3;
  k.box(sq, y0 - wallH + 0.5, sq, 0, wallH - 0.5, 0, S, 1);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const tx = sx * (sq / 2 - 1), tz = sz * (sq / 2 - 1), th = y0 + drumH * 0.6;
    k.cyl(2.4, 2.2, th - wallH, tx, wallH, tz, S, 1, 8);
    k.dome(2.3, tx, th, tz, L, 0.55, 1.1, q ? 8 : 10);
    if (!q) k.cyl(0.1, 0.1, 1.6, tx, th + 2.2, tz, C.gold, 0.4, 4);
  }
  // kasnak: pencereler ve payandalar
  k.cyl(R + 0.6, R + 0.5, drumH, 0, y0, 0, S, 1, q ? 16 : 32);
  if (!q) {
    const nW = Math.max(12, Math.round(2 * Math.PI * R / 2.6));
    for (let i = 0; i < nW; i++) {
      const a = (i + 0.5) / nW * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      k.box(0.7, drumH + 0.6, 0.9, ca * (R + 0.8), y0, sa * (R + 0.8), S, 1, -a);
      const a2 = i / nW * Math.PI * 2, rr = R + 0.62;
      k.quad([Math.cos(a2 - 0.035) * rr, y0 + 0.8, Math.sin(a2 - 0.035) * rr], [Math.cos(a2 + 0.035) * rr, y0 + 0.8, Math.sin(a2 + 0.035) * rr], [Math.cos(a2 + 0.035) * rr, y0 + drumH - 0.6, Math.sin(a2 + 0.035) * rr], [Math.cos(a2 - 0.035) * rr, y0 + drumH - 0.6, Math.sin(a2 - 0.035) * rr], [Math.cos(a2), 0, Math.sin(a2)], [1, 0.7, 0.4], 0.12, 'lamp');
    }
  }
  k.dome(R + 0.5, 0, drumTop, 0, L, 0.55, sy, q ? 16 : 32);
  if (!q) { k.cyl(0.25, 0.15, 3.2, 0, dTop, 0, C.gold, 0.4, 6); k.dome(0.6, 0, dTop + 2.4, 0, C.gold, 0.4, 1, 8); }
  // yarım kubbeler
  const dirs = o.semi === 4 ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : o.semi === 2 ? [[1, 0], [-1, 0]] : [];
  const sr = o.semiR || R * 0.95, sY = y0 - sr * 0.35;
  for (const [dx, dz] of dirs) {
    const cx = dx * (R + 0.5), cz = dz * (R + 0.5);
    k.half(sr, cx, sY, cz, dx, dz, L, 0.55, 0.85, q ? 10 : 18);
    k.box(dx ? 2 : sr * 2, sY - wallH + 0.3, dx ? sr * 2 : 2, cx, wallH - 0.3, cz, S, 1);
    if (o.exedra && !q) for (const s of [-1, 1]) {
      const ex = cx + (dx ? dx * sr * 0.45 : s * sr * 0.8), ez = cz + (dz ? dz * sr * 0.45 : s * sr * 0.8);
      k.half(sr * 0.42, ex, wallH + 0.5, ez, dx || s * 0.7, dz || s * 0.7, L, 0.55, 0.9, 10);
    }
  }
  // yan cephe kemer timpanları (iki yarım kubbeli camilerde)
  if (o.semi === 2) for (const s of [-1, 1]) {
    k.box(sq - 2, y0 - wallH + drumH * 0.4, 2.5, 0, wallH, s * (sq / 2 - 1.2), S, 1);
    if (!q) k.windows([[-sq / 2 + 3, s * (sq / 2 + 0.1)], [sq / 2 - 3, s * (sq / 2 + 0.1)], [sq / 2 - 3, s * (sq / 2 + 0.11)], [-sq / 2 + 3, s * (sq / 2 + 0.11)]], wallH + 2, y0 - 1, 2, 3.2, 1.4, 2.6, 5);
  }
  // yan galeri kubbecikleri
  if (o.sideDomes && !q) for (const s of [-1, 1]) for (let i = 0; i < o.sideDomes; i++) {
    const x = -HL / 2 + (i + 0.5) * HL / o.sideDomes, z = s * (HW / 2 - 4.5);
    k.cyl(3.6, 3.6, 1.2, x, wallH, z, S, 1, 12); k.dome(3.4, x, wallH + 1.2, z, L, 0.55, 0.85, 12);
  }
  // avlu (son cemaat yeri ve revaklar)
  if (o.court) {
    const { L: CL, W: CW } = o.court, cx = -HL / 2 - CL / 2, wh = o.court.h || 9;
    k.box(CL, wh + 4, 2.4, cx, -4, -CW / 2 + 1.2, S, 1); k.box(CL, wh + 4, 2.4, cx, -4, CW / 2 - 1.2, S, 1);
    k.box(2.4, wh + 4, CW, cx - CL / 2 + 1.2, -4, 0, S, 1);
    k.box(CL - 4, 0.6, CW - 4, cx, 0.2, 0, C.marble, 0.6);   // avlu zemini
    const strip = 7, pr = 3.1;
    const ring = [];
    for (let x = -CL / 2 + strip / 2 + 1; x <= CL / 2 - strip / 2; x += strip) { ring.push([cx + x, -CW / 2 + strip / 2 + 1]); ring.push([cx + x, CW / 2 - strip / 2 - 1]); }
    for (let z = -CW / 2 + strip * 1.5 + 1; z <= CW / 2 - strip * 1.5 - 1; z += strip) { ring.push([cx - CL / 2 + strip / 2 + 1, z]); ring.push([cx + CL / 2 - strip / 2 - 1, z]); }
    for (const [x, z] of ring) {
      if (!q) { k.cyl(pr + 0.2, pr + 0.2, 0.8, x, wh - 0.8, z, S, 1, 10); k.dome(pr, x, wh, z, L, 0.55, 0.8, 10); }
    }
    if (q) { k.box(CL, 1.4, 6, cx, wh - 0.4, -CW / 2 + 4, L, 0.5); k.box(CL, 1.4, 6, cx, wh - 0.4, CW / 2 - 4, L, 0.5); }
    // revak sütunları (iç yüzde)
    if (!q) for (let x = -CL / 2 + strip + 1; x < CL / 2 - 1; x += strip / 2) for (const s of [-1, 1]) k.cyl(0.45, 0.45, wh - 1, cx + x, 0, s * (CW / 2 - strip - 1), C.marble, 1, 6);
    // şadırvan
    k.cyl(4.2, 4.2, 4.5, cx, 0, 0, C.marble, 1, 8); k.dome(4.6, cx, 4.5, 0, L, 0.5, 0.7, q ? 8 : 12);
  }
  for (const [x, z, h, b] of o.minarets) minaret(k, x, z, h, b, o.minCol || C.white);
}

// ---------- Galata Kulesi: 66.9 m (külah ucu), dış çap 16.45 m ----------
function galata(k) {
  const q = k.q, sg = q ? 12 : 28, S = C.galata;
  k.lathe([[0, -3], [8.6, -3], [8.55, 2], [8.25, 4], [8.05, 44], [8.3, 45.5], [8.6, 46.6], [8.6, 47], [8.15, 47.2], [8.15, 51.2], [0, 51.2]], 0, 0, 0, S, 1, sg);
  // şerefe (seyir balkonu) ve korkuluk
  k.cyl(9.9, 9.9, 0.45, 0, 51.0, 0, C.stoneD, 1, sg);
  if (!q) k.cyl(9.8, 9.8, 1.1, 0, 51.45, 0, 0x55514a, 0.4, sg, 'op', true);
  // üst kat (kemerli pencereli) ve korniş
  k.lathe([[0, 51.4], [7.6, 51.4], [7.6, 56.6], [8.4, 57.2], [8.4, 57.8], [0, 57.8]], 0, 0, 0, S, 1, sg);
  // külah (kurşun)
  k.lathe([[8.2, 57.6], [7.6, 59.5], [5.8, 62.3], [3.0, 64.8], [0.6, 66.2], [0, 66.4]], 0, 0, 0, C.lead, 0.6, sg);
  if (!q) {
    k.cyl(0.14, 0.1, 1.6, 0, 66.2, 0, C.gold, 0.4, 4); k.dome(0.3, 0, 67.6, 0, C.gold, 0.4, 1, 6);
    // pencereler: gövdede dar mazgal pencereler, üst katlarda kemerli pencereler (gece yanar)
    const ring = (n, r, y0, y1, w) => { for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), tx = -s * w / 2, tz = c * w / 2;
      k.quad([c * r + tx, y0, s * r + tz], [c * r - tx, y0, s * r - tz], [c * r - tx, y1, s * r - tz], [c * r + tx, y1, s * r + tz], [c, 0, s], [1, 0.68, 0.36], 0.1, 'lamp'); } };
    for (const y of [9, 17, 25, 33, 40]) ring(4, 8.2, y, y + 2.2, 0.9);
    ring(16, 8.22, 47.6, 50.6, 1.6);
    ring(16, 7.66, 52.2, 55.8, 1.5);
  }
}

// ---------- Kız Kulesi: adacık, taş yapılar, kare kule (fener) ----------
function kizKulesi(k) {
  const q = k.q, S = C.white;
  // kayalık ada ve rıhtım
  k.add(new THREE.CylinderGeometry(24, 27, 4, q ? 10 : 18), M4(0, -0.8, 0, 0, 1, 1, 0.62), C.rock, 0.3);
  k.box(44, 1.2, 22, -2, 0.6, 0, C.stoneD, 0.8);
  // iki katlı taş yapılar (kurşun çatılı)
  k.box(26, 7.5, 13, -6, 1.8, 0, S, 1); k.add(new THREE.CylinderGeometry(0.01, 9.6, 3.2, 4), M4(-6, 9.3 + 1.6, 0, Math.PI / 4, 1.4, 1, 0.68), C.lead, 0.5);
  k.box(9, 5.5, 9, 13, 1.8, 0, S, 1); k.add(new THREE.CylinderGeometry(0.01, 6.6, 2.4, 4), M4(13, 7.3 + 1.2, 0, Math.PI / 4), C.lead, 0.5);
  // kule: kare gövde (8 m) 17 m'ye, sekizgen köşk, kubbe, alem: ~ 27 m
  k.box(8.2, 15.5, 8.2, 4, 1.8, 0, S, 1);
  k.box(9.0, 0.5, 9.0, 4, 17.2, 0, C.stoneD, 1);
  k.cyl(3.9, 3.7, 4.6, 4, 17.7, 0, S, 1, 8);
  k.dome(3.9, 4, 22.3, 0, C.lead, 0.5, 0.9, q ? 8 : 12);
  if (!q) {
    k.cyl(0.12, 0.08, 1.8, 4, 25.8, 0, C.gold, 0.4, 4);
    k.windows([[0, -4.1], [8, -4.1], [8, 4.1], [0, 4.1]].map(([x, z]) => [x, z]), 4, 15, 3, 2.7, 0.9, 1.6, 7);
    k.windows([[-19, -6.5], [7, -6.5], [7, 6.5], [-19, 6.5]], 2.5, 8.5, 2, 3.2, 1.2, 1.8, 8);
    // fener ışığı
    k.cyl(3.98, 3.98, 1.6, 4, 19.2, 0, [1, 0.92, 0.7], 0.55, 8, 'lamp', true);
  }
}

// ---------- Ayasofya: 82 x 73 m, kubbe Ø 31.9 m, tepe 55.6 m (yerel +x = apsis, güneydoğu) ----------
function ayasofya(k) {
  const q = k.q, P = C.pink, PD = C.pinkD, L = C.lead;
  k.box(70, 26, 73, 0, -4, 0, P, 1);                 // ana kütle
  k.box(12, 18, 64, -41, -4, 0, P, 1);               // narteksler
  k.box(9, 14, 70, -50.5, -4, 0, PD, 1);
  // kuzey ve güney dev payandalar
  for (const s of [-1, 1]) for (const x of [-18, 18]) k.box(11, 39, 16, x, -4, s * 30, P, 1);
  // kubbe kasnağının altındaki kare ve kuzey/güney timpan duvarları
  k.box(34, 18, 34, 0, 22, 0, P, 1);
  for (const s of [-1, 1]) k.box(26, 16, 3, 0, 22, s * 16.5, PD, 1);
  // kubbe: kasnak 40 pencere + payandalar, eteği ~41 m, tepe 55.6 m
  const R = 16.2, y0 = 40, dt = 55.6, sy = (dt - y0 - 2.2) / R;
  k.cyl(R + 0.3, R + 0.2, 2.4, 0, y0 - 0.2, 0, P, 1, q ? 16 : 40);
  if (!q) for (let i = 0; i < 40; i++) {
    const a = (i + 0.5) / 40 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    k.box(0.9, 4.2, 1.6, c * (R + 0.9), y0 - 1.8, s * (R + 0.9), PD, 1, -a);
    const a2 = i / 40 * Math.PI * 2, rr = R + 0.32;
    k.quad([Math.cos(a2 - 0.04) * rr, y0 + 0.2, Math.sin(a2 - 0.04) * rr], [Math.cos(a2 + 0.04) * rr, y0 + 0.2, Math.sin(a2 + 0.04) * rr], [Math.cos(a2 + 0.04) * rr, y0 + 2.0, Math.sin(a2 + 0.04) * rr], [Math.cos(a2 - 0.04) * rr, y0 + 2.0, Math.sin(a2 - 0.04) * rr], [Math.cos(a2), 0, Math.sin(a2)], [1, 0.72, 0.4], 0.12, 'lamp');
  }
  k.dome(R + 0.2, 0, y0 + 2.2, 0, L, 0.55, sy, q ? 16 : 36);
  if (!q) { k.cyl(0.3, 0.2, 2.6, 0, dt - 0.4, 0, C.gold, 0.4, 6); }
  // doğu ve batı yarım kubbeler + köşe eksedraları + apsis
  for (const s of [-1, 1]) {
    k.half(15.6, s * 16.3, 30.5, 0, s, 0, L, 0.55, 0.78, q ? 10 : 20);
    if (!q) for (const t of [-1, 1]) k.half(7.4, s * 22, 24, t * 9.5, s * 0.6, t * 0.8, L, 0.55, 0.85, 10);
  }
  k.cyl(7.2, 7.2, 22, 37, -4, 0, P, 1, q ? 8 : 14); k.half(7.2, 37, 18, 0, 1, 0, L, 0.55, 0.85, q ? 8 : 12);
  if (!q) {
    k.windows([[-35, -36.6], [35, -36.6], [35, 36.6], [-35, 36.6]], 3, 20, 2, 5, 1.8, 3.2, 11);
    for (const s of [-1, 1]) k.windows([[-13, s * 18.1], [13, s * 18.1], [13, s * 18.12], [-13, s * 18.12]], 26, 36, 2, 3.2, 1.6, 3.2, 12);
  }
  // minareler: güneydoğudaki kırmızı tuğla (kalın), diğerleri beyaz taş, ~60 m
  minaret(k, 30, 40, 57, 1, C.brick);
  minaret(k, 38, -40, 60, 1, C.white);
  minaret(k, -48, 40, 60, 2, C.white);
  minaret(k, -48, -40, 60, 2, C.white);
}

// ---------- Rumeli Hisarı ----------
function rumeli(k, W, at) {
  const q = k.q, S = C.stone, D = C.stoneD;
  // yerel çerçeve: +x kıyı boyunca kuzeye (baş 20°), +z denizden içeri (batıya) değil: dikkat, yerel +z = sağ = doğu tarafı.
  // bu yüzden içerisi -z. Noktalar (x, z) metre.
  const T = [ // [x, z, yarıçap, yükseklik, kenar sayısı, külah]
    [100, -18, 12.5, 28, 24, 1],     // Saruca Paşa Kulesi (kuzey, kıyı)
    [-62, -16, 11.7, 33, 12, 1],     // Halil Paşa Kulesi (güney, kıyı)
    [-104, -112, 13, 21, 12, 0],     // Zağanos Paşa Kulesi (güney, tepe)
    [98, -82, 5, 14, 12, 1], [40, -122, 5.5, 15, 12, 1], [-22, -134, 5, 14, 12, 0], [-92, -52, 4.5, 12, 12, 1], [20, -6, 4.5, 11, 12, 0],
  ];
  // kıyı: çapadan doğuya (+z) suya kadar olan uzaklık; kıyı kuleleri kıyının ~10 m içinde kalsın
  let sh = 0; while (sh < 220) { const p = k.mapAt(0, sh); if (!W.isLand(p.x, p.y)) break; sh += 4; }
  const zs = sh - 10;
  for (const t of T) t[1] += zs;
  const g = (x, z) => { const p = k.mapAt(x, z); return W.terrainH(p.x, p.y) - k.fh; };
  for (const [x, z, r, h, n, cap] of T) {
    const b = Math.min(g(x, z), g(x + r, z), g(x - r, z), g(x, z + r), g(x, z - r));
    const top = g(x, z) + h;
    k.cyl(r, r * 0.96, top - b + 3, x, b - 3, z, S, 1, q ? Math.min(n, 12) : n);
    if (cap) k.cone(r * 1.08, r * 1.05, x, top, z, C.lead, 0.5, q ? 10 : 18);
    else if (!q) for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.box(2.2, 1.6, 1.3, x + Math.cos(a) * (r - 0.6), top, z + Math.sin(a) * (r - 0.6), D, 1, -a); }
    if (!q) k.windows(Array.from({ length: 8 }, (_, i) => [x + Math.cos(i / 8 * 6.283) * (r + 0.05), z + Math.sin(i / 8 * 6.283) * (r + 0.05)]), b + 6, top - 3, 2, 9, 0.7, 1.4, x);
  }
  // surlar: araziye oturan parçalar, mazgallı
  const ring = [[100, -18], [98, -82], [40, -122], [-22, -134], [-104, -112], [-92, -52], [-62, -16], [20, -6], [100, -18]].map(([x, z]) => [x, z + zs]);
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, z0] = ring[i], [x1, z1] = ring[i + 1], L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / (q ? 24 : 8)));
    for (let j = 0; j < n; j++) {
      const t0 = j / n, t1 = (j + 1) / n, ax = x0 + (x1 - x0) * t0, az = z0 + (z1 - z0) * t0, bx = x0 + (x1 - x0) * t1, bz = z0 + (z1 - z0) * t1;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, gh = g(mx, mz);
      const ry = -Math.atan2(bz - az, bx - ax);
      k.add(new THREE.BoxGeometry(L / n + 0.6, 17, 4.5), M4(mx, gh - 5 + 8.5, mz, ry), S, 1);
      if (!q) for (let m = 0; m < 3; m++) { const t = (m + 0.5) / 3; k.add(new THREE.BoxGeometry(1.2, 1.4, 4.6), M4(ax + (bx - ax) * t, gh + 12 + 0.7, az + (bz - az) * t, ry), D, 1); }
    }
  }
}

// ---------- OSM tabanından tarihi yapı (Topkapı, Dolmabahçe): duvar, silme, pencere, kurşun çatı ----------
function osmPoly(flat) { const P = []; for (let i = 0; i < flat.length; i += 2) P.push([flat[i], -flat[i + 1]]); return P; }
function polyArea(P) { let a = 0; for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length; a += P[i][0] * P[j][1] - P[j][0] * P[i][1]; } return a / 2; }
function inflateP(P, d) {
  const n = P.length, s = polyArea(P) > 0 ? 1 : -1, out = [];
  for (let i = 0; i < n; i++) {
    const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, l2 = Math.hypot(c[0] - b[0], c[1] - b[1]) || 1;
    const n1 = [(b[1] - a[1]) / l1 * s, -(b[0] - a[0]) / l1 * s], n2 = [(c[1] - b[1]) / l2 * s, -(c[0] - b[0]) / l2 * s];
    let mx = n1[0] + n2[0], mz = n1[1] + n2[1]; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    const cs = Math.max(0.35, mx * n1[0] + mz * n1[1]);
    out.push([b[0] + mx * d / cs, b[1] + mz * d / cs]);
  }
  return out;
}
function hipRect(k, P, y, rise, c) {
  // 4 köşeli tabana kırma çatı (OBB'ye göre), diğerlerine alçak basık çatı
  if (P.length === 4) {
    const e = [0, 1, 2, 3].map((i) => Math.hypot(P[(i + 1) % 4][0] - P[i][0], P[(i + 1) % 4][1] - P[i][1]));
    const long = e[0] >= e[1] ? 0 : 1, a = P[long], b = P[long + 1], cc = P[long + 2], d = P[(long + 3) % 4];
    const w = Math.min(e[long], e[long + 1]) / 2;
    const mid1 = [(a[0] + d[0]) / 2, (a[1] + d[1]) / 2], mid2 = [(b[0] + cc[0]) / 2, (b[1] + cc[1]) / 2];
    const L = Math.hypot(mid2[0] - mid1[0], mid2[1] - mid1[1]) || 1, ux = (mid2[0] - mid1[0]) / L, uz = (mid2[1] - mid1[1]) / L;
    const r1 = [mid1[0] + ux * Math.min(w, L / 2), mid1[1] + uz * Math.min(w, L / 2)], r2 = [mid2[0] - ux * Math.min(w, L / 2), mid2[1] - uz * Math.min(w, L / 2)];
    const tri = (p0, p1, p2) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...p0, ...p1, ...p2], 3)); g.computeVertexNormals(); if (g.attributes.normal.getY(0) < 0) { g.setAttribute('position', new THREE.Float32BufferAttribute([...p0, ...p2, ...p1], 3)); g.computeVertexNormals(); } k.add(g, null, c, 0.45); };
    const A = [a[0], y, a[1]], B = [b[0], y, b[1]], Cc = [cc[0], y, cc[1]], Dd = [d[0], y, d[1]], R1 = [r1[0], y + rise, r1[1]], R2 = [r2[0], y + rise, r2[1]];
    tri(A, B, R2); tri(A, R2, R1); tri(Cc, Dd, R1); tri(Cc, R1, R2); tri(B, Cc, R2); tri(Dd, A, R1);
  } else {
    k.prism(inflateP(P, -1.2), y, y + rise * 0.35, c, 0.45);
  }
}
function palaceBlock(k, P, base, H, o = {}) {
  const q = k.q, wc = o.wall || C.marble;
  k.prism(P, base - 3, base + H, wc, 1, null);
  if (!q) {
    if (o.windows !== false) k.windows(P, base + 1.5, base + H - 1.5, Math.max(1, Math.round(H / (o.floorH || 6))), o.winSp || 4.2, 1.5, Math.min(3.4, (o.floorH || 6) * 0.5), o.seed || 1);
    // silme (korniş) ve korkuluk
    k.prism(inflateP(P, 0.6), base + H - 0.8, base + H, o.trim || C.stoneD, 1);
    if (o.balustrade) k.prism(inflateP(P, 0.1), base + H, base + H + 1.1, wc, 1, null);
    // plastırlar (Dolmabahçe cephesi)
    if (o.pilaster) {
      const s = polyArea(P) > 0 ? 1 : -1;
      for (let i = 0; i < P.length; i++) {
        const [x0, z0] = P[i], [x1, z1] = P[(i + 1) % P.length], L = Math.hypot(x1 - x0, z1 - z0); if (L < 12) continue;
        const ux = (x1 - x0) / L, uz = (z1 - z0) / L, nx = uz * s, nz = -ux * s, n = Math.floor(L / 4.2);
        for (let j = 0; j <= n; j++) { const t = j * L / n; k.add(new THREE.BoxGeometry(0.9, H - 1, 0.5), M4(x0 + ux * t + nx * 0.25, base + (H - 1) / 2, z0 + uz * t + nz * 0.25, -Math.atan2(uz, ux)), o.trim || C.stoneD, 1); }
      }
    }
  }
  if (o.roof !== false) hipRect(k, P, base + H, o.rise || Math.min(5, Math.sqrt(Math.abs(polyArea(P))) * 0.18), o.roofCol || C.lead);
  else k.prism(inflateP(P, -0.4), base + H - 0.2, base + H + 0.3, o.roofCol || C.roofZ, 0.3);
}
function pip(P, x, z) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { if ((P[i][1] > z) !== (P[j][1] > z) && x < (P[j][0] - P[i][0]) * (z - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; } return c; }
function centroidP(P) { let x = 0, z = 0; for (const p of P) { x += p[0]; z += p[1]; } return [x / P.length, z / P.length]; }

// ---------- Topkapı Sarayı (ana hatlar): OSM tabanları alçak, kurşun çatılı; Adalet Kulesi, mutfak bacaları, Bâbüsselâm ----------
function topkapi(k, W, D) {
  const q = k.q, seen = new Set();
  const gh = (P) => { let m = 1e9; for (const [x, z] of P) { const p = k.mapAt(x, z); m = Math.min(m, W.terrainH(p.x, p.y)); } return m - k.fh; };
  for (const [id, typ, h, flat] of D.P) {
    const P = osmPoly(flat), cc = centroidP(P), key = Math.round(cc[0]) + ':' + Math.round(cc[1]);
    if (seen.has(key)) continue; seen.add(key);
    const A = Math.abs(polyArea(P)), b = gh(P);
    const H = id === 298 ? 11 : h > 0 && h < 12 ? h : A > 3000 ? 10 : 8;
    palaceBlock(k, P, b, H, { wall: C.cream, trim: C.stoneD, winSp: 5, floorH: 5, seed: id, rise: Math.min(4, Math.sqrt(A) * 0.12) });
    // harem: kubbecikler
    if (id === 298 && !q) {
      let n = 0;
      for (let x = -60; x <= 60; x += 13) for (let z = -100; z <= 100; z += 13) {
        const px = cc[0] + x, pz = cc[1] + z;
        if (!pip(P, px, pz) || ((x * 7 + z * 3) & 7) > 3) continue;
        k.cyl(3.2, 3.2, 1.6, px, b + H, pz, C.cream, 1, 10); k.dome(3.0, px, b + H + 1.6, pz, C.lead, 0.5, 0.9, 10); n++;
      }
    }
    // mutfaklar: çift sıra kubbe ve bacalar
    if (id === 230) {
      const L0 = P.reduce((a, p) => a, 0);
      const o = longAxis(P);
      for (let i = 0; i < 10; i++) { const t = -0.42 + i * 0.093; const px = cc[0] + o.ux * o.L * t, pz = cc[1] + o.uz * o.L * t;
        k.dome(4.2, px, b + H, pz, C.lead, 0.5, 0.9, q ? 8 : 12); k.cyl(1.4, 1.2, 6, px, b + H + 3, pz, C.cream, 1, q ? 6 : 8); if (!q) k.dome(1.3, px, b + H + 9, pz, C.lead, 0.5, 1, 8); }
    }
    // Bâbüsselâm (Orta Kapı): iki sekizgen kule, sivri külah
    if (id === 257) {
      const o = longAxis(P);
      for (const s of [-1, 1]) { const px = cc[0] + o.ux * s * 9, pz = cc[1] + o.uz * s * 9;
        k.cyl(3.8, 3.6, 16, px, b, pz, C.cream, 1, 8); k.cone(4.3, 8.5, px, b + 16, pz, C.lead, 0.5, 8); if (!q) k.cyl(0.1, 0.1, 1.5, px, b + 24.5, pz, C.gold, 0.4, 4); }
    }
    // Adalet Kulesi (Kubbealtı'nın arkası): kare gövde, kemerli pencereli üst kat, sivri külah ~41 m
    if (id === 234) {
      const [px, pz] = cc;
      k.box(9.5, 26, 9.5, px, b - 2, pz, C.cream, 1);
      k.box(10.4, 0.7, 10.4, px, b + 24, pz, C.stoneD, 1);
      k.cyl(5.3, 5.0, 8.5, px, b + 24.7, pz, C.cream, 1, 8, 'op', false, Math.PI / 8);
      if (!q) k.windows(Array.from({ length: 8 }, (_, i) => [px + Math.cos((i + 0.5) / 8 * 6.283) * 5.0, pz + Math.sin((i + 0.5) / 8 * 6.283) * 5.0]), b + 26, b + 32.5, 1, 3.0, 1.2, 4.0, 17);
      k.cone(5.8, 8.5, px, b + 33.2, pz, C.lead, 0.5, 8, Math.PI / 8);
      if (!q) { k.cyl(0.12, 0.1, 2.4, px, b + 41.5, pz, C.gold, 0.4, 4); k.dome(0.4, px, b + 43.7, pz, C.gold, 0.4, 1, 6); }
      // Kubbealtı (Divan): üç kubbe
      const o = longAxis(D.P.find((p) => p[0] === 232) ? osmPoly(D.P.find((p) => p[0] === 232)[3]) : P);
      for (let i = 0; i < 3; i++) { const qx = px - o.ux * (10 + i * 8.5) + o.uz * 6, qz = pz - o.uz * (10 + i * 8.5) - o.ux * 6;
        k.cyl(4, 4, 2, qx, b + 9, qz, C.cream, 1, 10); k.dome(3.9, qx, b + 11, qz, C.lead, 0.5, 0.9, q ? 8 : 12); }
    }
  }
}
function longAxis(P) {
  let best = 0, ux = 1, uz = 0;
  for (let i = 0; i < P.length; i++) { const [x0, z0] = P[i], [x1, z1] = P[(i + 1) % P.length], L = Math.hypot(x1 - x0, z1 - z0); if (L > best) { best = L; ux = (x1 - x0) / L; uz = (z1 - z0) / L; } }
  let a0 = 1e9, a1 = -1e9; for (const [x, z] of P) { const t = x * ux + z * uz; a0 = Math.min(a0, t); a1 = Math.max(a1, t); }
  return { ux, uz, L: a1 - a0 };
}

// ---------- Dolmabahçe Sarayı: Mabeyn, Muayede Salonu (kubbe 36 m), Harem; beyaz mermer cephe, plastırlar ----------
function dolmabahce(k, W, D) {
  const q = k.q;
  const gh = (P) => { let m = 1e9; for (const [x, z] of P) { const p = k.mapAt(x, z); m = Math.min(m, W.terrainH(p.x, p.y)); } return Math.max(0.5, m) - k.fh; };
  const HH = { 0: 19, 3: 22, 2: 17, 1: 16, 4: 11, 5: 11 };
  for (const [id, typ, h, flat] of D.P) {
    const P = osmPoly(flat), b = gh(P), palace = id in HH;
    const H = HH[id] || (h > 0 ? h : 8);
    palaceBlock(k, P, b, H, palace ? { wall: C.marble, trim: 0xd6cdb8, pilaster: true, balustrade: true, roof: false, roofCol: C.roofZ, floorH: 6.3, winSp: 4.2, seed: id + 40 } : { wall: C.cream, seed: id + 60, floorH: 4 });
    if (id === 3) {
      // Muayede Salonu: yükseltilmiş orta salon ve kubbe (36 m)
      const [cx, cz] = centroidP(P), o = longAxis(P);
      const ry = -Math.atan2(o.uz, o.ux);
      k.add(new THREE.BoxGeometry(44, 8, 40), M4(cx, b + H + 4, cz, ry), C.marble, 1);
      k.add(new THREE.BoxGeometry(45, 0.8, 41), M4(cx, b + H + 8.2, cz, ry), 0xd6cdb8, 1);
      k.add(new THREE.SphereGeometry(19, q ? 14 : 28, q ? 5 : 10, 0, Math.PI * 2, 0, Math.PI / 2), M4(cx, b + H + 8.6, cz, ry, 1.1, 0.29, 1.0), C.roofZ, 0.4);
      if (!q) k.windows([[cx - 21, cz - 19.6], [cx + 21, cz - 19.6], [cx + 21, cz + 19.6], [cx - 21, cz + 19.6]].map(([x, z]) => { const dx = x - cx, dz = z - cz; const c = Math.cos(-ry), s = Math.sin(-ry); return [cx + dx * c + dz * s, cz - dx * s + dz * c]; }), b + H + 1, b + H + 7, 1, 3.2, 1.4, 4, 33);
    }
    if (id === 0 || id === 2) {
      // çatı ışıklıkları
      const [cx, cz] = centroidP(P);
      k.box(14, 3, 14, cx, b + H, cz, C.roofZ, 0.3);
    }
  }
}

// ---------- gökdelenler ----------
function glassTower(k, P, y0, H, o = {}) {
  const q = k.q;
  k.prism(P, y0 - 3, y0 + H, o.glass || C.glass, 1, o.roof || 0x6e757c, 'gl', 'op');
  if (!q && o.bands) for (let y = y0 + o.bands; y < y0 + H - 2; y += o.bands) k.prism(inflateP(P, 0.35), y, y + 0.9, o.band || 0xc9ced2, 0, null);
  if (!q) k.prism(inflateP(P, 0.25), y0 + H - 1.2, y0 + H + 0.6, o.band || 0xc9ced2, 0, null);
}
function stadium(L, W, n = 10) {
  const r = W / 2, a = L / 2 - r, P = [];
  for (let i = 0; i <= n; i++) { const t = -Math.PI / 2 + i / n * Math.PI; P.push([a + Math.cos(t) * r, Math.sin(t) * r]); }
  for (let i = 0; i <= n; i++) { const t = Math.PI / 2 + i / n * Math.PI; P.push([-a + Math.cos(t) * r, Math.sin(t) * r]); }
  return P;
}
function avLight(k, x, y, z) { k.cyl(0.6, 0.6, 0.8, x, y, z, [1, 0.12, 0.08], 0.35, 6, 'lamp'); }

// İstanbul Sapphire: 238 m çatı, 261 m tepe (çift cidarlı cam, her üç katta bir bahçe bandı)
function sapphire(k, W, D) {
  const q = k.q;
  const t = D.P.find((p) => p[0] === 30), P0 = osmPoly(t[3]), o = longAxis(P0), [cx, cz] = centroidP(P0);
  const ry = Math.atan2(-o.uz, o.ux);
  const g = (x, z) => { const p = k.mapAt(x, z); return W.terrainH(p.x, p.y) - k.fh; };
  const b = g(cx, cz);
  const rot = (P) => P.map(([x, z]) => [cx + x * Math.cos(ry) + z * Math.sin(ry), cz - x * Math.sin(ry) + z * Math.cos(ry)]);
  const Pl = rot(stadium(46, 27, q ? 5 : 10));
  glassTower(k, Pl, b, 230, { bands: 10.8, glass: 0x5d7890, band: 0xd4d9dc });
  // tepe: daralan taç ve sivri uç
  k.prism(rot(stadium(40, 21, q ? 4 : 8)), b + 230, b + 238, 0x6a8296, 1, 0xc9ced2, 'gl', 'op');
  k.cyl(1.6, 0.25, 23, cx, b + 238, cz, 0xd8dcdf, 0.3, 6);
  avLight(k, cx, b + 260.5, cz);
  // alçak kaide ve yan bloklar (OSM tabanları)
  for (const id of [31, 28, 32]) { const p = D.P.find((v) => v[0] === id); if (!p) continue; const P = osmPoly(p[3]); palaceBlock(k, P, g(...centroidP(P)), id === 32 ? 9 : p[2] || 10, { wall: 0xc8c4bc, roof: false, floorH: 4, winSp: 3.5, seed: id }); }
}
// Kanyon: kanyon biçimli alışveriş merkezi (4 kat), 26 katlı ofis kulesi, 22 katlı konut bloğu
function kanyon(k, W, D) {
  const q = k.q;
  const P = osmPoly(D.P[0][3]), o = longAxis(P), [cx, cz] = centroidP(P);
  const g = (x, z) => { const p = k.mapAt(x, z); return W.terrainH(p.x, p.y) - k.fh; };
  const b = g(cx, cz);
  palaceBlock(k, P, b, 22, { wall: 0xb98a5e, trim: 0x8b6a4a, roof: false, roofCol: 0x8a8580, floorH: 5.5, winSp: 3.4, seed: 77 });
  const sg = o.ux > 0 ? 1 : -1, nx = -o.uz, nz = o.ux;
  const rect = (u, v, L, Wd) => { const c = [[-L / 2, -Wd / 2], [L / 2, -Wd / 2], [L / 2, Wd / 2], [-L / 2, Wd / 2]]; return c.map(([a, d]) => [cx + o.ux * (u + a) + nx * (v + d), cz + o.uz * (u + a) + nz * (v + d)]); };
  glassTower(k, rect(-128 * sg, 4, 42, 27), b, 118, { bands: 3.8, glass: 0x627a8a, band: 0xb9b3a8 });
  avLight(k, cx + o.ux * -128 * sg + nx * 4, b + 118.8, cz + o.uz * -128 * sg + nz * 4);
  glassTower(k, rect(118 * sg, -6, 64, 17), b, 76, { bands: 3.4, glass: 0x7f8f96, band: 0xb98a5e });
}
// İş Kulesi 1: OSM gövdesine (170 m) basamaklı piramit taç ve sivri uç (181 m çatı, 195 m tepe)
function isKulesi(k, W) {
  const q = k.q, top = 170 - 0.5;
  for (let i = 0; i < 4; i++) { const s = 1 - i * 0.2; k.box(38 * s, 3.2, 29 * s, 0, top + i * 3, 0, i % 2 ? 0x8ea3b4 : 0xd0d4d6, 0.6); }
  k.cone(10, 9, 0, top + 12, 0, 0xd0d4d6, 0.6, 4, Math.PI / 4);
  k.cyl(0.9, 0.2, 12, 0, top + 20.5, 0, 0xdadfe2, 0.3, 6);
  avLight(k, 0, top + 32.5, 0);
}

// ---------- Ortaköy Camii (Büyük Mecidiye): neobarok, tek kubbe, iki ince minare ----------
function ortakoy(k, W, D) {
  const q = k.q, S = 0xeee8dc;
  const P = osmPoly(D.P[0][3]), o = longAxis(P), [cx, cz] = centroidP(P);
  // OSM tabanının uzun ekseni; +x kıbleye (güneydoğu) bakacak yönde
  let ux = o.ux, uy = -o.uz; const qb = bearing(QIBLA); if (ux * Math.cos(qb) + uy * Math.sin(qb) < 0) { ux = -ux; uy = -uy; }
  const ax = k.fx + cx, ay = k.fy - cz;
  const b = Math.max(1, W.terrainH(ax, ay));
  k.frame(ax, ay, b, Math.atan2(uy, ux));
  const X = 0, Z = 0;
  const b0 = b; { const b = 0;
  k.box(21, 18 + 3, 21, X + 2, b - 3, Z, S, 1);
  k.box(22, 1, 22, X + 2, b + 17.4, Z, 0xd8cfbd, 1);
  if (!q) {
    k.windows([[X - 8.5, Z - 10.55], [X + 12.5, Z - 10.55], [X + 12.5, Z + 10.55], [X - 8.5, Z + 10.55]], b + 2, b + 16.5, 2, 3.4, 2.2, 5.2, 21);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { k.cyl(1.4, 1.2, 4, X + 2 + sx * 10, b + 17.8, Z + sz * 10, S, 1, 8); k.dome(1.3, X + 2 + sx * 10, b + 21.8, Z + sz * 10, C.lead, 0.5, 1.2, 8); }
  }
  k.cyl(7.6, 7.4, 4.5, X + 2, b + 17.8, Z, S, 1, q ? 12 : 24);
  if (!q) k.windows(Array.from({ length: 16 }, (_, i) => [X + 2 + Math.cos((i + 0.5) / 16 * 6.283) * 7.45, Z + Math.sin((i + 0.5) / 16 * 6.283) * 7.45]), b + 18.6, b + 21.8, 1, 2.2, 0.9, 2.4, 22);
  k.dome(7.5, X + 2, b + 22.3, Z, C.lead, 0.5, 0.82, q ? 14 : 24);
  if (!q) { k.cyl(0.12, 0.1, 1.8, X + 2, b + 28.4, Z, C.gold, 0.4, 4); }
  // hünkâr kasrı (giriş bölümü, iki katlı)
  k.box(10, 14 + 3, 24, X - 13.5, b - 3, Z, S, 1);
  if (!q) k.windows([[X - 18.5, Z - 12.05], [X - 8.5, Z - 12.05], [X - 8.5, Z + 12.05], [X - 18.5, Z + 12.05]], b + 2, b + 12, 2, 3.2, 1.6, 3, 23);
  k.box(10.4, 1.2, 24.4, X - 13.5, b + 14, Z, C.roofZ, 0.3);
  for (const s of [-1, 1]) minaret(k, X - 9, Z + s * 13.5, 40, 1, S, b);
  }
}

// ---------- köprüler ----------
function sweepDeck(k, path, sec, cols, lits) {
  // path: [[x, y, z, nx, nz]] yerel; sec: [[c (yana), dy]] kapalı; her kenar kendi rengiyle
  const n = sec.length;
  for (let e = 0; e < n; e++) {
    const a = sec[e], b2 = sec[(e + 1) % n];
    const pos = [], nor = [], idx = [];
    for (let i = 0; i < path.length; i++) {
      const [x, y, z, nx, nz] = path[i];
      pos.push(x + nx * a[0], y + a[1], z + nz * a[0], x + nx * b2[0], y + b2[1], z + nz * b2[0]);
      // kenar normali (kesit düzleminde)
      const dc = b2[0] - a[0], dy = b2[1] - a[1], L = Math.hypot(dc, dy) || 1, ec = -dy / L, ey = dc / L;
      nor.push(nx * ec, ey, nz * ec, nx * ec, ey, nz * ec);
      if (i) { const s = (i - 1) * 2; idx.push(s, s + 2, s + 1, s + 1, s + 2, s + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
    // sarma yönü: ilk üçgenin normali kenar normaliyle aynı yönde olsun
    const p = pos, va = new THREE.Vector3(p[0], p[1], p[2]), vb = new THREE.Vector3(p[6], p[7], p[8]), vc = new THREE.Vector3(p[3], p[4], p[5]);
    const cr = new THREE.Vector3().subVectors(vb, va).cross(new THREE.Vector3().subVectors(vc, va));
    if (cr.x * nor[0] + cr.y * nor[1] + cr.z * nor[2] < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); }
    k.add(g, null, cols[e % cols.length], lits ? lits[e % lits.length] : 0);
  }
}
function bridge(k, W, b, dk) {
  const q = k.q;
  const ax = b.a[0], ay = b.a[1], bx = b.b[0], by = b.b[1];
  const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L, nx = -uy, ny = ux;
  const deckAt = dk ? dk.deckAt : () => b.deck;
  const Wd = b.width, susp = b.kind !== 'kiriş';
  const midAl = (b.mid[0] - ax) * ux + (b.mid[1] - ay) * uy;
  // yerel dönüşüm: harita -> örgü
  const P = (al, c, h) => [ax + ux * al + nx * c - k.ox, h, -(ay + uy * al + ny * c - k.oy)];
  const lnx = nx, lnz = -ny;
  const step = q ? 60 : 16, path = [];
  for (let al = 0; al <= L + 0.01; al += Math.min(step, L / 4)) { const p = P(al, 0, deckAt(al)); path.push([p[0], p[1], p[2], lnx, lnz]); }
  if (path.length && Math.abs(path[path.length - 1][1] - deckAt(L)) > 0.01 || true) { const p = P(L, 0, deckAt(L)); path.push([p[0], p[1], p[2], lnx, lnz]); }
  const h2 = Wd / 2;
  if (susp) {
    // aerodinamik kutu kiriş
    sweepDeck(k, path, [[-h2, 0], [h2, 0], [h2 + 1.2, -1.1], [h2 - 6, -3.4], [-h2 + 6, -3.4], [-h2 - 1.2, -1.1]], [C.asph, C.steel, C.steelD, 0x8f969c, C.steelD, C.steel]);
  } else {
    sweepDeck(k, path, [[-h2, 0], [h2, 0], [h2, -1.8], [-h2, -1.8]], [C.asph, C.conc, 0x8c8a86, C.conc]);
  }
  if (!q) {
    // bariyerler ve aydınlatma direkleri
    for (const s of [-1, 1]) sweepDeck(k, path.map(([x, y, z, a, c2]) => [x + a * s * (h2 - 0.4), y, z + c2 * s * (h2 - 0.4), a, c2]), [[-0.3, 1.1], [0.3, 1.1], [0.3, 0], [-0.3, 0]], [0xb8bcc0]);
    for (let al = 25; al < L - 10; al += 50) for (const s of [-1, 1]) {
      const p = P(al, s * (h2 - 1), deckAt(al));
      k.cyl(0.15, 0.12, 9, p[0], p[1], p[2], 0x9aa0a6, 0, 4);
      k.box(1.8, 0.3, 0.6, p[0], p[1] + 9, p[2], [1, 0.8, 0.5], 0.5, -Math.atan2(lnz, lnx), 'lamp');
    }
  }
  const out = { towers: [] };
  if (!susp) {
    // kiriş köprü: ayaklar; Galata Köprüsü'nde alt kat (lokantalar) ve açılır bölümdeki dört köşk
    const piers = Math.max(4, Math.round(L / 40));
    for (let i = 1; i < piers; i++) { const al = L * i / piers, h = deckAt(al); if (W.isLand(...mapXY(ax, ay, ux, uy, al))) continue;
      const p = P(al, 0, 0); k.add(new THREE.BoxGeometry(4, h + 3, Wd * 0.85), M4(p[0], (h - 3) / 2 - 1.8, p[2], Math.atan2(lnx, lnz)), C.conc, 0.3); }
    if (b.name === 'Galata Köprüsü') {
      const open = [midAl - 40, midAl + 40];
      for (const s of [-1, 1]) {
        const seg = (a0, a1) => { const pp = []; for (let al = a0; al <= a1 + 0.1; al += q ? 50 : 20) { const p = P(Math.min(al, a1), s * (h2 - 5.5), 1.2); pp.push([p[0], p[1], p[2], lnx, lnz]); } return pp; };
        for (const [a0, a1] of [[30, open[0] - 4], [open[1] + 4, L - 30]]) {
          if (a1 - a0 < 10) continue;
          const pp = seg(a0, a1);
          sweepDeck(k, pp, [[-4.5, deckAt(midAl) - 3.2], [4.5, deckAt(midAl) - 3.2], [4.5, 0], [-4.5, 0]], [0x9b9389, 0xc9c1b4, 0x6b6660, 0xc9c1b4]);
          if (!q) for (let al = a0 + 4; al < a1 - 2; al += 4.5) { const p = P(al, s * (h2 - 0.95), 2.8); k.box(3.2, 1.8, 0.1, p[0], p[1], p[2], [1, 0.7, 0.4], 0.12, -Math.atan2(lnz, lnx) + Math.PI / 2, 'lamp'); }
        }
        for (const al of open) { const p = P(al, s * (h2 - 6), deckAt(al));
          k.add(new THREE.BoxGeometry(9, 9, 9), M4(p[0], p[1] + 4.5, p[2], Math.atan2(lnx, lnz)), 0xd8d2c6, 1);
          k.add(new THREE.ConeGeometry(7, 4.5, 4), M4(p[0], p[1] + 9 + 2.25, p[2], Math.atan2(lnx, lnz) + Math.PI / 4), C.lead, 0.5);
          if (!q) { const pw = P(al, s * (h2 - 1.4), deckAt(al)); k.box(4, 2.5, 0.2, pw[0], pw[1] + 4, pw[2], [1, 0.8, 0.5], 0.12, -Math.atan2(lnz, lnx) + Math.PI / 2, 'lamp'); } }
      }
    }
    return out;
  }
  // asma / karma köprü kuleleri
  const tH = b.tower, tAl = [midAl - b.span / 2, midAl + b.span / 2], yss = b.kind === 'karma';
  const legOff = (h) => yss ? (h2 + 6) + ((h2 - 3) - (h2 + 6)) * Math.min(1, h / tH) : h2 + 2.5 - 1.0 * h / tH;
  const T = [];
  for (const al of tAl) {
    const [mx, my] = mapXY(ax, ay, ux, uy, al);
    const gh = W.isLand(mx, my) ? W.terrainH(mx, my) : 0;
    T.push({ al, gh });
    out.towers.push({ x: mx, y: my });
    // temel (keson)
    { const p = P(al, 0, gh - 4); k.add(new THREE.BoxGeometry(14, 10, Wd + 22), M4(p[0], gh + 1, p[2], Math.atan2(lnx, lnz)), C.conc, 0.3); }
    for (const s of [-1, 1]) {
      // ayak: parçalı (konik yaklaşık), yukarı doğru incelir; YSS'de içe eğik (A biçimi)
      const nS = q ? 2 : 6;
      for (let i = 0; i < nS; i++) {
        const h0 = gh + 6 + (tH - gh - 6) * i / nS, h1 = gh + 6 + (tH - gh - 6) * (i + 1) / nS;
        const w0 = (yss ? 9 : 7) - 2.5 * i / nS;
        k.beam(P(al, s * legOff(h0), h0), P(al, s * legOff(h1), h1 + 0.5), w0 * 0.85, C.white, 0.9, 'op', w0);
      }
      // gece led şeritleri (kule kenarları)
      if (!q) k.beam(P(al + 3.8, s * legOff(gh + 20), gh + 20), P(al + 3.8, s * legOff(tH), tH), 0.35, [0.55, 0.35, 1.0], 0.85, 'lamp');
    }
    for (const hh of [deckAt(al) - 6, gh + 6 + (tH - gh) * 0.55, tH - 5]) {
      if (hh < gh + 6 || hh > tH) continue;
      const off = legOff(hh) + 1;
      k.beam(P(al, -off, hh), P(al, off, hh), 5, C.white, 0.9, 'op', 6);
    }
    avLight(k, ...P(al, legOff(tH), tH + 0.6)); avLight(k, ...P(al, -legOff(tH), tH + 0.6));
  }
  // ana kablolar (lamba kovası: gündüz açık gri, gece mor-mavi led) ve askılar
  const sagLow = b.deck + 3;
  const midC = (al) => { const t = (al - tAl[0]) / (tAl[1] - tAl[0]); return tH - 4 * t * (1 - t) * (tH - sagLow); };
  for (const s of [-1, 1]) {
    const off = s * legOff(tH);
    const pts = [];
    const A0 = 0, A1 = L;
    pts.push([A0, deckAt(A0) + 1]);
    const steps = q ? 16 : 48;
    for (let i = 0; i <= steps; i++) { const al = tAl[0] + (tAl[1] - tAl[0]) * i / steps; pts.push([al, midC(al)]); }
    pts.push([A1, deckAt(A1) + 1]);
    if (!yss || true) for (let i = 0; i < pts.length - 1; i++) k.beam(P(pts[i][0], off, pts[i][1]), P(pts[i + 1][0], off, pts[i + 1][1]), 0.9, [0.6, 0.42, 1.0], 0.8, 'lamp');
    if (!q) {
      const ho = s * (h2 + 0.6);
      if (yss) {
        // eğik askı halatları (yelpaze) ve ortada düşey askılar
        for (const t of T) for (const dir of [-1, 1]) for (let i = 0; i < 18; i++) {
          const al = t.al + dir * (34 + i * 21); if (al < 0 || al > L) continue;
          const hh = tH - 26 - i * 5.5; k.line(P(t.al, s * legOff(hh), hh), P(al, ho, deckAt(al)));
        }
        for (let al = tAl[0] + 420; al < tAl[1] - 420; al += 21) k.line(P(al, off, midC(al)), P(al, ho, deckAt(al)));
      } else {
        const zig = b.name.startsWith('15 Temmuz');
        let z = 0;
        for (let al = tAl[0] + 18; al < tAl[1] - 10; al += 18, z++) {
          const da = zig ? (z % 2 ? 9 : -9) : 0;
          k.line(P(al, off, midC(al)), P(al + da, ho, deckAt(al + da)));
        }
      }
    }
  }
  return out;
}
function mapXY(ax, ay, ux, uy, al) { return [ax + ux * al, ay + uy * al]; }

// Haliç Metro Köprüsü: eğik askılı, iki pilon (65 m), ana açıklık 180 m, tabliye 13 m, 12.6 m genişlik
function metroBridge(W) {
  const c = geo(41.0227, 28.9662), br = 38 * D2R, ux = Math.sin(br), uy = Math.cos(br);
  // su geçişinin uçları
  const run = (s) => { let d = 0; while (d < 1500 && !W.isLand(c.x + s * ux * d, c.y + s * uy * d)) d += 2; return d; };
  const e1 = run(1), e0 = run(-1);
  const land = (s, e) => { let d = e; while (d < e + 220) { const x = c.x + s * ux * d, y = c.y + s * uy * d; if (W.terrainH(x, y) > 12.5) break; d += 4; } return d; };
  const a1 = land(1, e1), a0 = land(-1, e0);
  const ax = c.x - ux * a0, ay = c.y - uy * a0, L = a0 + a1;
  const mid = (a0 + (e1 - e0) / 2);
  return { name: 'Haliç Metro Köprüsü', ax, ay, ux, uy, L, mid, wet: [a0 - e0, a0 + e1] };
}
function metro(k, W, m) {
  const q = k.q, Wd = 12.6, deck = 13;
  const P = (al, cc, h) => [m.ax + m.ux * al - m.uy * cc - k.ox, h, -(m.ay + m.uy * al + m.ux * cc - k.oy)];
  const lnx = -m.uy, lnz = -m.ux;
  const path = []; for (let al = 0; al <= m.L + 0.01; al += q ? 60 : 15) { const p = P(Math.min(al, m.L), 0, deck); path.push([p[0], p[1], p[2], lnx, lnz]); }
  { const p = P(m.L, 0, deck); path.push([p[0], p[1], p[2], lnx, lnz]); }
  sweepDeck(k, path, [[-6.3, 0], [6.3, 0], [6.3, -0.6], [3.5, -2.6], [-3.5, -2.6], [-6.3, -0.6]], [0x8a8580, 0xdfe1e2, 0xc4c8cb, 0xb0b5b9, 0xc4c8cb, 0xdfe1e2]);
  if (!q) for (const s of [-1, 1]) sweepDeck(k, path.map(([x, y, z, a, c2]) => [x + a * s * 6.0, y, z + c2 * s * 6.0, a, c2]), [[-0.15, 1.2], [0.15, 1.2], [0.15, 0], [-0.15, 0]], [0xd0d4d6]);
  // ayaklar
  for (let al = 20; al < m.L - 10; al += 45) { const [x, y] = [m.ax + m.ux * al, m.ay + m.uy * al]; const gh = W.isLand(x, y) ? W.terrainH(x, y) : -2; if (gh > deck - 3) continue; const p = P(al, 0, gh);
    k.add(new THREE.BoxGeometry(3, deck - 2.6 - gh, 6), M4(p[0], gh + (deck - 2.6 - gh) / 2, p[2], Math.atan2(lnx, lnz)), C.conc, 0.3); }
  const tw = [m.mid - 90, m.mid + 90], out = [];
  for (const al of tw) {
    const p0 = P(al, 0, -2);
    k.add(new THREE.BoxGeometry(10, 6, 16), M4(p0[0], 1, p0[2], Math.atan2(lnx, lnz)), C.conc, 0.3);
    // pilon: tabliyenin ortasında, yukarı incelen
    const nS = q ? 2 : 5;
    for (let i = 0; i < nS; i++) { const h0 = 1 + 64 * i / nS, h1 = 1 + 64 * (i + 1) / nS; k.beam(P(al, 0, h0), P(al, 0, h1 + 0.3), 4.2 - 2 * i / nS, 0xeeeeee, 0.9, 'op', 6 - 2.6 * i / nS); }
    avLight(k, ...P(al, 0, 65.6));
    if (!q) for (let i = 0; i < 9; i++) for (const dir of [-1, 1]) {
      const hh = 47 + i * 2, d = 18 + i * 8.5;
      k.line(P(al, 0, hh), P(al + dir * d, 0, deck + 0.3));
    }
    const [x, y] = [m.ax + m.ux * al, m.ay + m.uy * al]; out.push({ x, y });
  }
  return out;
}

// ---------- gizleme (OSM binaları) ----------
const HIDE_N = 64, HIDE_G = 8;
const HU = { O: U.hideO, R: { value: Array.from({ length: HIDE_N }, () => new THREE.Vector4()) }, S: { value: Array.from({ length: HIDE_N }, () => new THREE.Vector2()) },
  G: { value: Array.from({ length: HIDE_G }, () => new THREE.Vector4()) }, I: { value: Array.from({ length: HIDE_G }, () => new THREE.Vector2()) } };
const HIDE_GLSL = `
uniform vec2 uHO; uniform vec4 uHR[${HIDE_N}]; uniform vec2 uHS[${HIDE_N}]; uniform vec4 uHG[${HIDE_G}]; uniform vec2 uHI[${HIDE_G}];
bool simHid(vec2 p) {
  for (int g = 0; g < ${HIDE_G}; g++) {
    vec4 G = uHG[g]; if (G.z <= 0.0) continue;
    vec2 d = p - G.xy; if (dot(d, d) > G.z * G.z) continue;
    int a = int(uHI[g].x), n = int(uHI[g].y);
    for (int i = 0; i < ${HIDE_N}; i++) { if (i >= n) break; vec4 R = uHR[a + i]; vec2 q = p - R.xy; vec2 s = uHS[a + i];
      if (abs(q.x * R.z + q.y * R.w) <= s.x && abs(-q.x * R.w + q.y * R.z) <= s.y) return true; }
  }
  return false;
}
`;
function hidePatch(mat, key, inst, roadAttr) {
  if (!mat || mat.userData.simHide) return;
  mat.userData.simHide = true;
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    sh.uniforms.uHO = HU.O; sh.uniforms.uHR = HU.R; sh.uniforms.uHS = HU.S; sh.uniforms.uHG = HU.G; sh.uniforms.uHI = HU.I;
    const test = inst
      ? `#ifdef USE_INSTANCING\n { vec4 hw = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); if (simHid(vec2(hw.x, -hw.z) + uHO)) gl_Position = vec4(0.0, 0.0, 2.0, 1.0); }\n#endif\n`
      : `{ vec4 hw = modelMatrix * vec4(transformed, 1.0); if (${roadAttr ? roadAttr + ' < 31.5 && ' : ''}simHid(vec2(hw.x, -hw.z) + uHO)) gl_Position = vec4(0.0, 0.0, 2.0, 1.0); }\n`;
    sh.vertexShader = sh.vertexShader.replace('void main() {', HIDE_GLSL + 'void main() {').replace('#include <fog_vertex>', test + '#include <fog_vertex>');
  };
  const pk = prevKey ? prevKey.call(mat) : '';
  mat.customProgramCacheKey = () => pk + '|simist-hide-' + key;
  mat.needsUpdate = true;
}
function setHide(groups) {
  let n = 0;
  groups.slice(0, HIDE_G).forEach((g, gi) => {
    let x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18; const a = n;
    for (const [cx, cy, c, s, hw, hd] of g) { if (n >= HIDE_N) break; HU.R.value[n].set(cx, cy, c, s); HU.S.value[n].set(hw, hd); n++; const r = Math.hypot(hw, hd); x0 = Math.min(x0, cx - r); x1 = Math.max(x1, cx + r); y0 = Math.min(y0, cy - r); y1 = Math.max(y1, cy + r); }
    HU.G.value[gi].set((x0 + x1) / 2, (y0 + y1) / 2, Math.hypot(x1 - x0, y1 - y0) / 2 + 2, 0); HU.I.value[gi].set(a, n - a);
  });
}

// ---------- kurulum ----------
// world.js: _landmarksIstanbul() ve _bridges() çağrıldıktan sonra; n0 = o çağrılardan önceki root çocuk sayısı
export function simgelerIst(W, n0) {
  const t0 = performance.now();
  const mats = materials();
  const lod = (W.opts && W.opts.lod) || [1500, 4200, 9000];
  const DN = Math.max(2600, lod[1] * 1.05), DF = Math.max(16000, lod[2] * 2.6), DS = Math.max(9000, lod[2]);
  const LM = (id) => { for (const l of (W.landmarkPos || [])) if (l.id === id) return l; return null; };
  const REPL = { galata: 25, kiz: 45, ayasofya: 75, sultanahmet: 135, suleymaniye: 115, rumeli: 170 };
  // 1) eski modelleri çıkar: köprü örgüleri tamamen, simge yapılardan yalnız değiştirilenlerin üçgenleri (Çamlıca'dakiler kalır)
  const BR = new Set([0x8c8f93, 0xd8dadc]);
  const kids = W.root.children.slice(n0);
  const cut = Object.keys(REPL).map((id) => { const l = LM(id); return l && [l.x, l.y, REPL[id]]; }).filter(Boolean);
  for (const o of kids) {
    if (o.isLineSegments || (o.isMesh && o.material && o.material.color && BR.has(o.material.color.getHex()))) { W.root.remove(o); o.geometry.dispose(); continue; }
    if (!o.isMesh || !o.geometry.index) continue;
    const P = o.geometry.attributes.position.array, I = o.geometry.index.array, keep = [];
    for (let i = 0; i < I.length; i += 3) {
      const a = I[i] * 3, b = I[i + 1] * 3, c = I[i + 2] * 3;
      const x = (P[a] + P[b] + P[c]) / 3, y = -(P[a + 2] + P[b + 2] + P[c + 2]) / 3;
      let drop = false; for (const [lx, ly, r] of cut) if ((x - lx) ** 2 + (y - ly) ** 2 < r * r) { drop = true; break; }
      if (!drop) keep.push(I[i], I[i + 1], I[i + 2]);
    }
    if (keep.length !== I.length) { if (keep.length) o.geometry.setIndex(keep); else { W.root.remove(o); o.geometry.dispose(); } }
  }
  W.lmCol = W.lmCol.filter((c) => !cut.some(([lx, ly, r]) => (c.x - lx) ** 2 + (c.y - ly) ** 2 < r * r));

  const all = [];
  let tris = 0;
  // bir yapı: iki ayrıntı düzeyi
  const make = (name, x, y, fn, dn = DN, df = DF) => {
    const L = new THREE.LOD(); L.position.set(x, 0, -y);
    const k0 = new Kit(x, y, 0), k1 = new Kit(x, y, 1);
    let ret;
    try { ret = fn(k0); fn(k1); } catch (e) { console.warn('Simge yapı kurulamadı:', name, e); return null; }
    const g0 = k0.build(mats), g1 = k1.build(mats);
    if (W.shadows) for (const g of [g0, g1]) g.traverse((m) => { if (m.isMesh && m.material === mats.op) { m.castShadow = true; m.receiveShadow = true; } });
    L.addLevel(g0, 0); L.addLevel(g1, dn); L.addLevel(new THREE.Object3D(), df);
    L.name = 'simist-' + name;
    W.root.add(L); all.push(L);
    tris += k0.tris();
    return ret;
  };
  const at = (id, lat, lon) => { const l = LM(id); const p = l || geo(lat, lon); return { x: p.x, y: p.y, h: W.terrainH(p.x, p.y) }; };
  const col = (x, y, r, top) => W.lmCol.push({ x, y, r, top });

  // Galata Kulesi
  { const p = at('galata', 41.025658, 28.974155); make('galata', p.x, p.y, (k) => galata(k.frame(p.x, p.y, p.h, 0)), DN, DS); col(p.x, p.y, 9, p.h + 67); }
  // Kız Kulesi
  { const p = at('kiz', 41.021164, 29.004092); make('kiz', p.x, p.y, (k) => kizKulesi(k.frame(p.x, p.y, 0, bearing(110))), DN, DS); col(p.x, p.y, 16, 27); }
  // Ayasofya (eksen ~ 122°: apsis güneydoğuda)
  { const p = at('ayasofya', 41.008583, 28.980175); make('ayasofya', p.x, p.y, (k) => ayasofya(k.frame(p.x, p.y, p.h, bearing(122)))); col(p.x, p.y, 42, p.h + 56); }
  // Sultanahmet: ibadet alanı 64 x 72 m, kubbe Ø 23.5 m / 43 m, dört yarım kubbe, 6 minare
  { const p = at('sultanahmet', 41.005410, 28.976814);
    make('sultanahmet', p.x, p.y, (k) => camii(k.frame(p.x, p.y, p.h, bearing(QIBLA)), { L: 64, W: 72, wallH: 22, domeR: 11.75, domeTop: 43, domeSy: 0.95, drumH: 4.5, semi: 4, semiR: 11.5, exedra: true, sideDomes: 0,
      court: { L: 64, W: 72, h: 9 }, minarets: [[30, 34, 64, 3], [30, -34, 64, 3], [-30, 34, 64, 3], [-30, -34, 64, 3], [-94, 34, 54, 2], [-94, -34, 54, 2]] }));
    col(p.x, p.y, 40, p.h + 43); }
  // Süleymaniye: 59 x 58 m, kubbe Ø 26.5 m / 53 m, iki yarım kubbe, minareler 2 x 76 m (3 şerefe) + 2 x 56 m (2 şerefe)
  { const p = at('suleymaniye', 41.016111, 28.963889);
    make('suleymaniye', p.x, p.y, (k) => camii(k.frame(p.x, p.y, p.h, bearing(QIBLA)), { L: 59, W: 58, wallH: 24, domeR: 13.25, domeTop: 53, domeSy: 0.95, drumH: 6, semi: 2, semiR: 13, exedra: true, sideDomes: 5,
      court: { L: 58, W: 58, h: 10 }, minarets: [[-31, 31, 76, 3], [-31, -31, 76, 3], [-87, 31, 56, 2], [-87, -31, 56, 2]] }));
    col(p.x, p.y, 36, p.h + 53); }
  // Rumeli Hisarı (kıyı boyunca 20°)
  { const p = at('rumeli', 41.084722, 29.056111); make('rumeli', p.x, p.y, (k) => rumeli(k.frame(p.x, p.y, p.h, bearing(20)), W), DN, DS); col(p.x, p.y, 25, p.h + 35); }
  // Ortaköy Camii
  { const D = OSM_DATA.ortakoy; make('ortakoy', D.x, D.y, (k) => ortakoy(k.frame(D.x, D.y, 0, 0), W, D), DN, DS); col(D.x, D.y, 14, W.terrainH(D.x, D.y) + 40); }
  // Dolmabahçe ve Topkapı (OSM tabanlarından)
  { const D = OSM_DATA.dolma; make('dolmabahce', D.x, D.y, (k) => dolmabahce(k.frame(D.x, D.y, 0, 0), W, D)); }
  { const D = OSM_DATA.topkapi; make('topkapi', D.x, D.y, (k) => topkapi(k.frame(D.x, D.y, 0, 0), W, D)); }
  // Levent: Sapphire, Kanyon, İş Kulesi 1
  { const D = OSM_DATA.sapphire; make('sapphire', D.x, D.y, (k) => sapphire(k.frame(D.x, D.y, 0, 0), W, D)); const t = D.P.find((p) => p[0] === 30); }
  { const D = OSM_DATA.kanyon; make('kanyon', D.x, D.y, (k) => kanyon(k.frame(D.x, D.y, 0, 0), W, D)); }
  { const x = 3379.4, y = -494.6, a = 12.8 * D2R; make('iskulesi', x, y, (k) => isKulesi(k.frame(x, y, W.terrainH(x, y), a), W)); col(x, y, 8, W.terrainH(x, y) + 195); }

  // OSM binalarını gizle
  setHide(['topkapi', 'dolma', 'kanyon', 'sapphire', 'ortakoy'].map((n) => OSM_DATA[n].R));
  if (W.buildings) { hidePatch(W.buildings.mat, 'b', false, 'st'); hidePatch(W.buildings.domeM, 'd', true); hidePatch(W.buildings.minM, 'm', true); }
  // Sapphire ve Kanyon'un çarpışması (OSM yüksekliği yanlıştı): kule silindirleri
  { const D = OSM_DATA.sapphire, R = D.R[0]; col(R[0], R[1], 22, W.terrainH(R[0], R[1]) + 261); }

  // köprüler
  const info = [];
  for (const b of (W._br || [])) {
    const dk = W.decks.find((d) => d.name === b.name);
    const big = b.kind !== 'kiriş';
    const r = make('kopru-' + b.name, b.mid[0], b.mid[1], (k) => bridge(k.frame(b.mid[0], b.mid[1], 0, 0), W, b, dk), big ? Math.max(DN, 3500) : DN, big ? Math.max(DF, 30000) : DS);
    if (!big && r) (W.landmarkPos || []).push({ x: b.mid[0], y: b.mid[1], name: b.name, id: 'kopru' });
  }
  // Haliç Metro Köprüsü
  { const m = metroBridge(W), cx = m.ax + m.ux * m.L / 2, cy = m.ay + m.uy * m.L / 2;
    const tw = make('halic-metro', cx, cy, (k) => metro(k.frame(cx, cy, 0, 0), W, m), DN, DF);
    W.decks.push({ ax: m.ax, ay: m.ay, ux: m.ux, uy: m.uy, len: m.L, w: 14.6, h0: 13, h1: 13, deckAt: () => 13, name: m.name });
    if (tw) { for (const t of tw) W.colliders.push({ type: 'tower', x: t.x, y: t.y, r: 4, top: 65.5, name: m.name }); (W.bridgeInfo || (W.bridgeInfo = [])).push({ name: m.name, towers: tw }); } }

  // HUD'da ad
  const lp = W.landmarkPos || (W.landmarkPos = []);
  const addName = (name, x, y) => { if (!lp.some((l) => l.name === name)) lp.push({ x, y, name, id: 'simist' }); };
  addName('Topkapı Sarayı', OSM_DATA.topkapi.x, OSM_DATA.topkapi.y + 120);
  addName('Ortaköy Camii', OSM_DATA.ortakoy.x, OSM_DATA.ortakoy.y);
  addName('İstanbul Sapphire', OSM_DATA.sapphire.R[0][0], OSM_DATA.sapphire.R[0][1]);
  addName('Kanyon', OSM_DATA.kanyon.x, OSM_DATA.kanyon.y);
  addName('İş Kuleleri', 3379.4, -494.6);

  // her kare: gece katsayısı ve gizleme için kayan orijin
  const sc = W.scene, prevBR = sc.onBeforeRender;
  let urlN = null; try { const s = new URLSearchParams(location.search).get('gece'); if (s != null) urlN = s === '' ? 1 : Math.max(0, Math.min(1, +s || 0)); } catch (e) { /* yok */ }
  sc.onBeforeRender = function (...a) {
    if (prevBR) prevBR.apply(this, a);
    const g = typeof W.gece === 'number' ? W.gece : typeof W.night === 'number' ? W.night : urlN != null ? urlN : 0;
    U.night.value = g;
    U.hideO.value.set(W.O.x, W.O.y);
  };
  W.simIst = { lods: all, tris, ms: Math.round(performance.now() - t0), mats, setNight: (v) => { W.gece = v; } };
  return W.simIst;
}

// world.js kurucusundaki kanca: import('./simgeler-ist.js').then((m) => m.kur(this));
// İstanbul simge yapıları ve köprüleri kurulunca (_landmarksIstanbul + _bridges) eskilerin yerini alır.
export function kur(W) {
  if (W._lmBuilt && W._lmBuilt.has('istanbul')) { console.warn('Simge yapılar: İstanbul önceden kurulmuş'); return; }
  const lm = W._landmarksIstanbul, br = W._bridges;
  let n0 = null;
  W._landmarksIstanbul = function (...a) { n0 = this.root.children.length; return lm.apply(this, a); };
  W._bridges = function (...a) { const r = br.apply(this, a); if (n0 != null && !this.simIst) simgelerIst(this, n0); return r; };
}
