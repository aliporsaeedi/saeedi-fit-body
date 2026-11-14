// Adapted from the user-supplied renderer. Illustration only; no simulated AI generation.
  function h2r(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function r2h(a) { return '#' + a.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function mix(a, b, t) { var x = h2r(a), y = h2r(b); return r2h([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * t; })); }
  function lite(c, t) { return mix(c, '#ffffff', t); }
  function dark(c, t) { return mix(c, '#000000', t); }
  function lum(c) { var r = h2r(c); return .299 * r[0] + .587 * r[1] + .114 * r[2]; }

  /* ---------------- option catalogues ---------------- */
  var BODY = { lean: { sw: 42, aw: 14, lw: 15 }, athletic: { sw: 52, aw: 19, lw: 19 }, muscular: { sw: 64, aw: 25, lw: 24 } };
  var OUTFIT = {
    tshirt: { top: '#1d232a', sleeve: 'short', bottom: 'shorts', bc: '#171c22' },
    tank: { top: '#232a31', sleeve: 'none', bottom: 'shorts', bc: '#171c22' },
    hoodie: { top: '#16191d', sleeve: 'long', bottom: 'full', bc: '#20262c', hood: true },
    shorts: { top: null, sleeve: 'none', bottom: 'shorts', bc: '#13171b' },
    leggings: { top: '#232a31', sleeve: 'none', bottom: 'full', bc: '#101316', crop: true },
    tracksuit: { top: '#12161a', sleeve: 'long', bottom: 'full', bc: '#12161a', stripe: true }
  };
  var ACCENT = { lime: '#b6ff2e', deep: '#7bd10a', citrus: '#dcff3a', mint: '#5dff9a' };
  var SKINS = ['#f6d3b8', '#e8b48f', '#d09a72', '#a8714a', '#7a4b2c', '#4f301c'];
  var HAIRS = ['#171210', '#3a2418', '#6b4326', '#a9743a', '#d8b56a', '#8c8c8c'];

  var LABELS = {
    body: [['lean', 'لاغر'], ['athletic', 'ورزشکار'], ['muscular', 'عضلانی']],
    outfit: [['tshirt', 'تی‌شرت'], ['tank', 'رکابی'], ['hoodie', 'هودی'], ['shorts', 'شورت'], ['leggings', 'لگینگ'], ['tracksuit', 'گرمکن']],
    accent: [['lime', 'نئون لایم'], ['deep', 'لایم تیره'], ['citrus', 'لایم لیمویی'], ['mint', 'لایم نعنایی']],
    mood: [['calm', 'آرام'], ['focused', 'متمرکز'], ['happy', 'شاد'], ['determined', 'مصمم'], ['energetic', 'پرانرژی']],
    pose: [['standing', 'ایستاده'], ['flexing', 'عضله‌نمایی'], ['before', 'قبل تمرین'], ['after', 'بعد تمرین'], ['dumbbell', 'دمبل'], ['stretching', 'کششی'], ['running', 'دویدن']],
    hair: [['short', 'کوتاه'], ['fade', 'فید'], ['long', 'بلند'], ['bun', 'جمع‌شده'], ['bald', 'بدون مو']],
    face: [['oval', 'بیضی'], ['round', 'گرد'], ['square', 'مربعی']],
    gender: [['masc', 'مردانه'], ['neutral', 'خنثی'], ['fem', 'زنانه']]
  };

  var DEFAULT = {
    skin: SKINS[1], hair: HAIRS[1], hairStyle: 'short', faceShape: 'oval', gender: 'masc', beard: false, glasses: false,
    body: 'athletic', outfit: 'tank', accent: 'lime', mood: 'determined', pose: 'standing', remoteUrl: null, hasPhoto: false
  };
  var state = Object.assign({}, DEFAULT);
  var uid = 0;

  /* ---------------- SVG renderer ---------------- */
  function pt(x, y) { return x.toFixed(1) + ' ' + y.toFixed(1); }
  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }

  function armPts(pose, side, sw) {
    var cx = 120, sx = cx + side * sw, E, H;
    switch (pose) {
      case 'flexing': E = [sx + side * (sw * .7 + 8), 168]; H = [sx + side * (sw * .7 + 4), 112]; break;
      case 'before': E = [sx + side * 30, 198]; H = [cx + side * sw * .74, 232]; break;
      case 'after': if (side > 0) { E = [sx + side * 26, 172]; H = [cx + side * 30, 100]; } else { E = [sx + side * 7, 204]; H = [sx + side * 9, 248]; } break;
      case 'dumbbell': if (side > 0) { E = [sx + side * 8, 206]; H = [sx - side * 2, 172]; } else { E = [sx + side * 7, 204]; H = [sx + side * 9, 248]; } break;
      case 'stretching': E = [sx + side * 10, 112]; H = [cx + side * 8, 52]; break;
      case 'running': if (side > 0) { E = [sx + side * 22, 196]; H = [sx + side * 34, 164]; } else { E = [sx + side * 20, 200]; H = [sx + side * 34, 232]; } break;
      default: E = [sx + side * 7, 204]; H = [sx + side * 9, 248];
    }
    return { S: [sx, 160], E: E, H: H };
  }

  function arm(side, o) {
    var p = armPts(o.pose, side, o.sw), aw = o.aw, out = '';
    var sk = 'M' + pt(p.S[0], p.S[1]) + ' L' + pt(p.E[0], p.E[1]) + ' L' + pt(p.H[0], p.H[1]);
    out += '<path d="' + sk + '" fill="none" stroke="' + dark(o.skin, .32) + '" stroke-width="' + (aw + 3) + '" stroke-linecap="round" stroke-linejoin="round"/>';
    out += '<path d="' + sk + '" fill="none" stroke="url(#' + o.id + 'arm)" stroke-width="' + aw + '" stroke-linecap="round" stroke-linejoin="round"/>';
    if (o.pose === 'flexing' && o.bodyKey !== 'lean' && o.of.sleeve !== 'long') {
      var m = lerp(p.S, p.E, .6);
      out += '<ellipse cx="' + m[0].toFixed(1) + '" cy="' + (m[1] - aw * .3).toFixed(1) + '" rx="' + (aw * .8).toFixed(1) + '" ry="' + (aw * .6).toFixed(1) + '" fill="' + lite(o.skin, .12) + '" opacity=".9"/>';
    }
    if (o.of.sleeve === 'short') {
      var m2 = lerp(p.S, p.E, .62);
      out += '<path d="M' + pt(p.S[0], p.S[1]) + ' L' + pt(m2[0], m2[1]) + '" fill="none" stroke="' + o.of.top + '" stroke-width="' + (aw + 5) + '" stroke-linecap="round"/>';
      out += '<path d="M' + pt(m2[0] - side * 1, m2[1]) + ' L' + pt(m2[0], m2[1]) + '" stroke="' + o.ac + '" stroke-width="' + (aw + 5) + '" stroke-linecap="butt" opacity=".0"/>';
    } else if (o.of.sleeve === 'long') {
      var e2 = lerp(p.E, p.H, .78);
      out += '<path d="M' + pt(p.S[0], p.S[1]) + ' L' + pt(p.E[0], p.E[1]) + ' L' + pt(e2[0], e2[1]) + '" fill="none" stroke="' + o.of.top + '" stroke-width="' + (aw + 5) + '" stroke-linecap="round" stroke-linejoin="round"/>';
      out += '<circle cx="' + e2[0].toFixed(1) + '" cy="' + e2[1].toFixed(1) + '" r="' + ((aw + 5) / 2 + 1) + '" fill="none" stroke="' + o.ac + '" stroke-width="2.2"/>';
    }
    out += '<circle cx="' + p.H[0].toFixed(1) + '" cy="' + p.H[1].toFixed(1) + '" r="' + (aw * .62).toFixed(1) + '" fill="' + o.skin + '" stroke="' + dark(o.skin, .32) + '" stroke-width="1.5"/>';
    if (o.pose === 'dumbbell') {
      out += '<g transform="translate(' + p.H[0].toFixed(1) + ' ' + p.H[1].toFixed(1) + ')"><rect x="-17" y="-3.5" width="34" height="7" rx="3" fill="#2b3138"/>' +
        '<rect x="-22" y="-10" width="9" height="20" rx="3" fill="#1b2026" stroke="' + o.ac + '" stroke-width="1.6"/>' +
        '<rect x="13" y="-10" width="9" height="20" rx="3" fill="#1b2026" stroke="' + o.ac + '" stroke-width="1.6"/></g>';
    }
    return out;
  }

  function leg(hip, knee, foot, o) {
    var lw = o.lw, pts = knee ? [hip, knee, foot] : [hip, foot], d = 'M' + pts.map(function (q) { return pt(q[0], q[1]); }).join(' L');
    var out = '<path d="' + d + '" fill="none" stroke="' + dark(o.skin, .32) + '" stroke-width="' + (lw + 3) + '" stroke-linecap="round" stroke-linejoin="round"/>';
    out += '<path d="' + d + '" fill="none" stroke="' + o.skin + '" stroke-width="' + lw + '" stroke-linecap="round" stroke-linejoin="round"/>';
    var end, mid;
    if (o.of.bottom === 'shorts') { end = lerp(hip, knee || foot, knee ? .95 : .52); mid = [hip, end]; }
    else { end = lerp(knee || hip, foot, .93); mid = knee ? [hip, knee, end] : [hip, end]; }
    var d2 = 'M' + mid.map(function (q) { return pt(q[0], q[1]); }).join(' L');
    out += '<path d="' + d2 + '" fill="none" stroke="' + o.of.bc + '" stroke-width="' + (lw + 6) + '" stroke-linecap="round" stroke-linejoin="round"/>';
    out += '<path d="' + d2 + '" fill="none" stroke="' + o.ac + '" stroke-width="2" stroke-linecap="round" opacity=".85" transform="translate(' + (hip[0] < 120 ? -(lw / 2 + 2) : (lw / 2 + 2)) + ' 0)"/>';
    out += '<ellipse cx="' + foot[0].toFixed(1) + '" cy="' + (foot[1] + 4).toFixed(1) + '" rx="' + (lw * .85).toFixed(1) + '" ry="8" fill="#eef1ec" stroke="#10140f" stroke-width="1.4"/>';
    out += '<path d="M' + pt(foot[0] - lw * .8, foot[1] + 9) + ' L' + pt(foot[0] + lw * .8, foot[1] + 9) + '" stroke="' + o.ac + '" stroke-width="3" stroke-linecap="round"/>';
    return out;
  }

  function brow(s, mood, col) {
    var cx = 120, a = cx + s * 6, b = cx + s * 27, m = (a + b) / 2, iy, oy, dy = 0;
    if (mood === 'calm') { iy = 77; oy = 78; dy = -4; }
    else if (mood === 'focused') { iy = 79; oy = 74; dy = -2; }
    else if (mood === 'happy') { iy = 73; oy = 73; dy = -7; }
    else if (mood === 'determined') { iy = 80; oy = 71; dy = -1; }
    else { iy = 70; oy = 66; dy = -6; }
    return '<path d="M' + pt(a, iy) + ' Q' + pt(m, (iy + oy) / 2 + dy) + ' ' + pt(b, oy) + '" fill="none" stroke="' + col + '" stroke-width="' + (mood === 'determined' ? 5.4 : 4.4) + '" stroke-linecap="round"/>';
  }

  function mouth(mood, gender) {
    var cx = 120, lip = gender === 'fem' ? '#b8424f' : '#7a3a2e', teeth = '#fffdf8';
    if (mood === 'calm') return '<path d="M' + pt(cx - 10, 111) + ' Q' + pt(cx, 117) + ' ' + pt(cx + 10, 111) + '" fill="none" stroke="' + lip + '" stroke-width="3.2" stroke-linecap="round"/>';
    if (mood === 'focused') return '<path d="M' + pt(cx - 8, 113) + ' L' + pt(cx + 8, 113) + '" stroke="' + lip + '" stroke-width="3.2" stroke-linecap="round"/>';
    if (mood === 'determined') return '<path d="M' + pt(cx - 10, 114) + ' Q' + pt(cx + 2, 115) + ' ' + pt(cx + 11, 107) + '" fill="none" stroke="' + lip + '" stroke-width="3.4" stroke-linecap="round"/>';
    var big = mood === 'energetic', y1 = big ? 106 : 107, w = big ? 15 : 13, dep = big ? 134 : 128;
    return '<path d="M' + pt(cx - w, y1) + ' Q' + pt(cx, dep) + ' ' + pt(cx + w, y1) + ' Z" fill="#4d1713" stroke="' + lip + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M' + pt(cx - w + 2, y1 + 1.5) + ' Q' + pt(cx, y1 + 6) + ' ' + pt(cx + w - 2, y1 + 1.5) + ' L' + pt(cx + w - 3, y1 + 5) + ' Q' + pt(cx, y1 + 10) + ' ' + pt(cx - w + 3, y1 + 5) + ' Z" fill="' + teeth + '"/>' +
      (big ? '<ellipse cx="' + cx + '" cy="124" rx="6" ry="3.4" fill="#e8645a"/>' : '');
  }

  function hairFront(style, c) {
    var cx = 120;
    if (style === 'bald') return '';
    var main;
    if (style === 'short') {
      main = 'M' + pt(cx - 36, 90) + ' C' + pt(cx - 38, 50) + ' ' + pt(cx - 10, 36) + ' ' + pt(cx + 6, 38) + ' C' + pt(cx + 30, 40) + ' ' + pt(cx + 39, 60) + ' ' + pt(cx + 36, 90) + ' C' + pt(cx + 32, 74) + ' ' + pt(cx + 24, 66) + ' ' + pt(cx + 4, 62) + ' C' + pt(cx - 14, 66) + ' ' + pt(cx - 28, 72) + ' ' + pt(cx - 36, 90) + ' Z';
    } else if (style === 'long') {
      main = 'M' + pt(cx - 37, 96) + ' C' + pt(cx - 42, 48) + ' ' + pt(cx - 12, 34) + ' ' + pt(cx + 4, 36) + ' C' + pt(cx + 30, 38) + ' ' + pt(cx + 42, 58) + ' ' + pt(cx + 37, 96) + ' C' + pt(cx + 30, 70) + ' ' + pt(cx + 16, 62) + ' ' + pt(cx - 6, 60) + ' C' + pt(cx - 22, 64) + ' ' + pt(cx - 32, 76) + ' ' + pt(cx - 37, 96) + ' Z';
    } else { // fade + bun share a tight cap
      main = 'M' + pt(cx - 33, 80) + ' C' + pt(cx - 34, 52) + ' ' + pt(cx - 12, 41) + ' ' + pt(cx, 41) + ' C' + pt(cx + 14, 41) + ' ' + pt(cx + 34, 52) + ' ' + pt(cx + 33, 80) + ' C' + pt(cx + 26, 66) + ' ' + pt(cx + 14, 59) + ' ' + pt(cx, 59) + ' C' + pt(cx - 14, 59) + ' ' + pt(cx - 26, 66) + ' ' + pt(cx - 33, 80) + ' Z';
    }
    var out = '<path d="' + main + '" fill="url(#gHair)" stroke="' + dark(c, .45) + '" stroke-width="1.4" stroke-linejoin="round"/>';
    out += '<path d="M' + pt(cx - 14, 46) + ' Q' + pt(cx + 4, 42) + ' ' + pt(cx + 20, 48) + '" fill="none" stroke="' + lite(c, .35) + '" stroke-width="3" stroke-linecap="round" opacity=".55"/>';
    if (style === 'fade') out += '<path d="M' + pt(cx - 33, 82) + ' Q' + pt(cx - 34, 98) + ' ' + pt(cx - 29, 106) + '" stroke="' + c + '" stroke-width="5" fill="none" opacity=".35" stroke-linecap="round"/><path d="M' + pt(cx + 33, 82) + ' Q' + pt(cx + 34, 98) + ' ' + pt(cx + 29, 106) + '" stroke="' + c + '" stroke-width="5" fill="none" opacity=".35" stroke-linecap="round"/>';
    return out;
  }

  function figure(st, o) {
    var cx = 120, id = o.id, body = BODY[st.body] || BODY.athletic, of = OUTFIT[st.outfit] || OUTFIT.tank;
    var fem = st.gender === 'fem', sw = body.sw * (fem ? .88 : 1), aw = body.aw * (fem ? .9 : 1), lw = body.lw * (fem ? .94 : 1);
    var ac = ACCENT[st.accent] || ACCENT.lime, skin = st.skin, hairC = st.hair, pose = o.pose, mood = o.mood;
    var base = { id: id, pose: pose, sw: sw, aw: aw, lw: lw, skin: skin, of: of, ac: ac, bodyKey: st.body };
    var g = '';

    // legs
    var spread = { flexing: .62, before: .6, stretching: .64, dumbbell: .5, after: .46 }[pose] || .46;
    var hipL = [cx - sw * .38, 236], hipR = [cx + sw * .38, 236], l, r;
    if (pose === 'running') {
      g += leg(hipL, [cx - sw * .5 - 8, 272], [cx - sw * .5 - 32, 292], base) + leg(hipR, [cx + sw * .5 + 18, 268], [cx + sw * .5 + 24, 300], base);
    } else {
      l = [cx - sw * spread - 2, 303]; r = [cx + sw * spread + 2, 303];
      g += leg(hipL, null, l, base) + leg(hipR, null, r, base);
    }
    // pelvis + waistband
    g += '<rect x="' + (cx - sw * .84).toFixed(1) + '" y="232" width="' + (sw * 1.68).toFixed(1) + '" height="28" rx="11" fill="' + of.bc + '"/>' +
      '<rect x="' + (cx - sw * .84).toFixed(1) + '" y="232" width="' + (sw * 1.68).toFixed(1) + '" height="6" rx="3" fill="' + ac + '"/>';
    // torso skin + shading
    var torso = 'M' + pt(cx - sw, 154) + ' Q' + pt(cx, 140) + ' ' + pt(cx + sw, 154) + ' L' + pt(cx + sw * .8, 240) + ' Q' + pt(cx, 248) + ' ' + pt(cx - sw * .8, 240) + ' Z';
    g += '<path d="' + torso + '" fill="url(#' + id + 'sk)" stroke="' + dark(skin, .32) + '" stroke-width="1.5" stroke-linejoin="round"/>';
    if (!of.top) { // bare torso: chest + abs, or sports bra
      var sh = dark(skin, .22);
      g += '<path d="M' + pt(cx, 162) + ' L' + pt(cx, 232) + '" stroke="' + sh + '" stroke-width="1.6" opacity=".6"/>';
      if (fem) {
        g += '<path d="M' + pt(cx - sw * .78, 158) + ' Q' + pt(cx, 150) + ' ' + pt(cx + sw * .78, 158) + ' L' + pt(cx + sw * .72, 184) + ' Q' + pt(cx, 192) + ' ' + pt(cx - sw * .72, 184) + ' Z" fill="' + ac + '"/>';
      } else {
        g += '<path d="M' + pt(cx - sw * .7, 186) + ' Q' + pt(cx - sw * .3, 196) + ' ' + pt(cx, 184) + ' Q' + pt(cx + sw * .3, 196) + ' ' + pt(cx + sw * .7, 186) + '" fill="none" stroke="' + sh + '" stroke-width="2" stroke-linecap="round" opacity=".7"/>';
        [202, 216, 230].forEach(function (y) { g += '<path d="M' + pt(cx - sw * .38, y) + ' Q' + pt(cx - sw * .18, y + 4) + ' ' + pt(cx - 4, y) + ' M' + pt(cx + 4, y) + ' Q' + pt(cx + sw * .18, y + 4) + ' ' + pt(cx + sw * .38, y) + '" fill="none" stroke="' + sh + '" stroke-width="1.8" stroke-linecap="round" opacity=".55"/>'; });
      }
    } else { // clothing top
      var hem = of.crop ? 214 : 242, tw = of.sleeve === 'none' ? .74 : 1;
      var top = 'M' + pt(cx - sw * tw, 152) + ' Q' + pt(cx, 140) + ' ' + pt(cx + sw * tw, 152) + ' L' + pt(cx + sw * (of.crop ? .72 : .82), hem) + ' Q' + pt(cx, hem + 7) + ' ' + pt(cx - sw * (of.crop ? .72 : .82), hem) + ' Z';
      g += '<path d="' + top + '" fill="' + of.top + '" stroke="#000" stroke-opacity=".5" stroke-width="1.4" stroke-linejoin="round"/>';
      g += '<path d="M' + pt(cx - sw * .5, 170) + ' Q' + pt(cx - sw * .2, 200) + ' ' + pt(cx - sw * .1, 238) + '" fill="none" stroke="#fff" stroke-opacity=".05" stroke-width="10" stroke-linecap="round"/>';
      g += '<path d="M' + pt(cx - 15, 146) + ' Q' + pt(cx, 170) + ' ' + pt(cx + 15, 146) + ' Z" fill="' + dark(skin, .12) + '"/>';
      var hx = cx, hy = 192, hr = 9; // lime hex emblem
      g += '<polygon points="' + [0, 1, 2, 3, 4, 5].map(function (i) { var a = Math.PI / 3 * i - Math.PI / 6; return (hx + hr * Math.cos(a)).toFixed(1) + ',' + (hy + hr * Math.sin(a)).toFixed(1); }).join(' ') + '" fill="' + ac + '"/>';
      if (of.stripe) g += '<path d="M' + pt(cx - sw * .78, 160) + ' L' + pt(cx - sw * .72, 240) + ' M' + pt(cx + sw * .78, 160) + ' L' + pt(cx + sw * .72, 240) + '" stroke="' + ac + '" stroke-width="3" fill="none"/>';
      if (of.hood) g += '<path d="M' + pt(cx - 30, 142) + ' Q' + pt(cx, 178) + ' ' + pt(cx + 30, 142) + ' Q' + pt(cx, 150) + ' ' + pt(cx - 30, 142) + ' Z" fill="#23282e" stroke="#000" stroke-opacity=".5"/><path d="M' + pt(cx - 8, 160) + ' L' + pt(cx - 10, 186) + ' M' + pt(cx + 8, 160) + ' L' + pt(cx + 10, 186) + '" stroke="' + ac + '" stroke-width="2" stroke-linecap="round"/>';
    }
    // arms
    base.pose = pose; g += arm(-1, base) + arm(1, base);
    // neck + towel (after-workout)
    g += '<rect x="' + (cx - 13) + '" y="122" width="26" height="30" rx="8" fill="' + dark(skin, .1) + '"/>';
    if (pose === 'after') g += '<path d="M' + pt(cx - 28, 142) + ' Q' + pt(cx, 166) + ' ' + pt(cx + 28, 142) + ' L' + pt(cx + 22, 178) + ' L' + pt(cx + 8, 168) + ' Q' + pt(cx, 172) + ' ' + pt(cx - 8, 168) + ' L' + pt(cx - 22, 178) + ' Z" fill="' + ac + '" stroke="#000" stroke-opacity=".35" stroke-width="1.2"/>';
    // head ------------------------------------------------------
    var rx = (st.faceShape === 'round' ? 38 : 34) - (fem ? 2 : 0), ry = st.faceShape === 'round' ? 38 : 40;
    if (st.hairStyle === 'long') g = '<path d="M' + pt(cx - 40, 80) + ' C' + pt(cx - 50, 130) + ' ' + pt(cx - 48, 170) + ' ' + pt(cx - 34, 188) + ' L' + pt(cx + 34, 188) + ' C' + pt(cx + 48, 170) + ' ' + pt(cx + 50, 130) + ' ' + pt(cx + 40, 80) + ' Z" fill="' + dark(hairC, .25) + '" stroke="' + dark(hairC, .5) + '" stroke-width="1.4"/>' + g; // back hair sits behind body
    if (st.hairStyle === 'bun') g += '<circle cx="' + cx + '" cy="36" r="15" fill="' + hairC + '" stroke="' + dark(hairC, .45) + '" stroke-width="1.4"/>';
    g += '<ellipse cx="' + (cx - rx + 1) + '" cy="94" rx="6.5" ry="9" fill="' + dark(skin, .06) + '" stroke="' + dark(skin, .32) + '" stroke-width="1.3"/><ellipse cx="' + (cx + rx - 1) + '" cy="94" rx="6.5" ry="9" fill="' + dark(skin, .06) + '" stroke="' + dark(skin, .32) + '" stroke-width="1.3"/>';
    var face = st.faceShape === 'square'
      ? '<rect x="' + (cx - 35 + (fem ? 2 : 0)) + '" y="54" width="' + (70 - (fem ? 4 : 0)) + '" height="78" rx="' + (fem ? 28 : 22) + '" fill="url(#' + id + 'face)" stroke="' + dark(skin, .35) + '" stroke-width="1.6"/>'
      : '<ellipse cx="' + cx + '" cy="92" rx="' + rx + '" ry="' + ry + '" fill="url(#' + id + 'face)" stroke="' + dark(skin, .35) + '" stroke-width="1.6"/>';
    g += face;
    g += '<ellipse cx="' + (cx - 8) + '" cy="64" rx="13" ry="5" fill="#fff" opacity=".16"/>';
    g += '<path d="M' + pt(cx - rx + 2, 82) + ' Q' + pt(cx - rx - 2, 102) + ' ' + pt(cx - 24, 124) + '" fill="none" stroke="' + ac + '" stroke-width="2.6" stroke-linecap="round" opacity=".6"/>'; // rim light
    if (mood === 'happy' || mood === 'energetic') g += '<ellipse cx="' + (cx - 24) + '" cy="106" rx="7" ry="4.5" fill="#ff7a6e" opacity=".26"/><ellipse cx="' + (cx + 24) + '" cy="106" rx="7" ry="4.5" fill="#ff7a6e" opacity=".26"/>';
    g += '<path d="M' + pt(cx - 3, 97) + ' Q' + pt(cx + 1, 104) + ' ' + pt(cx + 5, 101) + '" fill="none" stroke="' + dark(skin, .3) + '" stroke-width="2.2" stroke-linecap="round"/>';
    // eyes (large, glossy)
    [-1, 1].forEach(function (s) {
      var ex = cx + s * 15, big = mood === 'energetic' ? 11.2 : 10.4;
      g += '<ellipse cx="' + ex + '" cy="91" rx="9.4" ry="' + big + '" fill="#fff" stroke="' + dark(skin, .45) + '" stroke-width="1.3"/>' +
        '<circle cx="' + (ex + s * -.5) + '" cy="92" r="6.6" fill="url(#' + id + 'iris)"/><circle cx="' + (ex + s * -.5) + '" cy="92" r="3.1" fill="#0b0705"/>' +
        '<circle cx="' + (ex + 2.4) + '" cy="88.2" r="2.3" fill="#fff"/><circle cx="' + (ex - 2.2) + '" cy="95.6" r="1.1" fill="#fff" opacity=".9"/>' +
        '<path d="M' + pt(ex - 9.4, 89) + ' Q' + pt(ex, 80 - (mood === 'focused' ? -2 : 0)) + ' ' + pt(ex + 9.4, 89) + '" fill="none" stroke="#120a06" stroke-width="2.8" stroke-linecap="round"/>';
      if (fem) g += '<path d="M' + pt(ex + s * 9, 88) + ' l' + (s * 5) + ',-4 M' + pt(ex + s * 8, 91) + ' l' + (s * 5) + ',-1" stroke="#120a06" stroke-width="2" stroke-linecap="round"/>';
    });
    var bc = st.hairStyle === 'bald' ? dark(skin, .5) : dark(hairC, .2);
    g += brow(-1, mood, bc) + brow(1, mood, bc);
    // hair front
    g += hairFront(st.hairStyle, hairC);
    // beard
    if (st.beard) g += '<path d="M' + pt(cx - rx + 1, 94) + ' C' + pt(cx - rx - 1, 128) + ' ' + pt(cx - 16, 144) + ' ' + pt(cx, 144) + ' C' + pt(cx + 16, 144) + ' ' + pt(cx + rx + 1, 128) + ' ' + pt(cx + rx - 1, 94) + ' C' + pt(cx + 26, 112) + ' ' + pt(cx + 14, 110) + ' ' + pt(cx, 110) + ' C' + pt(cx - 14, 110) + ' ' + pt(cx - 26, 112) + ' ' + pt(cx - rx + 1, 94) + ' Z" fill="' + dark(hairC, .1) + '" stroke="' + dark(hairC, .5) + '" stroke-width="1.2"/><path d="M' + pt(cx - 13, 108) + ' Q' + pt(cx, 102) + ' ' + pt(cx + 13, 108) + ' Q' + pt(cx, 111) + ' ' + pt(cx - 13, 108) + ' Z" fill="' + dark(hairC, .1) + '"/>';
    g += mouth(mood, st.gender);
    if (st.glasses) g += '<g fill="rgba(150,220,255,.14)" stroke="#0d1013" stroke-width="2.8"><rect x="' + (cx - 31) + '" y="78" width="27" height="23" rx="9"/><rect x="' + (cx + 4) + '" y="78" width="27" height="23" rx="9"/><path d="M' + pt(cx - 4, 88) + ' L' + pt(cx + 4, 88) + ' M' + pt(cx - 31, 87) + ' L' + pt(cx - rx - 4, 88) + ' M' + pt(cx + 31, 87) + ' L' + pt(cx + rx + 4, 88) + '" fill="none"/></g>';
    if (pose === 'after') g += '<path d="M' + pt(cx + 36, 70) + ' q-4,7 0,11 q4,-4 0,-11z M' + pt(cx - 38, 88) + ' q-3,6 0,9 q3,-3 0,-9z" fill="#8fe0ff"/>';
    if (pose === 'running') g = '<g stroke="' + ac + '" stroke-width="3" stroke-linecap="round" opacity=".55"><path d="M10 120h34M0 160h40M14 200h30"/></g><g transform="rotate(-6 120 200)">' + g + '</g>';
    return g;
  }

  var VB = { full: '0 0 240 320', half: '20 14 200 252', head: '62 26 116 126' };

  function svg(st, opt) {
    st = st || state; opt = opt || {};
    if (st.remoteUrl) return '<img alt="آواتار" decoding="async" loading="lazy" src="' + String(st.remoteUrl).replace(/"/g, '&quot;') + '">';
    var id = 'a' + (++uid) + '_', ac = ACCENT[st.accent] || ACCENT.lime, skin = st.skin;
    var o = { id: id, pose: opt.pose || st.pose, mood: opt.mood || st.mood };
    var defs = '<defs>' +
      '<radialGradient id="' + id + 'face" cx=".4" cy=".32" r=".85"><stop offset="0" stop-color="' + lite(skin, .2) + '"/><stop offset=".6" stop-color="' + skin + '"/><stop offset="1" stop-color="' + dark(skin, .24) + '"/></radialGradient>' +
      '<linearGradient id="' + id + 'sk" x1="0" x2="1"><stop offset="0" stop-color="' + lite(skin, .06) + '"/><stop offset=".55" stop-color="' + skin + '"/><stop offset="1" stop-color="' + dark(skin, .2) + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'arm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + lite(skin, .08) + '"/><stop offset="1" stop-color="' + dark(skin, .12) + '"/></linearGradient>' +
      '<radialGradient id="' + id + 'iris" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#8a5a34"/><stop offset=".6" stop-color="#4a2c16"/><stop offset="1" stop-color="#25140a"/></radialGradient>' +
      '<linearGradient id="gHair" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + lite(st.hair, .12) + '"/><stop offset=".6" stop-color="' + st.hair + '"/><stop offset="1" stop-color="' + dark(st.hair, .3) + '"/></linearGradient>' +
      '<radialGradient id="' + id + 'glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="' + ac + '" stop-opacity=".38"/><stop offset="1" stop-color="' + ac + '" stop-opacity="0"/></radialGradient>' +
      '</defs>';
    // NB: gHair id is shared on purpose; the last render wins visually only for hair tint, so scope it per svg:
    defs = defs.split('gHair').join(id + 'hair');
    var body = figure(st, o).split('url(#gHair)').join('url(#' + id + 'hair)').split('gHair').join(id + 'hair');
    var floor = '<ellipse cx="120" cy="312" rx="62" ry="8" fill="#000" opacity=".5"/><circle cx="120" cy="170" r="118" fill="url(#' + id + 'glow)"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (VB[opt.crop] || VB.full) + '" role="img" aria-label="Personal illustrated fitness avatar" preserveAspectRatio="xMidYMid meet">' + defs + floor + body + '</svg>';
  }


export const avatarDefaults={...DEFAULT,remoteUrl:null};
export function avatarSvg(design:any={},options:any={}){const st={...DEFAULT,...design,remoteUrl:null};for(const k of ["skin","hair"])if(!/^#[a-f0-9]{6}$/i.test(st[k]))st[k]=DEFAULT[k];for(const [k,values]of Object.entries({body:Object.keys(BODY),outfit:Object.keys(OUTFIT),accent:Object.keys(ACCENT),mood:LABELS.mood.map(x=>x[0]),pose:LABELS.pose.map(x=>x[0]),hairStyle:LABELS.hair.map(x=>x[0]),faceShape:LABELS.face.map(x=>x[0]),gender:LABELS.gender.map(x=>x[0])}))if(!(values as string[]).includes(st[k]))st[k]=DEFAULT[k];return svg(st,{crop:["head","half","full"].includes(options.crop)?options.crop:"full"});}
export const avatarOptions={skin:SKINS,hairColor:HAIRS,body:LABELS.body,outfit:LABELS.outfit,pose:LABELS.pose,hairStyle:LABELS.hair,faceShape:LABELS.face,gender:LABELS.gender,mood:LABELS.mood,accent:LABELS.accent};
