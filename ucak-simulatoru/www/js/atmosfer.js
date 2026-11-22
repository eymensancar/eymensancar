// Atmosfer: gökyüzü (Rayleigh mavisi, ufukta açılan pus, güneş çevresinde Mie parlaması), yüksekliğe göre azalan üstel sis
// (hava perspektifi: uzaklar ufuk rengine, güneş yönünde sıcak tona kayar), ACES ton eşleme, güneş gölgeleri (yüksek kalite).
// Sis three.js'in fog parçaları değiştirilerek bütün malzemelere uygulanır (FogExp2 nesnesi yalnızca anahtar olarak kalır:
// fogDensity = deniz seviyesindeki yoğunluk, 1/m). Gökyüzü ve sis aynı skyAt() işlevini kullanır; ikisi de ekran renginde.
import * as THREE from '../vendor/three.module.min.js';

export const SUN = new THREE.Vector3(-0.45, 0.55, 0.7).normalize();
export const FOG_B = 1 / 1900;    // sis yüksekliğe göre e katı azalma (1/m)
const v3 = (v) => `vec3(${v.x.toFixed(5)}, ${v.y.toFixed(5)}, ${v.z.toFixed(5)})`;

// ekran rengi (ton eşlemeden sonra) olarak gökyüzü: d birim yön (three dünya ekseni)
export const SKY_GLSL = `
vec3 skyAt(vec3 d) {
  vec3 sunD = ${v3(SUN)};
  float y = clamp(d.y, -0.2, 1.0), yp = max(y, 0.0);
  float mu = dot(d, sunD);
  // Rayleigh: zenit koyu mavi, ufka doğru optik derinlik artınca açık, beyazımsı
  float od = 1.0 / (yp + 0.045);
  vec3 ext = exp(-vec3(0.014, 0.028, 0.060) * od);
  vec3 zen = vec3(0.26, 0.47, 0.80);
  vec3 hor = vec3(0.70, 0.79, 0.88);
  vec3 c = mix(hor, zen, ext * 0.95);
  c *= 0.92 + 0.12 * (1.0 + mu * mu) * 0.5;
  // Mie: güneş çevresinde sıcak hale (Henyey-Greenstein, g = 0.78)
  float g = 0.78, hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5);
  c += vec3(1.0, 0.86, 0.66) * hg * 0.018 * (0.4 + 0.6 * (1.0 - yp));
  // ufuk altı: pus (yer yansıması)
  if (y < 0.0) c = mix(c, vec3(0.62, 0.66, 0.68), clamp(-y * 6.0, 0.0, 0.6));
  return c;
}`;

export function setupAtmosphere(world, opts = {}) {
  const { scene, renderer } = world;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  // sis parçaları
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = '#ifdef USE_FOG\n varying float vFogDepth; varying vec3 vFogPos;\n#endif';
  C.fog_vertex = '#ifdef USE_FOG\n vFogDepth = - mvPosition.z; vFogPos = mvPosition.xyz;\n#endif';
  C.fog_pars_fragment = `#ifdef USE_FOG
    uniform vec3 fogColor; varying float vFogDepth; varying vec3 vFogPos;
    #ifdef FOG_EXP2
      uniform float fogDensity;
    #else
      uniform float fogNear; uniform float fogFar;
    #endif
    ${SKY_GLSL}
  #endif`;
  C.fog_fragment = `#ifdef USE_FOG
    #ifdef FOG_EXP2
      vec3 fv = transpose(mat3(viewMatrix)) * vFogPos;
      float fd = length(fv); vec3 fdir = fv / max(fd, 0.001);
      float fb = ${FOG_B.toExponential(4)};
      float fk = fogDensity * exp(-fb * max(cameraPosition.y, 0.0));
      float fy = fdir.y * fd * fb;
      float fint = abs(fy) > 0.0005 ? (1.0 - exp(-fy)) / fy : 1.0 - 0.5 * fy;
      float fogFactor = 1.0 - exp(-fk * fd * fint);
      vec3 fcol = skyAt(normalize(vec3(fdir.x, max(fdir.y, 0.0) * 0.35, fdir.z))) * fogColor;
      gl_FragColor.rgb = mix(gl_FragColor.rgb, fcol, clamp(fogFactor, 0.0, 1.0));
    #else
      float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
    #endif
  #endif`;
  // fogColor: sis rengine çarpan (1 = gökyüzü ufku)
  scene.fog = new THREE.FogExp2(new THREE.Color(1, 1, 1), 0.00004);
  scene.fog.color.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace);
  // gökyüzü küresi (ekran renginde yazılır; ton eşlemeye girmez)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false,
    vertexShader: 'varying vec3 vd; void main(){ vd = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: `varying vec3 vd; ${SKY_GLSL}
      void main(){ vec3 d = normalize(vd); vec3 c = skyAt(d);
        float s = max(dot(d, ${v3(SUN)}), 0.0);
        c += vec3(1.0, 0.95, 0.85) * smoothstep(0.99955, 0.99975, s) * 2.0;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), skyMat);
  sky.scale.setScalar(1000); sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);
  // ışıklar
  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x8a7d66, 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.9);
  sun.position.copy(SUN).multiplyScalar(1000);
  scene.add(sun); scene.add(sun.target);
  if (opts.shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const S = 320;
    Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 10, far: 4000 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
    sun.shadow.camera.updateProjectionMatrix();
  }
  return { sky, skyMat, sun, hemi };
}

