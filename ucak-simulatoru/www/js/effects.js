// Uçağın dış görünüş efektleri (parçacıklar): kanat ucu girdapları (sert çekişte), yüksekte yoğuşma izi (kontrail),
// yüksek hücum açısında kanat üstünde buhar. Konumlar sahne koordinatında; kayan orijin kayınca shift() ile kaydırılır.
import * as THREE from '../vendor/three.module.min.js';

// Örneklenmiş yüzen kareler: her parçacığın doğuşu, ömrü, boyu (başta/sonda), saydamlığı ve sürüklenme hızı ayrı.
export class Particles {
  constructor(scene, max, { color = 0xffffff, soft = 1.0, depthTest = true } = {}) {
    this.max = max; this.head = 0; this.time = 0;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.off = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.prm = new Float32Array(max * 4); // doğuş, ömür, boy0, boy1
    this.alp = new Float32Array(max).fill(0);
    for (let i = 0; i < max; i++) this.prm[i * 4] = -1e9;
    const A = (a, n) => { const b = new THREE.InstancedBufferAttribute(a, n); b.setUsage(THREE.DynamicDrawUsage); return b; };
    this.aOff = A(this.off, 3); this.aVel = A(this.vel, 3); this.aPrm = A(this.prm, 4); this.aAlp = A(this.alp, 1);
    g.setAttribute('offset', this.aOff); g.setAttribute('vel', this.aVel); g.setAttribute('prm', this.aPrm); g.setAttribute('alp', this.aAlp);
    g.instanceCount = max;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { t: { value: 0 }, col: { value: new THREE.Color(color) }, soft: { value: soft } }]),
      vertexShader: `attribute vec3 offset; attribute vec3 vel; attribute vec4 prm; attribute float alp; uniform float t; varying vec2 vu; varying float va;
        #include <fog_pars_vertex>
        void main(){ float age = t - prm.x, k = age / prm.y;
          va = (age < 0.0 || k > 1.0) ? 0.0 : alp * (1.0 - k) * smoothstep(0.0, 0.08, k);
          float sz = mix(prm.z, prm.w, sqrt(clamp(k, 0.0, 1.0)));
          vec4 mvPosition = modelViewMatrix * vec4(offset + vel * age, 1.0);
          float a = float(gl_InstanceID) * 2.399; mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
          mvPosition.xy += R * position.xy * sz; vu = position.xy; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform vec3 col; uniform float soft; varying vec2 vu; varying float va;
        #include <fog_pars_fragment>
        void main(){ float r = length(vu); if (r > 1.0 || va <= 0.002) discard; float a = pow(1.0 - r * r, soft) * va;
          gl_FragColor = vec4(col, a);
          #include <fog_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
    scene.add(this.mesh);
    this.dirty = false;
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, a) {
    const i = this.head, i3 = i * 3, i4 = i * 4;
    this.off[i3] = x; this.off[i3 + 1] = y; this.off[i3 + 2] = z; this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.prm[i4] = this.time; this.prm[i4 + 1] = life; this.prm[i4 + 2] = s0; this.prm[i4 + 3] = s1; this.alp[i] = a;
    this.head = (i + 1) % this.max; this.dirty = true;
  }
  tick(dt) {
    this.time += dt; this.mat.uniforms.t.value = this.time;
    if (this.dirty) { this.aOff.needsUpdate = this.aVel.needsUpdate = this.aPrm.needsUpdate = this.aAlp.needsUpdate = true; this.dirty = false; }
  }
  shift(d) { for (let i = 0; i < this.max; i++) { this.off[i * 3] += d.x; this.off[i * 3 + 2] += d.z; } this.aOff.needsUpdate = true; }
  clear() { for (let i = 0; i < this.max; i++) this.prm[i * 4] = -1e9; this.aPrm.needsUpdate = true; }
}

// Uçağa göre efekt yöneticisi. P: uçak verisi; noktalar model ekseninde (+X sağ, +Y yukarı, -Z burun).
const TIPS = { f16: [4.85, -0.14, 1.0], jet: [4.75, -0.45, -0.3], c172: [5.45, 0.92, -0.1] };
const NOZ = { f16: [0, 0.03, 7.7], jet: [0, 0.05, 6.3], c172: null };
export class AirFX {
  constructor(scene) {
    this.vort = new Particles(scene, 1600, { soft: 1.6 });
    this.con = new Particles(scene, 1400, { soft: 1.2 });
    this.acc = { v: 0, c: 0 };
    this.v = new THREE.Vector3(); this.w = new THREE.Vector3();
  }
  // ac: fizik durumu, root: uçağın model kökü (konum/yönelim güncel), dt: saniye
  update(ac, root, dt, id) {
    if (dt > 0 && !ac.crashed && !ac.onGround) {
      const vel = this.w.set(ac.vel[1], -ac.vel[2], -ac.vel[0]);
      const V = vel.length(), alt = ac.alt;
      // kanat ucu girdabı: yük ya da hücum açısı yüksekken, nemli alçak havada daha belirgin
      const nz = ac.nz, a = ac.out.alpha || 0;
      const kv = Math.max(0, Math.min(1, (nz - 3.2) / 4)) + Math.max(0, Math.min(1, (a - 0.2) / 0.25)) * Math.min(1, (ac.out.qbar || 0) / 9000);
      const tip = TIPS[id] || TIPS.f16;
      if (kv > 0.02 && V > 40) {
        this.acc.v += dt;
        while (this.acc.v > 0.007) {
          this.acc.v -= 0.007;
          for (const s of [-1, 1]) {
            this.v.set(s * tip[0], tip[1], tip[2]).applyQuaternion(root.quaternion).add(root.position);
            const j = (Math.random() - 0.5) * 0.2;
            this.vort.emit(this.v.x - vel.x * this.acc.v + j, this.v.y - vel.y * this.acc.v + j, this.v.z - vel.z * this.acc.v + j, 0, 0, 0, 0.6 + 0.6 * Math.min(1, kv), 0.3, 1.1, Math.min(0.4, 0.08 + kv * 0.25));
          }
        }
      } else this.acc.v = 0;
      // yoğuşma izi: 7500 m üstünde, motor arkasından; yükseldikçe yoğunlaşır
      const noz = NOZ[id];
      const kc = noz ? Math.max(0, Math.min(1, (alt - 7300) / 1500)) * Math.min(1, (ac.spool || 0) * 1.4) : 0;
      if (kc > 0.02) {
        this.acc.c += dt;
        while (this.acc.c > 0.04) {
          this.acc.c -= 0.04;
          this.v.set(noz[0], noz[1], noz[2] + 4).applyQuaternion(root.quaternion).add(root.position);
          this.con.emit(this.v.x - vel.x * this.acc.c + (Math.random() - 0.5), this.v.y - vel.y * this.acc.c + (Math.random() - 0.5), this.v.z - vel.z * this.acc.c + (Math.random() - 0.5), 0, 0.1, 0, 40, 1.2, 14, 0.5 * kc);
        }
      } else this.acc.c = 0;
    }
    this.vort.tick(dt); this.con.tick(dt);
  }
  shift(d) { this.vort.shift(d); this.con.shift(d); }
  clear() { this.vort.clear(); this.con.clear(); }
}

// F-16 kanat üstü buharı: yüksek hücum açısında LEX ve kanat kökünün üstünde titreşen yarı saydam bulut (kendi gölgelendiricimiz)
export function vaporSheet() {
  const g = new THREE.PlaneGeometry(1, 1, 1, 1); g.rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { t: { value: 0 }, k: { value: 0 } }]),
    vertexShader: `varying vec2 vu;
      #include <fog_pars_vertex>
      void main(){ vu = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float t, k; varying vec2 vu;
      #include <fog_pars_fragment>
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){ vec2 p = vu * vec2(6.0, 10.0) + vec2(0.0, -t * 9.0);
        float d = n(p) * 0.6 + n(p * 2.3 + 3.1) * 0.4;
        float edge = smoothstep(0.0, 0.25, vu.x) * smoothstep(1.0, 0.6, vu.x) * smoothstep(0.0, 0.2, vu.y) * smoothstep(1.0, 0.45, vu.y);
        float a = k * edge * smoothstep(0.35, 0.8, d) * 0.75; if (a < 0.003) discard;
        gl_FragColor = vec4(vec3(0.96, 0.97, 1.0), a);
        #include <fog_fragment>
      }`,
  });
  const o = new THREE.Mesh(g, m); o.renderOrder = 6; return o;
}
