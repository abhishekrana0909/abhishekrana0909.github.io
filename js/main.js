import * as THREE from 'three';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const touch = matchMedia('(hover:none),(pointer:coarse)').matches;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = () => innerWidth < 761;
const rand = (a, b) => a + Math.random() * (b - a);
const wait = s => new Promise(r => gsap.delayedCall(s, r));
gsap.registerPlugin(ScrollTrigger);

/* ================= SOUND (WebAudio, no files) ================= */
const Sound = (() => {
  let ctx, master, out, noise, on = false, padOn = false;
  const init = () => {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = 0;
    out = comp; comp.connect(master).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  };
  const ok = () => on && ctx;
  const tone = (f = 880, d = 0.12, v = 0.05, type = 'sine', at = 0, drop = 0.6) => {
    if (!ok()) return;
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f * drop), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.05);
  };
  const burst = (freq, d, v, type = 'bandpass', q = 1, at = 0, sweepTo = 0) => {
    if (!ok()) return;
    const t = ctx.currentTime + at, src = ctx.createBufferSource(); src.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + d);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + Math.min(0.25, d * 0.35)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f).connect(g).connect(out); src.start(t, Math.random() * 0.5, d + 0.05);
  };
  const S = {
    get on() { return on; },
    enable(v) {
      init(); ctx.resume(); on = v;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(v ? 1 : 0, ctx.currentTime + 0.3);
      if (v && !padOn) pad();
      return on;
    },
    blip: (f = 1500, d = 0.035, v = 0.02) => tone(f, d, v),
    click: () => { tone(620, 0.08, 0.04, 'triangle'); },
    whoosh: (d = 0.8, v = 0.09, from = 300, to = 3200) => burst(from, d, v, 'bandpass', 1.1, 0, to),
    swoosh: (d = 1.1, v = 0.1) => burst(2800, d, v, 'bandpass', 0.9, 0, 220),
    hello: () => { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 1.6, 0.03, 'sine', i * 0.09, 1)); },
    lang: i => { const scale = [587.33, 659.25, 739.99, 880, 987.77, 1108.7, 1318.5]; tone(scale[i % 7], 0.5, 0.035, 'sine', 0, 1); tone(scale[i % 7] * 2, 0.25, 0.01, 'sine', 0, 1); },
    chime: () => { [392, 587.33, 783.99, 1174.66].forEach((f, i) => tone(f, 2.2, 0.045, 'sine', i * 0.06, 1)); burst(6000, 1.2, 0.02, 'highpass', 0.7); },
    assemble: (d = 3.2) => {
      if (!ok()) return;
      burst(200, d, 0.07, 'bandpass', 0.8, 0, 5200);
      for (let i = 0; i < 70; i++) { const at = Math.pow(Math.random(), 0.7) * d; tone(rand(1800, 5200) * (0.6 + at / d), 0.05, rand(0.006, 0.016), 'sine', at, 0.8); }
      [261.63, 392, 523.25].forEach((f, i) => tone(f, 2.6, 0.035, 'sine', d * 0.78 + i * 0.05, 1));
    },
    thock: (wide = false) => {
      if (!ok()) return;
      const p = rand(0.92, 1.08);
      burst(4200 * p, 0.006, 0.05, 'highpass', 0.7);
      burst((wide ? 480 : 650) * p, wide ? 0.07 : 0.05, 0.32, 'bandpass', 1.3, 0.002);
      tone((wide ? 180 : 240) * p, wide ? 0.08 : 0.06, 0.4, 'sine', 0.001, 0.44);
    },
    tick: () => { tone(2400, 0.02, 0.02, 'square', 0, 0.9); },
  };
  function pad() {
    padOn = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const g = ctx.createGain(); g.gain.value = 0.02; lp.connect(g).connect(out);
    [55, 82.41, 110.3].forEach((f, i) => { const o = ctx.createOscillator(); o.type = i ? 'triangle' : 'sine'; o.frequency.value = f; o.detune.value = rand(-6, 6); o.connect(lp); o.start(); });
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 180; lfo.connect(lg).connect(lp.frequency); lfo.start();
  }
  return S;
})();

const soundBtn = $('#soundBtn');
const setSoundUI = on => { soundBtn.classList.toggle('on', on); soundBtn.setAttribute('aria-pressed', on); $('#soundLabel').textContent = on ? 'Sound on' : 'Sound off'; };
soundBtn.addEventListener('click', () => setSoundUI(Sound.enable(!Sound.on)));
document.addEventListener('mouseover', e => {
  const t = e.target.closest('a,button,.srow,.wcard');
  if (t && !t.contains(e.relatedTarget)) Sound.blip();
});
document.addEventListener('pointerdown', e => { if (!e.target.closest('.key,.play__canvas,.gate')) Sound.click(); });

/* ================= CURSOR ================= */
const cursor = $('#cursor'), pill = $('#cursorPill');
const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
if (!touch) {
  const cp = { x: mouse.x, y: mouse.y };
  addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  addEventListener('pointerdown', () => cursor.classList.add('down'));
  addEventListener('pointerup', () => cursor.classList.remove('down'));
  gsap.ticker.add(() => {
    cp.x += (mouse.x - cp.x) * 0.22; cp.y += (mouse.y - cp.y) * 0.22;
    cursor.style.transform = `translate3d(${cp.x}px,${cp.y}px,0)`;
  });
  document.addEventListener('mouseover', e => {
    const t = e.target.closest('[data-cursor]');
    if (t) { pill.textContent = t.dataset.cursor; cursor.classList.add('on'); }
    else cursor.classList.remove('on');
  });
}

