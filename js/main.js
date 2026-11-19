import * as THREE from 'three';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const touch = matchMedia('(hover:none),(pointer:coarse)').matches;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = () => innerWidth < 761;
const rand = (a, b) => a + Math.random() * (b - a);
gsap.registerPlugin(ScrollTrigger);

/* ================= SOUND (WebAudio, no files) ================= */
const Sound = (() => {
  let ctx, master, on = false, padOn = false;
  const init = () => {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  };
  const blip = (f = 1200, d = 0.05, v = 0.035, type = 'sine') => {
    if (!on || !ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(master); o.start(t); o.stop(t + d + 0.03);
  };
  const whoosh = (d = 0.7, v = 0.08) => {
    if (!on || !ctx) return;
    const t = ctx.currentTime, len = Math.floor(ctx.sampleRate * d);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(3000, t + d);
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(bp).connect(g).connect(master); src.start(t);
  };
  const pad = () => {
    if (padOn) return; padOn = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const g = ctx.createGain(); g.gain.value = 0.022; lp.connect(g).connect(master);
    [55, 82.41, 110.3].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i ? 'triangle' : 'sine'; o.frequency.value = f; o.detune.value = rand(-6, 6);
      o.connect(lp); o.start();
    });
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 180;
    lfo.connect(lg).connect(lp.frequency); lfo.start();
  };
  const toggle = () => {
    if (!ctx) init();
    ctx.resume(); on = !on;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.linearRampToValueAtTime(on ? 1 : 0, ctx.currentTime + 0.4);
    if (on) { pad(); setTimeout(() => blip(880, 0.12, 0.05), 50); }
    return on;
  };
  return { blip, whoosh, toggle, get on() { return on; } };
})();

const soundBtn = $('#soundBtn');
soundBtn.addEventListener('click', () => {
  const on = Sound.toggle();
  soundBtn.classList.toggle('on', on); soundBtn.setAttribute('aria-pressed', on);
  $('#soundLabel').textContent = on ? 'Sound on' : 'Sound off';
});
document.addEventListener('mouseover', e => {
  const t = e.target.closest('a,button,.srow,.wcard');
  if (t && !t.contains(e.relatedTarget)) Sound.blip(1500, 0.035, 0.02);
});
document.addEventListener('pointerdown', () => Sound.blip(620, 0.09, 0.045, 'triangle'));

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
    uMouse: { value: new THREE.Vector2(9, 9) }, uMouseStr: { value: 0 }, uSize: { value: 20 }, uPR: { value: pr },
  };
  const vert = `
    uniform float uTime,uIntro,uScatter,uSize,uPR,uMouseStr; uniform vec2 uMouse;
    attribute vec3 aStart; attribute float aLum,aSeed;
    varying float vLum,vHot,vA;
    void main(){
      float t = clamp(uIntro*1.8 - aSeed*0.8, 0., 1.);
      t = 1. - pow(1. - t, 3.);
      vec3 p = mix(aStart, position, t);
      p.x += sin(uTime*1.3 + aSeed*40.)*0.0035;
      p.y += cos(uTime*1.1 + aSeed*31.)*0.0035;
      vec2 d = p.xy - uMouse; float dist = length(d);
      float f = smoothstep(0.27, 0.0, dist) * uMouseStr * t;
      p.xy += normalize(d + 1e-5) * f * 0.16;
      p.z += f * (0.25 + aSeed*0.6);
      p += (aStart - position) * uScatter * (0.35 + aSeed);
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = uSize * (0.75 + aLum*0.7) * uPR / -mv.z * (1. + f*0.9);
      vLum = aLum; vHot = f; vA = t * (1. - uScatter*0.85);
    }`;
  const frag = `
    varying float vLum,vHot,vA;
    void main(){
      vec2 c = gl_PointCoord - .5; float r = length(c); if (r > .5) discard;
      float a = smoothstep(.5, .05, r);
      vec3 col = mix(vec3(pow(vLum, .75)), vec3(1., .5, .12), vHot*.9);
      gl_FragColor = vec4(col, a * (0.32 + vLum*0.95) * (0.25 + 0.75*vA));
    }`;
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const group = new THREE.Group(); scene.add(group);
  let points, rows = 1, aspectImg = 0.73;

  // floating dust
  const dustN = small() ? 260 : 600, dp = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) { dp[i * 3] = rand(-4, 4); dp[i * 3 + 1] = rand(-2.5, 2.5); dp[i * 3 + 2] = rand(-3, 1.5); }
  const dustG = new THREE.BufferGeometry(); dustG.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustG, new THREE.PointsMaterial({ color: 0xffb070, size: 0.012, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
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
        if (a < 110) continue;
        const l = (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) / 255;
        const px = (x / W - 0.5) * aspectImg * 2 + rand(-0.5, 0.5) * step / H;
        const py = (0.5 - y / H) * 2 + rand(-0.5, 0.5) * step / H;
        pos.push(px, py, rand(-0.02, 0.02));
        const th = rand(0, Math.PI * 2), ph = Math.acos(rand(-1, 1)), rr = rand(2.2, 6);
        start.push(Math.sin(ph) * Math.cos(th) * rr, Math.sin(ph) * Math.sin(th) * rr * 0.7, Math.cos(ph) * rr - 1);
        lum.push(Math.min(1, l * 1.08)); seed.push(Math.random());
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
    const s = photoH / 2; group.scale.setScalar(s);
    group.position.set(0, -visH / 2 + photoH / 2, 0);
    uniforms.uSize.value = (photoH / visH * h / rows) * camera.position.z * 1.25;
  }
  addEventListener('resize', resize);

  // mouse -> local coords
  const target = new THREE.Vector2(9, 9), cur = new THREE.Vector2(9, 9);
  let strT = 0;
  const setFromClient = (cx, cy) => {
    const r = section.getBoundingClientRect();
    const nx = (cx - r.left) / r.width - 0.5, ny = 0.5 - (cy - r.top) / r.height;
    const wx = nx * visW, wy = ny * visH;
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
    group.rotation.y = (mouse.x / innerWidth - 0.5) * 0.12; group.rotation.x = (mouse.y / innerHeight - 0.5) * -0.05;
    renderer.render(scene, camera);
  });

  gsap.to(uniforms.uScatter, { value: 1, ease: 'none', scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', scrub: true } });
  return {
    ready,
    intro() { gsap.fromTo(uniforms.uIntro, { value: reduce ? 1 : 0 }, { value: 1, duration: reduce ? 0.01 : 3.4, ease: 'none' }); },
  };
})();

