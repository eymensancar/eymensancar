/* Karakter: sıradan bir insan (CC0 model, 65 kemik) + hareket kütüphanesi (43 klip). Görünüş çizim tarzında:
   düz renkler, üç basamaklı gölge (toon), ters kabuk mürekkep dış çizgisi. Giysiler kemik ağırlıklarından boyanır
   (gövde → tişört, bacak → pantolon, ayak → ayakkabı); ten ve yüz modelin kendi dokusundan gelir. */
(function () {
  'use strict';
  const SO = window.SO, T3 = THREE;
  const RENK = { ink: 0x15120d, tisort: 0xc9c2ae, pantolon: 0x3f5673, ayakkabi: 0x2e2a28, sac: 0x2a1d16, ten: 0xd9a27c };
  const load = url => new Promise((ok, bad) => new T3.GLTFLoader().load(url, ok, undefined, e => bad(new Error('yüklenemedi: ' + url))));
  function gradient() { const d = new Uint8Array([120, 120, 120, 255, 196, 196, 196, 255, 255, 255, 255, 255]); const t = new T3.DataTexture(d, 3, 1, T3.RGBAFormat); t.minFilter = t.magFilter = T3.NearestFilter; t.needsUpdate = true; return t; }
  const hull = (kalin, skinned) => { const m = new T3.MeshBasicMaterial({ color: RENK.ink, side: T3.BackSide, skinning: !!skinned }); m.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = vec3(position) + normalize(normal) * ${kalin.toFixed(4)};`); }; return m; };
  function bolgeMaskesi(mesh) { // her köşe için en ağır kemik grubuna göre (tişört, pantolon, ayakkabı) maskesi
    const g = mesh.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = mesh.skeleton.bones, n = si.count, out = new Float32Array(n * 3);
    const grup = name => /^(pelvis|thigh|calf)/.test(name) ? 1 : /^(foot|ball)/.test(name) ? 2 : /^(spine|clavicle|upperarm)/.test(name) ? 0 : 3;
    for (let i = 0; i < n; i++) { const w = [0, 0, 0, 0]; const G4 = ['getX', 'getY', 'getZ', 'getW']; for (let k = 0; k < 4; k++) { const b = bones[si[G4[k]](i)]; if (b) w[grup(b.name)] += sw[G4[k]](i); } let best = 0; for (let k = 1; k < 4; k++) if (w[k] > w[best]) best = k; if (best < 3) out[i * 3 + best] = 1; }
    g.setAttribute('mask', new T3.BufferAttribute(out, 3));
  }
  async function build(scene) {
    const [body, lib, hair, lib2] = await Promise.all([load('model/insan.json'), load('model/hareketler.wasm'), load('model/sac.json'), load('model/hareketler2.wasm')]);
    const root = new T3.Group(), model = body.scene; root.add(model); scene.add(root);
    const grad = gradient(), bones = {}, meshes = [];
    model.traverse(o => { if (o.isBone) bones[o.name] = o; if (o.isSkinnedMesh) meshes.push(o); });
    meshes.forEach(m => {
      const name = m.material.name, map = m.material.map; if (map) map.encoding = T3.LinearEncoding; m.frustumCulled = false;
      if (name === 'MI_Superhero_Male') {
        bolgeMaskesi(m);
        const mt = new T3.MeshToonMaterial({ map, gradientMap: grad, skinning: true });
        mt.onBeforeCompile = s => {
          s.uniforms.uTisort = { value: new T3.Color(RENK.tisort) }; s.uniforms.uPantolon = { value: new T3.Color(RENK.pantolon) }; s.uniforms.uAyakkabi = { value: new T3.Color(RENK.ayakkabi) }; s.uniforms.uTen = { value: new T3.Color(RENK.ten) };
          s.vertexShader = 'attribute vec3 mask;\nvarying vec3 vMask;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvMask = mask;');
          s.fragmentShader = 'varying vec3 vMask;\nuniform vec3 uTisort; uniform vec3 uPantolon; uniform vec3 uAyakkabi; uniform vec3 uTen;\n' + s.fragmentShader.replace('#include <map_fragment>',
            '#include <map_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, uTen, .45);\n diffuseColor.rgb = mix(diffuseColor.rgb, uTisort, step(.5, vMask.x));\n diffuseColor.rgb = mix(diffuseColor.rgb, uPantolon, step(.5, vMask.y));\n diffuseColor.rgb = mix(diffuseColor.rgb, uAyakkabi, step(.5, vMask.z));');
        };
        m.material = mt;
        const o = new T3.SkinnedMesh(m.geometry, hull(.011, true)); o.bind(m.skeleton, m.bindMatrix); o.frustumCulled = false; m.parent.add(o);
      } else if (name === 'MI_Eyes') m.material = new T3.MeshBasicMaterial({ map, skinning: true });
      else m.material = new T3.MeshBasicMaterial({ color: RENK.sac, skinning: true });
    });
    // saç: dinlenme duruşunda yerine konur, sonra baş kemiğine bağlanır
    model.updateMatrixWorld(true);
    const sacMat = new T3.MeshToonMaterial({ color: RENK.sac, gradientMap: grad });
    const sacAg = []; hair.scene.traverse(o => { if (o.isMesh) sacAg.push(o); }); sacAg.forEach(o => { o.material = sacMat; o.add(new T3.Mesh(o.geometry, hull(.008, false))); });
    root.add(hair.scene); hair.scene.updateMatrixWorld(true); if (bones.Head) bones.Head.attach(hair.scene);
    const mixer = new T3.AnimationMixer(model), clips = {}, actions = {};
    lib.animations.concat(lib2.animations.filter(c => c.name !== 'A_TPose')).forEach(c => { c.tracks = c.tracks.filter(t => !/^(root|Armature)\.(position|scale)$/.test(t.name)); clips[c.name] = c; });
    // action(ad): klibin oynatıcısını verir (ağırlık 0 ile oynar durumda başlar; katman ağırlığı ve zamanı kendisi ayarlar)
    const action = name => { let a = actions[name]; if (!a) { const c = clips[name]; if (!c) throw new Error('klip yok: ' + name); a = actions[name] = mixer.clipAction(c); a.enabled = true; a.setEffectiveWeight(0); a.play(); } return a; };
    SO.char = { root, model, mixer, clips, actions, action, bones, RENK };
    return SO.char;
  }
  SO.karakter = { build };
})();