/* ================= SMOOTH SCROLL ================= */
const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const id = a.getAttribute('href'); const el = id === '#top' ? 0 : $(id);
  if (el === null) return; e.preventDefault(); Sound.whoosh(0.7, 0.05); lenis.scrollTo(el, { duration: 1.6 });
}));

/* ================= HERO PARTICLES ================= */
const Hero = (() => {
  const canvas = $('#heroCanvas'), section = $('#hero');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { document.documentElement.classList.add('no-webgl'); return { ready: Promise.resolve(), intro() {} }; }
  const pr = Math.min(devicePixelRatio, 2);
  renderer.setPixelRatio(pr);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.z = 5;
  const uniforms = {
    uTime: { value: 0 }, uIntro: { value: reduce ? 1 : 0 }, uScatter: { value: 0 },
    uMouse: { value: new THREE.Vector2(9, 9) }, uMouseStr: { value: 0 }, uSize: { value: 10 }, uPR: { value: pr },
  };
  const vert = `
    uniform float uTime,uIntro,uScatter,uSize,uPR,uMouseStr; uniform vec2 uMouse;
    attribute vec3 aStart; attribute float aLum,aSeed;
    varying float vLum,vA,vHole;
    void main(){
      float t = clamp(uIntro*1.7 - aSeed*0.7, 0., 1.);
      t = 1. - pow(1. - t, 4.);
      vec3 p = mix(aStart, position, t);
      float settle = 1. - t;
      p.x += sin(uTime*1.3 + aSeed*40.)*(0.0012 + settle*0.02);
      p.y += cos(uTime*1.1 + aSeed*31.)*(0.0012 + settle*0.02);
      vec2 d = p.xy - uMouse; float dist = length(d);
      float f = smoothstep(0.24, 0.0, dist) * uMouseStr * t;
      p.xy += normalize(d + 1e-5) * f * 0.14;
      p.z += f * (0.1 + aSeed*0.3);
      p += (aStart - position) * uScatter * (0.35 + aSeed);
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      gl_Position = projectionMatrix * mv;
      float sz = uSize * (0.8 + aLum*0.4) * uPR / max(-mv.z, 2.5);
      gl_PointSize = min(sz, 6. * uPR);
      vLum = aLum; vA = t * (1. - uScatter*0.85); vHole = f;
    }`;
  const frag = `
    varying float vLum,vA,vHole;
    void main(){
      vec2 c = gl_PointCoord - .5; float r = length(c); if (r > .5) discard;
      float a = smoothstep(.5, .2, r);
      vec3 col = vec3(pow(vLum, .85));
      gl_FragColor = vec4(col, a * (0.3 + vLum*0.7) * (0.15 + 0.85*vA) * (1. - vHole*0.75));
    }`;
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, depthTest: false, blending: THREE.NormalBlending });
  const group = new THREE.Group(); scene.add(group);
  let points, rows = 1, aspectImg = 0.73;

  const dustN = small() ? 220 : 500, dp = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) { dp[i * 3] = rand(-4, 4); dp[i * 3 + 1] = rand(-2.5, 2.5); dp[i * 3 + 2] = rand(-3, 1); }
  const dustG = new THREE.BufferGeometry(); dustG.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustG, new THREE.PointsMaterial({ color: 0xffffff, size: 0.01, transparent: true, opacity: 0.3, depthWrite: false }));
  scene.add(dust);

  const ready = new Promise(res => {
    const img = new Image(); img.src = 'images/abhishek-p.png';
    img.onload = () => {
      const W = img.width, H = img.height; aspectImg = W / H;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
      const data = cx.getImageData(0, 0, W, H).data;
      const step = small() ? 3 : 2; rows = H / step;
      const pos = [], start = [], lum = [], seed = [];
      for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
        const i = (y * W + x) * 4, a = data[i + 3];
        if (a < 120) continue;
        const l = (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) / 255;
        pos.push((x / W - 0.5) * aspectImg * 2, (0.5 - y / H) * 2, 0);
        const th = rand(0, Math.PI * 2), rr = rand(1.6, 4.5);
        start.push(Math.cos(th) * rr * 1.3, Math.sin(th) * rr * 0.8, rand(-3, 0.6));
        lum.push(Math.min(1, 0.04 + l * 1.05)); seed.push(Math.random());
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('aStart', new THREE.Float32BufferAttribute(start, 3));
      g.setAttribute('aLum', new THREE.Float32BufferAttribute(lum, 1));
      g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
      points = new THREE.Points(g, mat); points.frustumCulled = false; group.add(points);
      resize(); res();
    };
    img.onerror = () => res();
  });

  let visH = 1, visW = 1;
  function resize() {
    const w = section.clientWidth, h = section.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); visW = visH * camera.aspect;
    const photoH = Math.min(visH * 0.9, (visW * 0.96) / aspectImg);
    group.scale.setScalar(photoH / 2);
    group.position.set(0, -visH / 2 + photoH / 2, 0);
    uniforms.uSize.value = (photoH / visH * h / rows) * camera.position.z * 1.15;
  }
  addEventListener('resize', resize);

  const target = new THREE.Vector2(9, 9), cur = new THREE.Vector2(9, 9);
  let strT = 0;
  const setFromClient = (cx, cy) => {
    const r = section.getBoundingClientRect();
    const wx = ((cx - r.left) / r.width - 0.5) * visW, wy = (0.5 - (cy - r.top) / r.height) * visH;
    target.set((wx - group.position.x) / group.scale.x, (wy - group.position.y) / group.scale.y);
  };
  section.addEventListener('pointermove', e => { setFromClient(e.clientX, e.clientY); strT = 1; });
  section.addEventListener('pointerleave', () => { strT = 0; });
  section.addEventListener('touchmove', e => { const t = e.touches[0]; setFromClient(t.clientX, t.clientY); strT = 1; }, { passive: true });
  section.addEventListener('touchend', () => { strT = 0; });

  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(section);
  const clock = new THREE.Clock();
  gsap.ticker.add(() => {
    if (!visible) return;
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;
    cur.lerp(target, 0.12); uniforms.uMouse.value.copy(cur);
    uniforms.uMouseStr.value += (strT - uniforms.uMouseStr.value) * 0.06;
    dust.rotation.y = t * 0.02; dust.position.y = Math.sin(t * 0.2) * 0.05;
    group.rotation.y = (mouse.x / innerWidth - 0.5) * 0.1; group.rotation.x = (mouse.y / innerHeight - 0.5) * -0.04;
    renderer.render(scene, camera);
  });

  gsap.to(uniforms.uScatter, { value: 1, ease: 'none', scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', scrub: true } });
  return {
    ready,
    intro(d = 3.4) { Sound.assemble(d * 0.9); gsap.fromTo(uniforms.uIntro, { value: reduce ? 1 : 0 }, { value: 1, duration: reduce ? 0.01 : d, ease: 'none' }); },
  };
})();