/* ================= TEXT HELPERS ================= */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+/<>!?';
function scramble(el, text, dur = 0.9) {
  return new Promise(res => {
    const len = text.length, o = { p: 0 };
    gsap.to(o, {
      p: 1, duration: dur, ease: 'power2.out',
      onUpdate() {
        const n = Math.floor(o.p * len); let s = '';
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
gsap.set(heroChars, { yPercent: 105, opacity: 0 });
gsap.set(['.hero__sub', '.hero__top', '.hero__hint', '.fcursor'], { opacity: 0 });
heroH1.style.overflow = 'hidden';

function heroIn() {
  Hero.intro();
  gsap.to(heroChars, { yPercent: 0, opacity: 1, duration: 1.3, ease: 'expo.out', stagger: 0.05, delay: 0.5 });
  gsap.to(['.hero__sub', '.hero__top', '.hero__hint'], { opacity: 1, duration: 1, delay: 1.2, stagger: 0.12 });
  gsap.to('.fcursor', { opacity: 1, duration: 0.6, delay: 2.2, stagger: 0.3 });
  document.body.classList.remove('is-loading');
  lenis.start(); ScrollTrigger.refresh();
}

async function runLoader() {
  const loader = $('#loader'), word = $('#loaderWord'), glow = $('.loader__glow'), count = $('#loaderCount');
  if (reduce) { loader.remove(); await Hero.ready; heroIn(); return; }
  let skip = false; loader.addEventListener('click', () => { skip = true; gsap.globalTimeline.timeScale(4); });
  const c = { v: 0 };
  gsap.to(c, { v: 100, duration: 6.2, ease: 'power1.inOut', onUpdate: () => { count.textContent = String(Math.round(c.v)).padStart(3, '0'); } });
  const wait = s => new Promise(r => gsap.delayedCall(s, r));

  await gsap.fromTo(glow, { scale: 0 }, { scale: 1, duration: 0.7, ease: 'back.out(3)' });
  gsap.to(glow, { scale: 1.6, duration: 0.6, yoyo: true, repeat: 1, ease: 'sine.inOut' });
  await wait(0.5);
  // 1. Devanagari
  word.className = 'loader__word deva'; word.textContent = 'नमस्ते';
  gsap.to(glow, { scale: 0.4, opacity: 0.5, duration: 0.6 });
  await gsap.fromTo(word, { opacity: 0, filter: 'blur(18px)', scale: 1.15 }, { opacity: 1, filter: 'blur(0px)', scale: 1, duration: 0.8, ease: 'power3.out' });
  await wait(0.45);
  await gsap.to(word, { opacity: 0, filter: 'blur(12px)', duration: 0.35 });
  // 2. Namaste scramble
  word.className = 'loader__word'; gsap.set(word, { opacity: 1, filter: 'blur(0px)' });
  await scramble(word, 'Namaste', 0.8);
  await wait(0.35);
  // 3. ABHISHEK letters fly in
  word.textContent = 'ABHISHEK';
  const chs = splitChars(word, 'chrome');
  Sound.whoosh(0.8, 0.06);
  await gsap.from(chs, {
    x: () => rand(-innerWidth * 0.4, innerWidth * 0.4), y: () => rand(-innerHeight * 0.35, innerHeight * 0.35),
    rotation: () => rand(-200, 200), scale: () => rand(0.2, 1.8), opacity: 0,
    duration: 1.1, ease: 'expo.out', stagger: { each: 0.05, from: 'random' },
  });
  gsap.to(glow, { opacity: 0, duration: 0.4 });
  await Promise.all([Hero.ready, wait(0.4)]);
  gsap.globalTimeline.timeScale(1);
  Sound.whoosh(0.9, 0.07);
  gsap.to(word, { scale: 1.25, opacity: 0, filter: 'blur(10px)', duration: 0.9, ease: 'power3.in' });
  await gsap.to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut', delay: 0.35 });
  loader.remove();
  heroIn();
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
wander($('#fcA'), [0.08, 0.3, 0.3, 0.6]); wander($('#fcB'), [0.66, 0.86, 0.25, 0.55]);

/* ================= HERO SCROLL ================= */
gsap.to('.hero__name', { yPercent: -40, opacity: 0, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });

/* ================= INTRO ================= */
const words = splitWords($('#introBig'));
gsap.to(words, { opacity: 1, stagger: 0.08, ease: 'none', scrollTrigger: { trigger: '#introBig', start: 'top 80%', end: 'bottom 50%', scrub: true } });
$$('[data-count]').forEach(b => {
  const n = +b.dataset.count, o = { v: 0 };
  ScrollTrigger.create({ trigger: b, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: n, duration: 1.6, ease: 'power2.out', onUpdate: () => { b.textContent = Math.round(o.v); } }) });
});

/* ================= JOURNEY ================= */
(() => {
  const sw = $('#swatches');
  const shades = ['#e9dcc5', '#c98b5e', '#7d8f6a', '#3f5a6b', '#d7b47a', '#a44a3f', '#efe7da', '#8d6e63', '#5b7f95', '#b9a48a', '#d9c3a5', '#6c7a4f', '#c4553b', '#f2d7b6', '#2f4858', '#a3b18a', '#e0b1a0', '#866a4f', '#cfd6d9', '#9b5d3a'];
  let h = ''; for (let i = 0; i < 90; i++) h += `<i style="background:${shades[(i * 7 + (i >> 2)) % shades.length]}"></i>`;
  sw.innerHTML = h;
  const code = [
    'const site = build({ client: "your business" });', '<b>// fast on every phone</b>', 'site.speed = "under 2s";',
    'site.seo = google.ready();', 'whatsapp.connect("+91 98769 63879");', '<b>// motion that means something</b>',
    'gsap.to(".hero", { y: 0, ease: "expo.out" });', 'export default function Shop() {', '  return <Catalogue items={shades} />;', '}',
    'deploy("github.io") // live in minutes', '<b>// discipline from the road</b>', 'while (!done) { work(); }',
  ];
  const pre = $('#codefall'); let body = '';
  for (let i = 0; i < 60; i++) body += '  '.repeat(i % 3) + code[i % code.length] + '\n';
  pre.innerHTML = `<div class="codefall__in">${body}${body}</div>`;
  gsap.to('.codefall__in', { yPercent: -50, duration: 50, ease: 'none', repeat: -1 });

  const mm = gsap.matchMedia();
  mm.add('(min-width: 761px)', () => {
    const track = $('#journeyTrack');
    const dist = () => track.scrollWidth - innerWidth;
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: '#journey', pin: true, scrub: 1, end: () => '+=' + dist(), invalidateOnRefresh: true,
        onUpdate: s => gsap.set('#journeyLine', { scaleX: s.progress }) },
    });
    $$('.jpanel__place').forEach(p => {
      gsap.fromTo(p, { xPercent: -30 }, { xPercent: -70, ease: 'none', scrollTrigger: { trigger: p.parentElement, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
    });
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
    world.style.setProperty('--cw', cw + 'px');
    cards.forEach(c => c.el.style.setProperty('--cw', cw + 'px'));
  };
  layout(); addEventListener('resize', () => { layout(); update(st ? st.progress : 0); });

  const title = $('#workTitle'), cat = $('#workCat'), idx = $('#workIdx');
  const setActive = i => {
    if (i === active) return; active = i;
    scramble(title, PROJECTS[i].name, 0.6); cat.textContent = PROJECTS[i].cat; idx.textContent = String(i + 1).padStart(2, '0');
    Sound.blip(980, 0.06, 0.03);
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
    pos(e); Sound.whoosh(0.5, 0.06);
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

/* ================= CLOCK ================= */
const fmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
const tickClock = () => { $('#clock').textContent = fmt.format(new Date()); };
tickClock(); setInterval(tickClock, 15000);

document.fonts.ready.then(() => ScrollTrigger.refresh());
runLoader();
