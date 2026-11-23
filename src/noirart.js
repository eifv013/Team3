/*
 * 누아르 각성 그림(0.8.4) — 전설 등급이거나 ★5인 파트너가 '각성'하면 쓰는 멋있고 카리스마 있는 반신 초상(SVG 200×200).
 *   빛: 왼쪽에서 들어오는 한 줄기 불빛(림 라이트) · 오른쪽은 그림자 · 블라인드 줄무늬 · 비 · 가로등.
 *   옷: 깃 세운 트렌치코트 · 셔츠 · 넥타이. 등급마다: 일반 = 코트 / 희귀 = 중절모 / 영웅 = 붉은 목도리 · 은 배지 / 전설 = 금빛 림 라이트 · 금 배지 · 금 띠 모자.
 *   얼굴: 가늘고 날카로운 눈(빛나는 홍채) · 짙은 눈썹 · 한쪽만 올라간 입꼬리.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Team3NoirArt = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var uid = 0;
  function P(d, a) { return '<path d="' + d + '" ' + (a || '') + '/>'; }
  function mir(d) { return d; }

  // 종마다: 머리 모양(sil 에 들어가 그림자 · 림 라이트를 받는다) + 얼굴 + 모자 크기
  var SP = {
    corgi: {
      name: '단서', kind: '웰시코기', fur: '#B0662E', eye: '#F2B33D', hat: 'small',
      head: function () {
        return {
          sil: ['M66 78 L56 22 L92 60 Z', 'M134 78 L144 22 L108 60 Z', 'M62 102 Q60 72 78 62 L100 58 L122 62 Q140 72 138 102 Q136 126 100 134 Q64 126 62 102 Z'],
          draw: P('M66 78 L56 22 L92 60 Z', 'fill="#A35E2A" stroke="#1A0F0A" stroke-width="3" stroke-linejoin="round"') +
            P('M134 78 L144 22 L108 60 Z', 'fill="#A35E2A" stroke="#1A0F0A" stroke-width="3" stroke-linejoin="round"') +
            P('M70 70 L63 38 L84 61 Z', 'fill="#5A2E16"') + P('M130 70 L137 38 L116 61 Z', 'fill="#5A2E16"') +
            P('M62 102 Q60 72 78 62 L100 58 L122 62 Q140 72 138 102 Q136 126 100 134 Q64 126 62 102 Z', 'fill="#B0662E" stroke="#1A0F0A" stroke-width="3"') +
            P('M100 66 L91 86 Q84 106 88 118 Q100 132 112 118 Q116 106 109 86 Z', 'fill="#E6DAC4"') +
            '<ellipse cx="100" cy="114" rx="17" ry="12" fill="#EDE3D0"/>'
        };
      },
      faceY: 92, noseY: 104
    },
    siamese: {
      name: '모카', kind: '샴', fur: '#CDBFA8', eye: '#8FD8FF', hat: 'small', slit: true,
      head: function () {
        return {
          sil: ['M68 80 L64 30 L94 62 Z', 'M132 80 L136 30 L106 62 Z', 'M64 104 Q62 74 80 64 L100 60 L120 64 Q138 74 136 104 Q132 128 100 134 Q68 128 64 104 Z'],
          draw: P('M68 80 L64 30 L94 62 Z', 'fill="#3A2C24" stroke="#120C09" stroke-width="3" stroke-linejoin="round"') +
            P('M132 80 L136 30 L106 62 Z', 'fill="#3A2C24" stroke="#120C09" stroke-width="3" stroke-linejoin="round"') +
            P('M64 104 Q62 74 80 64 L100 60 L120 64 Q138 74 136 104 Q132 128 100 134 Q68 128 64 104 Z', 'fill="#CDBFA8" stroke="#120C09" stroke-width="3"') +
            '<ellipse cx="100" cy="106" rx="28" ry="25" fill="#4A3830" opacity=".9"/>' +
            P('M76 116 L52 112 M76 120 L54 122 M124 116 L148 112 M124 120 L146 122', 'stroke="#E8E0D0" stroke-width="1.2" opacity=".55"')
        };
      },
      faceY: 94, noseY: 108
    },
    fox: {
      name: '노을', kind: '여우', fur: '#B5532A', eye: '#FFB23E', hat: 'small',
      head: function () {
        return {
          sil: ['M70 78 L62 18 L94 58 Z', 'M130 78 L138 18 L106 58 Z', 'M66 96 Q64 70 84 62 L100 60 L116 62 Q136 70 134 96 L120 120 L100 140 L80 120 Z'],
          draw: P('M70 78 L62 18 L94 58 Z', 'fill="#A9481F" stroke="#160A05" stroke-width="3" stroke-linejoin="round"') +
            P('M130 78 L138 18 L106 58 Z', 'fill="#A9481F" stroke="#160A05" stroke-width="3" stroke-linejoin="round"') +
            P('M62 18 L66 40 L76 34 Z', 'fill="#120A06"') + P('M138 18 L134 40 L124 34 Z', 'fill="#120A06"') +
            P('M66 96 Q64 70 84 62 L100 60 L116 62 Q136 70 134 96 L120 120 L100 140 L80 120 Z', 'fill="#B5532A" stroke="#160A05" stroke-width="3" stroke-linejoin="round"') +
            P('M68 100 L100 140 L82 120 Q72 110 68 100 Z', 'fill="#ECE2D2"') + P('M132 100 L100 140 L118 120 Q128 110 132 100 Z', 'fill="#ECE2D2"')
        };
      },
      faceY: 90, noseY: 128, narrow: true
    },
    tiger: {
      name: '범수', kind: '호랑이', fur: '#C7782F', eye: '#F5C842', hat: 'big',
      head: function () {
        return {
          sil: ['M66 74 Q58 50 80 56 Z', 'M134 74 Q142 50 120 56 Z', 'M56 104 Q54 72 78 62 L100 58 L122 62 Q146 72 144 104 Q142 128 100 138 Q58 128 56 104 Z'],
          draw: P('M66 74 Q58 50 80 56 Z', 'fill="#B86C28" stroke="#140B05" stroke-width="3"') + P('M134 74 Q142 50 120 56 Z', 'fill="#B86C28" stroke="#140B05" stroke-width="3"') +
            P('M56 104 Q54 72 78 62 L100 58 L122 62 Q146 72 144 104 Q142 128 100 138 Q58 128 56 104 Z', 'fill="#C7782F" stroke="#140B05" stroke-width="3"') +
            '<ellipse cx="100" cy="116" rx="24" ry="16" fill="#EADFC9"/>' +
            P('M100 62 L95 74 L100 82 L105 74 Z M82 66 L78 80 M118 66 L122 80 M58 98 L76 100 M58 108 L76 108 M142 98 L124 100 M142 108 L124 108', 'fill="#140B05" stroke="#140B05" stroke-width="3.2" stroke-linecap="round"')
        };
      },
      faceY: 92, noseY: 108
    }
  };

  // 날카로운 눈: 아몬드꼴 · 빛나는 홍채 · 세로 동공 · 짙은 눈썹(왼쪽 눈썹이 조금 더 내려온 '노려봄')
  function eyes(s, y, grade) {
    var c = s.eye, g = '';
    [[-1, 0], [1, 1]].forEach(function (k) {
      var sx = k[0], x = 100 + sx * 16, tilt = k[1] ? -2 : 1;
      var d = 'M' + (x - 11 * sx) + ' ' + (y + 1) + ' Q' + x + ' ' + (y - 7 + tilt) + ' ' + (x + 11 * sx) + ' ' + (y - 3 + tilt) + ' Q' + x + ' ' + (y + 6) + ' ' + (x - 11 * sx) + ' ' + (y + 1) + ' Z';
      g += P(d, 'fill="' + c + '" stroke="#0A0705" stroke-width="2"');
      g += '<ellipse cx="' + (x + sx * 1) + '" cy="' + (y - 1) + '" rx="' + (s.slit ? 1.6 : 2.6) + '" ry="5" fill="#0A0705"/>';
      g += '<circle cx="' + (x - 2) + '" cy="' + (y - 3) + '" r="1.4" fill="#fff" opacity=".9"/>';
      // 빛나는 눈(어둠 속에서)
      g += P(d, 'class="nz-glow" fill="none" stroke="' + c + '" stroke-width="6" opacity=".28"');
      // 눈썹
      g += P('M' + (x - 13 * sx) + ' ' + (y - 9 + (k[1] ? 1 : 3)) + ' L' + (x + 12 * sx) + ' ' + (y - 11 + (k[1] ? -2 : 0)), 'stroke="#0A0705" stroke-width="4.5" stroke-linecap="round"');
    });
    return g;
  }
  function nose(s) {
    var y = s.noseY;
    return P('M' + 93 + ' ' + y + ' Q100 ' + (y - 4) + ' 107 ' + y + ' Q104 ' + (y + 6) + ' 100 ' + (y + 7) + ' Q96 ' + (y + 6) + ' 93 ' + y + ' Z', 'fill="#0E0B0A"') +
      // 한쪽만 올라간 입꼬리(씩 웃음)
      P('M100 ' + (y + 7) + ' V' + (y + 11) + ' M91 ' + (y + 12) + ' Q99 ' + (y + 14) + ' 100 ' + (y + 11) + ' Q105 ' + (y + 13) + ' 110 ' + (y + 8), 'stroke="#0E0B0A" stroke-width="2.4" fill="none" stroke-linecap="round"');
  }
  // 깃 세운 트렌치코트 · 셔츠 · 넥타이
  function coat(grade) {
    var tie = grade === 'h' || grade === 'l' ? '#8E1F24' : '#3A3F4A';
    var sil = ['M28 200 L40 160 Q58 144 82 140 L118 140 Q142 144 160 160 L172 200 Z', 'M80 146 L64 112 L94 132 Z', 'M120 146 L136 112 L106 132 Z'];
    var g = P(sil[0], 'fill="#6B5A44" stroke="#120E0A" stroke-width="3"') +   // 트렌치(낡은 카키)
      P('M86 140 L100 176 L114 140 Z', 'fill="#D6CFC0"') +
      P('M96 148 L104 148 L106 172 L100 182 L94 172 Z', 'fill="' + tie + '" stroke="#0E0B0A" stroke-width="1.5"') +
      P('M82 140 L100 182 L72 162 L66 146 Z', 'fill="#5A4A37" stroke="#120E0A" stroke-width="2.5" stroke-linejoin="round"') +
      P('M118 140 L100 182 L128 162 L134 146 Z', 'fill="#5A4A37" stroke="#120E0A" stroke-width="2.5" stroke-linejoin="round"') +
      P(sil[1], 'fill="#5E4E3A" stroke="#120E0A" stroke-width="2.5" stroke-linejoin="round"') +
      P(sil[2], 'fill="#5E4E3A" stroke="#120E0A" stroke-width="2.5" stroke-linejoin="round"') +
      // 견장 · 단추
      '<circle cx="70" cy="178" r="3" fill="#2A2118"/><circle cx="130" cy="178" r="3" fill="#2A2118"/>';
    if (grade === 'h') g += P('M78 142 Q100 156 122 142 L120 152 Q100 164 80 152 Z', 'fill="#8E1F24" stroke="#2A0608" stroke-width="2"');
    if (grade === 'h' || grade === 'l') {
      var b = grade === 'l' ? ['#FFE48A', '#C9961A'] : ['#E8EDF2', '#8D98A6'];
      g += P('M122 162 l8 -4 l8 4 l-2 10 l-6 4 l-6 -4 z', 'fill="' + b[0] + '" stroke="' + b[1] + '" stroke-width="1.5"') + '<circle cx="130" cy="166" r="2.2" fill="' + b[1] + '"/>';
    }
    return { sil: sil, draw: g };
  }
  // 중절모: 큰 귀 동물은 귀 사이에 작게 눌러 쓰고, 귀가 작은 동물은 크게 비스듬히
  function hat(kind, grade) {
    var band = grade === 'l' ? '#E0B23A' : grade === 'h' ? '#8E1F24' : '#1A1A1E';
    if (kind === 'small') {
      var crown = 'M80 60 L84 38 Q100 32 116 38 L120 60 Z', brim = 'M64 62 Q100 52 136 62 Q100 70 64 62 Z';
      return { sil: [crown, brim], rot: 'rotate(-7 100 56)', draw: '<g transform="rotate(-7 100 56)">' + P(brim, 'fill="#1E1F24" stroke="#08080A" stroke-width="2.5"') + P(crown, 'fill="#25262C" stroke="#08080A" stroke-width="2.5"') +
        P('M90 40 Q100 47 110 40', 'stroke="#0E0E12" stroke-width="2.5" fill="none"') + '<rect x="81" y="52" width="38" height="6" fill="' + band + '"/></g>' };
    }
    var c2 = 'M72 64 L78 32 Q100 24 122 32 L128 64 Z', b2 = 'M42 66 Q100 50 158 66 Q100 78 42 66 Z';
    return { sil: [c2, b2], rot: 'rotate(-8 100 60)', draw: '<g transform="rotate(-8 100 60)">' + P(b2, 'fill="#1E1F24" stroke="#08080A" stroke-width="2.5"') + P(c2, 'fill="#25262C" stroke="#08080A" stroke-width="2.5"') +
      P('M88 32 Q100 42 112 32', 'stroke="#0E0E12" stroke-width="3" fill="none"') + '<rect x="73" y="54" width="54" height="8" fill="' + band + '"/></g>' };
  }


  /* ---------- 나머지 26종: 머리 모양 · 귀 · 주둥이 · 무늬를 조합해서 만든다 ---------- */
  function ell(cx, cy, rx, ry) { return 'M' + (cx - rx) + ' ' + cy + ' A' + rx + ' ' + ry + ' 0 1 0 ' + (cx + rx) + ' ' + cy + ' A' + rx + ' ' + ry + ' 0 1 0 ' + (cx - rx) + ' ' + cy + ' Z'; }
  function earPair(e) { if (!e) return []; if (typeof e === 'string') return [e, mirror(e)]; return [ell(e[0], e[1], e[2], e[3]), ell(200 - e[0], e[1], e[2], e[3])]; }
  function mirror(d) { return d.replace(/([MLQA ])(-?[0-9.]+) (-?[0-9.]+)/g, function (m, c, x, y) { return c + (200 - +x) + ' ' + y; }); }
  var EAR = {
    point: 'M68 82 L58 30 L94 62 Z', round: [70, 64, 16, 16], small: [73, 66, 10, 10], mouse: [62, 60, 24, 24],
    flop: 'M66 70 Q42 74 48 116 Q60 114 72 86 Z', long: 'M78 70 Q60 6 78 4 Q94 8 90 66 Z', tuft: 'M72 72 L62 30 L88 62 Z',
    koala: [58, 72, 24, 22], none: ''
  };
  var EAR_IN = { point: 'M71 74 L64 42 L86 63 Z', long: 'M80 64 Q70 18 79 14 Q87 18 86 62 Z', mouse: [62, 60, 14, 14], koala: [58, 72, 13, 12], round: [70, 64, 8, 8] };
  function gen(c) {
    var cx = 100, cy = c.cy || 98, rx = c.rx || 38, ry = c.ry || 36, ear = EAR[c.ear || 'round'], earIn = EAR_IN[c.ear];
    var st = 'stroke="#140D09" stroke-width="3" stroke-linejoin="round"';
    var headD = c.shape || ell(cx, cy, rx, ry);
    return {
      name: c.name, kind: c.kind, fur: c.fur, eye: c.eye || '#F2B33D', hat: c.hat || (c.ear === 'long' || c.ear === 'point' || c.ear === 'mouse' || c.ear === 'koala' ? 'small' : 'big'),
      slit: c.slit, faceY: c.faceY || cy - 4, noseY: c.noseY || cy + 12, noseKind: c.nose, narrow: c.narrow,
      head: function () {
        var sil = [], g = '';
        if (c.back) { g += c.back; if (c.backSil) sil = sil.concat(c.backSil); }
        if (ear) { var ep = earPair(ear), ip = earPair(earIn);
          ep.forEach(function (d) { sil.push(d); g += P(d, 'fill="' + (c.earC || c.fur) + '" ' + st); });
          ip.forEach(function (d) { g += P(d, 'fill="' + (c.inC || '#4A2A1C') + '" opacity=".85"'); }); }
        sil.push(headD);
        g += P(headD, 'fill="' + c.fur + '" ' + st);
        if (c.marks) g += c.marks;
        if (c.muzzle !== false) g += '<ellipse cx="100" cy="' + ((c.noseY || cy + 12) + 6) + '" rx="' + (c.mzRx || 20) + '" ry="' + (c.mzRy || 13) + '" fill="' + (c.mzC || '#EDE3D0') + '"/>';
        if (c.top) g += c.top;
        return { sil: sil, draw: g };
      }
    };
  }
  // 코 모양: dog(기본) · pig · beak · bill · koala · hippo
  function noseOf(s) {
    var y = s.noseY, k = s.noseKind;
    if (k === 'pig') return '<ellipse cx="100" cy="' + (y + 4) + '" rx="13" ry="9" fill="#E8A0A8" stroke="#3A1418" stroke-width="2"/><ellipse cx="95" cy="' + (y + 4) + '" rx="2.6" ry="4" fill="#3A1418"/><ellipse cx="105" cy="' + (y + 4) + '" rx="2.6" ry="4" fill="#3A1418"/>' + P('M90 ' + (y + 17) + ' Q100 ' + (y + 19) + ' 110 ' + (y + 13), 'stroke="#140D09" stroke-width="2.4" fill="none" stroke-linecap="round"');
    if (k === 'beak') return P('M90 ' + (y - 2) + ' L110 ' + (y - 2) + ' L100 ' + (y + 14) + ' Z', 'fill="#E0A13A" stroke="#3A2408" stroke-width="2" stroke-linejoin="round"') + P('M93 ' + (y + 4) + ' L107 ' + (y + 4), 'stroke="#3A2408" stroke-width="1.5"');
    if (k === 'bill') return P('M84 ' + y + ' Q100 ' + (y - 6) + ' 116 ' + y + ' Q118 ' + (y + 10) + ' 100 ' + (y + 12) + ' Q82 ' + (y + 10) + ' 84 ' + y + ' Z', 'fill="#E89A2C" stroke="#3A2408" stroke-width="2"') + P('M86 ' + (y + 5) + ' Q100 ' + (y + 8) + ' 114 ' + (y + 3), 'stroke="#3A2408" stroke-width="1.8" fill="none"');
    if (k === 'koala') return '<ellipse cx="100" cy="' + (y + 2) + '" rx="12" ry="15" fill="#1A1414"/><ellipse cx="96" cy="' + (y - 4) + '" rx="3" ry="4" fill="#fff" opacity=".35"/>' + P('M92 ' + (y + 22) + ' Q100 ' + (y + 24) + ' 108 ' + (y + 19), 'stroke="#140D09" stroke-width="2.4" fill="none" stroke-linecap="round"');
    if (k === 'hippo') return '<circle cx="90" cy="' + (y + 2) + '" r="3.6" fill="#2A1A20"/><circle cx="110" cy="' + (y + 2) + '" r="3.6" fill="#2A1A20"/>' + P('M84 ' + (y + 18) + ' Q100 ' + (y + 22) + ' 118 ' + (y + 12), 'stroke="#140D09" stroke-width="2.6" fill="none" stroke-linecap="round"');
    return nose(s);
  }
  var W = '#EDE3D0';
  var MORE = {
    shiba: gen({ name: '보리', kind: '시바견', fur: '#C9742E', ear: 'point', marks: '<ellipse cx="78" cy="112" rx="14" ry="12" fill="' + W + '"/><ellipse cx="122" cy="112" rx="14" ry="12" fill="' + W + '"/>', eye: '#F2B33D' }),
    hamster: gen({ name: '도토리', kind: '햄스터', fur: '#D9A066', ear: 'small', rx: 44, ry: 38, marks: '<ellipse cx="68" cy="112" rx="16" ry="13" fill="#F2D2A8"/><ellipse cx="132" cy="112" rx="16" ry="13" fill="#F2D2A8"/>', mzRx: 14, mzRy: 10 }),
    rabbit: gen({ name: '솜이', kind: '토끼', fur: '#D8D2C6', ear: 'long', inC: '#C98A92', eye: '#E05A6A', mzRx: 15, mzRy: 11 }),
    bear: gen({ name: '곰돌 반장', kind: '곰', fur: '#7A4E2C', ear: 'round', inC: '#3A2414', rx: 42, ry: 38, mzC: '#C9A27A', mzRx: 22, mzRy: 15 }),
    hedgehog: gen({ name: '가시', kind: '고슴도치', fur: '#C9A47E', ear: 'small', back: P('M52 96 L40 70 L60 76 L56 50 L76 62 L80 38 L94 56 L104 34 L112 56 L128 40 L128 62 L148 52 L142 76 L162 72 L148 96 Z', 'fill="#4A3426" stroke="#140D09" stroke-width="3" stroke-linejoin="round"'), backSil: ['M52 96 L40 70 L60 76 L56 50 L76 62 L80 38 L94 56 L104 34 L112 56 L128 40 L128 62 L148 52 L142 76 L162 72 L148 96 Z'], mzRx: 14, mzRy: 10 }),
    duck: gen({ name: '뒤뚱', kind: '오리', fur: '#E8C94A', ear: 'none', nose: 'bill', muzzle: false, top: P('M96 60 Q100 46 106 58 Q112 48 112 62', 'stroke="#8A6A12" stroke-width="3" fill="none" stroke-linecap="round"'), eye: '#5AC8FA', hat: 'big' }),
    frog: gen({ name: '풍덩', kind: '개구리', fur: '#6FA84A', ear: 'none', rx: 46, ry: 32, cy: 104, faceY: 82, noseY: 108, muzzle: false, back: '<circle cx="74" cy="76" r="17" fill="#6FA84A" stroke="#140D09" stroke-width="3"/><circle cx="126" cy="76" r="17" fill="#6FA84A" stroke="#140D09" stroke-width="3"/>', backSil: [ell(74, 76, 17, 17), ell(126, 76, 17, 17)], eye: '#F2D23D', hat: 'big' }),
    ragdoll: gen({ name: '알리', kind: '랙돌', fur: '#E6DCCB', ear: 'point', earC: '#5A4232', slit: true, eye: '#5AB8F5', marks: '<ellipse cx="100" cy="92" rx="30" ry="16" fill="#7A5E48" opacity=".75"/>' }),
    penguin: gen({ name: '펭경', kind: '펭귄', fur: '#1E2228', ear: 'none', nose: 'beak', muzzle: false, marks: P('M74 100 Q76 74 100 80 Q124 74 126 100 Q122 126 100 130 Q78 126 74 100 Z', 'fill="#F0EDE6"'), eye: '#9FD8FF', hat: 'big' }),
    monkey: gen({ name: '망고', kind: '원숭이', fur: '#7A5232', ear: 'round', inC: '#E2B68A', marks: P('M70 96 Q72 74 92 80 Q100 70 108 80 Q128 74 130 96 Q128 124 100 130 Q72 124 70 96 Z', 'fill="#E8C49A"'), muzzle: false }),
    squirrel: gen({ name: '도람', kind: '다람쥐', fur: '#B0602A', ear: 'tuft', marks: '<ellipse cx="100" cy="116" rx="18" ry="14" fill="' + W + '"/>' + P('M70 70 L82 120 M130 70 L118 120', 'stroke="#5A2E12" stroke-width="3"'), mzRx: 12, mzRy: 9 }),
    koala: gen({ name: '코코', kind: '코알라', fur: '#9A9AA4', ear: 'koala', inC: '#E6E2DA', nose: 'koala', muzzle: false, rx: 42 }),
    raccoon: gen({ name: '몽이', kind: '너구리', fur: '#8A8076', ear: 'point', inC: '#2A2420', marks: P('M62 92 Q100 76 138 92 L134 106 Q100 96 66 106 Z', 'fill="#1E1A18"') + '<ellipse cx="100" cy="116" rx="20" ry="13" fill="' + W + '"/>', muzzle: false }),
    owl: gen({ name: '새벽', kind: '부엉이', fur: '#7A5A3A', ear: 'tuft', inC: '#3A2414', nose: 'beak', muzzle: false, marks: '<ellipse cx="82" cy="92" rx="19" ry="18" fill="#D8C29A"/><ellipse cx="118" cy="92" rx="19" ry="18" fill="#D8C29A"/>', eye: '#FFB23E' }),
    otter: gen({ name: '달수', kind: '수달', fur: '#7A5434', ear: 'small', rx: 40, ry: 34, mzC: '#D8BC98', mzRx: 24, mzRy: 15, marks: P('M78 118 L60 116 M78 122 L62 126 M122 118 L140 116 M122 122 L138 126', 'stroke="#EDE3D0" stroke-width="1.3" opacity=".6"') }),
    panda: gen({ name: '판돌', kind: '판다', fur: '#EDEAE4', ear: 'round', earC: '#1A1818', inC: '#1A1818', rx: 42, marks: '<ellipse cx="82" cy="92" rx="13" ry="16" fill="#1A1818" transform="rotate(25 82 92)"/><ellipse cx="118" cy="92" rx="13" ry="16" fill="#1A1818" transform="rotate(-25 118 92)"/>', mzC: '#F6F3EE', eye: '#E8E2D6' }),
    sheep: gen({ name: '뭉게', kind: '양', fur: '#3A3430', ear: 'flop', earC: '#3A3430', rx: 30, ry: 36, mzC: '#5A504A', mzRx: 16, mzRy: 11,
      back: [[66, 66], [84, 52], [100, 48], [116, 52], [134, 66], [140, 86], [60, 86]].map(function (q) { return '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="17" fill="#ECE6DA" stroke="#140D09" stroke-width="3"/>'; }).join(''),
      backSil: [[66, 66], [84, 52], [100, 48], [116, 52], [134, 66], [140, 86], [60, 86]].map(function (q) { return ell(q[0], q[1], 17, 17); }), hat: 'big' }),
    pig: gen({ name: '복돌', kind: '돼지', fur: '#E6A8AE', ear: 'point', inC: '#B86A74', nose: 'pig', muzzle: false, rx: 42 }),
    redpanda: gen({ name: '단풍', kind: '레서판다', fur: '#B84A22', ear: 'point', earC: '#F0E6D6', inC: '#4A1A0A', marks: '<ellipse cx="78" cy="106" rx="12" ry="10" fill="' + W + '"/><ellipse cx="122" cy="106" rx="12" ry="10" fill="' + W + '"/>' + P('M84 96 L80 120 M116 96 L120 120', 'stroke="#5A1A08" stroke-width="5" stroke-linecap="round"'), mzC: W, mzRx: 16, mzRy: 11 }),
    alpaca: gen({ name: '파카', kind: '알파카', fur: '#E6D6BC', ear: 'tuft', inC: '#9A7A5A', rx: 30, ry: 38, mzC: '#F2E8D6', mzRx: 18, mzRy: 13,
      top: '<circle cx="88" cy="62" r="13" fill="#F2E8D6"/><circle cx="104" cy="56" r="14" fill="#F2E8D6"/><circle cx="117" cy="64" r="12" fill="#F2E8D6"/>' }),
    seal: gen({ name: '몽실', kind: '물범', fur: '#7E8A96', ear: 'none', rx: 42, ry: 38, mzC: '#B8C2CC', mzRx: 22, mzRy: 14, marks: '<circle cx="78" cy="80" r="3" fill="#4A5460"/><circle cx="124" cy="76" r="2.5" fill="#4A5460"/><circle cx="118" cy="128" r="2.5" fill="#4A5460"/>', eye: '#1A1A1A', hat: 'big' }),
    hippo: gen({ name: '하하', kind: '하마', fur: '#8A7A8E', ear: 'small', rx: 42, ry: 34, cy: 94, nose: 'hippo', mzC: '#B8A6BA', mzRx: 34, mzRy: 20, noseY: 110 }),
    turtle: gen({ name: '엉금', kind: '거북이', fur: '#7A9A4A', ear: 'none', rx: 32, ry: 36, muzzle: false, marks: '<ellipse cx="100" cy="74" rx="16" ry="9" fill="#5A7A34" opacity=".6"/>', eye: '#F2D23D', hat: 'big' }),
    mouse: gen({ name: '치즈', kind: '생쥐', fur: '#9A9098', ear: 'mouse', inC: '#D89AA4', rx: 34, ry: 34, mzRx: 13, mzRy: 9, marks: P('M80 114 L58 110 M80 118 L60 122 M120 114 L142 110 M120 118 L140 122', 'stroke="#EDE3D0" stroke-width="1.2" opacity=".55"') }),
    lion: gen({ name: '갈기', kind: '사자', fur: '#D49A48', ear: 'small', rx: 36, ry: 36, mzC: '#F0DAB0', mzRx: 20, mzRy: 13,
      back: (function () { var g = ''; for (var i = 0; i < 14; i++) { var a = i / 14 * Math.PI * 2, x = 100 + Math.cos(a) * 44, y = 96 + Math.sin(a) * 42; g += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="16" fill="#7A4218" stroke="#140D09" stroke-width="3"/>'; } return g + '<circle cx="100" cy="96" r="44" fill="#7A4218"/>'; })(),
      backSil: [ell(100, 96, 58, 56)], eye: '#F5C842', hat: 'big' }),
    deer: gen({ name: '방울', kind: '사슴', fur: '#B47A44', ear: 'point', inC: '#E8C8A0', ry: 40, mzC: '#E8D4B8', mzRx: 14, mzRy: 11,
      back: P('M80 60 L70 22 M74 40 L60 32 M120 60 L130 22 M126 40 L140 32', 'stroke="#5A3A1A" stroke-width="5" stroke-linecap="round"'), backSil: [], marks: '<circle cx="78" cy="78" r="3" fill="#F0E0C8"/><circle cx="126" cy="80" r="3" fill="#F0E0C8"/>' })
  };
  Object.keys(MORE).forEach(function (k) { SP[k] = MORE[k]; });


  /* ---------- 0.8.4 코드네임 차림: 종마다 다른 옷 · 모자 · 얼굴 소품 · 가슴 소품 · 불빛 색 ----------
     coat: trench(트렌치) · leather(가죽점퍼) · tux(턱시도) · pea(피코트) · rain(우비) · hood(후드) · vest(조끼+셔츠)
     hat : fedora · flat(헌팅캡) · beanie · beret · sailor · helmet · rainhat · deer(셜록 모자) · none
     face: shades · mono(외알 안경) · headset · earpiece · mask(가면) · goggles(물안경) · nvg(야간 투시경) · sleep(수면 안대) · bandana · scar · none
     prop: magnifier · bag(증거 봉투) · radio · leaf · bell · camera · paper(거짓말 탐지 종이) · none
     등급: 일반은 모자 없음 · 희귀부터 모자 · 영웅 은 배지(트렌치·피코트는 붉은 목도리) · 전설 금빛 림 · 금 배지 */
  var KIT = {
    corgi:    { coat: 'trench', hat: 'fedora', face: 'headset', prop: 'magnifier', lamp: '#FFB347' },
    shiba:    { coat: 'leather', hat: 'flat', face: 'shades', prop: 'none', lamp: '#FF6B5A' },
    hamster:  { coat: 'vest', hat: 'flat', face: 'none', prop: 'bag', lamp: '#FFB347' },
    rabbit:   { coat: 'trench', cc: '#4A4E58', hat: 'beanie', hc: '#3A2A44', face: 'earpiece', prop: 'radio', lamp: '#9B7BFF' },
    bear:     { coat: 'leather', cc: '#4A2E1C', hat: 'flat', hc: '#3A3026', face: 'none', prop: 'radio', lamp: '#FFB347' },
    hedgehog: { coat: 'hood', cc: '#2A3A2C', hat: 'none', face: 'shades', prop: 'none', lamp: '#7CFFB0' },
    duck:     { coat: 'rain', cc: '#2E5C8A', hat: 'sailor', face: 'none', prop: 'magnifier', lamp: '#6FD3FF' },
    frog:     { coat: 'rain', hat: 'rainhat', face: 'none', prop: 'none', lamp: '#7CFFB0' },
    ragdoll:  { coat: 'tux', tie: '#2E6FD0', hat: 'none', face: 'mono', prop: 'none', lamp: '#6FB8FF' },
    siamese:  { coat: 'tux', tie: '#8E1F24', hat: 'none', face: 'mask', prop: 'none', lamp: '#FF5FA8' },
    fox:      { coat: 'trench', cc: '#6E2A22', hat: 'fedora', face: 'none', prop: 'paper', lamp: '#FF8A3D' },
    penguin:  { coat: 'tux', tie: '#C8323A', hat: 'none', face: 'none', prop: 'none', lamp: '#8FD8FF' },
    monkey:   { coat: 'vest', cc: '#3A4A2A', hat: 'flat', hc: '#4A3A22', face: 'goggles', fc: '#3A3A30', prop: 'radio', lamp: '#FFD36A' },
    squirrel: { coat: 'trench', cc: '#5C3E26', hat: 'beret', hc: '#7A2A22', face: 'none', prop: 'bag', lamp: '#FFB347' },
    koala:    { coat: 'hood', cc: '#3A4456', hat: 'none', face: 'sleep', prop: 'none', lamp: '#9BB8FF' },
    raccoon:  { coat: 'hood', cc: '#1E2026', hat: 'beanie', hc: '#14161A', face: 'bandana', prop: 'none', lamp: '#FF5F5F' },
    owl:      { coat: 'trench', cc: '#3A3A44', hat: 'none', face: 'nvg', prop: 'radio', lamp: '#7CFF8A' },
    otter:    { coat: 'pea', hat: 'none', face: 'goggles', fc: '#2E7FA8', prop: 'none', lamp: '#4FD1FF' },
    panda:    { coat: 'trench', cc: '#3C3C40', hat: 'fedora', face: 'none', prop: 'camera', lamp: '#E8E8E8', mono: true },
    tiger:    { coat: 'leather', hat: 'none', face: 'scar', prop: 'none', lamp: '#FF6B3D' },
    sheep:    { coat: 'pea', cc: '#3A4A6A', hat: 'beret', hc: '#24283A', face: 'none', prop: 'none', lamp: '#C8B8FF' },
    pig:      { coat: 'trench', cc: '#6A5A3A', hat: 'deer', face: 'none', prop: 'magnifier', lamp: '#FFB347' },
    redpanda: { coat: 'trench', cc: '#7A3A1E', hat: 'none', face: 'shades', prop: 'leaf', lamp: '#FF7A3D' },
    alpaca:   { coat: 'vest', cc: '#5A4A6A', hat: 'beanie', hc: '#C8A040', face: 'mono', prop: 'bag', lamp: '#FFD36A' },
    seal:     { coat: 'pea', hat: 'sailor', face: 'none', prop: 'none', lamp: '#6FD3FF' },
    hippo:    { coat: 'leather', cc: '#3A2A3E', hat: 'none', face: 'headset', prop: 'none', lamp: '#FF5FA8' },
    turtle:   { coat: 'pea', cc: '#3A4A2E', hat: 'helmet', face: 'none', prop: 'radio', lamp: '#B8FF6A' },
    mouse:    { coat: 'hood', cc: '#3A2E2E', hat: 'beanie', hc: '#5A2228', face: 'none', prop: 'none', lamp: '#FFD36A' },
    lion:     { coat: 'trench', cc: '#2A2626', hat: 'fedora', face: 'none', prop: 'none', lamp: '#FFD36A', crown: true },
    deer:     { coat: 'pea', cc: '#4A2E2A', hat: 'none', face: 'none', prop: 'bell', lamp: '#FFE08A' }
  };
  function shade(hex, k) {   // k<1 어둡게, k>1 밝게
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255;
    var f = function (v) { return Math.max(0, Math.min(255, Math.round(k < 1 ? v * k : v + (255 - v) * (k - 1)))); };
    return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
  }
  var OUT = 'stroke="#0E0B0A" stroke-width="2.5" stroke-linejoin="round"';
  var SH = 'M28 200 L40 160 Q58 144 82 140 L118 140 Q142 144 160 160 L172 200 Z';
  // 옷
  function coatOf(grade, k) {
    var c = k.cc, t = k.coat, g = '', sil = [SH];
    var tie = k.tie || (grade === 'h' || grade === 'l' ? '#8E1F24' : '#3A3F4A');
    if (t === 'trench') {
      c = c || '#6B5A44';
      sil.push('M80 146 L64 112 L94 132 Z', 'M120 146 L136 112 L106 132 Z');
      g = P(SH, 'fill="' + c + '" ' + OUT) + P('M86 140 L100 176 L114 140 Z', 'fill="#D6CFC0"') +
        P('M96 148 L104 148 L106 172 L100 182 L94 172 Z', 'fill="' + tie + '" stroke="#0E0B0A" stroke-width="1.5"') +
        P('M82 140 L100 182 L72 162 L66 146 Z', 'fill="' + shade(c, .85) + '" ' + OUT) + P('M118 140 L100 182 L128 162 L134 146 Z', 'fill="' + shade(c, .85) + '" ' + OUT) +
        P(sil[1], 'fill="' + shade(c, .9) + '" ' + OUT) + P(sil[2], 'fill="' + shade(c, .9) + '" ' + OUT) +
        '<circle cx="70" cy="178" r="3" fill="' + shade(c, .4) + '"/><circle cx="130" cy="178" r="3" fill="' + shade(c, .4) + '"/>';
    } else if (t === 'leather') {
      c = c || '#26242A';
      sil.push('M78 142 L58 128 L70 152 Z', 'M122 142 L142 128 L130 152 Z');
      g = P(SH, 'fill="' + c + '" ' + OUT) + P('M84 140 Q100 150 116 140 L112 200 L88 200 Z', 'fill="#3A3E46"') +   // 티셔츠
        P('M100 152 L100 200', 'stroke="#9AA0A8" stroke-width="2" stroke-dasharray="3 2"') +   // 지퍼
        P(sil[1], 'fill="' + shade(c, 1.25) + '" ' + OUT) + P(sil[2], 'fill="' + shade(c, 1.25) + '" ' + OUT) +
        P('M60 170 Q66 166 72 172 M140 170 Q134 166 128 172', 'stroke="' + shade(c, 1.5) + '" stroke-width="2" fill="none" opacity=".6"');   // 가죽 주름 빛
    } else if (t === 'tux') {
      c = c || '#141418';
      g = P(SH, 'fill="' + c + '" ' + OUT) + P('M84 140 L100 186 L116 140 Z', 'fill="#F2EEE6"') +
        P('M84 140 L100 186 L78 170 L70 148 Z', 'fill="#24242C" ' + OUT) + P('M116 140 L100 186 L122 170 L130 148 Z', 'fill="#24242C" ' + OUT) +
        P('M88 148 L100 154 L112 148 L112 160 L100 154 L88 160 Z', 'fill="' + tie + '" stroke="#0E0B0A" stroke-width="1.5"') +
        '<circle cx="100" cy="166" r="1.6" fill="#1A1A1E"/><circle cx="100" cy="176" r="1.6" fill="#1A1A1E"/>';
    } else if (t === 'pea') {
      c = c || '#22304A';
      sil.push('M76 144 L68 118 L96 136 Z', 'M124 144 L132 118 L104 136 Z');
      g = P(SH, 'fill="' + c + '" ' + OUT) + P('M88 140 Q100 148 112 140 L110 150 Q100 156 90 150 Z', 'fill="#3A3A42"') +   // 목폴라
        P(sil[1], 'fill="' + shade(c, 1.2) + '" ' + OUT) + P(sil[2], 'fill="' + shade(c, 1.2) + '" ' + OUT) +
        [[84, 164], [116, 164], [84, 184], [116, 184]].map(function (q) { return '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="3.4" fill="#C9A24A" stroke="#5A4210" stroke-width="1"/>'; }).join('');
    } else if (t === 'rain') {
      c = c || '#D9A82A';
      g = P('M60 150 Q100 118 140 150 L140 160 L60 160 Z', 'fill="' + shade(c, .8) + '" ' + OUT) +   // 등 뒤 후드
        P(SH, 'fill="' + c + '" ' + OUT) + P('M84 140 L100 168 L116 140 Z', 'fill="' + shade(c, .7) + '"') +
        P('M100 168 L100 200', 'stroke="' + shade(c, .55) + '" stroke-width="2.5"') +
        [174, 188].map(function (y) { return '<circle cx="106" cy="' + y + '" r="2.6" fill="' + shade(c, .5) + '"/>'; }).join('') +
        P('M64 172 Q70 168 76 174', 'stroke="#fff" stroke-width="2" fill="none" opacity=".35"');
    } else if (t === 'hood') {
      c = c || '#2C2F36';
      g = P('M56 156 Q100 112 144 156 L144 164 L56 164 Z', 'fill="' + shade(c, .8) + '" ' + OUT) +
        P(SH, 'fill="' + c + '" ' + OUT) + P('M84 142 Q100 154 116 142', 'stroke="' + shade(c, .55) + '" stroke-width="3" fill="none"') +
        P('M92 150 L90 178 M108 150 L110 178', 'stroke="#D8D4CC" stroke-width="2" stroke-linecap="round"') +
        P('M78 186 L122 186 L118 200 L82 200 Z', 'fill="' + shade(c, .8) + '"');   // 앞주머니
    } else {   // vest
      c = c || '#3A3A44';
      g = P(SH, 'fill="#D8D0C0" ' + OUT) +   // 셔츠(소매 걷은)
        P('M72 148 L84 140 L100 184 L116 140 L128 148 L132 200 L68 200 Z', 'fill="' + c + '" ' + OUT) +
        P('M86 140 L100 158 L114 140', 'fill="#EEE8DC" stroke="#0E0B0A" stroke-width="1.5"') +
        P('M97 152 L103 152 L105 174 L100 182 L95 174 Z', 'fill="' + tie + '" stroke="#0E0B0A" stroke-width="1.2"') +
        P('M58 160 L76 200 M142 160 L124 200', 'stroke="#4A3A2A" stroke-width="4"') +   // 멜빵
        '<circle cx="106" cy="170" r="2" fill="#C9A24A"/><circle cx="106" cy="184" r="2" fill="#C9A24A"/>';
    }
    if (grade === 'h' && (t === 'trench' || t === 'pea')) g += P('M78 142 Q100 156 122 142 L120 152 Q100 164 80 152 Z', 'fill="#8E1F24" stroke="#2A0608" stroke-width="2"');
    if (grade === 'h' || grade === 'l') {
      var b = grade === 'l' ? ['#FFE48A', '#C9961A'] : ['#E8EDF2', '#8D98A6'];
      g += P('M126 164 l8 -4 l8 4 l-2 10 l-6 4 l-6 -4 z', 'fill="' + b[0] + '" stroke="' + b[1] + '" stroke-width="1.5"') + '<circle cx="134" cy="168" r="2.2" fill="' + b[1] + '"/>';
    }
    return { sil: sil, draw: g + propOf(k.prop) };
  }
  // 가슴 · 손 소품(왼쪽 가슴. 오른쪽은 등급 배지 자리)
  function propOf(p) {
    if (p === 'magnifier') return P('M52 196 L64 180', 'stroke="#3A2A1A" stroke-width="5" stroke-linecap="round"') + '<circle cx="70" cy="172" r="10" fill="#9FD8F0" fill-opacity=".35" stroke="#C9A24A" stroke-width="3.5"/>' + P('M65 168 Q68 165 72 166', 'stroke="#fff" stroke-width="1.6" fill="none" opacity=".8"');
    if (p === 'bag') return P('M62 158 L80 158 L80 180 L62 180 Z', 'fill="#E8F0F4" fill-opacity=".75" stroke="#7A8A94" stroke-width="1.5"') + '<rect x="62" y="158" width="18" height="4" fill="#C8323A"/>' + P('M66 168 L76 168 M66 173 L74 173', 'stroke="#3A4450" stroke-width="1.4"');
    if (p === 'radio') return '<rect x="62" y="160" width="14" height="22" rx="2.5" fill="#22252B" stroke="#0A0A0C" stroke-width="1.5"/>' + P('M72 160 L72 146', 'stroke="#22252B" stroke-width="3" stroke-linecap="round"') + '<circle cx="69" cy="166" r="2" fill="#7CFF8A"/>' + P('M65 172 L73 172 M65 176 L73 176', 'stroke="#555A64" stroke-width="1.2"');
    if (p === 'leaf') return P('M70 158 L73 166 L80 163 L76 170 L82 174 L74 175 L74 182 L70 177 L66 182 L66 175 L58 174 L64 170 L60 163 L67 166 Z', 'fill="#D9482A" stroke="#6A1A0A" stroke-width="1.2"');
    if (p === 'bell') return P('M100 150 Q92 152 92 162 L90 166 L110 166 L108 162 Q108 152 100 150 Z', 'fill="#E8E8EE" stroke="#8D98A6" stroke-width="1.5"') + '<circle cx="100" cy="168" r="2.4" fill="#8D98A6"/>' + P('M90 148 Q100 154 110 148', 'stroke="#8E1F24" stroke-width="3" fill="none"');
    if (p === 'camera') return P('M60 140 L76 168', 'stroke="#1A1A1E" stroke-width="2.5"') + '<rect x="58" y="166" width="26" height="18" rx="3" fill="#1E1F24" stroke="#0A0A0C" stroke-width="1.5"/><circle cx="71" cy="175" r="6" fill="#2A3440" stroke="#9AA0A8" stroke-width="1.5"/><circle cx="69" cy="173" r="1.6" fill="#fff" opacity=".7"/>';
    if (p === 'paper') return P('M64 156 L64 186 L80 186 L80 156 Z', 'fill="#F0EBDD" stroke="#8A8270" stroke-width="1"') + P('M65 172 L68 166 L70 176 L72 160 L74 178 L76 168 L79 172', 'stroke="#C8323A" stroke-width="1.4" fill="none"');
    return '';
  }
  // 머리 맨 위 y(경로를 짚어 가며). 모자가 머리에 '얹히지' 않고 '씌워지게' 높이를 맞추는 데 쓴다
  function pathTop(d) {
    var y = 1e9, cx = 0, cy = 0, sx = 0, sy = 0, t = d.match(/[MLQAZ]|-?[0-9.]+/g) || [], i = 0, c;
    function n() { return +t[i++]; }
    while (i < t.length) {
      if (/[MLQAZ]/.test(t[i])) c = t[i++];
      if (c === 'M' || c === 'L') { cx = n(); cy = n(); if (c === 'M') { sx = cx; sy = cy; } y = Math.min(y, cy); }
      else if (c === 'Q') { var qy, x1, y1; n(); qy = n(); x1 = n(); y1 = n(); for (var q = 0; q <= 20; q++) { var u = q / 20; y = Math.min(y, (1 - u) * (1 - u) * cy + 2 * (1 - u) * u * qy + u * u * y1); } cx = x1; cy = y1; }
      else if (c === 'A') { n(); var ry = n(); n(); n(); n(); cx = n(); var yy = n(); y = Math.min(y, cy - ry); cy = yy; }
      else if (c === 'Z') { cx = sx; cy = sy; }
      else i++;
    }
    return y;
  }
  /* 모자마다 아랫단 y(그린 그대로)와 머리를 얼마나 덮을지(wrap). 아랫단이 '머리 맨 위 + wrap' 에 오도록 내린다.
     둥근 머리는 꼭대기가 좁아서, 아랫단을 꼭대기에 맞추면 양옆이 떠 보인다(0.8.4 검수에서 발견) */
  var HAT_FIT = { flat: [68, 14], beanie: [68, 18], beret: [62, 10], sailor: [66, 12], helmet: [70, 18], rainhat: [74, 12], deer: [68, 14] };
  // 모자(머리 좌표). 큰 귀 동물(small)은 줄여서 귀 사이에
  function hatOf(kind, grade, k, top) {
    var h = k.hat, band = grade === 'l' ? '#E0B23A' : grade === 'h' ? '#8E1F24' : '#1A1A1E', hc = k.hc, a, b, d = '', rot = 'rotate(-6 100 58)';
    if (h === 'none' || grade === 'c') return null;
    if (h === 'fedora') {
      var t = hat(kind, grade);
      if (k.crown) t.draw = t.draw.replace('</g>', P('M88 ' + (kind === 'small' ? 50 : 52) + ' l4 -8 l4 5 l4 -7 l4 7 l4 -5 l4 8 z', 'fill="#FFD36A" stroke="#8A6410" stroke-width="1.2"') + '</g>');
      return t;
    }
    if (h === 'flat') { hc = hc || '#4A4238'; a = 'M66 60 Q70 34 100 32 Q132 34 136 58 Z'; b = 'M60 60 Q100 52 140 58 L146 66 Q100 70 58 66 Z'; d = P(a, 'fill="' + hc + '" ' + OUT) + P(b, 'fill="' + shade(hc, .8) + '" ' + OUT) + P('M80 40 L120 40 M76 48 L124 48', 'stroke="' + shade(hc, 1.3) + '" stroke-width="1.2" opacity=".6"') + '<circle cx="100" cy="33" r="3" fill="' + shade(hc, .7) + '"/>'; }
    else if (h === 'beanie') { hc = hc || '#2A2E38'; a = 'M66 62 Q66 26 100 24 Q134 26 134 62 Z'; b = 'M62 56 L138 56 L138 68 L62 68 Z'; d = P(a, 'fill="' + hc + '" ' + OUT) + P(b, 'fill="' + shade(hc, .8) + '" ' + OUT) + P('M74 58 L74 66 M84 58 L84 66 M94 58 L94 66 M104 58 L104 66 M114 58 L114 66 M124 58 L124 66', 'stroke="' + shade(hc, 1.3) + '" stroke-width="1.5" opacity=".5"'); rot = 'rotate(-4 100 50)'; }
    else if (h === 'beret') { hc = hc || '#2A2A30'; a = 'M62 58 Q60 34 104 34 Q146 36 140 56 Q100 66 62 58 Z'; b = 'M64 58 Q100 66 138 56 L138 60 Q100 70 64 62 Z'; d = P(a, 'fill="' + hc + '" ' + OUT) + P(b, 'fill="' + shade(hc, .7) + '"') + '<rect x="102" y="28" width="3" height="7" fill="' + shade(hc, .6) + '"/>'; rot = 'rotate(-10 100 50)'; }
    else if (h === 'sailor') { a = 'M70 60 L74 40 Q100 34 126 40 L130 60 Z'; b = 'M64 58 L136 58 L136 66 L64 66 Z'; d = P(a, 'fill="#F2EEE6" ' + OUT) + P(b, 'fill="#22304A" ' + OUT) + P('M78 62 Q100 58 122 62 L120 72 Q100 66 80 72 Z', 'fill="#14161A"') + '<circle cx="100" cy="50" r="5" fill="#C9A24A" stroke="#5A4210" stroke-width="1"/>'; }
    else if (h === 'helmet') { hc = '#4A5A3A'; a = 'M62 64 Q60 26 100 24 Q140 26 138 64 Z'; b = 'M56 62 L144 62 L146 70 L54 70 Z'; d = P(a, 'fill="' + hc + '" ' + OUT) + P(b, 'fill="' + shade(hc, .75) + '" ' + OUT) + P('M70 44 Q100 30 130 44', 'stroke="' + shade(hc, 1.3) + '" stroke-width="2" fill="none" opacity=".5"'); rot = 'rotate(-3 100 50)'; }
    else if (h === 'rainhat') { a = 'M70 58 Q72 32 100 30 Q128 32 130 58 Z'; b = 'M48 60 Q100 46 152 60 L160 74 Q140 66 100 66 Q60 66 40 74 Z'; d = P(a, 'fill="#E0B030" ' + OUT) + P(b, 'fill="#C8981E" ' + OUT); rot = 'rotate(-5 100 56)'; }
    else if (h === 'deer') { a = 'M66 62 Q66 28 100 26 Q134 28 134 62 Z'; b = 'M60 60 Q78 56 92 60 L84 68 Q70 68 60 60 Z M108 60 Q122 56 140 60 Q130 68 116 68 Z'; d = P(a, 'fill="#8A6A44" ' + OUT) + P('M80 30 L80 60 M100 26 L100 62 M120 30 L120 60 M68 44 L132 44', 'stroke="#5A4228" stroke-width="2" opacity=".7"') + P(b, 'fill="#6E5234" ' + OUT) + '<circle cx="100" cy="26" r="3" fill="#5A4228"/>'; }
    var sc = kind === 'small' ? 'translate(100 54) scale(.74) translate(-100 -54)' : '';
    var fit = HAT_FIT[h], bot = kind === 'small' ? 54 + .74 * (fit[0] - 54) : fit[0];
    var dy = Math.round(((top || 62) + fit[1] - bot) * 10) / 10;
    var tf = 'translate(0 ' + dy + ') ' + rot + (sc ? ' ' + sc : '');
    return { sil: [a, b], rot: tf, draw: '<g transform="' + tf + '">' + d + '</g>' };
  }
  // 얼굴 소품(눈 위에 그린다). 눈 자리: x 84 · 116, y = faceY
  function faceOf(f, s, k) {
    var y = s.faceY, ny = s.noseY;
    if (f === 'shades') return P('M70 ' + (y - 6) + ' L96 ' + (y - 6) + ' L94 ' + (y + 6) + ' Q83 ' + (y + 10) + ' 72 ' + (y + 5) + ' Z M104 ' + (y - 6) + ' L130 ' + (y - 6) + ' L128 ' + (y + 5) + ' Q117 ' + (y + 10) + ' 106 ' + (y + 6) + ' Z', 'fill="#0C0E12" stroke="#000" stroke-width="2"') +
      P('M96 ' + (y - 4) + ' L104 ' + (y - 4), 'stroke="#000" stroke-width="3"') + P('M75 ' + (y - 3) + ' L84 ' + (y - 3) + ' M109 ' + (y - 3) + ' L118 ' + (y - 3), 'stroke="' + (k.lamp || '#fff') + '" stroke-width="1.6" opacity=".7"');
    if (f === 'mono') return '<circle cx="116" cy="' + (y - 1) + '" r="11" fill="#BFE6FF" fill-opacity=".18" stroke="#E0B23A" stroke-width="2.6"/>' + P('M126 ' + (y + 4) + ' Q134 ' + (y + 26) + ' 126 ' + (y + 48), 'stroke="#E0B23A" stroke-width="1.4" fill="none"');
    if (f === 'headset') return P('M62 ' + (y - 4) + ' Q100 ' + (y - 60) + ' 138 ' + (y - 4), 'stroke="#1A1C22" stroke-width="5" fill="none"') + '<rect x="54" y="' + (y - 10) + '" width="12" height="20" rx="4" fill="#1E2026" stroke="#000" stroke-width="1.5"/>' +
      P('M60 ' + (y + 8) + ' Q66 ' + (ny + 14) + ' 86 ' + (ny + 12), 'stroke="#1A1C22" stroke-width="2.6" fill="none"') + '<circle cx="88" cy="' + (ny + 12) + '" r="3" fill="#2A2E36"/>';
    if (f === 'earpiece') return '<circle cx="136" cy="' + (y + 4) + '" r="3.5" fill="#D8D4CC"/>' + P('M136 ' + (y + 8) + ' q-4 4 0 8 q4 4 0 8 q-4 4 0 8 q4 4 0 8 L130 ' + (y + 60), 'stroke="#D8D4CC" stroke-width="1.5" fill="none"');
    if (f === 'mask') return P('M62 ' + (y - 4) + ' Q70 ' + (y - 16) + ' 100 ' + (y - 8) + ' Q130 ' + (y - 16) + ' 138 ' + (y - 4) + ' Q134 ' + (y + 12) + ' 114 ' + (y + 10) + ' Q104 ' + (y + 8) + ' 100 ' + (y + 2) + ' Q96 ' + (y + 8) + ' 86 ' + (y + 10) + ' Q66 ' + (y + 12) + ' 62 ' + (y - 4) + ' Z' +
      ' M73 ' + (y + 1) + ' Q84 ' + (y - 9) + ' 95 ' + (y - 2) + ' Q84 ' + (y + 7) + ' 73 ' + (y + 1) + ' Z M127 ' + (y + 1) + ' Q116 ' + (y - 9) + ' 105 ' + (y - 2) + ' Q116 ' + (y + 7) + ' 127 ' + (y + 1) + ' Z', 'fill="#1A0E14" fill-rule="evenodd" stroke="#C9A24A" stroke-width="1.8"');
    if (f === 'goggles' || f === 'nvg') {
      var gy = y - 24, fc = k.fc || '#2A3440', lens = f === 'nvg' ? '#7CFF8A' : '#9FE0FF';
      if (f === 'nvg') return P('M60 ' + (gy + 2) + ' Q100 ' + (gy - 8) + ' 140 ' + (gy + 2), 'stroke="#1A1C1A" stroke-width="5" fill="none"') + '<rect x="78" y="' + (gy - 9) + '" width="16" height="18" rx="3" fill="#22261E" stroke="#000" stroke-width="1.5"/><rect x="106" y="' + (gy - 9) + '" width="16" height="18" rx="3" fill="#22261E" stroke="#000" stroke-width="1.5"/>' +
        '<circle cx="86" cy="' + gy + '" r="5" fill="' + lens + '"/><circle cx="114" cy="' + gy + '" r="5" fill="' + lens + '"/><circle cx="86" cy="' + gy + '" r="9" fill="' + lens + '" opacity=".2"/><circle cx="114" cy="' + gy + '" r="9" fill="' + lens + '" opacity=".2"/>';
      return P('M60 ' + gy + ' L140 ' + gy, 'stroke="' + fc + '" stroke-width="5"') + '<circle cx="86" cy="' + gy + '" r="10" fill="' + lens + '" fill-opacity=".55" stroke="' + shade(fc, .6) + '" stroke-width="3"/><circle cx="114" cy="' + gy + '" r="10" fill="' + lens + '" fill-opacity=".55" stroke="' + shade(fc, .6) + '" stroke-width="3"/>' +
        P('M81 ' + (gy - 4) + ' Q84 ' + (gy - 7) + ' 88 ' + (gy - 6) + ' M109 ' + (gy - 4) + ' Q112 ' + (gy - 7) + ' 116 ' + (gy - 6), 'stroke="#fff" stroke-width="1.6" fill="none" opacity=".8"');
    }
    if (f === 'sleep') { var sy = y - 22; return P('M64 ' + sy + ' Q100 ' + (sy - 10) + ' 136 ' + sy + ' L134 ' + (sy + 12) + ' Q100 ' + (sy + 4) + ' 66 ' + (sy + 12) + ' Z', 'fill="#7A8CC8" stroke="#2A3050" stroke-width="2"') + P('M78 ' + (sy + 5) + ' Q84 ' + (sy + 9) + ' 90 ' + (sy + 5) + ' M110 ' + (sy + 5) + ' Q116 ' + (sy + 9) + ' 122 ' + (sy + 5), 'stroke="#fff" stroke-width="1.8" fill="none"'); }
    if (f === 'bandana') return P('M70 ' + (ny + 18) + ' Q100 ' + (ny + 12) + ' 130 ' + (ny + 18) + ' L100 ' + (ny + 40) + ' Z', 'fill="#A8282E" stroke="#3A0A0E" stroke-width="2"') + '<circle cx="92" cy="' + (ny + 24) + '" r="1.5" fill="#F2E8D6"/><circle cx="106" cy="' + (ny + 22) + '" r="1.5" fill="#F2E8D6"/><circle cx="100" cy="' + (ny + 30) + '" r="1.5" fill="#F2E8D6"/>';
    if (f === 'scar') return P('M108 ' + (y - 16) + ' L124 ' + (y + 12), 'stroke="#E8C8B8" stroke-width="3" stroke-linecap="round"') + P('M112 ' + (y - 6) + ' L118 ' + (y - 9) + ' M116 ' + (y + 2) + ' L122 ' + (y - 1), 'stroke="#E8C8B8" stroke-width="2" stroke-linecap="round"');
    return '';
  }

  /* ---------- 0.8.4 코드네임 배경(판매 후보). 모두 200×200, 몸 뒤에 깔린다. 움직임 class(nz-rain 등)는 공통 CSS 가 돌린다 ---------- */
  function rainG(col, op) {
    var xs = [12, 34, 58, 150, 172, 190, 84, 126];
    var one = function (cls) { return '<g class="' + cls + '" stroke="' + col + '" stroke-width="1" opacity="' + op + '">' + xs.map(function (x, i) { var y = (i * 37) % 120; return '<line x1="' + x + '" y1="' + y + '" x2="' + (x - 6) + '" y2="' + (y + 26) + '"/>'; }).join('') + '</g>'; };
    return one('nz-rain') + one('nz-rain b');
  }
  function lampG(n, x, y, r) { return '<circle class="nz-lamp" cx="' + x + '" cy="' + y + '" r="' + r + '" fill="url(#' + n + 'lamp)"/>'; }
  var BG_LIST = [
    { id: 'alley', name: '비 오는 골목' }, { id: 'neon', name: '네온 거리' }, { id: 'interro', name: '취조실' }, { id: 'roof', name: '옥상 야경' },
    { id: 'harbor', name: '해무항 부두' }, { id: 'office', name: '블라인드 사무실' }, { id: 'snow', name: '눈 오는 밤' }, { id: 'station', name: '막차 역' }
  ];
  var BGS = {
    alley: function (n) { return lampG(n, 18, 20, 46) + rainG('#9DB4CC', '.22'); },
    neon: function (n) {
      return '<rect x="0" y="0" width="200" height="200" fill="#1A0A24" opacity=".55"/>' +
        '<g class="nz-lamp"><rect x="14" y="22" width="54" height="20" rx="4" fill="none" stroke="#FF4FA8" stroke-width="2.5"/><text x="41" y="37" text-anchor="middle" font-size="12" font-weight="900" fill="#FF7FC4" font-family="sans-serif">24시</text>' +
        '<rect x="146" y="14" width="40" height="52" rx="4" fill="none" stroke="#4FE0FF" stroke-width="2.5"/><path d="M156 30 L176 30 M156 40 L176 40 M156 50 L170 50" stroke="#4FE0FF" stroke-width="2.5"/></g>' +
        '<circle cx="40" cy="32" r="40" fill="#FF4FA8" opacity=".14"/><circle cx="166" cy="40" r="40" fill="#4FE0FF" opacity=".12"/>' +
        '<rect x="0" y="176" width="200" height="24" fill="#FF4FA8" opacity=".08"/>' + rainG('#C8A8FF', '.3');
    },
    interro: function (n) {
      var br = ''; for (var yy = 0; yy < 200; yy += 14) for (var xx = (yy / 14) % 2 ? -12 : 0; xx < 200; xx += 24) br += '<rect x="' + xx + '" y="' + yy + '" width="22" height="12" fill="#2A1E1A" opacity=".55"/>';
      return '<rect width="200" height="200" fill="#120C0A"/>' + br + '<path d="M100 0 L100 18" stroke="#2A2A2A" stroke-width="2"/>' +
        '<path class="nz-lamp" d="M100 22 L30 200 L170 200 Z" fill="#FFE8A8" opacity=".14"/><ellipse class="nz-lamp" cx="100" cy="24" rx="9" ry="6" fill="#FFF3C8"/><circle cx="100" cy="24" r="22" fill="#FFE8A8" opacity=".2"/>';
    },
    roof: function () {
      var w = '', hs = [[0, 120, 26], [26, 96, 22], [48, 132, 30], [78, 108, 18], [140, 100, 24], [164, 126, 36]];
      hs.forEach(function (h) { w += '<rect x="' + h[0] + '" y="' + h[1] + '" width="' + h[2] + '" height="' + (200 - h[1]) + '" fill="#0A0E16"/>';
        for (var yy = h[1] + 6; yy < 190; yy += 10) for (var xx = h[0] + 4; xx < h[0] + h[2] - 4; xx += 7) if ((xx * 7 + yy * 3) % 5 < 2) w += '<rect x="' + xx + '" y="' + yy + '" width="3" height="4" fill="#FFD36A" opacity=".55"/>'; });
      return '<rect width="200" height="200" fill="#0C1530" opacity=".6"/><circle class="nz-lamp" cx="160" cy="34" r="16" fill="#F2EED8"/><circle cx="160" cy="34" r="30" fill="#F2EED8" opacity=".1"/>' +
        [[20, 20], [60, 40], [110, 16], [190, 70], [40, 70]].map(function (q) { return '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="1" fill="#fff" opacity=".7"/>'; }).join('') + w;
    },
    harbor: function (n) {
      return '<rect width="200" height="200" fill="#0E1A22" opacity=".6"/><path d="M150 30 L150 110 M150 34 L196 34 M150 34 L120 70" stroke="#1E2A34" stroke-width="5"/>' +
        '<rect x="0" y="120" width="200" height="80" fill="#0A1218"/><path d="M10 112 L60 112 L52 124 L18 124 Z" fill="#1A242C"/>' +
        '<circle class="nz-lamp" cx="40" cy="104" r="3" fill="#FF5F5F"/><circle cx="40" cy="104" r="12" fill="#FF5F5F" opacity=".2"/>' + lampG(n, 176, 60, 40) +
        '<g class="nz-fog"><rect x="-40" y="90" width="280" height="40" rx="20" fill="#B8C8D4" opacity=".1"/><rect x="-80" y="140" width="300" height="30" rx="15" fill="#B8C8D4" opacity=".08"/></g>';
    },
    office: function (n) {
      var bl = ''; for (var yy = 10; yy < 120; yy += 9) bl += '<rect x="110" y="' + yy + '" width="80" height="5" fill="#E8D8A8" opacity=".22"/>';
      return '<rect width="200" height="200" fill="#16120C" opacity=".5"/>' + bl + '<path class="nz-lamp" d="M110 10 L190 10 L200 200 L60 200 Z" fill="#E8D8A8" opacity=".06"/>' +
        '<path d="M14 120 L24 96 L40 96 L44 120 Z" fill="#1E4A2A"/><path d="M28 120 L28 140" stroke="#2A2A2A" stroke-width="3"/><ellipse class="nz-lamp" cx="32" cy="124" rx="18" ry="5" fill="#B8FF9A" opacity=".25"/>';
    },
    snow: function (n) {
      var f = function (cls) { return '<g class="' + cls + '" fill="#fff" opacity=".7">' + [[14, 10], [40, 60], [70, 24], [130, 40], [160, 90], [186, 20], [100, 6], [24, 110], [176, 140]].map(function (q, i) { return '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + (1.2 + (i % 3) * .6) + '"/>'; }).join('') + '</g>'; };
      return '<rect width="200" height="200" fill="#1A2436" opacity=".5"/>' + lampG(n, 22, 22, 50) + f('nz-snow') + f('nz-snow b') + '<rect x="0" y="186" width="200" height="14" fill="#E8EEF6" opacity=".12"/>';
    },
    station: function (n) {
      return '<rect width="200" height="200" fill="#121418" opacity=".5"/><circle cx="160" cy="34" r="18" fill="#E8E2D0" stroke="#2A2A2A" stroke-width="3"/><path d="M160 34 L160 22 M160 34 L168 38" stroke="#1A1A1A" stroke-width="2.2" stroke-linecap="round"/>' +
        '<rect x="0" y="0" width="200" height="8" fill="#0A0A0C"/>' + [30, 80, 130].map(function (x) { return '<rect class="nz-lamp" x="' + (x - 14) + '" y="8" width="28" height="4" fill="#FFF3C8" opacity=".8"/><path d="M' + (x - 14) + ' 12 L' + (x - 34) + ' 200 L' + (x + 34) + ' 200 L' + (x + 14) + ' 12 Z" fill="#FFF3C8" opacity=".05"/>'; }).join('') +
        '<rect x="14" y="56" width="52" height="16" rx="2" fill="#0A0A0C"/><text x="40" y="68" text-anchor="middle" font-size="10" font-weight="800" fill="#FF9A3D" font-family="monospace">막차 00:12</text>';
    }
  };
  function draw(id, o) {
    o = o || {};
    var s = SP[id], grade = o.grade || 'r', n = 'nz' + (++uid);
    var k = KIT[id] || { coat: 'trench', hat: 'fedora', face: 'none', prop: 'none' };
    var rim = grade === 'l' ? '#FFD36A' : (k.lamp || '#FFB347');
    var H = s.head(), C = coatOf(grade, k), T = hatOf(s.hat, grade, k, pathTop(H.sil[H.sil.length - 1]));
    var HT = 'translate(100 92) scale(1.16) translate(-100 -96)';
    // 모자는 기울여 그리므로 실루엣도 같이 기울인다(안 그러면 림 라이트가 엉뚱한 자리에 모자 테두리를 그린다)
    function silOut(attr) {
      var m = function (a) { return a.map(function (d) { return P(d, attr); }).join(''); };
      return m(C.sil) + '<g transform="' + HT + '">' + m(H.sil) + (T ? '<g transform="' + T.rot + '">' + m(T.sil) + '</g>' : '') + '</g>';
    }
    var silG = silOut('fill="#fff"');
    var defs = '<defs>' +
      '<radialGradient id="' + n + 'bg" cx="22%" cy="18%" r="95%"><stop offset="0" stop-color="' + (grade === 'l' ? '#3A2E14' : '#1C2836') + '"/><stop offset=".55" stop-color="#0C1119"/><stop offset="1" stop-color="#040508"/></radialGradient>' +
      '<linearGradient id="' + n + 'sh" x1="0" y1="0" x2="1" y2="0.2"><stop offset=".38" stop-color="#000" stop-opacity="0"/><stop offset=".62" stop-color="#05070C" stop-opacity=".55"/><stop offset="1" stop-color="#05070C" stop-opacity=".8"/></linearGradient>' +
      '<linearGradient id="' + n + 'rg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".42" stop-color="#fff" stop-opacity=".0"/></linearGradient>' +
      '<mask id="' + n + 'm">' + silG + '</mask>' +
      '<mask id="' + n + 'rm"><rect width="200" height="200" fill="url(#' + n + 'rg)"/></mask>' +
      '<pattern id="' + n + 'bl" width="200" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-14)"><rect width="200" height="5" fill="#000" opacity=".16"/></pattern>' +
      '<radialGradient id="' + n + 'lamp" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="' + rim + '" stop-opacity=".55"/><stop offset="1" stop-color="' + rim + '" stop-opacity="0"/></radialGradient>' +
      '</defs>';
    var bgId = o.bg && BGS[o.bg] ? o.bg : 'alley';
    var bg = '<rect width="200" height="200" rx="18" fill="url(#' + n + 'bg)"/>' + BGS[bgId](n, rim);
    var body = '<g class="nz-body">' + C.draw + '<g transform="' + HT + '">' + H.draw + eyes(s, s.faceY, grade) + noseOf(s) + faceOf(k.face, s, k) + (T ? T.draw : '') + '</g></g>';
    // 오른쪽 그림자(실루엣 안에만)
    var shade = '<rect width="200" height="200" fill="url(#' + n + 'sh)" mask="url(#' + n + 'm)"/>';
    // 왼쪽 림 라이트(실루엣 테두리, 왼쪽에만)
    var rimG = '<g mask="url(#' + n + 'rm)" fill="none" stroke="' + rim + '" stroke-width="3" opacity=".9" stroke-linejoin="round">' + silOut('') + '</g>';
    var blinds = '<rect width="200" height="200" fill="url(#' + n + 'bl)" mask="url(#' + n + 'm)"/>';
    var glow = grade === 'l' ? '<rect x="2" y="2" width="196" height="196" rx="17" fill="none" stroke="#E0B23A" stroke-width="3"/>' : '';
    var w = o.size || 200;
    if (k.mono) body = '<g style="filter:grayscale(1) contrast(1.15)">' + body + '</g>';
    return '<svg viewBox="0 0 200 200" width="' + w + '" height="' + w + '" xmlns="http://www.w3.org/2000/svg">' + defs + '<g clip-path="inset(0 round 18px)">' + bg + body + shade + blinds + rimG + '</g>' + glow + '</svg>';
  }
    var IDS = Object.keys(SP);
  return { BG_LIST: BG_LIST, draw: draw, ids: IDS, has: function (id) { return !!SP[id]; } };
});