/* ================= TEXT HELPERS ================= */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+/<>!?';
function scramble(el, text, dur = 0.9, onLetter) {
  return new Promise(res => {
    const len = text.length, o = { p: 0 }; let last = -1;
    gsap.to(o, {
      p: 1, duration: dur, ease: 'power2.out',
      onUpdate() {
        const n = Math.floor(o.p * len); let s = '';
        if (n !== last) { last = n; onLetter && onLetter(n); }
        for (let i = 0; i < len; i++) s += i < n || text[i] === ' ' ? text[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        el.textContent = s;
      },
      onComplete() { el.textContent = text; res(); },
    });
  });
}
function splitChars(el, cls = '') {
  const t = el.textContent; el.textContent = '';
  return [...t].map(c => { const s = document.createElement('span'); s.className = 'ch ' + cls; s.textContent = c === ' ' ? ' ' : c; el.appendChild(s); return s; });
}
function splitWords(root) {
  const walk = node => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
          else { const s = document.createElement('span'); s.className = 'w'; s.textContent = part; frag.appendChild(s); }
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  walk(root); return $$('.w', root);
}

/* ================= LOADER ================= */
const heroH1 = $('#heroName');
heroH1.classList.remove('chrome');
const heroChars = splitChars($('span', heroH1), 'chrome');
gsap.set(heroH1, { opacity: 0 });
gsap.set(['.hero__sub', '.hero__top', '.hero__hint', '.fcursor'], { opacity: 0 });

function heroUI() {
  gsap.to(['.hero__sub', '.hero__top', '.hero__hint'], { opacity: 1, duration: 1, delay: 0.6, stagger: 0.12 });
  gsap.to('.fcursor', { opacity: 1, duration: 0.6, delay: 2.4, stagger: 0.3 });
  document.body.classList.remove('is-loading');
  lenis.start(); ScrollTrigger.refresh();
}

const LANGS = [
  ['नमस्ते', 'hi'], ['ਸਤ ਸ੍ਰੀ ਅਕਾਲ', 'pa'], ['Hola', ''], ['Bonjour', ''], ['Ciao', ''], ['こんにちは', 'ja'], ['مرحبا', 'ar'],
];

async function runLoader() {
  const loader = $('#loader'), word = $('#loaderWord'), glow = $('.loader__glow'), count = $('#loaderCount');
  const gate = $('#gate'), hello = $('#hello'), helloText = $('text', hello);
  if (reduce) { loader.remove(); gsap.set(heroH1, { opacity: 1 }); await Hero.ready; Hero.intro(); heroUI(); return; }

  // gate: choose sound
  gsap.fromTo(glow, { scale: 0 }, { scale: 1, duration: 0.8, ease: 'back.out(3)' });
  gsap.to(glow, { scale: 1.35, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.from(gate, { opacity: 0, y: 14, duration: 0.8, delay: 0.4 });
  await new Promise(res => {
    const go = withSound => { setSoundUI(Sound.enable(withSound)); res(); };
    $('#enterSound').addEventListener('click', () => go(true), { once: true });
    $('#enterMute').addEventListener('click', () => go(false), { once: true });
    const kd = e => { if (e.key === 'Enter') { removeEventListener('keydown', kd); go(true); } }; addEventListener('keydown', kd);
  });
  Sound.whoosh(0.5, 0.05);
  await gsap.to(gate, { opacity: 0, y: -10, duration: 0.35 }); gate.remove();
  gsap.killTweensOf(glow);
  const c = { v: 0 };
  gsap.to(c, { v: 100, duration: 9.2, ease: 'power1.inOut', onUpdate: () => { count.textContent = String(Math.round(c.v)).padStart(3, '0'); } });

  // 1. "hello" written in cursive (Apple style)
  gsap.to(glow, { scale: 0.3, opacity: 0, duration: 0.6 });
  await document.fonts.load('230px Sacramento').catch(() => {});
  const len = 2600;
  gsap.set(hello, { opacity: 1 });
  gsap.set(helloText, { strokeDasharray: len, strokeDashoffset: len, fillOpacity: 0 });
  Sound.hello();
  await gsap.to(helloText, { strokeDashoffset: 0, duration: 1.9, ease: 'power1.inOut' });
  await gsap.to(helloText, { fillOpacity: 1, duration: 0.4 });
  await wait(0.35);
  await gsap.to(hello, { opacity: 0, filter: 'blur(10px)', scale: 0.96, duration: 0.4 });
  hello.remove();

  // 2. hello in many languages
  for (let i = 0; i < LANGS.length; i++) {
    const [txt, cls] = LANGS[i];
    word.className = 'loader__word lang' + (cls ? ' lang-' + cls : ''); word.textContent = txt;
    Sound.lang(i);
    await gsap.fromTo(word, { opacity: 0, filter: 'blur(14px)', y: 10 }, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.28, ease: 'power2.out' });
    await wait(0.22);
    await gsap.to(word, { opacity: 0, filter: 'blur(10px)', duration: 0.18 });
  }

  // 3. ABHISHEK letters fly together
  word.className = 'loader__word'; gsap.set(word, { opacity: 1, filter: 'blur(0px)', y: 0 });
  word.textContent = 'ABHISHEK';
  const chs = splitChars(word, 'chrome');
  Sound.whoosh(1, 0.09);
  await gsap.from(chs, {
    x: () => rand(-innerWidth * 0.4, innerWidth * 0.4), y: () => rand(-innerHeight * 0.35, innerHeight * 0.35),
    rotation: () => rand(-200, 200), scale: () => rand(0.2, 1.8), opacity: 0,
    duration: 1.1, ease: 'expo.out', stagger: { each: 0.05, from: 'random' },
  });
  await wait(0.45);

  // 4. ABHISHEK -> PORTFOLIO
  word.textContent = 'ABHISHEK'; word.classList.add('chrome');
  await scramble(word, 'PORTFOLIO', 0.9, () => Sound.tick());
  word.classList.remove('chrome'); const pchs = splitChars(word, 'chrome');
  Sound.chime();
  await Promise.all([Hero.ready, wait(0.5)]);

  // 5. PORTFOLIO glides into the hero, photo assembles
  const from = word.getBoundingClientRect(), to = heroH1.getBoundingClientRect();
  const sc = to.width / from.width;
  const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
  Sound.swoosh(1.2, 0.08);
  Hero.intro(3.4);
  gsap.to(count.parentElement, { opacity: 0, duration: 0.4 });
  gsap.to(loader, { backgroundColor: 'rgba(0,0,0,0)', duration: 1.4, ease: 'power2.inOut' });
  await gsap.to(word, { x: dx, y: dy, scale: sc, duration: 1.4, ease: 'expo.inOut' });
  gsap.set(heroH1, { opacity: 1 });
  loader.remove();
  heroUI();
}

/* ================= FLOATING FIGMA CURSORS ================= */
function wander(el, zone) {
  const hero = $('#hero');
  const go = () => {
    const w = hero.clientWidth, h = hero.clientHeight;
    gsap.to(el, { x: rand(zone[0], zone[1]) * w, y: rand(zone[2], zone[3]) * h, duration: rand(2.2, 3.8), ease: 'power1.inOut', onComplete: go });
  };
  gsap.set(el, { x: zone[0] * hero.clientWidth, y: zone[2] * hero.clientHeight }); go();
}
wander($('#fcA'), [0.08, 0.3, 0.3, 0.55]); wander($('#fcB'), [0.66, 0.86, 0.25, 0.5]);

/* ================= HERO SCROLL ================= */
gsap.to('.hero__name', { yPercent: -40, opacity: 0, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });

/* ================= INTRO ================= */
const words = splitWords($('#introBig'));
gsap.to(words, { opacity: 1, stagger: 0.08, ease: 'none', scrollTrigger: { trigger: '#introBig', start: 'top 80%', end: 'bottom 50%', scrub: true } });
$$('[data-count]').forEach(b => {
  const n = +b.dataset.count, o = { v: 0 };
  ScrollTrigger.create({ trigger: b, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: n, duration: 1.6, ease: 'power2.out', onUpdate: () => { b.textContent = Math.round(o.v); } }) });
});