// her kare: gölge kamerasını uçağın / kameranın çevresine taşı, uçağın parçalarını gölge düşürür yap
export function updateShadows(world, camLocal) {
  const sun = world.sunLight;
  if (!sun || !sun.castShadow) return;
  // gölge merkezi: kameranın önünde, yere yakın (uçak genellikle oradadır)
  const t = world._shTarget || (world._shTarget = new THREE.Vector3());
  t.copy(world._acLocal || camLocal);
  // texel'e kilitle (kayarken gölge kenarları titremesin)
  const q = 640 / 2048;
  t.x = Math.round(t.x / q) * q; t.z = Math.round(t.z / q) * q; t.y = Math.round(t.y / q) * q;
  sun.target.position.copy(t);
  sun.position.copy(t).addScaledVector(SUN, 1800);
  sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
  // uçak, duman ve kameraya yakın sahne nesneleri (dünya kökü dışındakiler) gölge düşürür
  if ((world._shFrame = (world._shFrame || 0) + 1) % 30 === 1) {
    for (const o of world.scene.children) {
      if (o === world.root || o.isLight || o === world.sky || o === world.water || o.userData._sh) continue;
      o.userData._sh = true;
      o.traverse((m) => { if (m.isMesh && !m.material.transparent) m.castShadow = true; });
    }
  }
}

// ---------- kümülüs bulutları: kameranın çevresinde dönen (sarmal) 48 km'lik alanda, 1700-2600 m'de yumuşak kümeler ----------
// Her bulut 9-14 kameraya dönük yumuşak kare; hepsi tek örneklenmiş çizim. Kameraya çok yaklaşan kare saydamlaşır.
export function makeClouds(scene) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 26; k++) {
    const x = 64 + (rnd() - 0.5) * 50, y = 64 + (rnd() - 0.5) * 40, r = 18 + rnd() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.NoColorSpace;
  const AREA = 48000, NCL = 70, puffs = [];
  seed = 5;
  for (let i = 0; i < NCL; i++) {
    const cx = rnd() * AREA, cy = rnd() * AREA, base = 1700 + rnd() * 900, sz = 260 + rnd() * 420, n = 9 + Math.floor(rnd() * 6);
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * sz;
      puffs.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, base + rnd() * sz * 0.45 * (1 - r / sz * 0.6), sz * (0.45 + rnd() * 0.4));
    }
  }
  const N = puffs.length / 4;
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.setAttribute('puff', new THREE.InstancedBufferAttribute(new Float32Array(puffs), 4));
  geo.instanceCount = N;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: tex }, wrap: { value: new THREE.Vector3() } }]),
    vertexShader: `attribute vec4 puff; uniform vec3 wrap; varying vec2 vu; varying float va; varying float vy;
      #include <fog_pars_vertex>
      void main(){
        // sarmal alan: bulutlar kamerayla birlikte gelir (wrap.xy = kamera mutlak konumu mod alan, z = alan)
        vec2 p = mod(puff.xy - wrap.xy + wrap.z * 0.5, wrap.z) - wrap.z * 0.5;
        vec3 wp = vec3(p.x, puff.z, -p.y) + vec3(cameraPosition.x, 0.0, cameraPosition.z);
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        float d = length(mvPosition.xyz);
        va = smoothstep(puff.w * 0.6, puff.w * 1.8, d) * (1.0 - smoothstep(wrap.z * 0.38, wrap.z * 0.5, length(p)));
        mvPosition.xy += position.xy * puff.w;
        vu = position.xy * 0.5 + 0.5; vy = position.y;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform sampler2D map; varying vec2 vu; varying float va; varying float vy;
      #include <fog_pars_fragment>
      void main(){ vec4 t = texture2D(map, vu); float a = t.a * va; if (a < 0.01) discard;
        vec3 c = mix(vec3(0.74, 0.77, 0.82), vec3(1.0, 0.99, 0.97), smoothstep(-0.8, 0.7, vy));
        gl_FragColor = vec4(c, a * 0.9);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 8;
  scene.add(mesh);
  return { mesh, update(absX, absY) { mat.uniforms.wrap.value.set(((absX % AREA) + AREA) % AREA, ((absY % AREA) + AREA) % AREA, AREA); } };
}
