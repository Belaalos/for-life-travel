/* For Life Travel: interactive globe ("Find your next destination").
   Plain canvas, no libraries. Data: globe-data.js (FLT_GEO, FLT_DEST, FLT_CREDITS). */
(function () {
  'use strict';
  var GEO = window.FLT_GEO, DEST = window.FLT_DEST, CREDITS = window.FLT_CREDITS;
  if (!GEO || !DEST) return;

  var BASE = (function () { var s = document.currentScript; return s && s.src ? s.src.replace(/[^\/]*$/, '') : ''; })();
  var D2R = Math.PI / 180, PI = Math.PI;
  var WA = 'https://wa.me/201055553989?text=';
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var T = {
    en: {
      eyebrow: 'EXPLORE EGYPT',
      title: 'Find your next destination',
      sub: 'Start from space, fly into Egypt and tap any pin to see its landmarks.',
      hintGlobe: 'Drag to spin. Tap Egypt to fly in.',
      hintEgypt: 'Tap a pin to fly in.',
      cta: 'Fly into Egypt',
      earth: 'Earth', egypt: 'Egypt',
      chips: 'Or pick a destination',
      count: function (n) { return n + ' destinations'; },
      isNew: 'New',
      ask: function (n) { return 'Ask about ' + n; },
      next: 'Next', prev: 'Previous', close: 'Close',
      credits: 'Photo credits',
      marker: 'EGYPT',
      markerSub: function (n) { return n + ' destinations'; },
      wa: function (n) { return 'Hi For Life Travel! I\'d like to ask about the ' + n + ' trip.'; },
      alt: 'An interactive globe of Egypt with the For Life Travel destinations'
    },
    ar: {
      eyebrow: 'اكتشف مصر',
      title: 'اختار وجهتك الجاية',
      sub: 'ابدأ من الفضاء، انزل على مصر، ودوس على أي نقطة تشوف معالمها.',
      hintGlobe: 'اسحب عشان تلف الكرة. دوس على مصر عشان تنزل عليها.',
      hintEgypt: 'دوس على أي نقطة عشان تنزل عليها.',
      cta: 'انزل على مصر',
      earth: 'الأرض', egypt: 'مصر',
      chips: 'أو اختار وجهة من هنا',
      count: function (n) { return n.toLocaleString('ar-EG') + ' وجهة'; },
      isNew: 'جديد',
      ask: function (n) { return 'اسأل عن ' + n; },
      next: 'التالية', prev: 'السابقة', close: 'اقفل',
      credits: 'حقوق الصور',
      marker: 'مصر',
      markerSub: function (n) { return n.toLocaleString('ar-EG') + ' وجهة'; },
      wa: function (n, en) { return 'Hi For Life Travel! I\'d like to ask about the ' + en + ' trip.'; },
      alt: 'كرة أرضية تفاعلية لمصر عليها وجهات فور لايف'
    }
  };

  // Rough Egypt outline, only used to tint Egypt's land lighter.
  var EG = [[25.15, 31.7], [25, 30.5], [25, 22], [36.9, 22], [36, 23.5], [35.2, 25], [34.6, 26.3], [34.3, 27.4],
    [34.5, 27.85], [34.85, 28.6], [34.9, 29.5], [34.6, 30.3], [34.25, 31.3], [34.2, 32], [25.15, 32]];
  // Nile, rough course with the two delta branches.
  var NILE = [[32.88, 24.05], [32.65, 25.2], [32.65, 25.7], [32.75, 26.2], [31.9, 26.6], [31.2, 27.2], [30.85, 28.0],
    [30.8, 28.6], [31.2, 29.6], [31.25, 30.05]];
  var NILE_E = [[31.25, 30.05], [31.4, 30.6], [31.75, 31.4]];
  var NILE_W = [[31.25, 30.05], [30.85, 30.9], [30.4, 31.45]];
  var CAIRO = [31.24, 30.04];

  var STARS = [];
  (function () {
    var s = 7;
    function rnd() { s = (s * 16807) % 2147483647; return s / 2147483647; }
    for (var i = 0; i < 170; i++) STARS.push([rnd(), rnd(), rnd() * 1.3 + 0.3, rnd() * 0.6 + 0.25]);
  })();

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function lang() {
    var f = document.querySelector('.flt');
    return f && f.getAttribute('lang') === 'ar' ? 'ar' : 'en';
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function init(mount) {
    if (mount.getAttribute('data-ready')) return;
    mount.setAttribute('data-ready', '1');

    var L = lang(), tx = T[L];
    var root = el('div', 'gl');
    mount.appendChild(root);

    var head = el('div', 'gl-head');
    var eyebrow = el('span', 'gl-eyebrow'), h2 = el('h2'), sub = el('p', 'gl-sub');
    head.appendChild(eyebrow); head.appendChild(h2); head.appendChild(sub);
    root.appendChild(head);

    var stage = el('div', 'gl-stage');
    var canvas = el('canvas', 'gl-canvas');
    canvas.setAttribute('role', 'img');
    stage.appendChild(canvas);
    var crumbs = el('div', 'gl-crumbs');
    var bEarth = el('button', 'gl-crumb'), bEgypt = el('button', 'gl-crumb'), bDest = el('span', 'gl-crumb gl-crumb-cur');
    bEarth.type = 'button'; bEgypt.type = 'button';
    crumbs.appendChild(bEarth); crumbs.appendChild(bEgypt); crumbs.appendChild(bDest);
    stage.appendChild(crumbs);
    var hint = el('div', 'gl-hint');
    stage.appendChild(hint);
    var cta = el('button', 'gl-cta'); cta.type = 'button';
    stage.appendChild(cta);
    var attr = el('div', 'gl-attr', 'Imagery: NASA Blue Marble (public domain) \u00b7 EOxCloudless 2016, contains modified Copernicus Sentinel data 2016 (CC BY 4.0)');
    stage.appendChild(attr);

    var panel = el('aside', 'gl-panel');
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML =
      '<button type="button" class="gl-x"></button>' +
      '<div class="gl-photo"><img alt="" decoding="async"><div class="gl-cap"></div></div>' +
      '<div class="gl-thumbs"></div>' +
      '<div class="gl-body"><h3></h3><div class="gl-tag"></div><p></p>' +
      '<a class="gl-wa" target="_blank" rel="noreferrer"></a>' +
      '<ul class="gl-lm"></ul>' +
      '<div class="gl-nav"><button type="button" class="gl-prev"></button><button type="button" class="gl-next"></button></div></div>';
    stage.appendChild(panel);
    root.appendChild(stage);

    var chipsWrap = el('div', 'gl-chips-wrap');
    var chipsTitle = el('div', 'gl-chips-title');
    var chips = el('div', 'gl-chips');
    chipsWrap.appendChild(chipsTitle); chipsWrap.appendChild(chips);
    root.appendChild(chipsWrap);

    var credits = el('details', 'gl-credits');
    var csum = el('summary'), clist = el('ul');
    credits.appendChild(csum); credits.appendChild(clist);
    root.appendChild(credits);

    var pImg = panel.querySelector('.gl-photo img'), pCap = panel.querySelector('.gl-cap'),
      pThumbs = panel.querySelector('.gl-thumbs'), pH = panel.querySelector('h3'),
      pTag = panel.querySelector('.gl-tag'), pP = panel.querySelector('.gl-body p'),
      pLm = panel.querySelector('.gl-lm'), pWa = panel.querySelector('.gl-wa'),
      pX = panel.querySelector('.gl-x'), pPrev = panel.querySelector('.gl-prev'),
      pNext = panel.querySelector('.gl-next');

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = 1;
    var panelW = 0;
    // view state: lon/lat centre, R px per radian, ox/oy centre offset in px
    var st = { lon: 70, lat: 24, R: 200, ox: 0, oy: 0 };
    var mode = 'globe', sel = -1, hover = -1, photoIdx = 0;
    var anim = null, drag = null, idleT = 0, visible = false, rafId = 0, introDone = false;
    var lastInteract = 0, t0 = performance.now();

    function isMobile() { return W < 760; }
    function Rglobe() { return Math.min(W, H) * 0.4; }
    function Regypt() {
      var byH = 0.74 * H / 0.128, byW = (W < 760 ? 0.92 : 0.8) * W / 0.148;
      return Math.min(byH, byW);
    }
    function Rdest() {
      var w = isMobile() ? W * 0.95 : (W - panelW - 24) * 0.92;
      return Math.max(w / (18 / 6371), Regypt() * 3);
    }
    function target(m, i) {
      if (m === 'globe') return { lon: 31, lat: 24, R: Rglobe(), ox: 0, oy: 0 };
      if (m === 'egypt') return { lon: 30.3, lat: 27.7, R: Regypt(), ox: 0, oy: 0 };
      var d = DEST[i], ox = 0, oy = 0;
      if (isMobile()) oy = -H * 0.28; else ox = (L === 'ar' ? 1 : -1) * (panelW + 24) / 2;
      return { lon: d.lon, lat: d.lat, R: Rdest(), ox: ox, oy: oy };
    }
    function fly(m, i, dur) {
      var tg = target(m, i), prevMode = mode;
      if (m === 'dest') { pKey = DEST[i].key; patchFor(pKey); }
      mode = m; sel = m === 'dest' ? i : -1;
      lastInteract = performance.now();
      if (REDUCED || !dur) { st = tg; anim = null; syncUI(); schedule(); return; }
      var dl = ((tg.lon - st.lon + 540) % 360) - 180;
      anim = { arc: (prevMode === 'dest' && m === 'dest') ? Math.log(tg.R / (Regypt() * 2)) * 0.9 : 0, t: performance.now(), dur: dur, from: { lon: st.lon, lat: st.lat, R: st.R, ox: st.ox, oy: st.oy }, dl: dl, to: tg };
      syncUI(); schedule();
    }
    function step(now) {
      if (!anim) return;
      var k = clamp((now - anim.t) / anim.dur, 0, 1), e = ease(k), f = anim.from, g = anim.to;
      st.lon = f.lon + anim.dl * e; st.lat = f.lat + (g.lat - f.lat) * e;
      st.R = Math.exp(Math.log(f.R) + (Math.log(g.R) - Math.log(f.R)) * e - (anim.arc || 0) * Math.sin(PI * e));
      st.ox = f.ox + (g.ox - f.ox) * e; st.oy = f.oy + (g.oy - f.oy) * e;
      if (k >= 1) { st = { lon: g.lon, lat: g.lat, R: g.R, ox: g.ox, oy: g.oy }; anim = null; }
    }

    // ---------- WebGL earth (NASA Blue Marble texture) ----------
    var glc = null, gl = null, glProg = null, glU = {}, texW = null, texR = null, glReady = 0, glLoading = false;
    var REG = [23.5, 20, 38, 33.5];
    function glInit() {
      try {
        glc = document.createElement('canvas'); glc.className = 'gl-earth';
        gl = glc.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' });
        if (!gl) { glc = null; return; }
        var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
        var fs = 'precision highp float;uniform vec2 uRes,uC;uniform float uR,uLon0,uLat0,uSpace,uReg,uPw;uniform vec4 uBox,uPB;uniform sampler2D tW,tR,tP;' +
          'const float PI=3.14159265;' +
          'void main(){' +
          'vec2 f=vec2(gl_FragCoord.x-uC.x,(uRes.y-gl_FragCoord.y)-uC.y);' +
          'vec2 q=vec2(f.x,-f.y)/uR;float rho=length(q);' +
          'float edge=1.-smoothstep(uR>0.?1.-1.6/uR:.99,1.,rho);' +
          'if(rho>=1.){gl_FragColor=vec4(0.);return;}' +
          'float c=asin(rho);float sc=sin(c),cc=cos(c);float sp=sin(uLat0),cp=cos(uLat0);' +
          'float lat=asin(clamp(cc*sp+(rho>0.?q.y*sc*cp/rho:0.),-1.,1.));' +
          'float lon=uLon0+atan(q.x*sc,rho*cp*cc-q.y*sp*sc);' +
          'float u=fract(lon/(2.*PI)+.5);float v=.5-lat/PI;' +
          'vec3 col=texture2D(tW,vec2(u,v)).rgb;' +
          'float dl=lon*180./PI;dl=mod(dl+180.,360.)-180.;float da=lat*180./PI;' +
          'vec2 ru=vec2((dl-uBox.x)/(uBox.z-uBox.x),(uBox.w-da)/(uBox.w-uBox.y));' +
          'float m=smoothstep(0.,.04,ru.x)*smoothstep(0.,.04,ru.y)*smoothstep(0.,.04,1.-ru.x)*smoothstep(0.,.04,1.-ru.y)*uReg;' +
          'if(m>0.){vec3 rc=texture2D(tR,clamp(ru,0.001,.999)).rgb;col=mix(col,rc,m);}' +
          'if(uPw>0.){float ym=log(tan(.7853982+lat*.5));vec2 pu=vec2((dl-uPB.x)/(uPB.y-uPB.x),(uPB.z-ym)/(uPB.z-uPB.w));float pm=smoothstep(0.,.03,pu.x)*smoothstep(0.,.03,pu.y)*smoothstep(0.,.03,1.-pu.x)*smoothstep(0.,.03,1.-pu.y)*uPw;if(pm>0.)col=mix(col,texture2D(tP,clamp(pu,0.001,.999)).rgb*.9,pm);}' +
          'float g=dot(col,vec3(.299,.587,.114));col=mix(vec3(g),col,1.18-.2*uPw);col=pow(col,vec3(.95+.05*uPw))*1.04;' +
          'vec3 n=vec3(q.x,q.y,sqrt(1.-rho*rho));float lt=max(dot(n,normalize(vec3(-.45,.5,.75))),0.);' +
          'float sh=mix(1.,.28+.82*lt,uSpace);col*=sh;' +
          'float fr=pow(1.-n.z,3.);col+=vec3(.20,.42,.95)*fr*.55*uSpace+vec3(.10,.2,.4)*fr*.25*(1.-uSpace);' +
          'gl_FragColor=vec4(col*edge,edge);}';
        function sh(t, src) { var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
        glProg = gl.createProgram(); gl.attachShader(glProg, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(glProg, sh(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(glProg); if (!gl.getProgramParameter(glProg, gl.LINK_STATUS)) throw new Error('link');
        gl.useProgram(glProg);
        var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        var loc = gl.getAttribLocation(glProg, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        ['uRes', 'uC', 'uR', 'uLon0', 'uLat0', 'uSpace', 'uReg', 'uBox', 'tW', 'tR', 'tP', 'uPB', 'uPw'].forEach(function (n) { glU[n] = gl.getUniformLocation(glProg, n); });
        gl.uniform1i(glU.tW, 0); gl.uniform1i(glU.tR, 1); gl.uniform1i(glU.tP, 2);
        glc.addEventListener('webglcontextlost', function (e) { e.preventDefault(); glReady = 0; schedule(); });
        stage.insertBefore(glc, canvas);
      } catch (err) { if (glc && glc.parentNode) glc.parentNode.removeChild(glc); glc = null; gl = null; }
    }
    function mkTex(unit, img, mips) {
      var t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, mips ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (mips) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
      else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      return t;
    }
    function glLoad() {
      if (glLoading || !gl) return; glLoading = true;
      function load(src, cb) { var im = new Image(); im.decoding = 'async'; im.onload = function () { cb(im); schedule(); }; im.src = src; }
      load(BASE + 'img/earth-world.jpg', function (im) {
        try { texW = mkTex(0, im, true); glReady = Math.max(glReady, 1); } catch (e) { }
        load(BASE + 'img/earth-egypt.jpg', function (im2) {
          try { texR = mkTex(1, im2, false); glReady = 2; } catch (e) { }
        });
      });
    }
    var PATCH = window.FLT_PATCH || {}, pCache = {}, pOrder = [], pKey = null;
    function mercY(lat) { return Math.log(Math.tan(PI / 4 + lat * D2R / 2)); }
    function patchFor(key) {
      var p = pCache[key];
      if (p || !PATCH[key] || !gl) return p;
      p = pCache[key] = { tex: null, t: 0, box: PATCH[key] };
      pOrder.push(key);
      var im = new Image(); im.decoding = 'async';
      im.onload = function () {
        try {
          gl.activeTexture(gl.TEXTURE2);
          var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          p.tex = t; p.t = performance.now();
          while (pOrder.length > 3) { var k = pOrder.shift(); if (k !== key && pCache[k]) { if (pCache[k].tex) gl.deleteTexture(pCache[k].tex); delete pCache[k]; } else if (k === key) pOrder.push(k); }
        } catch (e) { }
        schedule();
      };
      im.src = BASE + 'img/patch/' + key + '.jpg';
      return p;
    }
    function glDraw(space, rg) {
      var pw = Math.round(W * dpr), ph = Math.round(H * dpr);
      if (glc.width !== pw || glc.height !== ph) { glc.width = pw; glc.height = ph; glc.style.width = W + 'px'; glc.style.height = H + 'px'; }
      gl.viewport(0, 0, pw, ph);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texW);
      if (texR) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texR); }
      gl.uniform2f(glU.uRes, pw, ph); gl.uniform2f(glU.uC, cx * dpr, cy * dpr); gl.uniform1f(glU.uR, st.R * dpr);
      gl.uniform1f(glU.uLon0, st.lon * D2R); gl.uniform1f(glU.uLat0, st.lat * D2R); gl.uniform1f(glU.uSpace, space);
      gl.uniform1f(glU.uReg, glReady >= 2 ? clamp((rg - 1.3) / 1.2, 0, 1) : 0);
      gl.uniform4f(glU.uBox, REG[0], REG[1], REG[2], REG[3]);
      var pwt = 0, pp = pKey ? pCache[pKey] : null;
      if (pp && pp.tex) {
        pwt = clamp((st.R - 30000) / 60000, 0, 1) * clamp((performance.now() - pp.t) / 600, 0, 1);
        if (pwt > 0) {
          gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, pp.tex);
          gl.uniform4f(glU.uPB, pp.box[0], pp.box[1], mercY(pp.box[2]), mercY(pp.box[3]));
        }
        if (performance.now() - pp.t < 700) schedule();
      }
      gl.uniform1f(glU.uPw, pwt);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    var EGY = window.FLT_EGY || [];
    function drawBorder(rg) {
      if (!EGY.length) return;
      var a = clamp((rg - 1.15) / 1.0, 0, 1) * 0.8 * clamp(1 - (rg - 7) / 4, 0, 1); if (a <= 0) return;
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, st.R, 0, PI * 2); ctx.clip();
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (var i = 0; i < EGY.length; i++) {
        var r = EGY[i], on = false;
        for (var j = 0; j < r.length; j++) {
          proj(r[j][0], r[j][1]);
          if (out[2] > 0) { if (!on) { ctx.moveTo(out[0], out[1]); on = true; } else ctx.lineTo(out[0], out[1]); } else on = false;
        }
      }
      var big = st.R > Rglobe() * 3;
      ctx.setLineDash(big ? [7, 5] : []);
      ctx.strokeStyle = 'rgba(255,255,255,' + a * 0.85 + ')'; ctx.lineWidth = big ? 1.6 : 1.2; ctx.stroke();
      ctx.restore();
    }

    // ---------- projection ----------
    var cx = 0, cy = 0, sinP0 = 0, cosP0 = 1;
    function prep() {
      cx = W / 2 + st.ox; cy = H / 2 + st.oy;
      sinP0 = Math.sin(st.lat * D2R); cosP0 = Math.cos(st.lat * D2R);
    }
    var out = [0, 0, 0];
    function proj(lon, lat) {
      var l = (lon - st.lon) * D2R, p = lat * D2R, cp = Math.cos(p), sp = Math.sin(p), cl = Math.cos(l);
      var cosc = sinP0 * sp + cosP0 * cp * cl;
      var px = cp * Math.sin(l), py = cosP0 * sp - sinP0 * cp * cl;
      if (cosc < 0) { var r = Math.sqrt(px * px + py * py) || 1; px /= r; py /= r; }
      out[0] = cx + st.R * px; out[1] = cy - st.R * py; out[2] = cosc;
      return out;
    }
    function ringPath(rings, close) {
      for (var i = 0; i < rings.length; i++) {
        var r = rings[i];
        for (var j = 0; j < r.length; j++) {
          proj(r[j][0], r[j][1]);
          if (j === 0) ctx.moveTo(out[0], out[1]); else ctx.lineTo(out[0], out[1]);
        }
        if (close) ctx.closePath();
      }
    }
    function polyPath(pts) {
      for (var j = 0; j < pts.length; j++) {
        proj(pts[j][0], pts[j][1]);
        if (j === 0) ctx.moveTo(out[0], out[1]); else ctx.lineTo(out[0], out[1]);
      }
      ctx.closePath();
    }

    // ---------- drawing ----------
    function drawStars(a) {
      ctx.save();
      if (glReady && mode !== 'x') { ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(cx, cy, st.R, 0, PI * 2, true); ctx.clip('evenodd'); }
      ctx.fillStyle = '#fff';
      for (var i = 0; i < STARS.length; i++) {
        var s = STARS[i];
        ctx.globalAlpha = s[3] * a * (0.75 + 0.25 * Math.sin(performance.now() / 900 + i));
        ctx.fillRect(s[0] * W, s[1] * H, s[2], s[2]);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    function graticule() {
      var rg = st.R / Rglobe();
      var stp = rg < 1.6 ? 15 : rg < 5 ? 5 : 1;
      var span = Math.max(W, H) / st.R / D2R * 1.1;
      var full = st.R < Rglobe() * 3;
      var lo = full ? -180 : Math.floor((st.lon - span) / stp) * stp, hi = full ? 180 : Math.ceil((st.lon + span) / stp) * stp;
      var la0 = full ? -90 : Math.floor((st.lat - span) / stp) * stp, la1 = full ? 90 : Math.ceil((st.lat + span) / stp) * stp;
      ctx.beginPath();
      var a, b, drawing;
      for (a = lo; a <= hi; a += stp) {
        drawing = false;
        for (b = Math.max(-85, la0); b <= Math.min(85, la1); b += Math.max(2, stp / 4)) {
          proj(a, b);
          if (out[2] > 0) { if (!drawing) { ctx.moveTo(out[0], out[1]); drawing = true; } else ctx.lineTo(out[0], out[1]); } else drawing = false;
        }
      }
      for (b = Math.max(-80, la0); b <= Math.min(80, la1); b += stp) {
        drawing = false;
        for (a = lo; a <= hi; a += Math.max(2, stp / 4)) {
          proj(a, b);
          if (out[2] > 0) { if (!drawing) { ctx.moveTo(out[0], out[1]); drawing = true; } else ctx.lineTo(out[0], out[1]); } else drawing = false;
        }
      }
      ctx.strokeStyle = 'rgba(150,190,255,0.10)'; ctx.lineWidth = 1; ctx.stroke();
    }
    function render(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      prep();
      var R = st.R, rg = R / Rglobe();
      var space = clamp(1 - (rg - 1) / 2.2, 0, 1);

      drawStars(clamp(1 - (rg - 1) / 1.2, 0.0, 1));

      // atmosphere
      if (space > 0) {
        var g0 = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.14);
        g0.addColorStop(0, 'rgba(90,160,255,' + (0.45 * space) + ')');
        g0.addColorStop(1, 'rgba(90,160,255,0)');
        ctx.fillStyle = g0; ctx.beginPath(); ctx.arc(cx, cy, R * 1.14, 0, PI * 2); ctx.fill();
      }

      var useGL = !!(gl && glReady);
      if (useGL) {
        try { glDraw(space, rg); } catch (e) { useGL = false; glReady = 0; }
      }
      if (!useGL) {
      // sphere / sea (2D fallback)
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, PI * 2); ctx.clip();
      var sea = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.05, cx, cy, R * 1.05);
      sea.addColorStop(0, '#1b4a8f'); sea.addColorStop(0.55, '#0f2f66'); sea.addColorStop(1, '#071840');
      ctx.fillStyle = sea; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(12,45,95,' + (0.55 * (1 - space)) + ')'; ctx.fillRect(0, 0, W, H);

      graticule();

      // land
      var t = clamp((rg - 5) / 2.5, 0, 1);
      var landFill = '#34578f', landLit = '#4a74b3';
      if (t < 1) {
        ctx.globalAlpha = 1 - t;
        ctx.beginPath(); ringPath(GEO.world, true);
        var lg = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
        lg.addColorStop(0, landLit); lg.addColorStop(1, '#27487d');
        ctx.fillStyle = lg; ctx.fill();
        if (rg > 1.4) { ctx.strokeStyle = 'rgba(190,220,255,0.35)'; ctx.lineWidth = 1; ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      if (t > 0) {
        ctx.globalAlpha = t;
        ctx.beginPath(); ringPath(GEO.reg, true);
        ctx.fillStyle = landFill; ctx.fill();
        ctx.strokeStyle = 'rgba(190,220,255,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // Egypt tinted lighter
      var et = clamp((rg - 2.2) / 3, 0, 1) * (mode === 'globe' && !anim ? 0.35 : 1);
      if (rg > 1.6 || mode !== 'globe') {
        ctx.save();
        ctx.beginPath(); polyPath(EG); ctx.clip();
        ctx.globalAlpha = Math.max(0.55, et);
        ctx.beginPath();
        if (t > 0.5) ringPath(GEO.reg, true); else ringPath(GEO.world, true);
        var eg = ctx.createLinearGradient(cx - R * 0.1, cy - R * 0.1, cx + R * 0.1, cy + R * 0.1);
        ctx.fillStyle = '#4c6ca3'; ctx.fill();
        ctx.restore();
      }
      // Nile
      var nileOn = mode !== 'dest' || (sel >= 0 && (DEST[sel].key === 'luxor' || DEST[sel].key === 'aswan'));
      if (rg > 3 && nileOn) {
        ctx.globalAlpha = clamp((rg - 3) / 3, 0, 1) * (mode === 'dest' ? 0.55 : 1);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = '#7fd7ff'; ctx.lineWidth = clamp(R / 1800, 1.5, 3.2);
        [NILE, NILE_E, NILE_W].forEach(function (pl) {
          ctx.beginPath();
          for (var i = 0; i < pl.length; i++) { proj(pl[i][0], pl[i][1]); if (i) ctx.lineTo(out[0], out[1]); else ctx.moveTo(out[0], out[1]); }
          ctx.stroke();
        });
        proj(CAIRO[0], CAIRO[1]);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(out[0], out[1], 2.6, 0, PI * 2); ctx.fill();
        if (mode !== 'dest' && !isMobile()) {
          ctx.font = '500 11px ' + fontFam(); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.textAlign = 'center';
          ctx.fillText(L === 'ar' ? 'القاهرة' : 'Cairo', out[0], out[1] - 8);
        }
        ctx.globalAlpha = 1;
      }

      // night side shading
      var sh = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.5, R * 0.2, cx, cy, R * 1.12);
      var sa = 0.5 * space;
      sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.6, 'rgba(2,6,24,' + (sa * 0.35) + ')'); sh.addColorStop(1, 'rgba(2,6,24,' + sa + ')');
      ctx.fillStyle = sh; ctx.fillRect(0, 0, W, H);
      ctx.restore();
      } else { drawBorder(rg); }

      // rim
      if (space > 0.02) {
        ctx.strokeStyle = 'rgba(150,200,255,' + (0.35 * space) + ')'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, PI * 2); ctx.stroke();
      }

      // markers
      if (mode === 'globe' && !anim || (anim && anim.to && rg < 3.5 && mode === 'globe')) drawEgyptMarker(now);
      if (rg > 4.5) drawPins(now, clamp((rg - 4.5) / 2, 0, 1));
    }
    function fontFam() { return L === 'ar' ? 'Segoe UI, Tahoma, Arial, sans-serif' : '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif'; }

    var egyptPos = [0, 0, 0];
    function drawEgyptMarker(now) {
      proj(30.5, 26.8);
      egyptPos = [out[0], out[1], out[2]];
      if (out[2] < 0.12) return;
      var x = out[0], y = out[1], p = (now / 1600) % 1;
      var k = clamp((out[2] - 0.12) / 0.3, 0, 1);
      ctx.globalAlpha = k;
      var gg = ctx.createRadialGradient(x, y, 0, x, y, 46);
      gg.addColorStop(0, 'rgba(242,184,75,0.55)'); gg.addColorStop(1, 'rgba(242,184,75,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, 46, 0, PI * 2); ctx.fill();
      if (!REDUCED) {
        ctx.strokeStyle = 'rgba(242,184,75,' + (0.8 * (1 - p)) + ')'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(x, y, 8 + p * 30, 0, PI * 2); ctx.stroke();
      }
      ctx.fillStyle = '#f2b84b'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, PI * 2); ctx.fill(); ctx.stroke();
      // label
      var lbl = tx.marker, sub2 = tx.markerSub(DEST.length);
      ctx.textAlign = 'center';
      ctx.font = '800 13px ' + fontFam();
      var w1 = Math.max(ctx.measureText(lbl).width, 0);
      ctx.font = '500 11px ' + fontFam();
      var w2 = ctx.measureText(sub2).width, bw = Math.max(w1, w2) + 22, bh = 38, bx = x - bw / 2, by = y - 62;
      ctx.fillStyle = 'rgba(8,18,50,0.78)'; roundRect(bx, by, bw, bh, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(242,184,75,0.6)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#f2b84b'; ctx.font = '800 13px ' + fontFam(); ctx.fillText(lbl, x, by + 16);
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '500 11px ' + fontFam(); ctx.fillText(sub2, x, by + 31);
      ctx.globalAlpha = 1;
    }
    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }

    var pinPos = [];
    function drawPins(now, alpha) {
      var rects = [], i, d;
      pinPos.length = 0;
      for (i = 0; i < DEST.length; i++) {
        d = DEST[i]; proj(d.lon, d.lat);
        pinPos.push([out[0], out[1]]);
      }
      var big = mode === 'dest';
      var order = [];
      for (i = 0; i < DEST.length; i++) order.push(i);
      order.sort(function (a, b) { return (a === sel) - (b === sel) || (a === hover) - (b === hover); });
      var pr = isMobile() ? 5 : 6;
      // labels (greedy, no overlap)
      ctx.globalAlpha = alpha;
      ctx.font = '700 ' + (isMobile() ? 11 : 12.5) + 'px ' + fontFam();
      ctx.textBaseline = 'middle';
      for (i = 0; i < pinPos.length; i++) rects.push([pinPos[i][0] - 9, pinPos[i][1] - 9, 18, 18, i]);
      var lorder = order.slice().reverse();
      for (var li = 0; li < lorder.length; li++) {
        i = lorder[li];
        var nm = DEST[i][L].name, x2 = pinPos[i][0], y2 = pinPos[i][1];
        if (x2 < -10 || x2 > W + 10 || y2 < -10 || y2 > H + 10) continue;
        var tw = ctx.measureText(nm).width + 14, th = 20, force = i === sel || i === hover;
        var cands = [[x2 + 12, y2 - th / 2], [x2 - 12 - tw, y2 - th / 2], [x2 - tw / 2, y2 - 14 - th], [x2 - tw / 2, y2 + 14], [x2 + 10, y2 - th - 6], [x2 - 10 - tw, y2 - th - 6], [x2 + 10, y2 + 6], [x2 - 10 - tw, y2 + 6]];
        var placed = null;
        for (var c = 0; c < cands.length && !placed; c++) {
          var rc = [cands[c][0], cands[c][1], tw, th], ok = true;
          if (rc[0] < 4 || rc[0] + tw > W - 4 || rc[1] < 4 || rc[1] + th > H - 4) ok = false;
          for (var q = 0; q < rects.length && ok; q++) {
            var o = rects[q]; if (o[4] === i) continue;
            if (rc[0] < o[0] + o[2] + 3 && rc[0] + rc[2] + 3 > o[0] && rc[1] < o[1] + o[3] + 2 && rc[1] + rc[3] + 2 > o[1]) ok = false;
          }
          if (ok) placed = rc;
        }
        if (!placed && force) placed = [cands[0][0], cands[0][1], tw, th];
        if (!placed) continue;
        rects.push(placed);
        ctx.fillStyle = i === sel ? 'rgba(242,184,75,0.95)' : 'rgba(8,18,50,0.72)';
        roundRect(placed[0], placed[1], tw, th, 9); ctx.fill();
        ctx.fillStyle = i === sel ? '#1b1a38' : '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(nm, placed[0] + tw / 2, placed[1] + th / 2 + 0.5);
      }
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = alpha;
      for (var oi = 0; oi < order.length; oi++) {
        i = order[oi];
        var x = pinPos[i][0], y = pinPos[i][1], isSel = i === sel, isHov = i === hover;
        if (x < -30 || x > W + 30 || y < -30 || y > H + 30) continue;
        var r = pr + (isSel ? 3 : isHov ? 2 : 0);
        if (isSel || (!REDUCED && big === false && false)) { }
        var g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
        g.addColorStop(0, 'rgba(242,184,75,' + (isSel ? 0.65 : 0.4) + ')'); g.addColorStop(1, 'rgba(242,184,75,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, PI * 2); ctx.fill();
        if (isSel && !REDUCED) {
          var p = ((now / 1500) + 0) % 1;
          ctx.strokeStyle = 'rgba(242,184,75,' + (0.9 * (1 - p)) + ')'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, r + p * 26, 0, PI * 2); ctx.stroke();
        }
        ctx.fillStyle = '#f2b84b'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, r, 0, PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2c2a4a'; ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ---------- loop ----------
    function needsFrame() {
      return visible;
    }
    function schedule() { if (!rafId && visible) rafId = requestAnimationFrame(loop); }
    function loop(now) {
      rafId = 0;
      if (!visible) return;
      step(now);
      // intro: arrive from the side, then idle drift
      if (!anim && mode === 'globe' && !drag && !REDUCED) {
        if (!introDone) {
          var k = clamp((now - t0) / 2600, 0, 1);
          st.lon = 31 + (1 - ease(k)) * 70; st.lat = 24 + (1 - ease(k)) * -6;
          if (k >= 1) introDone = true;
        } else if (now - lastInteract > 1500) {
          idleT += 0.0016; st.lon = 31 + Math.sin(idleT) * 14; st.lat = 24 + Math.sin(idleT * 0.7) * 4;
        }
      }
      if (gl && !glLoading) glLoad();
      render(now);
      if (needsFrame()) rafId = requestAnimationFrame(loop);
    }

    // ---------- UI ----------
    function setText() {
      L = lang(); tx = T[L];
      eyebrow.textContent = tx.eyebrow; h2.textContent = tx.title; sub.textContent = tx.sub;
      bEarth.textContent = tx.earth; bEgypt.textContent = tx.egypt;
      cta.textContent = tx.cta; chipsTitle.textContent = tx.chips;
      pX.setAttribute('aria-label', tx.close); pX.innerHTML = '&times;';
      pPrev.textContent = (L === 'ar' ? '→ ' : '← ') + tx.prev; pNext.textContent = tx.next + (L === 'ar' ? ' ←' : ' →');
      csum.textContent = tx.credits;
      canvas.setAttribute('aria-label', tx.alt);
      root.setAttribute('dir', L === 'ar' ? 'rtl' : 'ltr');
      chips.innerHTML = '';
      DEST.forEach(function (d, i) {
        var b = el('button', 'gl-chip' + (i === sel ? ' is-on' : '')); b.type = 'button';
        var im = el('img'); im.src = d.photos[0].f; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
        b.appendChild(im);
        var s = el('span', 'gl-chip-name'); s.textContent = d[L].name; b.appendChild(s);
        if (d.new) { var n = el('em', 'gl-new'); n.textContent = tx.isNew; b.appendChild(n); }
        b.addEventListener('click', function () { openDest(i); });
        chips.appendChild(b);
      });
      clist.innerHTML = '';
      [['Globe imagery: NASA Blue Marble, via NASA GIBS (public domain)'],
       ['Close-up satellite views: EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016), CC BY 4.0'],
       ['Egypt outline: Natural Earth (public domain)']].forEach(function (t) { var li = el('li'); li.textContent = t[0]; clist.appendChild(li); });
      CREDITS.forEach(function (c) {
        var li = el('li'); li.textContent = c.place + ': ' + c.title + (c.author ? ', ' + c.author : '') + ' (' + c.lic + ', Wikimedia Commons)';
        clist.appendChild(li);
      });
      syncUI();
      if (sel >= 0) fillPanel(sel, true);
    }
    function syncUI() {
      var inEgypt = mode !== 'globe';
      stage.setAttribute('data-mode', mode);
      cta.style.display = mode === 'globe' ? '' : 'none';
      bEgypt.style.display = inEgypt ? '' : 'none';
      bDest.style.display = mode === 'dest' ? '' : 'none';
      crumbs.style.display = inEgypt ? '' : 'none';
      if (mode === 'dest' && sel >= 0) bDest.textContent = DEST[sel][L].name;
      hint.textContent = mode === 'globe' ? tx.hintGlobe : mode === 'egypt' ? tx.hintEgypt : '';
      hint.style.display = mode === 'dest' ? 'none' : '';
      panel.classList.toggle('is-open', mode === 'dest');
      panel.setAttribute('aria-hidden', mode === 'dest' ? 'false' : 'true');
      var cs = chips.children;
      for (var i = 0; i < cs.length; i++) cs[i].classList.toggle('is-on', i === sel);
      canvas.style.cursor = mode === 'globe' ? 'grab' : 'default';
    }
    function fillPanel(i, keepPhoto) {
      var d = DEST[i], p = d.photos;
      if (!keepPhoto) photoIdx = 0;
      pH.textContent = d[L].name; pTag.textContent = d[L].tag; pP.textContent = d[L].desc;
      pLm.innerHTML = '';
      p.forEach(function (ph, k) {
        var li = el('li'); li.textContent = ph[L];
        pLm.appendChild(li);
      });
      pThumbs.innerHTML = '';
      p.forEach(function (ph, k) {
        var b = el('button', 'gl-th' + (k === photoIdx ? ' is-on' : '')); b.type = 'button';
        b.setAttribute('aria-label', ph[L]);
        var im = el('img'); im.src = ph.f; im.alt = ''; im.decoding = 'async';
        b.appendChild(im);
        b.addEventListener('click', function () { showPhoto(i, k); });
        pThumbs.appendChild(b);
      });
      pWa.textContent = tx.ask(d[L].name);
      pWa.href = WA + encodeURIComponent(L === 'ar' ? T.ar.wa(d[L].name, d.en.name) : tx.wa(d.en.name));
      showPhoto(i, photoIdx);
    }
    function showPhoto(i, k) {
      var d = DEST[i], ph = d.photos[k];
      photoIdx = k;
      pImg.classList.remove('is-in');
      var next = new Image();
      next.onload = function () { pImg.src = ph.f; pImg.alt = ph[L]; requestAnimationFrame(function () { pImg.classList.add('is-in'); }); };
      next.src = ph.f;
      if (pImg.getAttribute('src') === ph.f) pImg.classList.add('is-in');
      pCap.textContent = ph[L];
      var ts = pThumbs.children;
      for (var j = 0; j < ts.length; j++) ts[j].classList.toggle('is-on', j === k);
    }
    function openDest(i) {
      resize();
      var wasDest = mode === 'dest';
      fillPanel(i);
      fly('dest', i, wasDest ? 1100 : (mode === 'globe' ? 2200 : 1500));
      if (!visible) { stage.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' }); }
    }
    function step2(delta) {
      var i = (sel + delta + DEST.length) % DEST.length;
      openDest(i);
    }

    bEarth.addEventListener('click', function () { fly('globe', -1, 1800); });
    bEgypt.addEventListener('click', function () { fly('egypt', -1, 1300); });
    cta.addEventListener('click', function () { fly('egypt', -1, 2200); });
    pX.addEventListener('click', function () { fly('egypt', -1, 1200); });
    pPrev.addEventListener('click', function () { step2(L === 'ar' ? 1 : -1); });
    pNext.addEventListener('click', function () { step2(L === 'ar' ? -1 : 1); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && mode === 'dest') fly('egypt', -1, 1200); });

    function localXY(e) {
      var r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }
    function pinAt(x, y) {
      var best = -1, bd = isMobile() ? 24 : 18;
      for (var i = 0; i < pinPos.length; i++) {
        var dx = pinPos[i][0] - x, dy = pinPos[i][1] - y, dd = Math.sqrt(dx * dx + dy * dy);
        if (dd < bd) { bd = dd; best = i; }
      }
      return best;
    }
    function onEgyptMarker(x, y) {
      if (egyptPos[2] < 0.12) return false;
      var dx = egyptPos[0] - x, dy = egyptPos[1] - y;
      return Math.sqrt(dx * dx + dy * dy) < 70 || (dy > -70 && dy < 0 && Math.abs(dx) < 60);
    }
    canvas.addEventListener('pointerdown', function (e) {
      if (mode !== 'globe' || anim) { drag = { moved: 0, x0: e.clientX, y0: e.clientY, pan: false }; return; }
      drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: 0, pan: true };
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { }
      canvas.style.cursor = 'grabbing';
      lastInteract = performance.now();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (drag && drag.pan) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        drag.x = e.clientX; drag.y = e.clientY;
        var k = 1 / st.R / D2R;
        st.lon -= dx * k / Math.max(0.35, Math.cos(st.lat * D2R)); st.lat = clamp(st.lat + dy * k, -70, 70);
        lastInteract = performance.now(); introDone = true; schedule();
        return;
      }
      if (e.pointerType === 'mouse' && mode !== 'globe') {
        var p = localXY(e), h = pinAt(p[0], p[1]);
        if (h !== hover) { hover = h; canvas.style.cursor = h >= 0 ? 'pointer' : 'default'; schedule(); }
      } else if (e.pointerType === 'mouse' && mode === 'globe') {
        var q = localXY(e); canvas.style.cursor = onEgyptMarker(q[0], q[1]) ? 'pointer' : 'grab';
      }
    });
    function end(e) {
      if (!drag) return;
      var moved = drag.pan ? drag.moved : Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0);
      drag = null;
      canvas.style.cursor = mode === 'globe' ? 'grab' : 'default';
      if (moved < 8 && e.type === 'pointerup') {
        var p = localXY(e);
        if (mode === 'globe') {
          if (onEgyptMarker(p[0], p[1])) fly('egypt', -1, 2200);
        } else {
          var h = pinAt(p[0], p[1]);
          if (h >= 0) openDest(h);
        }
      }
    }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', function (e) { drag = null; });
    canvas.addEventListener('pointerleave', function () { if (hover !== -1) { hover = -1; schedule(); } });

    function resize() {
      var r = stage.getBoundingClientRect();
      var w = Math.round(r.width), h = Math.round(r.height);
      if (!w || !h) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var changed = w !== W || h !== H;
      W = w; H = h;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      panelW = isMobile() ? 0 : Math.min(400, Math.round(W * 0.38));
      if (changed && !anim) { var tg = target(mode, sel); st.R = tg.R; st.ox = tg.ox; st.oy = tg.oy; if (mode !== 'globe') { st.lon = tg.lon; st.lat = tg.lat; } }
      schedule();
    }
    window.addEventListener('resize', resize);

    var io = new IntersectionObserver(function (es) {
      var v = es[0].isIntersecting;
      if (v && !visible) { visible = true; if (!introDone) t0 = performance.now(); resize(); schedule(); }
      else if (!v) { visible = false; }
    }, { threshold: 0.05 });
    io.observe(stage);

    // language changes
    var flt = document.querySelector('.flt');
    if (flt) new MutationObserver(function () { if (lang() !== L) { setText(); resize(); schedule(); } }).observe(flt, { attributes: true, attributeFilter: ['lang'] });

    // deep link: #explore opens the section; #explore=dahab flies to a destination
    function fromHash() {
      var m = /^#explore[=\/](\w+)/.exec(location.hash);
      if (m) {
        for (var i = 0; i < DEST.length; i++) if (DEST[i].key === m[1]) { setTimeout(function (j) { openDest(j); }, 700, i); }
      }
    }
    setText(); resize(); st = target('globe', -1); st.lon = 101; st.lat = 18;
    if (REDUCED) { st.lon = 31; st.lat = 24; introDone = true; }
    fromHash();
    // test hook
    glInit();
    window.__fltGlobe = { pin: function (i) { return pinPos[i]; }, openDest: openDest, fly: fly, state: function () { return { mode: mode, sel: sel, st: st }; } };
  }

  function boot() {
    var m = document.getElementById('flt-globe-mount');
    if (m && !m.getAttribute('data-ready')) init(m);
  }
  new MutationObserver(boot).observe(document.documentElement, { childList: true, subtree: true });
  boot();
})();