/* ================= KEYBOARD (RANA / PAINTS) ================= */
const Keyboard = (() => {
  const kb = $('#kb');
  const K = (label, o = {}) => ({ label, ...o });
  const rows = [
    [K('esc', { w: 1.5, word: 'l', fn: 1 }), ...'F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12'.split(' ').map(f => K(f, { fn: 1, small: 1 })), K('', { fn: 1 })],
    [K('~`', { pair: 1 }), ...['!1', '@2', '#3', '$4', '%5', '^6', '&7', '*8', '(9', ')0', '_-', '+='].map(p => K(p, { pair: 1 })), K('delete', { w: 1.5, word: 'r' })],
    [K('tab', { w: 1.5, word: 'l' }), ...'RANA'.split('').map(l => K(l, { hl: 1 })), ...'TYUIOP'.split('').map(l => K(l)), K('{[', { pair: 1 }), K('}]', { pair: 1 }), K('|\\', { pair: 1 })],
    [K('caps lock', { w: 1.75, word: 'l' }), ...'PAINTS'.split('').map(l => K(l, { hl: 1 })), ...'JKL'.split('').map(l => K(l)), K(':;', { pair: 1 }), K('"\'', { pair: 1 }), K('return', { w: 1.75, word: 'r' })],
    [K('shift', { w: 2.25, word: 'l' }), ...'ZXCVBNM'.split('').map(l => K(l)), K('<,', { pair: 1 }), K('>.', { pair: 1 }), K('?/', { pair: 1 }), K('shift', { w: 2.25, word: 'r' })],
    [K('fn', { word: 'l' }), K('control', { word: 'l', sym: '⌃' }), K('option', { word: 'l', sym: '⌥' }), K('command', { w: 1.25, word: 'l', sym: '⌘' }), K('', { w: 5, space: 1 }), K('command', { w: 1.25, word: 'l', sym: '⌘' }), K('option', { word: 'l', sym: '⌥' }), K('◀'), K('▲▼', { pair: 1 }), K('▶')],
  ];
  const typeOrder = [];
  rows.forEach((row, ri) => {
    const r = document.createElement('div'); r.className = 'kb__row';
    row.forEach((k, ki) => {
      const el = document.createElement('div'); el.className = 'key' + (k.fn ? ' fn' : '') + (k.hl ? ' hl' : '');
      if (k.w) el.style.setProperty('--w', k.w);
      if (k.pair) el.innerHTML = `<span class="pair"><i>${k.label[0]}</i><i>${k.label.slice(1)}</i></span>`;
      else if (k.word) el.innerHTML = (k.sym ? `<small class="t">${k.sym}</small>` : '') + `<small class="${k.word === 'r' ? 'r' : ''}">${k.label}</small>`;
      else if (k.small) el.innerHTML = `<span style="font-size:calc(var(--u)*.17)">${k.label}</span>`;
      else el.innerHTML = `<span>${k.label}</span>`;
      el.dataset.label = k.label;
      if (k.hl) typeOrder.push(el);
      if (k.space) { el.dataset.space = 1; typeOrder.splice(4, 0, el); }
      const wide = (k.w || 1) >= 1.5;
      el.addEventListener('pointerdown', () => { el.classList.add('down'); Sound.thock(wide); });
      const up = () => el.classList.remove('down');
      el.addEventListener('pointerup', up); el.addEventListener('pointerleave', up);
      r.appendChild(el);
    });
    kb.appendChild(r);
  });
  // RANA, space, PAINTS order: hl keys are RANA then PAINTS; space inserted at index 4
  const spaceKey = $('[data-space]', kb);
  const seq = [...typeOrder.filter(k => !k.dataset.space)];
  seq.splice(4, 0, spaceKey);
  // map real keyboard letters to keys
  const byLetter = {};
  $$('.key', kb).forEach(k => { const l = k.dataset.label; if (l && l.length === 1) (byLetter[l] = byLetter[l] || []).push(k); });
  let inView = false, loopT;
  addEventListener('keydown', e => {
    if (!inView || e.repeat) return;
    const ks = e.key === ' ' ? [spaceKey] : byLetter[e.key.toUpperCase()];
    if (!ks) return; ks.forEach(k => k.classList.add('down')); Sound.thock(e.key === ' ');
    setTimeout(() => ks.forEach(k => k.classList.remove('down')), 140);
  });
  const typeAll = async () => {
    for (const k of seq) {
      if (!inView) return;
      k.classList.add('down'); Sound.thock(k === spaceKey);
      await wait(0.09); k.classList.remove('down'); await wait(rand(0.08, 0.18));
    }
  };
  const loop = async () => { await typeAll(); if (inView) loopT = gsap.delayedCall(2.8, loop); };
  new IntersectionObserver(([en]) => {
    const was = inView; inView = en.intersectionRatio > 0.5;
    if (inView && !was) { loopT && loopT.kill(); gsap.delayedCall(0.4, loop); }
  }, { threshold: [0, 0.5, 0.8] }).observe($('.jpanel--shop'));
})();

