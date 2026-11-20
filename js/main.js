import * as THREE from 'three';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const touch = matchMedia('(hover:none),(pointer:coarse)').matches;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = () => innerWidth < 761;
const rand = (a, b) => a + Math.random() * (b - a);
const wait = s => new Promise(r => gsap.delayedCall(s, r));
gsap.registerPlugin(ScrollTrigger);

/* ================= SOUND (WebAudio, no files) =================
   Only two places make sound: the intro name typing and the 8 website slides. */
const Sound = (() => {
  let ctx, out, master, noise, on = true, keys = null, lastKey = -1;
  // sprite: 7 keystrokes sliced from Mixkit "Typing on an electronic device" (KEY_SLOT s each),
  // then Mixkit "Sci Fi confirmation" at CONF_AT for CONF_LEN s (played once, after PORTFOLIO is typed)
  const KEY_SLOT = 0.12, KEY_N = 7, CONF_AT = 0.84, CONF_LEN = 1.1;
  // one-shot effects (Mixkit, trimmed): name -> buffer. Peaks: fall .256s, impact .932s, dust .03s, gather 1.439s, snap .088s, slide .226s
  const FX = ['fall', 'impact', 'dust', 'gather', 'snap', 'slide'], fxBuf = {};
  const fxData = Object.fromEntries(FX.map(n => [n, fetch(`audio/fx/${n}.mp3?v=1`).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null)]));
  const keyData = fetch('audio/type-hud.wav?v=1').then(r => r.ok ? r.arrayBuffer() : null).catch(() => null);
  const init = () => {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = on ? 1 : 0;
    out = comp; comp.connect(master).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    keyData.then(b => b && new Promise((res, rej) => ctx.decodeAudioData(b, res, rej))).then(buf => { if (buf) keys = buf; }).catch(() => {});
    FX.forEach(n => fxData[n].then(b => b && new Promise((res, rej) => ctx.decodeAudioData(b, res, rej))).then(buf => { if (buf) fxBuf[n] = buf; }).catch(() => {}));
  };
  const playPart = (at, len, v, rate = 1) => {
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = keys; s.playbackRate.value = rate; g.gain.value = v;
    s.connect(g).connect(out); s.start(ctx.currentTime + 0.002, at, len);
  };
  const playKey = i => playPart(i * KEY_SLOT, KEY_SLOT, 0.6, 0.97 + Math.random() * 0.06);
  const ok = () => on && ctx && ctx.state === 'running';
  const osc = (type, f, t, d, v, f2) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.03);
  };
  const nz = (type, f, t, d, v, q = 1, f2 = 0) => {
    const src = ctx.createBufferSource(); src.buffer = noise;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + d);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + Math.min(0.12, d * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(fl).connect(g).connect(out); src.start(t, Math.random() * 0.5, d + 0.05);
  };
  return {
    get on() { return on; },
    unlock() { init(); if (ctx.state !== 'running') ctx.resume(); },
    enable(v) {
      on = v; init(); ctx.resume();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(v ? 1 : 0, ctx.currentTime + 0.2);
      return on;
    },
    // robotic, computer-terminal key
    type(final = false) {
      if (!ok()) return;
      if (keys) {
        let i; do { i = (Math.random() * KEY_N) | 0; } while (i === lastKey); lastKey = i;
        playKey(i); return;
      }
      const t = ctx.currentTime + 0.002, f = [880, 988, 1175, 1319, 1480][(Math.random() * 5) | 0];
      osc('square', f, t, 0.045, 0.045);
      osc('sine', f * 2.01, t, 0.03, 0.02);
      nz('highpass', 5200, t, 0.012, 0.09, 0.7);
      nz('bandpass', 1800, t + 0.004, 0.03, 0.05, 6);
      if (final) { osc('square', 220, t + 0.02, 0.12, 0.03, 110); osc('sine', 1760, t + 0.03, 0.25, 0.02); }
    },
    fx(name, vol = 0.8) {
      if (!ok() || !fxBuf[name]) return;
      const src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = fxBuf[name]; g.gain.value = vol;
      src.connect(g).connect(out); src.start(ctx.currentTime + 0.002);
    },
    // once, when PORTFOLIO is fully typed
    confirm() { if (ok() && keys) playPart(CONF_AT, CONF_LEN, 0.55); },
    slide() {
      if (!ok()) return;
      const t = ctx.currentTime + 0.002;
      nz('bandpass', 500, t, 0.45, 0.06, 1.2, 2600);   // whoosh only (the two beeps were removed on request)
    },
  };
})();

