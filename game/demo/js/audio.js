/* 깃들 데모: 소리
   녹음 파일 없이 브라우저에서 만들어 내는 임시 소리다. 바람, 발소리, 두루미 울음, 칸을 바꿀 때의 소리. */
(function () {
  const AU = GD.audio = { mute: false, lastCall: -99, nextCall: 14, step: 0 };
  let AC = null;
  function start() {
    if (AC) return; const A = window.AudioContext || window.webkitAudioContext; if (!A) return; AC = new A();
    AU.master = AC.createGain(); AU.master.gain.value = AU.mute ? 0 : .9; AU.master.connect(AC.destination);
    const len = AC.sampleRate * 4, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = .99765 * b0 + w * .099046; b1 = .963 * b1 + w * .2965164; b2 = .57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * .1848) * .16; }
    AU.noise = buf; const n = AC.createBufferSource(); n.buffer = buf; n.loop = true; n.start(0);
    AU.windF = AC.createBiquadFilter(); AU.windF.type = 'lowpass'; AU.windF.frequency.value = 400; AU.windF.Q.value = .4; AU.wind = AC.createGain(); AU.wind.gain.value = 0; n.connect(AU.windF); AU.windF.connect(AU.wind); AU.wind.connect(AU.master);
  }
  function burst(freq, q, dur, vol, type) {
    const n = AC.createBufferSource(); n.buffer = AU.noise; const f = AC.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q; const g = AC.createGain(), t = AC.currentTime;
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur); n.connect(f); f.connect(g); g.connect(AU.master); n.start(t, Math.random() * 3, dur + .05);
  }
  AU.footstep = function (wet, snow) { if (!AC) return; if (wet) { burst(520, .8, .34, .5); burst(2600, .9, .2, .14, 'highpass'); } else if (snow > .5) { burst(1500, 1.1, .15, .42); burst(4200, 1.4, .07, .13); } else { burst(700, .9, .1, .3); burst(2600, 1.5, .05, .07); } };
  AU.tick = function () { if (!AC) return; burst(900, 1.2, .08, .18); };
  // 두루미 울음: 녹음이 아니라 합성한 임시 소리
  AU.craneCall = function (x, z, vol) {
    if (!AC || AC.currentTime - AU.lastCall < 5) return; AU.lastCall = AC.currentTime; const t = AC.currentTime + .05;
    const pan = AC.createPanner(); pan.panningModel = 'equalpower'; pan.distanceModel = 'inverse'; pan.refDistance = 1.5; pan.rolloffFactor = 1.1; pan.setPosition(x, .8, z);
    const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 1.6; const g = AC.createGain(); g.gain.value = 0; f.connect(g); g.connect(pan); pan.connect(AU.master);
    const os = [['sawtooth', 1], ['square', 2.01]].map(([ty, m]) => { const o = AC.createOscillator(), og = AC.createGain(); o.type = ty; og.gain.value = m === 1 ? .6 : .2; o.connect(og); og.connect(f); for (let k = 0; k < 3; k++) { const a = t + k * .46; o.frequency.setValueAtTime(790 * m, a); o.frequency.linearRampToValueAtTime(1060 * m, a + .11); o.frequency.linearRampToValueAtTime(930 * m, a + .38); } return o; });
    for (let k = 0; k < 3; k++) { const a = t + k * .46; g.gain.setValueAtTime(.0001, a); g.gain.linearRampToValueAtTime(vol, a + .05); g.gain.setValueAtTime(vol, a + .26); g.gain.exponentialRampToValueAtTime(.0001, a + .42); }
    os.forEach(o => { o.start(t); o.stop(t + 1.5); });
  };
  // 소쩍새 소리: 두 마디로 끊어 우는 휘파람 같은 임시 소리
  AU.hoot = function (x, z, vol) {
    if (!AC) return; const t = AC.currentTime + .05, pan = AC.createPanner(); pan.panningModel = 'equalpower'; pan.distanceModel = 'inverse'; pan.refDistance = 1.2; pan.rolloffFactor = .9; pan.setPosition(x, 1, z);
    const g = AC.createGain(); g.gain.value = 0; g.connect(pan); pan.connect(AU.master); const o = AC.createOscillator(); o.type = 'sine'; o.connect(g);
    [[0, 1180], [.34, 960]].forEach(([d, f]) => { o.frequency.setValueAtTime(f, t + d); g.gain.setValueAtTime(.0001, t + d); g.gain.linearRampToValueAtTime(vol, t + d + .03); g.gain.exponentialRampToValueAtTime(.0001, t + d + .24); });
    o.start(t); o.stop(t + .7);
  };
  AU.nextHoot = 4;
  AU.setMute = function (m) { AU.mute = m; if (AC) AU.master.gain.setTargetAtTime(m ? 0 : .9, AC.currentTime, .1); };
  AU.frame = function (dt, walking, moving, bob, pos, yaw, eyeY) {
    if (!AC) return; const t = AC.currentTime, gust = .5 + .5 * Math.sin(t * .23) * Math.sin(t * .071 + 1);
    AU.wind.gain.setTargetAtTime((walking ? .1 : .04) + .11 * gust * (walking ? 1 : .4), t, .6); AU.windF.frequency.setTargetAtTime(300 + 420 * gust, t, .6);
    const L = AC.listener; if (L.setPosition) { L.setPosition(pos.x, eyeY, pos.z); L.setOrientation(-Math.sin(yaw), 0, -Math.cos(yaw), 0, 1, 0); }
    if (!walking) return;
    const st = Math.floor(bob / Math.PI); if (moving && st !== AU.step) { AU.step = st; AU.footstep(GD.w3.sample(pos.x, pos.z) < GD.vis.WL, GD.w3.snowAt(pos.x, pos.z)); }
    AU.nextHoot -= dt; if (AU.nextHoot <= 0) { AU.nextHoot = 6 + Math.random() * 7; const Z = GD.S.z[GD.S.zone], h = Z.here.scopsowl; if (h && GD.sim.phase().id === 'night') { const c = GD.hex.centerK(h.cell); AU.hoot(c[0], c[1], .22); } }
    AU.nextCall -= dt; if (AU.nextCall <= 0) { AU.nextCall = 28 + Math.random() * 30; const cc = GD.actors.list.filter(a => a.sp === 'crane' && !a.gone && a.state !== 'alert' && a.state !== 'away'); if (cc.length) { const c = cc[Math.floor(Math.random() * cc.length)]; AU.craneCall(c.x, c.z, .28); } }
  };
  const wake = () => { start(); if (AC && AC.state === 'suspended') AC.resume(); };
  window.addEventListener('pointerdown', wake); window.addEventListener('keydown', wake);
})();