/* ================= CODE TYPING (full background) ================= */
(() => {
  const box = $('#codeIn');
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const LINES = [
    '// abhishek.rana — mohali, punjab',
    'import { gsap } from "gsap";',
    'import { WhatsApp } from "./contact";',
    '',
    'const client = { name: "your business", goal: "more customers" };',
    '',
    'export async function buildWebsite(client) {',
    '  const site = await design({ style: "premium", mobileFirst: true });',
    '  site.speed = "under 2 seconds";',
    '  site.seo = google.ready(client.name);',
    '  site.motion = gsap.timeline({ ease: "expo.out" });',
    '  site.contact = new WhatsApp("+91 98769 63879");',
    '  return deploy(site, { host: "github.io" });',
    '}',
    '',
    '// discipline from the road, trust from the shop',
    'while (!client.happy) {',
    '  iterate(site);',
    '  listen(client.feedback);',
    '}',
    '',
    'const live = await buildWebsite(client);',
    'console.log("Live at", live.url); // ✓ shipped',
    '',
  ];
  const hl = s => {
    if (/^\s*\/\//.test(s)) return `<span class="c">${esc(s)}</span>`;
    return esc(s)
      .replace(/(&quot;|")(.*?)\1/g, '<span class="s">"$2"</span>')
      .replace(/\b(import|from|const|export|async|function|await|return|new|while)\b/g, '<span class="k">$1</span>')
      .replace(/\b(\d+)\b(?![^<]*>)/g, '<span class="n">$1</span>');
  };
  let lineNo = 1, li = 0, running = false, cur = null, ci = 0, timer;
  const caret = '<span class="caret"></span>';
  const newLine = () => {
    cur = document.createElement('div'); box.appendChild(cur); ci = 0;
    while (box.children.length > 40) box.firstChild.remove();
  };
  const step = () => {
    if (!running) return;
    const text = LINES[li % LINES.length];
    if (!cur) newLine();
    if (ci <= text.length) {
      cur.innerHTML = `<span class="ln">${lineNo}</span>${hl(text.slice(0, ci))}${caret}`;
      ci += text.length ? Math.ceil(rand(1, 3)) : 1;
      if (ci % 3 === 0) Sound.tick();
      timer = setTimeout(step, rand(18, 55));
    } else {
      cur.innerHTML = `<span class="ln">${lineNo}</span>${hl(text)}`;
      lineNo++; li++; newLine(); timer = setTimeout(step, rand(80, 260));
    }
  };
  // pre-fill so the screen is never empty
  for (let i = 0; i < 18; i++) { const d = document.createElement('div'); d.innerHTML = `<span class="ln">${lineNo}</span>${hl(LINES[li % LINES.length])}`; box.appendChild(d); lineNo++; li++; }
  new IntersectionObserver(([en]) => {
    const was = running; running = en.isIntersecting;
    if (running && !was) step(); if (!running) clearTimeout(timer);
  }).observe($('.jpanel--code'));
})();

/* ================= JOURNEY ================= */
(() => {
  const mm = gsap.matchMedia();
  mm.add('(min-width: 761px)', () => {
    const track = $('#journeyTrack');
    const dist = () => track.scrollWidth - innerWidth;
    let lastPanel = -1;
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '#journey', pin: true, scrub: 1, end: () => '+=' + dist(), invalidateOnRefresh: true,
        onUpdate: s => {
          gsap.set('#journeyLine', { scaleX: s.progress });
          const p = Math.round(s.progress * 3); if (p !== lastPanel) { lastPanel = p; Sound.whoosh(0.6, 0.04, 400, 1800); }
        },
      },
    });
    $$('.jpanel__place').forEach(p => {
      gsap.fromTo(p, { xPercent: -30 }, { xPercent: -70, ease: 'none', scrollTrigger: { trigger: p.parentElement, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
    });
    gsap.fromTo('.jbg img', { xPercent: 6 }, { xPercent: -6, ease: 'none', scrollTrigger: { trigger: '.jpanel--road', containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
    gsap.fromTo('.kb', { rotateX: 55, rotateZ: -10, y: 60 }, { rotateX: 32, rotateZ: -4, y: -30, ease: 'none', scrollTrigger: { trigger: '.jpanel--shop', containerAnimation: tween, start: 'left right', end: 'center center', scrub: true } });
    $$('.jpanel__body').forEach(b => {
      gsap.from(b, { y: 60, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: b.parentElement, containerAnimation: tween, start: 'left 45%' } });
    });
  });
  mm.add('(max-width: 760px)', () => {
    $$('.jpanel__body').forEach(b => gsap.from(b, { y: 40, opacity: 0, duration: 1, scrollTrigger: { trigger: b, start: 'top 85%' } }));
  });
})();

/* ================= SERVICES ================= */
$$('.srow').forEach(r => {
  r.addEventListener('click', () => window.open('https://wa.me/919876963879?text=' + encodeURIComponent(r.dataset.msg), '_blank', 'noopener'));
  gsap.from(r, { y: 50, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: r, start: 'top 90%' } });
});

/* ================= WORK: 3D FLY-THROUGH ================= */
const PROJECTS = [
  { id: 'rana-paints', name: 'Rana Paints', cat: 'Paint & hardware store', tag: 'Brand site' },
  { id: 'rana-paints-shades', name: 'Rana Paints Shades', cat: '7,000+ real paint shades', tag: 'Catalogue + WhatsApp' },
  { id: 'slate-and-saffron', name: 'Slate & Saffron', cat: 'World veg recipes', tag: 'Content site' },
  { id: 'roast-and-ritual', name: 'Roast & Ritual', cat: 'Coffee across continents', tag: 'Cinematic scroll' },
  { id: 'starpath', name: 'StarPath', cat: 'Vedic astrology, live sky', tag: 'Web app' },
  { id: 'lift-lab', name: 'Lift Lab', cat: 'Gym diet & workout plans', tag: 'Fitness' },
  { id: 'drugy-drip', name: 'Drugy Drip', cat: 'Streetwear clothing brand', tag: 'E-commerce' },
  { id: 'DWONcars', name: 'DWON Cars', cat: 'Luxury car rental', tag: 'Booking site' },
];
(() => {
  const world = $('#workWorld'), N = PROJECTS.length;
  const cards = PROJECTS.map((p, i) => {
    const url = `https://abhishekrana0909.github.io/${p.id}/`;
    const el = document.createElement('div'); el.className = 'wcard'; el.dataset.cursor = 'Visit live';
    el.innerHTML = `<div class="wcard__in"><img src="images/work/${p.id}${small() ? '-s' : ''}.webp" alt="${p.name} website" loading="lazy"><span class="wcard__live">Live</span></div>
      <div class="wcard__info"><b>${String(i + 1).padStart(2, '0')} · ${p.name}</b><span>${p.tag}</span></div>
      <a href="${url}" target="_blank" rel="noopener" aria-label="Open ${p.name}"></a>`;
    world.appendChild(el); return { el, p, url, frame: null, timer: 0 };
  });
  let GAP, cw, active = -1;
  const layout = () => {
    cw = small() ? Math.min(innerWidth * 0.86, 520) : Math.min(innerWidth * 0.44, 780);
    GAP = small() ? 1000 : 1300;
    cards.forEach(c => c.el.style.setProperty('--cw', cw + 'px'));
    cards.forEach(c => { if (c.frame) c.frame.style.transform = `scale(${cw / 1440})`; });
  };
  layout(); addEventListener('resize', () => { layout(); update(st ? st.progress : 0); });

  const title = $('#workTitle'), cat = $('#workCat'), idx = $('#workIdx');
  const setActive = i => {
    if (i === active) return; active = i;
    gsap.killTweensOf([title, cat]);
    gsap.fromTo(title, { opacity: 0, y: 24, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'power3.out', onStart: () => { title.textContent = PROJECTS[i].name; } });
    gsap.fromTo(cat, { opacity: 0 }, { opacity: 1, duration: 0.6, delay: 0.1, onStart: () => { cat.textContent = PROJECTS[i].cat; } });
    idx.textContent = String(i + 1).padStart(2, '0');
    Sound.whoosh(0.45, 0.035, 600, 2400);
    if (small()) return;
    cards.forEach((c, j) => {
      clearTimeout(c.timer);
      if (j === i) c.timer = setTimeout(() => goLive(c), 650);
      else if (c.frame) { const f = c.frame; c.frame = null; c.el.classList.remove('is-live'); f.classList.remove('ready'); setTimeout(() => f.remove(), 600); }
    });
  };
  const goLive = c => {
    if (c.frame) return;
    const f = document.createElement('iframe'); f.className = 'wcard__frame'; f.loading = 'lazy'; f.tabIndex = -1;
    f.setAttribute('aria-hidden', 'true'); f.title = c.p.name + ' live preview';
    f.style.transform = `scale(${cw / 1440})`; f.src = c.url;
    f.onload = () => setTimeout(() => { if (c.frame === f) { f.classList.add('ready'); c.el.classList.add('is-live'); } }, 900);
    $('.wcard__in', c.el).appendChild(f); c.frame = f;
  };
  const update = prog => {
    const camZ = prog * (N - 1) * GAP;
    cards.forEach((c, i) => {
      const side = i % 2 ? 1 : -1;
      const rel = -i * GAP + camZ;
      const x = small() ? 0 : side * cw * 0.32 + innerWidth * 0.1;
      const y = small() ? 40 : side * -30 + 30;
      const ry = small() ? 0 : side * -10 * Math.min(1, Math.abs(rel) / GAP);
      let o = rel > 0 ? 1 - rel / 700 : 1 + rel / (GAP * 2.6);
      o = Math.max(0, Math.min(1, o));
      c.el.style.transform = `translate3d(${x}px,${y}px,${rel}px) rotateY(${ry}deg)`;
      c.el.style.opacity = o; c.el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
      c.el.style.pointerEvents = Math.abs(rel) < GAP * 0.4 ? 'auto' : 'none';
    });
    gsap.set('#workBar', { scaleX: prog });
    setActive(Math.min(N - 1, Math.round(prog * (N - 1))));
  };
  let st;
  st = ScrollTrigger.create({
    trigger: '#workStage', pin: true, start: 'top top', end: () => '+=' + innerHeight * N * 0.85, scrub: true,
    onUpdate: s => update(s.progress),
  });
  update(0);
})();

/* ================= PLAY: DOT MATRIX ================= */
(() => {
  const cv = $('#playCanvas'), ctx = cv.getContext('2d'), countEl = $('#playCount');
  let dots = [], W = 0, H = 0, dpr = 1, gap = 10, pushed = 0, running = false;
  const m = { x: -999, y: -999 };
  const build = () => {
    dpr = Math.min(devicePixelRatio, 2); W = cv.clientWidth; H = cv.clientHeight;
    if (!W || !H) { dots = []; setTimeout(build, 500); return; }
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gap = W < 600 ? 6 : W < 1000 ? 8 : 10;
    const off = document.createElement('canvas'); off.width = W; off.height = H; const o = off.getContext('2d');
    const lines = W < 600 ? ['SITES', 'THAT', 'SELL.'] : ['SITES THAT', 'SELL.'];
    let fs = Math.min(H / (lines.length * 0.98), 400);
    o.font = `900 ${fs}px Archivo`; const maxW = Math.max(...lines.map(l => o.measureText(l).width));
    if (maxW > W * 0.94) fs *= (W * 0.94) / maxW;
    o.font = `900 ${fs}px Archivo`; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#fff';
    const lh = fs * 0.92, top = H / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => o.fillText(l, W / 2, top + i * lh));
    const d = o.getImageData(0, 0, W, H).data; dots = [];
    for (let y = gap / 2; y < H; y += gap) for (let x = gap / 2; x < W; x += gap) {
      if (d[((y | 0) * W + (x | 0)) * 4 + 3] > 128) dots.push({ hx: x, hy: y, x, y, vx: 0, vy: 0, off: false });
    }
  };
  const tick = () => {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);
    const s = gap * 0.62, R = gap * 9;
    for (const p of dots) {
      const dx = p.x - m.x, dy = p.y - m.y, dd = dx * dx + dy * dy;
      if (dd < R * R) { const dist = Math.sqrt(dd) || 1, f = (1 - dist / R) * 2.4; p.vx += (dx / dist) * f; p.vy += (dy / dist) * f; }
      p.vx += (p.hx - p.x) * 0.05; p.vy += (p.hy - p.y) * 0.05; p.vx *= 0.84; p.vy *= 0.84;
      p.x += p.vx; p.y += p.vy;
      const disp = Math.abs(p.x - p.hx) + Math.abs(p.y - p.hy);
      if (disp > 6 && !p.off) { p.off = true; pushed++; } else if (disp < 1) p.off = false;
      const k = Math.min(1, disp / 40);
      ctx.fillStyle = k > 0.05 ? `rgb(255,${(240 - k * 118) | 0},${(235 - k * 209) | 0})` : '#efece6';
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    countEl.textContent = pushed.toLocaleString('en-IN');
    requestAnimationFrame(tick);
  };
  const pos = e => { const r = cv.getBoundingClientRect(); m.x = e.clientX - r.left; m.y = e.clientY - r.top; };
  cv.addEventListener('pointermove', pos);
  cv.addEventListener('pointerleave', () => { m.x = m.y = -999; });
  cv.addEventListener('pointerdown', e => {
    pos(e); Sound.whoosh(0.5, 0.08, 200, 1200);
    for (const p of dots) { const dx = p.x - m.x, dy = p.y - m.y, dist = Math.hypot(dx, dy) || 1; if (dist < 260) { const f = (1 - dist / 260) * 34; p.vx += (dx / dist) * f + rand(-3, 3); p.vy += (dy / dist) * f + rand(-3, 3); } }
  });
  document.fonts.ready.then(() => { build(); new IntersectionObserver(([en]) => { const was = running; running = en.isIntersecting; if (running && !was) tick(); }).observe(cv); });
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 200); });
})();

