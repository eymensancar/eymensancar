// karakterler/*.json → karakterler.js (window.KARAKTERLER). Bozuk ya da eksik dosyaları bildirir.
const fs=require('fs'),path=require('path');const d=path.join(__dirname,'karakterler');
global.window={};eval(fs.readFileSync(path.join(__dirname,'musteri.js'),'utf8'));const M=window.Musteri;
const out=[],bad=[];
for(const f of fs.readdirSync(d).filter(f=>/^\d{3}\.json$/.test(f)).sort()){
  try{const j=JSON.parse(fs.readFileSync(path.join(d,f),'utf8'));const m=j.m;
    for(const k of Object.keys(M.PARTS))if(!(Number.isInteger(m[k])&&m[k]>=0&&m[k]<M.PARTS[k].length))throw new Error(k+' geçersiz');
    if(m.cinsiyet===0&&(m.biyik||m.sakal))throw new Error('kadında bıyık/sakal');
    for(const e of M.EMOTIONS)M.draw(m,e);
    out.push({no:j.no,ad:j.ad||'',m})}catch(e){bad.push(f+': '+e.message)}}
const have=new Set(out.map(k=>k.no)),missing=[];for(let n=1;n<=200;n++)if(!have.has(n))missing.push(n);
fs.writeFileSync(path.join(__dirname,'karakterler.js'),'/* 200 elle ayarlanmış müşteri (birlestir.cjs üretir; elle değiştirme, karakterler/NNN.json değiştir) */\nwindow.KARAKTERLER='+JSON.stringify(out)+';\n');
console.log('karakter:',out.length,'| bozuk:',bad.length,bad.join('; '),'| eksik:',missing.length?missing.join(','):'yok');