const soundBtn = $('#soundBtn');
const setSoundUI = on => { soundBtn.classList.toggle('on', on); soundBtn.setAttribute('aria-pressed', on); $('#soundLabel').textContent = on ? 'Sound on' : 'Sound off'; };
setSoundUI(true);
soundBtn.addEventListener('click', () => setSoundUI(Sound.enable(!Sound.on)));
['pointerdown', 'keydown', 'touchend'].forEach(ev => addEventListener(ev, () => Sound.unlock(), { passive: true }));

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
  if (el === null) return; e.preventDefault(); lenis.scrollTo(el, { duration: 1.6 });
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
    uMouse: { value: new THREE.Vector2(9, 9) }, uVel: { value: new THREE.Vector2() }, uMouseStr: { value: 0 }, uSize: { value: 10 }, uPR: { value: pr },
  };
  const vert = `
    uniform float uTime,uIntro,uScatter,uSize,uPR,uMouseStr; uniform vec2 uMouse,uVel;
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
      float f = smoothstep(0.1, 0.0, dist) * uMouseStr * t;
      vec2 swirl = vec2(sin(aSeed*91. + uTime*4.), cos(aSeed*57. + uTime*3.3));
      p.xy += (normalize(d + 1e-5) * 0.035 + swirl * 0.05 * aSeed + uVel * (0.4 + aSeed*1.6)) * f;
      p.z += f * (0.15 + aSeed*0.9);
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
      gl_FragColor = vec4(col * (1. + vHole*0.6), a * (0.3 + vLum*0.7) * (0.15 + 0.85*vA));
    }`;
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, depthTest: false, blending: THREE.NormalBlending });
  const group = new THREE.Group(); scene.add(group);
  let points, rows = 1, aspectImg = 0.73;


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
  const fadeMask = () => {
    const hr = section.getBoundingClientRect(), tr = $('#heroName').getBoundingClientRect();
    const a = tr.top - hr.top + tr.height * 0.35, b = tr.bottom - hr.top + 4;
    const m = `linear-gradient(180deg,#000 0px,#000 ${a}px,transparent ${b}px)`;
    canvas.style.webkitMaskImage = m; canvas.style.maskImage = m;
  };
  document.fonts.ready.then(fadeMask); addEventListener('resize', fadeMask); fadeMask();

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
    const px = cur.x, py = cur.y; cur.lerp(target, 0.18); uniforms.uMouse.value.copy(cur);
    const v = uniforms.uVel.value; v.x += ((cur.x - px) * 3 - v.x) * 0.2; v.y += ((cur.y - py) * 3 - v.y) * 0.2; v.clampLength(0, 0.12);
    uniforms.uMouseStr.value += (strT - uniforms.uMouseStr.value) * 0.06;
    group.rotation.y = (mouse.x / innerWidth - 0.5) * 0.1; group.rotation.x = (mouse.y / innerHeight - 0.5) * -0.04;
    renderer.render(scene, camera);
  });

  if (reduce) gsap.to(uniforms.uScatter, { value: 1, ease: 'none', scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', scrub: true } });
  return {
    ready,
    intro(d = 3.4) { gsap.fromTo(uniforms.uIntro, { value: reduce ? 1 : 0 }, { value: 1, duration: reduce ? 0.01 : d, ease: 'none' }); },
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
gsap.set(['.hero__sub', '.hero__top', '.hero__hint'], { opacity: 0 });
gsap.set('#dock', { opacity: 0, y: 24 });

function heroUI() {
  gsap.to(['.hero__sub', '.hero__top', '.hero__hint'], { opacity: 1, duration: 1, delay: 0.6, stagger: 0.12 });
  gsap.to('#dock', { opacity: 1, y: 0, duration: 0.9, delay: 1, ease: 'expo.out' });
  document.body.classList.remove('is-loading');
  lenis.start(); ScrollTrigger.sort(); ScrollTrigger.refresh();
  Dust.arm();
}

const ROBO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*/<>';

async function typeLetter(span, ch, final = false) {
  span.style.opacity = 1;
  for (let k = 0; k < 2; k++) { span.textContent = ROBO[(Math.random() * ROBO.length) | 0]; await wait(0.03); }
  span.textContent = ch; Sound.type(final);
  gsap.fromTo(span, { filter: 'brightness(2.2)' }, { filter: 'brightness(1)', duration: 0.35 });
}

/* dust kicked up where the letters land: a short-lived canvas of soft grains and puffs */
function dustBurst(parent, points, fs) {
  const cv = document.createElement('canvas'), dpr = Math.min(devicePixelRatio, 2), W = innerWidth, H = innerHeight;
  cv.className = 'dust-burst'; cv.width = W * dpr; cv.height = H * dpr; parent.appendChild(cv);
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  // one soft dot, drawn once and stamped per particle (much cheaper than a gradient per particle per frame)
  const dot = document.createElement('canvas'); dot.width = dot.height = 64;
  const dc = dot.getContext('2d'), dg = dc.createRadialGradient(32, 32, 0, 32, 32, 32);
  dg.addColorStop(0, 'rgba(214,206,194,1)'); dg.addColorStop(1, 'rgba(214,206,194,0)'); dc.fillStyle = dg; dc.fillRect(0, 0, 64, 64);
  const ps = [];
  points.forEach(([x, y]) => {
    for (let k = 0; k < 34; k++) {                                   // grains
      const dir = Math.random() < 0.5 ? -1 : 1;
      ps.push({ x: x + rand(-fs * 0.2, fs * 0.2), y, vx: dir * rand(40, 300), vy: -rand(30, 230), r: rand(0.8, 2.6), life: rand(0.6, 1.4), t: 0, a: rand(0.5, 0.9), g: 260 });
    }
    for (let k = 0; k < 5; k++)                                       // soft clouds
      ps.push({ x: x + rand(-fs * 0.3, fs * 0.3), y: y - rand(0, fs * 0.15), vx: rand(-60, 60), vy: -rand(10, 50), r: rand(fs * 0.15, fs * 0.3), grow: rand(fs * 0.5, fs * 1.1), life: rand(1, 1.7), t: 0, a: rand(0.12, 0.22), g: 0, cloud: true });
  });
  let last = performance.now();
  const step = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    c.clearRect(0, 0, W, H); let alive = 0;
    for (const p of ps) {
      p.t += dt; if (p.t >= p.life) continue; alive++;
      p.vx *= 1 - dt * 2.2; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const k = 1 - p.t / p.life, r = p.cloud ? p.r + p.grow * (1 - k) : p.r;
      c.globalAlpha = p.a * k; c.drawImage(dot, p.x - r, p.y - r, r * 2, r * 2);
    }
    c.globalAlpha = 1;
    if (alive) requestAnimationFrame(step); else cv.remove();
  };
  requestAnimationFrame(step);
}
function shake(el, amp, n = 9) {
  const tl = gsap.timeline();
  for (let k = 0; k < n; k++) { const a = amp * (1 - k / n); tl.to(el, { x: rand(-a, a), y: rand(-a, a), duration: 0.045, ease: 'none' }); }
  return tl.to(el, { x: 0, y: 0, duration: 0.08 });
}

async function runLoader() {
  const loader = $('#loader'), word = $('#loaderWord'), glow = $('.loader__glow'), count = $('#loaderCount');
  const gate = $('#gate');
  if (reduce) { loader.remove(); gsap.set(heroH1, { opacity: 1 }); await Hero.ready; Hero.intro(); heroUI(); return; }

  // click to enter (browsers only allow sound after a click)
  gsap.fromTo(glow, { scale: 0 }, { scale: 1, duration: 0.8, ease: 'back.out(3)' });
  gsap.to(glow, { scale: 1.35, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.from(gate, { opacity: 0, y: 10, duration: 0.8, delay: 0.3 });
  await new Promise(res => {
    const go = withSound => { setSoundUI(Sound.enable(withSound)); res(); };
    $('#enterSound').addEventListener('click', () => go(true), { once: true });
    $('#enterMute').addEventListener('click', e => { e.stopPropagation(); go(false); }, { once: true });
    const kd = e => { if (e.key === 'Enter') { removeEventListener('keydown', kd); go(true); } }; addEventListener('keydown', kd);
  });
  gsap.killTweensOf(glow);
  gsap.to(gate, { opacity: 0, duration: 0.25, onComplete: () => gate.remove() });
  const c = { v: 0 };
  gsap.to(c, { v: 100, duration: 6, ease: 'power1.inOut', onUpdate: () => { count.textContent = String(Math.round(c.v)).padStart(3, '0'); } });

  // 1. ABHISHEK drops in all at once, scattered and tilted; dust + shake on landing; then the letters pull back into the word
  gsap.to(glow, { scale: 0.3, opacity: 0, duration: 0.4 });
  word.className = 'loader__word name'; gsap.set(word, { opacity: 1, filter: 'none' });
  word.textContent = 'ABHISHEK';
  const chs = splitChars(word, 'chrome');
  chs.forEach(s => { s.style.opacity = 0; });
  await Promise.race([document.fonts.load(getComputedStyle(word).font, 'ABHISHEK').catch(() => {}), wait(0.8)]);
  const fs = parseFloat(getComputedStyle(word).fontSize), W = innerWidth, H = innerHeight, n = chs.length;
  const rects = chs.map(s => s.getBoundingClientRect());
  const mob = W < 761, floorY = mob ? H * 0.68 : Math.min(H * 0.78, rects[0].top + rects[0].height / 2 + fs * 1.4);        // where the letters come to rest
  const slots = gsap.utils.shuffle([...Array(n).keys()]), spanW = mob ? W * 0.94 : Math.min(W * 0.86, fs * 5.6);
  const land = chs.map((s, i) => {
    const r = rects[i], cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const lx = W / 2 - spanW / 2 + (slots[i] + 0.5) * spanW / n + rand(-fs * 0.12, fs * 0.12);
    return { x: lx - cx, y: floorY - cy + rand(-fs * 0.06, fs * 0.06), rot: (Math.random() < 0.5 ? -1 : 1) * rand(10, 80) };
  });
  Sound.fx('impact', 0.9);                                    // its build-up peaks 0.93 s in: on the landing
  await wait(0.28);
  Sound.fx('fall', 0.55);
  chs.forEach((s, i) => {
    s.style.opacity = 1;
    gsap.fromTo(s, { x: land[i].x + rand(-W * 0.12, W * 0.12), y: -rects[i].bottom - rand(60, H * 0.45), rotation: rand(-200, 200) },
      { x: land[i].x, y: land[i].y, rotation: land[i].rot, duration: 0.65, ease: 'power2.in' });   // same time for all: they land together
  });
  await wait(0.65);
  Sound.fx('dust', 0.75);
  dustBurst(loader, chs.map((s, i) => [rects[i].left + rects[i].width / 2 + land[i].x, floorY + fs * 0.32]), fs);
  shake(loader, Math.min(22, fs * 0.1));
  chs.forEach((s, i) => gsap.to(s, { keyframes: [
    { y: land[i].y - rand(fs * 0.1, fs * 0.28), rotation: land[i].rot + rand(-10, 10), duration: 0.14, ease: 'power2.out' },
    { y: land[i].y, rotation: land[i].rot, duration: 0.32, ease: 'bounce.out' }] }));
  await wait(0.7);
  // 2. the letters lift and swirl home, centre first; the swirl sound peaks as the last one locks
  Sound.fx('gather', 0.7);
  await wait(0.19);
  const homeOrder = [3, 4, 2, 5, 1, 6, 0, 7], tl = gsap.timeline();
  chs.forEach((s, i) => {
    const d = homeOrder.indexOf(i) * 0.05;
    tl.to(s, { y: land[i].y - fs * 0.55, x: land[i].x * 0.85, rotation: land[i].rot * 0.4, duration: 0.3, ease: 'power2.out' }, d)
      .to(s, { x: 0, y: 0, rotation: 0, duration: 0.6, ease: 'expo.inOut' }, d + 0.3);
  });
  gsap.delayedCall(tl.duration() - 0.09, () => Sound.fx('snap', 0.55));   // the clank's peak on the lock
  await tl;
  shake(word, fs * 0.04, 5);
  gsap.fromTo(chs, { filter: 'brightness(2.6)' }, { filter: 'brightness(1)', duration: 0.5, stagger: 0.02 });
  await wait(0.45);

  // 3. keep only the I, it slides to PORTFOLIO's I
  const iOld = chs[3], x0 = iOld.getBoundingClientRect().left;
  await gsap.to(chs.filter((_, i) => i !== 3), { opacity: 0, y: () => rand(-14, 14), filter: 'blur(6px)', duration: 0.35, stagger: 0.03 });
  word.textContent = 'PORTFOLIO';
  const pchs = splitChars(word, 'chrome');
  pchs.forEach((s, i) => { if (i !== 7) s.style.opacity = 0; });
  const x1 = pchs[7].getBoundingClientRect().left;
  gsap.set(pchs[7], { x: x0 - x1 });
  gsap.delayedCall(0.15, () => Sound.fx('slide', 0.6));   // sweep peaks mid-slide
  await gsap.to(pchs[7], { x: 0, duration: 0.75, ease: 'expo.inOut' });

  // 4. the rest of PORTFOLIO types in around the I
  const order = [0, 1, 2, 3, 4, 5, 6, 8];
  for (let k = 0; k < order.length; k++) { await typeLetter(pchs[order[k]], 'PORTFOLIO'[order[k]], k === order.length - 1); await wait(0.04); }
  await wait(0.1); Sound.confirm();   // typing done: one sci-fi confirmation
  await Promise.all([Hero.ready, wait(0.45)]);

  // 5. PORTFOLIO glides into the hero, photo assembles
  const from = word.getBoundingClientRect(), to = heroH1.getBoundingClientRect();
  const sc = to.width / from.width;
  const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
  Hero.intro(3.2);
  gsap.to(count.parentElement, { opacity: 0, duration: 0.4 });
  gsap.to(loader, { backgroundColor: 'rgba(0,0,0,0)', duration: 1.3, ease: 'power2.inOut' });
  await gsap.to(word, { x: dx, y: dy, scale: sc, duration: 1.3, ease: 'expo.inOut' });
  gsap.set(heroH1, { opacity: 1 });
  loader.remove();
  heroUI();
}

/* hero scroll-out is driven by Dust (below): the word and the photo turn into dust */

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
    if (!ks) return; ks.forEach(k => k.classList.add('down'));
    setTimeout(() => ks.forEach(k => k.classList.remove('down')), 140);
  });
  const typeAll = async () => {
    for (const k of seq) {
      if (!inView) return;
      k.classList.add('down');
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

/* ================= DUST: PORTFOLIO + photo blow away, gather into "Three roads." =================
   A fixed overlay of points in screen px. Each point starts on a pixel of the hero (PORTFOLIO glyphs or the photo),
   blows up into a faint cloud while the hero scrolls out (e1), floats behind the intro, then swirls into a pixel of
   the Journey title as it arrives (e3). Everything is a function of scrollY, so scrolling up plays it backwards. */
const Dust = (() => {
  if (reduce) return { arm() {} };
  const hero = $('#hero'), heroCanvas = $('#heroCanvas'), heroSub = $('.hero__sub');
  const title = $('.jpanel--intro .jpanel__title'), journey = $('#journey'), track = $('#journeyTrack');
  const cv = document.createElement('canvas'); cv.className = 'dust'; cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: false, powerPreference: 'high-performance' }); }
  catch (e) { cv.remove(); return { arm() {} }; }
  const pr = Math.min(devicePixelRatio, 1.5); renderer.setPixelRatio(pr);
  const scene = new THREE.Scene(), camera = new THREE.Camera();
  const U = { uScroll: { value: 0 }, uPin: { value: 1e9 }, uE1: { value: 0 }, uE3: { value: 0 }, uTime: { value: 0 }, uOut: { value: 1 },
    uRes: { value: new THREE.Vector2(1, 1) }, uPR: { value: pr } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: `
      uniform float uScroll,uPin,uE1,uE3,uTime,uPR; uniform vec2 uRes;
      attribute vec2 aTgt, aCloud; attribute vec4 aRnd; attribute vec3 aC0, aC1; attribute float aSize;
      varying vec3 vCol; varying float vA;
      float ease(float x){ return x*x*(3.-2.*x); }
      void main(){
        vec2 s = position.xy - vec2(0., uScroll);                       // on the hero, moving up with the page
        float k1 = ease(clamp((uE1 - aRnd.x*0.35) / 0.65, 0., 1.));     // staggered break-up
        vec2 cloud = aCloud + vec2(sin(uTime*.25 + aRnd.z*20.)*26., cos(uTime*.21 + aRnd.w*17.)*20.);
        vec2 wind = vec2((aRnd.y - .5)*320. + sin(uTime*.8 + aRnd.z*30.)*30., -140. - aRnd.w*300.) * sin(3.14159*k1);
        vec2 p = mix(s, cloud, k1) + wind;
        float k3 = ease(clamp((uE3 - (1. - aRnd.x)*0.3) / 0.7, 0., 1.)); // staggered gathering
        vec2 t = aTgt - vec2(0., min(uScroll, uPin));                     // the title, moving with its section
        float an = aRnd.z*6.2832 + k3*4.;
        vec2 swirl = vec2(cos(an), sin(an)) * (60. + aRnd.y*160.) * sin(3.14159*k3);
        p = mix(p, t, k3) + swirl;
        gl_Position = vec4(p.x / uRes.x * 2. - 1., 1. - p.y / uRes.y * 2., 0., 1.);
        gl_PointSize = aSize * uPR * (1. + 0.35*sin(3.14159*k1));
        vCol = mix(aC0, aC1, k3);
        vA = mix(mix(1., .3, k1), 1., k3);
      }`,
    fragmentShader: `
      uniform float uOut; varying vec3 vCol; varying float vA;
      void main(){ vec2 c = gl_PointCoord - .5; float r = length(c); if (r > .5) discard;
        gl_FragColor = vec4(vCol, smoothstep(.5, .15, r) * vA * uOut); }`,
  });
  let points = null, armed = false, active = false, H = 1, e1a = 0, e1b = 1, e3a = 0, e3b = 1, lastE1 = 0;

  const photo = new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'images/abhishek-p.png'; });
  // chrome gradient of the hero word (.chrome), as a grey value 0..1 down the glyph
  const CHROME = [[0, 1], [.2, .95], [.4, .81], [.56, .57], [.68, .66], [.86, .9], [1, 1]];
  const chrome = t => { for (let i = 1; i < CHROME.length; i++) if (t <= CHROME[i][0]) { const [a, va] = CHROME[i - 1], [b, vb] = CHROME[i]; return va + (vb - va) * (t - a) / (b - a); } return 1; };
  const rgb = s => (s.match(/[\d.]+/g) || [255, 255, 255]).slice(0, 3).map(v => v / 255);

  // every visible pixel of the given characters, in viewport px: [{x, y, ch: {top, h}, col}]
  function glyphPixels(chars, step) {
    let L = 1e9, T = 1e9, R = -1e9, B = -1e9;
    chars.forEach(c => { L = Math.min(L, c.r.left); T = Math.min(T, c.r.top); R = Math.max(R, c.r.right); B = Math.max(B, c.r.bottom); });
    const pad = 20, w = Math.ceil(R - L) + pad * 2, h = Math.ceil(B - T) + pad * 2;
    if (!isFinite(w) || w < 2 || h < 2) return [];
    const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
    const x = c2.getContext('2d', { willReadFrequently: true });
    const out = [], owner = new Int16Array(w * h).fill(-1);
    chars.forEach((c, i) => {
      x.font = c.font; if ('fontStretch' in x) x.fontStretch = c.stretch;
      const m = x.measureText(c.t), asc = m.fontBoundingBoxAscent || c.r.height * .8, desc = m.fontBoundingBoxDescent || c.r.height * .2;
      const base = c.r.top - T + pad + (c.r.height - (asc + desc)) / 2 + asc;
      x.clearRect(0, 0, w, h); x.fillText(c.t, c.r.left - L + pad, base);
      const d = x.getImageData(0, 0, w, h).data;
      for (let yy = 0; yy < h; yy += step) for (let xx = 0; xx < w; xx += step)
        if (d[(yy * w + xx) * 4 + 3] > 140) out.push({ x: xx + L - pad, y: yy + T - pad, c });
    });
    return out;
  }
  const charsOf = (root, fn) => {
    const list = [], walk = n => {
      if (n.nodeType === 3) {
        const st = getComputedStyle(n.parentElement);
        for (let i = 0; i < n.length; i++) {
          const t = n.data[i]; if (!t.trim()) continue;
          const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1);
          const r = rg.getBoundingClientRect(); if (!r.width) continue;
          list.push({ t, r: fn ? fn(r) : r, font: `${st.fontStyle} ${st.fontWeight} ${st.fontSize} ${st.fontFamily}`,
            stretch: /wdth"?\s*12\d/.test(st.fontVariationSettings) ? 'expanded' : 'normal', col: rgb(st.color) });
        }
      } else n.childNodes.forEach(walk);
    };
    walk(root); return list;
  };

  async function build() {
    const im = await photo; await document.fonts.ready;
    const W = innerWidth, VH = innerHeight, sm = small(), sy = scrollY;
    H = hero.offsetHeight; const heroTop = hero.getBoundingClientRect().top + sy;
    const h1 = $('#heroName'), h1r = h1.getBoundingClientRect();
    // --- start points (page coords at scroll 0) ---
    const S = [], C0 = [], SZ = [];
    const word = glyphPixels(charsOf(h1, r => ({ left: r.left, right: r.right, top: r.top + sy - heroTop, bottom: r.bottom + sy - heroTop, height: r.height })), sm ? 3 : 2);
    const nWord = sm ? 2600 : 5200;
    for (let i = 0; i < nWord && word.length; i++) {
      const p = word[(Math.random() * word.length) | 0], g = chrome(Math.min(1, Math.max(0, (p.y - p.c.r.top) / p.c.r.height)));
      S.push(p.x + Math.random() * 2 - 1, p.y + heroTop + Math.random() * 2 - 1); C0.push(g, g, g); SZ.push(sm ? 2.2 : 2.4);
    }
    if (im) {
      const iw = im.width, ih = im.height, asp = iw / ih, Wh = hero.clientWidth, Hh = hero.clientHeight;
      const ph = Math.min(0.9 * Hh, 0.96 * Wh / asp), pw = ph * asp, left = (Wh - pw) / 2, top = Hh - ph;
      const cut = h1r.bottom + sy - heroTop;                          // the photo is masked out below the word
      const c2 = document.createElement('canvas'); c2.width = iw; c2.height = ih;
      const x = c2.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, iw, ih).data, step = sm ? 6 : 4;
      for (let yy = 0; yy < ih; yy += step) for (let xx = 0; xx < iw; xx += step) {
        const k = (yy * iw + xx) * 4; if (d[k + 3] < 120) continue;
        const l = Math.min(1, 0.04 + (d[k] * .3 + d[k + 1] * .59 + d[k + 2] * .11) / 255 * 1.05);
        if (Math.random() > 0.35 + l * 0.65) continue;                // dark pixels are mostly invisible on the hero too
        const px = left + ((xx + Math.random() * step) / iw) * pw, py = top + ((yy + Math.random() * step) / ih) * ph;   // jitter: no grid
        if (py > cut) continue;
        S.push(px, py + heroTop); const g = Math.pow(l, .85) * .9; C0.push(g, g, g); SZ.push(sm ? 2 : 2.1);
      }
    }
    const N = S.length / 2; if (!N) return;
    // --- target: the Journey title, document coords at the moment it settles ---
    const jt = ScrollTrigger.getAll().find(t => t.pin === journey);
    const tx = track.getBoundingClientRect().left;                    // undo the horizontal scroll, if any
    let tOff, endScroll;
    if (jt) { tOff = jt.start - journey.getBoundingClientRect().top; endScroll = jt.start; U.uPin.value = jt.start; }
    else { const r = title.getBoundingClientRect(); endScroll = r.top + sy - VH * 0.32; tOff = sy; U.uPin.value = 1e9; }
    const tgt = glyphPixels(charsOf(title, r => ({ left: r.left - tx, right: r.right - tx, top: r.top + tOff, bottom: r.bottom + tOff, height: r.height })), sm ? 2 : 2);
    const A = new Float32Array(N * 2), CL = new Float32Array(N * 2), R4 = new Float32Array(N * 4), C1 = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const p = tgt.length ? tgt[(Math.random() * tgt.length) | 0] : { x: W / 2, y: endScroll + VH / 2, c: { col: [1, 1, 1] } };
      A[i * 2] = p.x; A[i * 2 + 1] = p.y; C1.set(p.c.col, i * 3);
      CL[i * 2] = W * (0.04 + Math.random() * 0.92); CL[i * 2 + 1] = VH * (0.08 + Math.pow(Math.random(), 1.2) * 0.84);
      R4[i * 4] = Math.random(); R4[i * 4 + 1] = Math.random(); R4[i * 4 + 2] = Math.random(); R4[i * 4 + 3] = Math.random();
    }
    const g = new THREE.BufferGeometry(), pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = S[i * 2]; pos[i * 3 + 1] = S[i * 2 + 1]; }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aTgt', new THREE.BufferAttribute(A, 2)); g.setAttribute('aCloud', new THREE.BufferAttribute(CL, 2));
    g.setAttribute('aRnd', new THREE.BufferAttribute(R4, 4)); g.setAttribute('aC0', new THREE.Float32BufferAttribute(C0, 3));
    g.setAttribute('aC1', new THREE.BufferAttribute(C1, 3)); g.setAttribute('aSize', new THREE.Float32BufferAttribute(SZ, 1));
    if (points) { scene.remove(points); points.geometry.dispose(); }
    points = new THREE.Points(g, mat); points.frustumCulled = false; scene.add(points);
    renderer.setSize(W, VH, false); U.uRes.value.set(W, VH);
    e1a = heroTop + H * 0.03; e1b = heroTop + H * 0.78;
    e3b = endScroll; e3a = Math.max(e1b, endScroll - VH * 0.95);
  }
  let pending = null;
  const rebuild = () => { clearTimeout(pending); pending = setTimeout(() => build().then(tick), 60); };
  ScrollTrigger.addEventListener('refresh', () => { if (armed) rebuild(); });

  const clamp01 = v => Math.max(0, Math.min(1, v));
  function tick() {
    if (!armed || !points) return;
    const y = scrollY, e1 = clamp01((y - e1a) / (e1b - e1a)), e3 = clamp01((y - e3a) / (e3b - e3a));
    if (e1 > 0 || lastE1 > 0) {                                         // (at the top, leave the intro's own fades alone)
      const fade = clamp01(e1 / 0.06);                                  // hand the hero over to the dust
      heroCanvas.style.opacity = 1 - fade; heroH1.style.opacity = 1 - fade;
      heroSub.style.opacity = 1 - clamp01(e1 / 0.35);
    }
    lastE1 = e1;
    title.style.opacity = clamp01((e3 - 0.86) / 0.14);
    const on = e1 > 0 && e3 < 1;
    if (on !== active) { active = on; cv.style.display = on ? 'block' : 'none'; }
    if (!on) return;
    U.uScroll.value = y; U.uE1.value = e1; U.uE3.value = e3; U.uTime.value = performance.now() / 1000;
    U.uOut.value = 1 - clamp01((e3 - 0.93) / 0.07);
    renderer.render(scene, camera);
  }
  gsap.ticker.add(tick);
  addEventListener('resize', () => { if (armed) rebuild(); });
  return { arm() { if (armed) return; armed = true; build().then(tick); } };
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
    Sound.slide();
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
    trigger: '#workStage', pin: true, refreshPriority: -1, start: 'top top', end: () => '+=' + innerHeight * N * 0.85, scrub: true,
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
    pos(e);
    for (const p of dots) { const dx = p.x - m.x, dy = p.y - m.y, dist = Math.hypot(dx, dy) || 1; if (dist < 260) { const f = (1 - dist / 260) * 34; p.vx += (dx / dist) * f + rand(-3, 3); p.vy += (dy / dist) * f + rand(-3, 3); } }
  });
  document.fonts.ready.then(() => { build(); new IntersectionObserver(([en]) => { const was = running; running = en.isIntersecting; if (running && !was) tick(); }).observe(cv); });
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 200); });
})();

/* ================= CONTACT ================= */
gsap.from('.contact__big', { y: 80, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.contact', start: 'top 75%' } });
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
  btn.addEventListener('click', () => lenis.scrollTo(0, { duration: 2 }));
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

ScrollTrigger.sort();
document.fonts.ready.then(() => { ScrollTrigger.sort(); ScrollTrigger.refresh(); });
runLoader();