/* ================= CONTACT ================= */
gsap.from('.contact__big', { y: 80, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.contact', start: 'top 75%', onEnter: () => Sound.chime() } });
gsap.from('.cbtn', { y: 30, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out', scrollTrigger: { trigger: '.contact__btns', start: 'top 92%' } });
if (!touch) $$('.magnet').forEach(b => {
  b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * 0.3, y: (e.clientY - r.top - r.height / 2) * 0.4, duration: 0.4 }); });
  b.addEventListener('pointerleave', () => gsap.to(b, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1,0.4)' }));
});

/* ================= SCROLL PROGRESS: back-to-top ring + nav line ================= */
(() => {
  const btn = $('#toTop'), ring = $('#toTopRing'), C = 2 * Math.PI * 27;
  const nav = $('#nav'), fill = $('#navFill'), dot = $('#navDot'), track = $('.nav__track');
  const links = $$('.nav__links a');
  const ids = links.map(a => a.getAttribute('href'));
  let starts = [], centers = [];
  const measure = () => {
    starts = ids.map(id => { const el = $(id); const sp = el.closest('.pin-spacer') || el; return sp.getBoundingClientRect().top + scrollY; });
    const tr = track.getBoundingClientRect();
    centers = links.map(a => { const r = a.getBoundingClientRect(); return (r.left + r.width / 2 - tr.left) / tr.width; });
  };
  ScrollTrigger.addEventListener('refresh', measure);
  addEventListener('resize', measure);
  btn.addEventListener('click', () => { Sound.swoosh(1, 0.08); lenis.scrollTo(0, { duration: 2 }); });
  let lastActive = -2;
  const update = () => {
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight, p = max > 0 ? y / max : 0;
    ring.style.strokeDashoffset = C * (1 - p);
    btn.classList.toggle('show', y > innerHeight * 0.8);
    nav.classList.toggle('solid', y > 40);
    if (!starts.length) measure();
    const off = innerHeight * 0.4;
    let f;
    if (y + off < starts[0]) f = centers[0] * Math.max(0, (y + off) / starts[0]);
    else {
      let i = starts.length - 1; while (i > 0 && y + off < starts[i]) i--;
      if (i < starts.length - 1) f = centers[i] + (centers[i + 1] - centers[i]) * ((y + off - starts[i]) / (starts[i + 1] - starts[i]));
      else f = centers[i] + (1 - centers[i]) * Math.min(1, (y + off - starts[i]) / Math.max(1, max + off - starts[i]));
    }
    f = Math.max(0, Math.min(1, f));
    fill.style.transform = `scaleX(${f})`; dot.style.left = (f * 100) + '%';
    let a = -1; starts.forEach((s, i) => { if (y + off >= s) a = i; });
    if (a !== lastActive) { lastActive = a; links.forEach((l, i) => l.classList.toggle('active', i === a)); }
  };
  lenis.on('scroll', update); addEventListener('scroll', update, { passive: true });
  ScrollTrigger.addEventListener('refresh', update);
})();

/* ================= CLOCK ================= */
const fmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
const tickClock = () => { $('#clock').textContent = fmt.format(new Date()); };
tickClock(); setInterval(tickClock, 15000);

document.fonts.ready.then(() => ScrollTrigger.refresh());
runLoader();
