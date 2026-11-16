/* Ses: şimdilik sessiz iskelet. Oyun olayları SO.ses.olay(ad, bilgi) ile gelir:
   'adim'  { zemin: 'asfalt' | 'kaldirim' | 'cim', hiz (m/sn), ayak: 'l' | 'r' }
   'zipla' { }      'in' { hiz (yere değiş hızı m/sn), zemin }
   init() ilk dokunuşta çağrılır (tarayıcı sesi ancak kullanıcı dokununca açar); update(dt) her karede. */
(function () {
  'use strict';
  const SO = window.SO;
  SO.ses = { init() { }, update(dt) { }, olay(ad, bilgi) { } };
})();
