module.exports=function(d){
 try{localStorage.clear()}catch(e){}
 K=yeniKayit();kilit=false;kapat();panelKapat();
 if(d==='kayit'){hepsiniCiz();kayitEkrani();return}
 K.oyuncuId=T.addPlayer(K.world,'Eymen Sancar').id;K.baslangic=Date.now()-GUN_MS*.4;
 const p=()=>K.world.players[K.oyuncuId];
 if(d!=='issiz'&&d!=='p-kariyer1'){eylem({tur:'meslek_sec',meslek:'kurye'},1);eylem({tur:'gorev_yap'},1);eylem({tur:'gorev_yap'},1);eylem({tur:'kursa_yazil',kurs:'kamu_sinavi'},1)}
 if(d==='patron'||d==='p-kariyer3'){p().cash=1500000;p().totalExperienceDays=65;p().experience.kurye=65}
 if(d==='patron'){K.world.players[K.oyuncuId].courseInProgress=null;eylem({tur:'meslek_sec',meslek:'dukkan_sahibi'},1);eylem({tur:'gorev_yap'},1)}
 if(d==='p-banka'||d==='p-mulk'){p().cash=900000;p().lastMonthIncome=70000;eylem({tur:'mulk_al',mulk_turu:'daire',kredili:true,oturacak:true},1);eylem({tur:'mulk_al',mulk_turu:'arsa'},1);eylem({tur:'kredi_cek',tutar:20000},1)}
 kaydet();hepsiniCiz();document.getElementById('bildirim').classList.remove('acik');document.getElementById('tost').classList.remove('acik');
 if(d==='p-kariyer1')panelAc('kariyer','1');if(d==='p-kariyer3')panelAc('kariyer','3');if(d==='p-kurs')panelAc('kariyer','kurs');if(d==='p-banka')panelAc('banka');if(d==='p-mulk')panelAc('mulk');
}