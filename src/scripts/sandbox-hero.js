// The hero (UV, 13 Nov; /sandbox/hero/): a pool table seen from straight above, the
// logo mark in the middle of the cloth, a spotted cue ball and two object balls, one
// with a stripe and one solid with the stripe cut out of it. The cue ball plays at an
// object ball, again and again, from wherever the last shot left them, so the loop
// never jumps. A ball that drops falls through the pocket into the void, and a new one
// drops onto the table from above the camera, bounces and settles. Each shot is picked at random from the pots on
// offer, with random pace and spin and now and then a deliberate miss. Trails follow
// the balls and fade out before the next shot. Everything is simulated live.
//
// Built from UV's pool sandbox (made in a chat, 13 Nov: Three.js r128, an English 7ft
// table, the spin model). From it: the units (1 = a ball's diameter, R = 0.5, the bed
// 18 x 36), the pockets, the slip model of spin, the cushion and ball-to-ball rules
// and the trails. Changed for the hero (UV, 13 Nov, "spin more apparent, nice arcs"):
// side spin lasts longer and turns a cushion's angle more. The defaults are UV's, set
// on the sliders on an iPad (14 Nov): cloth speed 4.5, cloth spin 35, cushion speed
// 0.25, cushion spin 0.9, ball-ball 0.04, no swerve; shadow 1, blur 1.2, no misses. Before its
// first contact the cue ball still runs straight (UV's rule in the game), which is
// also what lets the shot picker aim.
//
// Drawn on a 2D canvas in the site's design (UV, 13 Nov: "follow my site's styling"),
// whose shadows are CSS's own: blurred, offset from the page's light (page-light.js
// writes --page-shadow-x / -y on <html>, read every frame) and made from the same
// tokens as design.css: --nm-blur, --nm-shadow-alpha, the lit edge (--nm-lit-colour,
// --nm-lit-alpha), --nm-radius and --nm-knob-glow. The table is raised from the page
// as a card is, its bed sunk into it as a panel is, the pockets sunk deeper; its lines
// cast their own shadows and glow. Everything is see-through, as on the site. The
// balls are still spheres: each is drawn pixel by pixel from its rotation, so the cue
// ball's spots lie flat on its surface and foreshorten as they roll to its edge.
(function () {
	'use strict';
	var AREA = 'Hero';
	var stage = document.getElementById('hero-stage');
	var statusEl = document.getElementById('hero-status');
	var shotEl = document.getElementById('hero-shot');
	if (!stage) return;
	try { init(); } catch (e) { TDC.error(AREA, 'the table could not be drawn.', e, statusEl); }

	function init() {
		var root = document.documentElement;

		/* ---------- table geometry (from the game) ---------- */
		var R = 0.5;                    // ball radius
		var HX = 9, HZ = 18;            // half-width, half-length of the bed
		var LX = HX - R, LZ = HZ - R;   // ball-CENTRE limits at the cushions
		var D2 = R * 2;                 // contact distance between two balls
		var CW = 2.0;                   // rail width (cushion and wood, as on a real table)
		var OX = HX + CW, OZ = HZ + CW; // the table's outer edge (not drawn): past it a ball is lost
		// The pockets, from a real English 7ft table (UV, 13 Nov: the game's middle pockets
		// stuck far out into the bed). The mouth is the gap between the cushions' noses:
		// about 3.5in at a corner and a little wider at the middle, in 2in balls 1.8 and
		// 1.9. The cushion is cut back there into two short straight jaws that lead to the
		// hole; the hole is as wide as the mouth and lies behind it, in the rail: a corner's
		// on the corner point, a middle's just behind the cushion's nose line, so it comes
		// only MID_LIP into the bed.
		var CM = 1.8, MM = 1.9, MID_LIP = 0.15;
		// How far the table reaches, holes included: there is no rail drawn (UV, 13 Nov)
		var EX = HX + MM - MID_LIP, EZ = HZ + CM / 2;
		var PIT_Y = -R - 0.75;          // a potted ball's centre, at rest in the pocket
		var GRAV = 26, STOPV = 0.22, PMIN = 5, PMAX = 48;
		var MARGIN = 1.6;               // round the table, for its shadows
		var LOGO_PAD = 2.2;             // the logo fills the bed between the markings, this far in
		var SPOT_R = 0.28;              // a spot's angular radius on the cue ball
		var BAND = 0.40;                // half the stripe's angular width
		var TRAIL_MAX = 600, TRAIL_STEP = 0.06;
		// The markings UV puts on the club's tables (13 Nov, from photos of them; the sizes
		// are read from the photos until UV measures them): the baulk line across the
		// table a fifth of its length from the baulk cushion, broken at its centre and
		// either side, with a small dot in each break; and a cross for the black's spot
		// at the other end, a fifth of the length from the top cushion.
		var BAULK_Z = HZ - HZ * 2 / 5;   // the baulk end is +z (the foot of the screen upright)
		var SPOT_Z = -BAULK_Z;
		var BAULK_DOTS = [-2.5, 0, 2.5], BAULK_GAP = 0.45, BAULK_DOT = 0.11;
		// The cross is longer along the table than across it (UV's photo)
		var CROSS_LONG = 1.15, CROSS_SHORT = 0.68;
		// A ball potted falls into the void; a new one drops from above the camera (UV,
		// 13 Nov). The camera is CAM_D above the cloth: a ball nearer it is drawn larger
		// and further from the middle of the screen, as a camera sees it.
		// The landing (UV, 13 Nov: "a bit more realistic"): gravity nearer a real one, the
		// cloth taking two thirds of each bounce's speed so the bounces die quickly, and a
		// little roll from the first one, as a dropped ball seldom lands dead.
		var CAM_D = 46, DROP_H = 40, VOID_Y = -5, FALL_G = 120, BOUNCE = 0.35, SETTLE = 3;

		// Each pocket: its hole (x, z, r), its mouth's centre (mx, mz), the way into the
		// table (ix, iz), its two jaws (J: the cushion's nose, T: where the jaw meets the
		// hole), the point a shot aims at and how wide an angle it takes a ball from
		function corner(sx, sz) {
			var ix = -sx / Math.SQRT2, iz = -sz / Math.SQRT2, A = CM / Math.SQRT2;
			return mkPocket(true, sx * HX, sz * HZ, CM / 2, ix, iz,
				[sx * (HX - A), sz * HZ], [sx * HX, sz * (HZ - A)]);
		}
		function middle(sx) {
			var r = MM / 2;
			return mkPocket(false, sx * (HX + r - MID_LIP), 0, r, -sx, 0,
				[sx * HX, -MM / 2], [sx * HX, MM / 2]);
		}
		function mkPocket(isCorner, x, z, r, ix, iz, j1, j2) {
			var pk = { corner: isCorner, x: x, z: z, r: r, ix: ix, iz: iz };
			pk.mx = (j1[0] + j2[0]) / 2; pk.mz = (j1[1] + j2[1]) / 2;
			// A jaw runs straight back from the nose, along the pocket, to the hole
			pk.jaws = [j1, j2].map(function (J) {
				var t = (x - J[0]) * -ix + (z - J[1]) * -iz;
				return { J: J, T: [J[0] - ix * t, J[1] - iz * t] };
			});
			pk.ax = pk.mx - ix * 0.3; pk.az = pk.mz - iz * 0.3;   // just inside the mouth
			pk.take = isCorner ? 40 : 35;                         // the widest angle it takes, from straight in
			return pk;
		}
		// Clockwise from the top left
		var pockets = [corner(-1, -1), corner(1, -1), middle(1), corner(1, 1), corner(-1, 1), middle(-1)];
		var JAWS = [];
		pockets.forEach(function (pk) { pk.jaws.forEach(function (j) { JAWS.push(j); }); });
		// Where along a rail the cushion is cut away for a mouth
		var CA = CM / Math.SQRT2;
		function mouthOnLong(z) { return z < -HZ + CA || z > HZ - CA || Math.abs(z) < MM / 2; }
		function mouthOnShort(x) { return x < -HX + CA || x > HX - CA; }

		// The bed's edge, clockwise: the cushions' noses and, at each pocket, in along one
		// jaw, round the back of the hole and out along the other
		var BED = (function () {
			var pts = [];
			function ang(p, pk) { return Math.atan2(p[1] - pk.z, p[0] - pk.x); }
			pockets.forEach(function (pk) {
				var a = pk.jaws[0], b = pk.jaws[1];
				var da = Math.atan2(b.J[1], b.J[0]) - Math.atan2(a.J[1], a.J[0]);
				while (da <= -Math.PI) da += 2 * Math.PI;
				while (da > Math.PI) da -= 2 * Math.PI;
				var inJ = da > 0 ? a : b, outJ = da > 0 ? b : a;   // met first going clockwise
				pts.push(inJ.J, inJ.T);
				// Round the back of the hole: whichever way passes away from the table
				var a0 = ang(inJ.T, pk), a1 = ang(outJ.T, pk), back = Math.atan2(-pk.iz, -pk.ix);
				var up = a1; while (up <= a0) up += 2 * Math.PI;
				var down = a1; while (down >= a0) down -= 2 * Math.PI;
				var mid = (a0 + up) / 2, end = Math.cos(mid - back) > 0 ? up : down;
				for (var i = 1; i < 16; i++) {
					var t = a0 + (end - a0) * i / 16;
					pts.push([pk.x + pk.r * Math.cos(t), pk.z + pk.r * Math.sin(t)]);
				}
				pts.push(outJ.T, outJ.J);
			});
			return pts;
		})();

		/* ---------- the tunables ---------- */
		// Physics: the game's, with the cloth's grip and the swerve on sliders here
		var P = { cs: 4.5, cg: 35, ks: 0.25, kg: 0.9, bb: 0.04, sw: 0, side: 0.35, wyKeep: 0.03 };   // UV's, 14 Nov
		var S = { speed: 1, linePx: 2, shadow: 1, blur: 1.2, glow: 1, miss: 0 };                     // UV's, 14 Nov

		/* ---------- colours and sizes, from the site's tokens ---------- */
		var probe = document.createElement('canvas');
		probe.width = probe.height = 1;
		var pctx = probe.getContext('2d', { willReadFrequently: true });
		// Any CSS colour (color-mix too) as [r, g, b, a]: the browser resolves it, a pixel reads it
		function rgba(cssValue) {
			var el = document.createElement('div');
			el.style.color = cssValue;
			el.style.display = 'none';
			document.body.appendChild(el);
			var c = getComputedStyle(el).color;
			document.body.removeChild(el);
			pctx.clearRect(0, 0, 1, 1);
			pctx.fillStyle = '#000';
			pctx.fillStyle = c;
			pctx.fillRect(0, 0, 1, 1);
			var d = pctx.getImageData(0, 0, 1, 1).data;
			return [d[0], d[1], d[2], d[3] / 255];
		}
		function css(c, k) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + Math.max(0, Math.min(1, c[3] * (k == null ? 1 : k))).toFixed(3) + ')'; }
		function num(name, fallback) {
			var v = parseFloat(getComputedStyle(root).getPropertyValue(name));
			return isFinite(v) ? v : fallback;
		}
		var C = {};
		function readTokens() {
			C.bg = rgba('var(--bg-base)');
			C.teal = rgba('var(--color-primary)');
			C.cream = rgba('var(--text-primary)');
			C.grey = rgba('var(--text-muted)');
			C.yellow = rgba('var(--color-warning)');
			C.yellowGlow = rgba('var(--match-glow-colour)');
			C.glow = rgba('var(--nm-knob-glow)');
			C.lit = rgba('var(--nm-lit-colour)');
			C.litA = num('--nm-lit-alpha', 0.05);
			C.darkA = num('--nm-shadow-alpha', 1);
			C.blur = num('--nm-blur', 16);
			C.radius = num('--nm-radius', 26);
			C.inset = num('--page-inset-offset', 10);
		}

		/* ---------- the canvas ---------- */
		var canvas = document.createElement('canvas');
		stage.appendChild(canvas);
		var ctx = canvas.getContext('2d');
		// The table changes only when the light moves, so it is drawn on a layer of its own
		var layer = document.createElement('canvas');
		var lctx = layer.getContext('2d');
		var dpr = 1, cw = 0, ch = 0, sc = 10, cx = 0, cy = 0, land = false, layerKey = '';

		function fit() {
			var w = stage.clientWidth, h = stage.clientHeight;
			if (!w || !h) return;
			dpr = Math.min(window.devicePixelRatio || 1, 2);
			cw = Math.round(w * dpr); ch = Math.round(h * dpr);
			canvas.width = layer.width = cw;
			canvas.height = layer.height = ch;
			// The table's long side along the screen's long side
			land = w > h;
			var halfW = (land ? EZ : EX) + MARGIN, halfH = (land ? EX : EZ) + MARGIN;
			sc = Math.min(cw / (2 * halfW), ch / (2 * halfH));
			cx = cw / 2; cy = ch / 2;
			layerKey = '';
		}
		// The table to the screen (device px). Upright: x right, z down. On its side:
		// z right, x up.
		function W(x, z) { return land ? [cx + z * sc, cy - x * sc] : [cx + x * sc, cy + z * sc]; }

		/* ---------- the light, from page-light.js ---------- */
		var light = { x: 0, y: 10 };   // the page's shadow offset, CSS px
		function readLight() {
			var sx = parseFloat(root.style.getPropertyValue('--page-shadow-x'));
			var sy = parseFloat(root.style.getPropertyValue('--page-shadow-y'));
			if (!isFinite(sx) || !isFinite(sy)) { sx = 0; sy = C.inset; }
			light.x = Math.round(sx * 2) / 2;
			light.y = Math.round(sy * 2) / 2;
		}

		/* ---------- shadows, as CSS draws them ---------- */
		// Canvas shadows are not moved or scaled by the transform, so offsets and blurs
		// are CSS px times the pixel ratio, as on the page
		function setShadow(c, colour, ox, oy, blur) {
			c.shadowColor = colour;
			c.shadowOffsetX = ox * dpr; c.shadowOffsetY = oy * dpr;
			c.shadowBlur = blur * dpr;
		}
		function noShadow(c) { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; }
		function everything(c) { c.rect(-cw, -ch, cw * 3, ch * 3); }
		// A box-shadow: cast outside a see-through shape, never under it
		function dropShadow(c, path, colour, ox, oy, blur) {
			c.save();
			c.beginPath(); everything(c); path(c); c.clip('evenodd');
			setShadow(c, colour, ox, oy, blur);
			c.beginPath(); path(c); c.fillStyle = '#000'; c.fill();
			c.restore();
		}
		// An inset box-shadow: cast inside a shape, by everything round it
		function insetShadow(c, path, colour, ox, oy, blur) {
			c.save();
			c.beginPath(); path(c); c.clip();
			setShadow(c, colour, ox, oy, blur);
			c.beginPath(); everything(c); path(c); c.fillStyle = '#000'; c.fill('evenodd');
			c.restore();
		}
		function dark(k) { return 'rgba(0,0,0,' + Math.max(0, Math.min(1, C.darkA * S.shadow * (k == null ? 1 : k))).toFixed(3) + ')'; }

		/* ---------- the table's shapes ---------- */
		// A closed outline with soft corners: every sharp turn rounded to r (device px)
		function softPath(c, pts, r) {
			var n = pts.length;
			var a = pts[n - 1], b = pts[0];
			c.moveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
			for (var i = 0; i < n; i++) {
				var o = pts[(i - 1 + n) % n], p = pts[i], q = pts[(i + 1) % n];
				var ax = p[0] - o[0], ay = p[1] - o[1], bx = q[0] - p[0], by = q[1] - p[1];
				var la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
				var turn = (la && lb) ? Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)))) : 0;
				if (turn > 0.4) c.arcTo(p[0], p[1], q[0], q[1], Math.min(r, la / 2, lb / 2));
				else c.lineTo(p[0], p[1]);
			}
			c.closePath();
		}
		function bedPath(c) { softPath(c, BED.map(function (p) { return W(p[0], p[1]); }), 0.25 * sc); }
		function circlePath(x, y, r) { return function (c) { c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2); }; }
		function pocketPath(pk) { var p = W(pk.x, pk.z); return circlePath(p[0], p[1], pk.r * sc); }

		// A pocket: a hole sunk below the bed, inside the table's edge
		function pocketShade(c, pk) {
			var L = light, B = C.blur * S.blur, path = pocketPath(pk);
			c.save();
			c.beginPath(); bedPath(c); c.clip();
			c.beginPath(); path(c); c.fillStyle = dark(0.35); c.fill();
			insetShadow(c, path, dark(), L.x, L.y, B / 2);
			c.restore();
		}

		/* ---------- the logo mark ---------- */
		var logoImg = null, logoAr = 1, logoFor = '';
		function loadLogo() {
			var which = root.dataset.theme === 'light' ? 'light' : 'dark';
			if (which === logoFor) return;
			logoFor = which;
			var img = new Image();
			img.onload = function () {
				// Cropped to what is drawn, so it fills its space without the file's margin
				var ar = (img.naturalHeight / img.naturalWidth) || 1;
				var full = document.createElement('canvas');
				full.width = 1024; full.height = Math.round(1024 * ar);
				var fc = full.getContext('2d', { willReadFrequently: true });
				fc.drawImage(img, 0, 0, full.width, full.height);
				var px = fc.getImageData(0, 0, full.width, full.height).data;
				var x0 = full.width, y0 = full.height, x1 = -1, y1 = -1;
				for (var yy = 0; yy < full.height; yy++) {
					for (var xx = 0; xx < full.width; xx++) {
						if (px[(yy * full.width + xx) * 4 + 3] > 8) {
							if (xx < x0) x0 = xx; if (xx > x1) x1 = xx;
							if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
						}
					}
				}
				if (x1 < 0) { logoImg = full; logoAr = ar; layerKey = ''; return; }
				var crop = document.createElement('canvas');
				crop.width = x1 - x0 + 1; crop.height = y1 - y0 + 1;
				crop.getContext('2d').drawImage(full, x0, y0, crop.width, crop.height, 0, 0, crop.width, crop.height);
				logoImg = crop;
				logoAr = crop.height / crop.width;
				layerKey = '';
			};
			img.onerror = function (e) { TDC.error(AREA, 'the logo for the middle of the table did not load.', e, statusEl); };
			img.src = '/resources/branding/logo-mark-' + which + '.svg';
		}

		/* ---------- the markings ---------- */
		function drawMarkings(c) {
			c.save();
			c.strokeStyle = c.fillStyle = css(C.grey);   // the site's grey (UV, 13 Nov)
			c.lineWidth = Math.max(1.5, S.linePx * 1.1) * dpr;
			c.lineCap = 'round';
			function line(x1, z1, x2, z2) {
				var a = W(x1, z1), b = W(x2, z2);
				c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]);
			}
			c.beginPath();
			// The baulk line, cushion to cushion, broken round each dot
			var from = -HX;
			BAULK_DOTS.forEach(function (x) { line(from, BAULK_Z, x - BAULK_GAP, BAULK_Z); from = x + BAULK_GAP; });
			line(from, BAULK_Z, HX, BAULK_Z);
			// The black's spot
			line(0, SPOT_Z - CROSS_LONG, 0, SPOT_Z + CROSS_LONG);   // along the table
			line(-CROSS_SHORT, SPOT_Z, CROSS_SHORT, SPOT_Z);        // across it
			c.stroke();
			BAULK_DOTS.forEach(function (x) {
				var p = W(x, BAULK_Z);
				c.beginPath(); c.arc(p[0], p[1], Math.max(1.8 * dpr, BAULK_DOT * sc), 0, Math.PI * 2); c.fill();
			});
			c.restore();
		}

		/* ---------- the table, drawn when the light moves ---------- */
		function drawLayer() {
			var c = lctx, L = light, B = C.blur * S.blur, lit = css(C.lit, C.litA);
			c.clearRect(0, 0, cw, ch);
			// No rail: only the bed's edge and the pockets (UV, 13 Nov). The bed is sunk,
			// as a panel is (--nm-sunken)
			insetShadow(c, bedPath, dark(), L.x, L.y, B / 2);
			insetShadow(c, bedPath, lit, -L.x, -L.y, B / 2);
			// The pockets, sunk deeper
			pockets.forEach(function (pk) { pocketShade(c, pk); });
			// The markings, chalked flat on the cloth
			drawMarkings(c);
			// The logo, with the soft shadow of the match page's marks
			if (logoImg) {
				// As large as fits the bed's width and the space between the cross and the baulk line
				var across = 2 * (HX - LOGO_PAD), along = 2 * (-(SPOT_Z + CROSS_LONG) - LOGO_PAD);
				var boxW = (land ? along : across) * sc, boxH = (land ? across : along) * sc;
				var lw = Math.min(boxW, boxH / logoAr), lh = lw * logoAr;
				c.save();
				setShadow(c, dark(0.45), L.x / 2, L.y / 2, 10 * S.blur);
				c.drawImage(logoImg, cx - lw / 2, cy - lh / 2, lw, lh);
				c.restore();
			}
			// The lines: their own shadow, then their glow
			c.save();
			c.lineJoin = 'round'; c.lineCap = 'round';
			c.lineWidth = S.linePx * dpr;
			c.strokeStyle = css(C.teal);
			c.beginPath(); bedPath(c);
			setShadow(c, dark(0.8), L.x / 2, L.y / 2, B / 3);
			c.stroke();
			if (S.glow > 0) {
				setShadow(c, css(C.glow, S.glow), 0, 0, 10 * S.glow);
				c.stroke();
			}
			c.restore();
		}

		/* ---------- the balls ---------- */
		function mkBall(kind, name) {
			var body = document.createElement('canvas'), feat = document.createElement('canvas');
			return { kind: kind, name: name, body: body, feat: feat, bctx: body.getContext('2d'), fctx: feat.getContext('2d'), size: 0,
				x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, sx: 0, sz: 0, wy: 0, hit: false, state: 'play', pk: null, t: 0,
				q: randomQuat(), trail: [] };
		}
		function randomQuat() {
			var u1 = Math.random(), u2 = Math.random() * Math.PI * 2, u3 = Math.random() * Math.PI * 2;
			var a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
			return [a * Math.sin(u2), a * Math.cos(u2), b * Math.sin(u3), b * Math.cos(u3)];
		}
		var cue = mkBall('spots', 'the cue ball');
		var stripe = mkBall('stripe', 'the striped ball');
		var solid = mkBall('solid', 'the solid ball');
		var balls = [cue, stripe, solid], objs = [stripe, solid];

		function clearOf(x, z, skip) {
			for (var i = 0; i < balls.length; i++) {
				var o = balls[i];
				if (o === skip || o.state !== 'play') continue;
				if (Math.hypot(o.x - x, o.z - z) < D2 * 1.2) return false;
			}
			return true;
		}
		// Over a hole: the ball drops
		function inPocket(x, z) {
			for (var p = 0; p < pockets.length; p++) {
				if (Math.hypot(x - pockets[p].x, z - pockets[p].z) < pockets[p].r) return pockets[p];
			}
			return null;
		}
		// Near a pocket's mouth: no place to put a ball
		function nearMouth(x, z, pad) {
			for (var p = 0; p < pockets.length; p++) {
				if (Math.hypot(x - pockets[p].mx, z - pockets[p].mz) < 1 + pad) return true;
			}
			return false;
		}
		balls.forEach(function (b) {
			var x, z, n = 0;
			do { x = (Math.random() * 2 - 1) * (LX - 1.5); z = (Math.random() * 2 - 1) * (LZ - 1.5); n++; }
			while ((!clearOf(x, z, b) || nearMouth(x, z, 1)) && n < 80);
			b.x = x; b.z = z;
		});

		function moving() {
			for (var i = 0; i < balls.length; i++) {
				var b = balls[i];
				if (b.state !== 'play' || Math.abs(b.vx) > 0.004 || Math.abs(b.vz) > 0.004) return true;
			}
			return false;
		}

		/* ---------- physics (from the game) ---------- */
		// Cushions scrub spin, never mirror it (the game's handoff, rule 1). Side spin
		// turns the angle off the cushion (P.side; 0.18 in the game).
		function cushion(b, nx, nz) {
			b.hit = true;
			var e = 1 - P.ks, tx = -nz, tz = nx, keep = 1 - P.kg;
			var vn = b.vx * nx + b.vz * nz, vt = b.vx * tx + b.vz * tz;
			vn = -vn * e;
			vt -= P.side * keep * R * b.wy;
			b.vx = vn * nx + vt * tx; b.vz = vn * nz + vt * tz;
			b.wy *= keep;
			b.sx *= keep; b.sz *= keep;
		}

		function jaw(b, j) {
			var ex = j.T[0] - j.J[0], ez = j.T[1] - j.J[1], L2 = ex * ex + ez * ez;
			var t = Math.max(0, Math.min(1, ((b.x - j.J[0]) * ex + (b.z - j.J[1]) * ez) / L2));
			var qx = j.J[0] + ex * t, qz = j.J[1] + ez * t;
			var dx = b.x - qx, dz = b.z - qz, d = Math.hypot(dx, dz);
			if (d >= R || d === 0) return;
			var nx = dx / d, nz = dz / d;
			b.x = qx + nx * R; b.z = qz + nz * R;
			if (b.vx * nx + b.vz * nz < 0) cushion(b, nx, nz);
		}
		function nearestPocket(b) {
			var best = pockets[0], bd = Infinity;
			pockets.forEach(function (pk) { var d = Math.hypot(b.x - pk.x, b.z - pk.z); if (d < bd) { bd = d; best = pk; } });
			return best;
		}

		function step(dt) {
			var i, b;
			for (i = 0; i < balls.length; i++) {
				b = balls[i];
				if (b.state !== 'play') { if (!SIM) pocketStep(b, dt); continue; }

				var sp = Math.hypot(b.vx, b.vz);
				if (!b.hit) {
					// Before its first contact the cloth damps speed only (UV's rule in the game)
					if (sp > 0) {
						var ns = sp - P.cs * dt;
						if (ns < STOPV) { b.vx = 0; b.vz = 0; } else { b.vx = b.vx / sp * ns; b.vz = b.vz / sp * ns; }
					}
				} else {
					var ux = b.vx + b.sx, uz = b.vz + b.sz, un = Math.hypot(ux, uz);
					if (un > 0.02) {
						// Sliding: slip decays at 3.5x and the ball settles into rolling. The
						// lower the grip (cg), the longer it slides and the wider its arc.
						var nx = ux / un, nz = uz / un, a = P.cg;
						b.vx -= a * nx * dt; b.vz -= a * nz * dt;
						b.sx -= 2.5 * a * nx * dt; b.sz -= 2.5 * a * nz * dt;
						if ((b.vx + b.sx) * nx + (b.vz + b.sz) * nz < 0) { b.sx = -b.vx; b.sz = -b.vz; }
					} else {
						sp = Math.hypot(b.vx, b.vz);
						if (sp > 0) {
							var n2 = sp - P.cs * dt;
							if (n2 < STOPV) { b.vx = 0; b.vz = 0; } else { b.vx = b.vx / sp * n2; b.vz = b.vz / sp * n2; }
						}
						b.sx = -b.vx; b.sz = -b.vz;
					}
					// Swerve from side spin, after contact only
					sp = Math.hypot(b.vx, b.vz);
					if (sp > 0.05 && Math.abs(b.wy) > 0.01) {
						var px = b.vz / sp, pz = -b.vx / sp;
						b.vx += P.sw * b.wy * px * dt; b.vz += P.sw * b.wy * pz * dt;
					}
					b.wy *= Math.exp(-(P.cg * P.wyKeep) * dt);
				}

				b.x += b.vx * dt; b.z += b.vz * dt;

				// Pockets before cushions (the game's handoff, rule 2): a ball drops once its
				// centre is over the hole
				var pk = inPocket(b.x, b.z);
				if (pk) { potted(b, pk); continue; }
				// A ball that somehow left the table goes down the nearest pocket
				if (Math.abs(b.x) > OX || Math.abs(b.z) > OZ) { potted(b, nearestPocket(b)); continue; }

				// The cushions, only where they are: not across a pocket's mouth
				if (!mouthOnLong(b.z)) {
					if (b.x < -LX) { b.x = -LX; cushion(b, 1, 0); } else if (b.x > LX) { b.x = LX; cushion(b, -1, 0); }
				}
				if (!mouthOnShort(b.x)) {
					if (b.z < -LZ) { b.z = -LZ; cushion(b, 0, 1); } else if (b.z > LZ) { b.z = LZ; cushion(b, 0, -1); }
				}
				// The jaws, their noses included: a ball off line rattles in or out
				for (var jw = 0; jw < JAWS.length; jw++) jaw(b, JAWS[jw]);
			}

			// Ball to ball, repeated until nothing overlaps (the game's handoff: one pass
			// can squirt a ball out of a cluster at a wrong angle)
			for (var it = 0; it < 4; it++) {
				var any = false;
				for (var a1 = 0; a1 < balls.length; a1++) {
					for (var k = a1 + 1; k < balls.length; k++) {
						var A = balls[a1], B = balls[k];
						if (A.state !== 'play' || B.state !== 'play') continue;
						var dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
						if (!(d > 0 && d < D2)) continue;
						any = true;
						var cx2 = dx / d, cz2 = dz / d, ov = (D2 - d) / 2;
						A.x -= cx2 * ov; A.z -= cz2 * ov; B.x += cx2 * ov; B.z += cz2 * ov;
						var rv = (B.vx - A.vx) * cx2 + (B.vz - A.vz) * cz2;
						if (rv < 0) {
							var j = -rv * (1 - P.bb);
							A.vx -= j * cx2; A.vz -= j * cz2; B.vx += j * cx2; B.vz += j * cz2;
							A.hit = true; B.hit = true;
							// Object balls pick up no spin from contact; the cue ball keeps its own (the game)
							if (B !== cue) { B.sx = 0; B.sz = 0; B.wy = 0; }
							if (A !== cue) { A.sx = 0; A.sz = 0; A.wy = 0; }
						}
					}
				}
				if (!any) break;
			}
		}

		/* ---------- the pocket: into the void, and a new ball from above ---------- */
		function potted(b, pk) {
			b.state = 'drop'; b.pk = pk; b.vy = 0;
			if (SIM) return;
			if (shot) shot.potted.push(b.name);
		}

		function pocketStep(b, dt) {
			var pk = b.pk;
			if (b.state === 'drop') {
				// Falls through the hole under gravity, its speed across the table dying,
				// held inside the hole, until it is gone into the void
				b.vy -= GRAV * dt;
				b.y += b.vy * dt;
				var k = Math.exp(-6 * dt);
				b.vx *= k; b.vz *= k;
				b.x += b.vx * dt; b.z += b.vz * dt;
				var dx = b.x - pk.x, dz = b.z - pk.z, d = Math.hypot(dx, dz), lim = Math.max(0.15, pk.r - R * 0.8);
				if (d > lim) { b.x = pk.x + dx / d * lim; b.z = pk.z + dz / d * lim; }
				if (b.y <= VOID_Y) {
					b.state = 'gone';
					b.t = 0.3 + Math.random() * 0.5;   // a moment before the new one
				}
				return;
			}
			if (b.state === 'gone') {
				b.t -= dt;
				if (b.t > 0) return;
				// A clear place on the table, away from the pockets
				for (var tries = 0; tries < 40; tries++) {
					var x = (Math.random() * 2 - 1) * (LX - 1.5), z = (Math.random() * 2 - 1) * (LZ - 1.5);
					if (!clearOf(x, z, b) || nearMouth(x, z, 1)) continue;
					b.state = 'fall';
					b.x = x; b.z = z; b.y = DROP_H;
					b.vx = b.vz = b.vy = b.sx = b.sz = b.wy = 0;
					b.hit = false; b.pk = null; b.bounced = false;
					b.q = randomQuat();
					b.trail = [];
					return;
				}
				b.t = 0.3;   // nowhere clear: try again shortly
				return;
			}
			if (b.state === 'fall') {
				// Down from above the camera, a few quick bounces, then still
				b.vy -= FALL_G * dt;
				b.y += b.vy * dt;
				b.x = Math.max(-LX, Math.min(LX, b.x + b.vx * dt));
				b.z = Math.max(-LZ, Math.min(LZ, b.z + b.vz * dt));
				if (b.y <= 0) {
					b.y = 0;
					if (-b.vy < SETTLE) {
						// On the cloth: it rolls out what is left of its drift
						b.vy = 0; b.state = 'play'; b.hit = true;
						b.sx = -b.vx; b.sz = -b.vz;
					} else {
						b.vy = -b.vy * BOUNCE;
						if (!b.bounced) {
							b.bounced = true;
							var da = Math.random() * Math.PI * 2, dv = 0.6 + Math.random() * 1.4;
							b.vx = Math.cos(da) * dv; b.vz = Math.sin(da) * dv;
							b.sx = -b.vx; b.sz = -b.vz;   // rolling as it drifts
						}
					}
				}
			}
		}

		/* ---------- the shot picker ---------- */
		var shot = null, shots = 0, stillFor = 0, nextWait = 1.2, busyFor = 0, trailFade = 1;
		var target = null;   // the ball being played, kept until it goes down
		function rad(deg) { return deg * Math.PI / 180; }
		function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }
		// Does a ball rolling from a to b pass clear of every ball but those skipped?
		function pathClear(ax, az, bx, bz, skip) {
			var dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
			for (var i = 0; i < balls.length; i++) {
				var o = balls[i];
				if (skip.indexOf(o) >= 0 || o.state !== 'play') continue;
				var t = (o.x - ax) * ux + (o.z - az) * uz;
				if (t < 0 || t > L + R) continue;
				if (Math.abs((o.x - ax) * uz - (o.z - az) * ux) < D2) return false;
			}
			return true;
		}

		// Every pot on offer on obj with the cue ball at (fx, fz): the ghost ball, a cut it
		// can make, the way into the pocket through its mouth, nothing in the way
		function potsOn(obj, fx, fz) {
			var out = [];
			pockets.forEach(function (pk) {
				var px = pk.ax - obj.x, pz = pk.az - obj.z, dOP = Math.hypot(px, pz);
				if (dOP < 0.5) return;
				var ux = px / dOP, uz = pz / dOP;
				if (-(ux * pk.ix + uz * pk.iz) < Math.cos(rad(pk.take))) return;
				var gx = obj.x - ux * D2, gz = obj.z - uz * D2;   // the ghost ball
				if (Math.abs(gx) > LX || Math.abs(gz) > LZ) return;
				var cx2 = gx - fx, cz2 = gz - fz, dCG = Math.hypot(cx2, cz2);
				if (dCG < 0.4) return;
				var ax = cx2 / dCG, az = cz2 / dCG, cut = ax * ux + az * uz;
				if (cut < Math.cos(rad(72))) return;
				if (!pathClear(fx, fz, gx, gz, [cue, obj])) return;
				if (!pathClear(obj.x, obj.z, pk.ax, pk.az, [cue, obj])) return;
				var score = cut * cut / (1 + 0.05 * (dOP + dCG));
				out.push({ obj: obj, pk: pk, ax: ax, az: az, cut: cut, dOP: dOP, dCG: dCG, score: score });
			});
			return out;
		}

		// The next shot's line (UV, 13 Nov): the other ball into a pocket, and the spot on
		// that line, SPOT_BACK behind the ball (nearer if the table runs out), where the
		// cue ball is meant to stop for it
		var SPOT_BACK = 4;
		function lineTo(B, pk) {
			var dx = pk.ax - B.x, dz = pk.az - B.z, d = Math.hypot(dx, dz) || 1;
			return { pk: pk, ux: dx / d, uz: dz / d, d: d };
		}
		function spotOn(B, pk) {
			var L = lineTo(B, pk);
			for (var back = SPOT_BACK; back >= D2 + 1; back -= 0.5) {
				var x = B.x - L.ux * back, z = B.z - L.uz * back;
				if (Math.abs(x) < LX - 0.3 && Math.abs(z) < LZ - 0.3 && !nearMouth(x, z, 0.3)) return [x, z];
			}
			return null;
		}
		function nextLine(B) {
			var lines = pockets.map(function (pk) {
				var L = lineTo(B, pk);
				if (L.d < 0.5) return null;
				if (-(L.ux * pk.ix + L.uz * pk.iz) < Math.cos(rad(pk.take))) return null;
				if (!pathClear(B.x, B.z, pk.ax, pk.az, [cue, B, target])) return null;
				if (!spotOn(B, pk)) return null;
				L.score = 1 / (1 + 0.08 * L.d);
				return L;
			}).filter(Boolean);
			return lines.length ? pick(lines, function (l) { return l.score; }) : null;
		}

		// Pace: the object ball reaches the pocket still rolling. After contact it slides
		// down to 5/7 of its speed, then rolls to a stop at cs; the cue ball slows at cs
		// on the way to it.
		function paceFor(plan, arrive) {
			var v0 = 7 / 5 * Math.sqrt(arrive * arrive + 2 * P.cs * (plan.dOP + 0.8));   // on into the hole
			var vc = v0 / (Math.max(0.25, plan.cut) * (1 - P.bb));
			return Math.sqrt(vc * vc + 2 * P.cs * plan.dCG);
		}
		function strike(c, ax, az, power, tipX, tipY) {
			power = Math.max(PMIN, Math.min(PMAX, power));
			c.vx = ax * power; c.vz = az * power;
			c.sx = -2.5 * tipY * power * ax; c.sz = -2.5 * tipY * power * az;
			c.wy = 2.5 * tipX * power / R;
			c.hit = false;
		}

		// The shot played out on a copy of the table, quickly and coarsely, to see whether it
		// pots and where the cue ball stops (UV, 13 Nov: "doesn't need to be exact")
		// The copy steps exactly as the table does (STEP), so it plays out as the shot will:
		// a coarser step changed the angle balls came off each other at pace
		var SIM = false;
		function simulate(plan, power, tipX, tipY, other, next) {
			var keep = { balls: balls, cue: cue, objs: objs };
			var copy = balls.map(function (b) {
				return { name: b.name, x: b.x, z: b.z, y: 0, vx: 0, vz: 0, vy: 0, sx: 0, sz: 0, wy: 0, hit: false,
					state: b.state === 'play' ? 'play' : 'away', pk: null };
			});
			var res = { potted: false, scratch: false, err: 0 };
			balls = copy; cue = copy[0]; objs = copy.slice(1); SIM = true;
			try {
				strike(cue, plan.ax, plan.az, power, tipX, tipY);
				for (var t = 0; t < 10; t += STEP) {
					step(STEP);
					var still = copy.every(function (b) { return b.state !== 'play' || (Math.abs(b.vx) <= 0.004 && Math.abs(b.vz) <= 0.004); });
					if (still) break;
				}
				res.potted = copy[keep.balls.indexOf(plan.obj)].state === 'drop';
				res.scratch = cue.state === 'drop';
				var oth = other ? copy[keep.balls.indexOf(other)] : null;
				// Position: how far the cue ball stops from the spot on the next shot's line,
				// taken from wherever the other ball ends up
				if (res.scratch) res.err = Infinity;
				else if (next && oth && oth.state === 'play') {
					var sp = spotOn(oth, next.pk);
					res.err = sp ? Math.hypot(cue.x - sp[0], cue.z - sp[1]) : 20;
				} else res.err = 5;   // nothing to play for

			} finally {
				balls = keep.balls; cue = keep.cue; objs = keep.objs; SIM = false;
			}
			return res;
		}
		function pick(list, weight) {
			var sum = list.reduce(function (s, o) { return s + weight(o); }, 0), r = Math.random() * sum;
			for (var i = 0; i < list.length; i++) { r -= weight(list[i]); if (r <= 0) return list[i]; }
			return list[list.length - 1];
		}

		// Working out the next shot while the balls are still (UV, 13 Nov): play one ball,
		// trying to land on a shot for the other, then play the other. Shots are tried
		// on a copy of the table, a few each frame so the page never stalls: first at
		// random across the best pots, then close round the one that stopped the cue ball
		// nearest the spot on the next shot's line.
		var planning = null, PLAN_MS = 5, PLAN_WIDE = 48, PLAN_NEAR = 24;
		function randomTry(plan) {
			return { plan: plan, tipY: Math.random() * 1.6 - 0.8, tipX: Math.random() < 0.4 ? Math.random() - 0.5 : 0, arrive: 1 + Math.random() * 8 };
		}
		function startPlanning() {
			if (!target || target.state !== 'play') {
				var on = objs.filter(function (o) { return o.state === 'play'; });
				if (!on.length) return null;
				target = on[0];
			}
			var other = objs.filter(function (o) { return o !== target; })[0] || null;
			var next = other && other.state === 'play' ? nextLine(other) : null;
			var options = potsOn(target, cue.x, cue.z).sort(function (a, b) { return b.score - a.score; }).slice(0, 3);
			var queue = [];
			for (var i = 0; options.length && i < PLAN_WIDE; i++) queue.push(randomTry(options[i % options.length]));
			return { target: target, other: other, next: next, options: options, queue: queue, tried: [], round: 0, all: potsOn(target, cue.x, cue.z) };
		}
		function planStep(pl) {
			var t0 = performance.now();
			while (pl.queue.length && performance.now() - t0 < PLAN_MS) {
				var q = pl.queue.shift(), power = paceFor(q.plan, q.arrive);
				var r = simulate(q.plan, power, q.tipX, q.tipY, pl.other, pl.next);
				if (r.potted && !r.scratch) pl.tried.push({ plan: q.plan, power: power, tipX: q.tipX, tipY: q.tipY, arrive: q.arrive, err: r.err });
			}
			if (!pl.queue.length && pl.round < 2) {
				pl.round++;
				var best = pl.tried.reduce(function (m, o) { return !m || o.err < m.err ? o : m; }, null);
				if (!best && pl.round === 1) {
					// Nothing potted: once more at random, over every pot on offer
					for (var j = 0; pl.all.length && j < PLAN_WIDE; j++) pl.queue.push(randomTry(pl.all[j % pl.all.length]));
				} else if (best && pl.next) {
					// Close round the best, closer the second time
					var w = pl.round === 1 ? 1 : 0.4;
					for (var i = 0; i < PLAN_NEAR; i++) {
						pl.queue.push({ plan: best.plan,
							tipY: Math.max(-0.8, Math.min(0.8, best.tipY + (Math.random() - 0.5) * 0.3 * w)),
							tipX: best.tipX + (Math.random() - 0.5) * 0.2 * w,
							arrive: Math.max(0.5, best.arrive * (1 + (Math.random() - 0.5) * 0.4 * w)) });
					}
				}
			}
			return !pl.queue.length;
		}

		function shoot(pl) {
			var other = pl.other, next = pl.next, options = pl.options, tried = pl.tried;
			var plan, power, tipX, tipY;
			if (tried.length) {
				// The nearer the cue ball stops to the spot, the likelier the shot
				var c = pick(tried, function (o) { return Math.exp(-2 * o.err); });
				plan = c.plan; power = c.power; tipX = c.tipX; tipY = c.tipY;
			} else if (options.length) {
				// None came off in the copy: the likeliest pot, with spin at random
				var r0 = randomTry(pick(options, function (o) { return o.score; }));
				plan = r0.plan; power = paceFor(plan, r0.arrive); tipX = r0.tipX; tipY = r0.tipY;
			} else {
				// No pot on: a thin hit on the ball, to move things on
				var fx = pl.target.x - cue.x, fz = pl.target.z - cue.z, f = Math.hypot(fx, fz) || 1;
				var off = (Math.random() < 0.5 ? -1 : 1) * Math.asin(Math.min(0.9, (0.3 + Math.random() * 0.5) * D2 / f));
				var co = Math.cos(off), so = Math.sin(off);
				plan = { obj: pl.target, pk: null, ax: (fx * co - fz * so) / f, az: (fx * so + fz * co) / f, cut: 0.5, dOP: 8, dCG: f };
				power = paceFor(plan, 3);
				tipY = (Math.random() * 2 - 1) * 0.5; tipX = 0;
			}

			// Aim: a little error always, a lot when it is meant to miss
			var miss = plan.pk && Math.random() < S.miss;
			var err = miss ? (Math.random() < 0.5 ? -1 : 1) * rad(1.5 + Math.random() * 3) : gauss() * rad(0.05);
			var ce = Math.cos(err), se = Math.sin(err);
			strike(cue, plan.ax * ce - plan.az * se, plan.ax * se + plan.az * ce, power, tipX, tipY);
			objs.forEach(function (o) { o.hit = false; o.sx = 0; o.sz = 0; o.wy = 0; });
			balls.forEach(function (b) { b.trail = []; });
			trailFade = 1;

			shots++;
			var words = 'Shot ' + shots + ': ';
			if (plan.pk) words += 'a ' + Math.round(Math.acos(Math.min(1, plan.cut)) * 180 / Math.PI) + '° cut on ' + plan.obj.name + ' to a ' + (plan.pk.corner ? 'corner' : 'middle pocket') + (miss ? ', meant to miss' : '');
			else words += 'no pot on, a thin hit on ' + plan.obj.name;
			words += (tipY > 0.4 ? ', follow' : tipY < -0.4 ? ', draw' : '') + (tipX > 0.1 ? ', right side' : tipX < -0.1 ? ', left side' : '');
			if (next) words += ', for position on ' + other.name;
			shot = { words: words, potted: [], next: next ? { ball: other, pk: next.pk } : null };
			target = other || pl.target;   // the next shot plays the other ball
			if (shotEl) shotEl.textContent = words;
		}

		/* ---------- drawing the balls ---------- */
		function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
		function qMul(a, b) {
			return [
				a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
				a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
				a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
				a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
			];
		}
		// The game's visual rotation: omega from the slip vector (wx = -sz/R, wz = sx/R)
		// plus side spin about the vertical, composed in world space
		function spin(b, dt) {
			var wx = -b.sz / R, wv = b.wy, wz = b.sx / R;
			var mag = Math.sqrt(wx * wx + wv * wv + wz * wz);
			if (mag < 1e-3) return;
			var h = mag * dt / 2, s = Math.sin(h) / mag;
			var q = qMul([wx * s, wv * s, wz * s, Math.cos(h)], b.q);
			var n = Math.hypot(q[0], q[1], q[2], q[3]);
			b.q = [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
		}

		// The ball pixel by pixel, into two small canvases: its body, see-through (UV,
		// 13 Nov: where a ball was the background colour it is transparent) but for a
		// glow from its edge inward, as a chosen toggle's; and its features (spots or
		// stripe), which are drawn with a glow of their own
		function paintBall(b, rp) {
			var size = Math.ceil(rp * 2) + 4;
			if (b.size !== size) {
				b.body.width = b.body.height = b.feat.width = b.feat.height = size;
				b.size = size;
				b.bodyData = b.bctx.createImageData(size, size);
				b.featData = b.fctx.createImageData(size, size);
			}
			var bd = b.bodyData.data, fd = b.featData.data, half = size / 2;
			// The world to the ball's own frame: the rotation of its conjugate
			var x = -b.q[0], y = -b.q[1], z = -b.q[2], w = b.q[3];
			var m00 = 1 - 2 * (y * y + z * z), m01 = 2 * (x * y - z * w), m02 = 2 * (x * z + y * w);
			var m10 = 2 * (x * y + z * w), m11 = 1 - 2 * (x * x + z * z), m12 = 2 * (y * z - x * w);
			var m20 = 2 * (x * z - y * w), m21 = 2 * (y * z + x * w), m22 = 1 - 2 * (x * x + y * y);
			var fc = b.kind === 'spots' ? C.yellow : C.teal;
			var rimK = 0.6 * S.glow * C.glow[3];
			var gl = C.glow;
			for (var j = 0; j < size; j++) {
				var v = (j + 0.5 - half) / rp;
				for (var i = 0; i < size; i++) {
					var u = (i + 0.5 - half) / rp, o = (j * size + i) * 4;
					var d2 = u * u + v * v, cov = clamp01((1 - Math.sqrt(d2)) * rp + 0.5);
					if (cov <= 0) { bd[o + 3] = 0; fd[o + 3] = 0; continue; }
					var nz0 = Math.sqrt(Math.max(0, 1 - d2));   // towards the camera
					// The surface's normal on the table: up is +y
					var nx, ny = nz0, nz;
					if (land) { nx = -v; nz = u; } else { nx = u; nz = v; }
					var bx = m00 * nx + m01 * ny + m02 * nz;
					var by = m10 * nx + m11 * ny + m12 * nz;
					var bz = m20 * nx + m21 * ny + m22 * nz;
					var ew = 1 / (rp * Math.max(nz0, 0.2));     // a pixel, as an angle on the ball
					var f;
					if (b.kind === 'spots') {
						f = 0;
						var comps = [bx, -bx, by, -by, bz, -bz];
						for (var c = 0; c < 6; c++) {
							if (comps[c] < 0.85) continue;
							var ang = Math.acos(Math.min(1, comps[c]));
							f = Math.max(f, clamp01((SPOT_R - ang) / ew + 0.5));
						}
					} else {
						var lat = Math.asin(Math.max(-1, Math.min(1, by)));
						f = clamp01((BAND - Math.abs(lat)) / ew + 0.5);
						if (b.kind === 'solid') f = 1 - f;
					}
					var rim = rimK * Math.pow(1 - nz0, 2);
					bd[o] = gl[0]; bd[o + 1] = gl[1]; bd[o + 2] = gl[2];
					bd[o + 3] = 255 * cov * rim;
					fd[o] = fc[0]; fd[o + 1] = fc[1]; fd[o + 2] = fc[2];
					fd[o + 3] = 255 * cov * f;
				}
			}
			b.bctx.putImageData(b.bodyData, 0, 0);
			b.fctx.putImageData(b.featData, 0, 0);
		}

		// A shadow alone, the shape itself drawn off the canvas
		function shadowOnly(c, x, y, r, colour, ox, oy, blur) {
			c.save();
			setShadow(c, colour, ox, oy, blur);
			c.shadowOffsetX += 4 * cw;
			c.beginPath(); c.arc(x - 4 * cw, y, r, 0, Math.PI * 2); c.fillStyle = '#000'; c.fill();
			c.restore();
		}

		function drawBall(b) {
			if (b.state === 'gone') return;
			var L = light, B = C.blur * S.blur;
			var k = CAM_D / (CAM_D - b.y);   // nearer the camera, larger and further out
			var p0 = W(b.x, b.z), p = [cx + (p0[0] - cx) * k, cy + (p0[1] - cy) * k];
			var rp = R * sc * k;
			var under = b.y < 0;
			// Fading into the void below the pocket; appearing at once from above
			var alpha = under ? clamp01(1 - b.y / VOID_Y) : clamp01((DROP_H - b.y) / 3);
			paintBall(b, rp);
			// Its shadow on the cloth, as a small raised button's (--nm-raised-small): the
			// higher the ball, the further off, softer and fainter
			// The ball is see-through, so its shadow is kept outside it, as a box-shadow is
			if (!under) {
				var h = b.y, off = 0.6 + h * 0.12;
				ctx.save();
				ctx.beginPath(); everything(ctx); circlePath(p[0], p[1], rp)(ctx); ctx.clip('evenodd');
				shadowOnly(ctx, p0[0], p0[1], R * sc, dark(alpha / (1 + h * 0.08)), L.x * off, L.y * off, (B / 2) * (1 + h * 0.1));
				ctx.restore();
			}
			ctx.save();
			ctx.globalAlpha = alpha;
			// Through the hole: the table hides whatever is not over it
			if (under && b.pk) { ctx.beginPath(); pocketPath(b.pk)(ctx); ctx.clip(); }
			ctx.drawImage(b.body, p[0] - b.size / 2, p[1] - b.size / 2);
			if (S.glow > 0) setShadow(ctx, css(b === cue ? C.yellowGlow : C.glow, S.glow), 0, 0, 8 * S.glow);
			ctx.drawImage(b.feat, p[0] - b.size / 2, p[1] - b.size / 2);
			noShadow(ctx);
			ctx.restore();
		}

		/* ---------- the trails (from the game) ---------- */
		function trailPush(b) {
			var T = b.trail, l = T[T.length - 1];
			if (l && Math.hypot(b.x - l[0], b.z - l[1]) < TRAIL_STEP) return;
			T.push([b.x, b.z]);
			if (T.length > TRAIL_MAX) T.shift();
		}
		// Where a ball is drawn on the screen, or null when it is not on or above the table
		function onScreen(b) {
			if (b.state === 'gone' || b.state === 'drop') return null;
			var k = CAM_D / (CAM_D - b.y), p0 = W(b.x, b.z);
			return { x: cx + (p0[0] - cx) * k, y: cy + (p0[1] - cy) * k, r: R * sc * k };
		}
		function drawTrails() {
			if (trailFade <= 0) return;
			ctx.save();
			// The balls mask the trails (UV, 13 Nov): nothing is drawn where a ball is
			ctx.beginPath(); everything(ctx);
			balls.forEach(function (b) { var o = onScreen(b); if (o) circlePath(o.x, o.y, o.r)(ctx); });
			ctx.clip('evenodd');
			ctx.lineJoin = 'round'; ctx.lineCap = 'round';
			ctx.lineWidth = 1.5 * dpr;
			// Undrawn from its tail towards the ball, on every ball (UV, 13 Nov)
			balls.forEach(function (b) {
				var T = b.trail, n = T.length;
				if (n < 2) return;
				var from = (1 - trailFade) * (n - 1), i0 = Math.floor(from), part = from - i0;
				ctx.strokeStyle = css(b === cue ? C.cream : C.teal, b === cue ? 0.6 : 0.5);
				ctx.beginPath();
				var pen = false;
				for (var i = i0; i < n; i++) {
					if (!T[i]) { pen = false; continue; }
					var pt = T[i];
					// The first point slides along its segment, so the line undraws smoothly
					if (i === i0 && T[i + 1]) pt = [pt[0] + (T[i + 1][0] - pt[0]) * part, pt[1] + (T[i + 1][1] - pt[1]) * part];
					var p = W(pt[0], pt[1]);
					if (pen) ctx.lineTo(p[0], p[1]); else { ctx.moveTo(p[0], p[1]); pen = true; }
				}
				ctx.stroke();
			});
			ctx.restore();
		}

		/* ---------- the loop ---------- */
		// The table moves in fixed steps of STEP, however fast the screen draws, so the
		// copy used to plan a shot plays out the same
		var STEP = 1 / 480, acc = 0;
		var last = performance.now(), failed = false;
		function frame(now) {
			if (failed) return;
			try {
				var dt = Math.min((now - last) / 1000, 0.05) * S.speed;
				last = now;
				acc = Math.min(acc + dt, 0.1);
				while (acc >= STEP) { step(STEP); acc -= STEP; }
				balls.forEach(function (b) {
					spin(b, dt);
					if ((b.state === 'play' || b.state === 'drop') && (Math.abs(b.vx) > 0.004 || Math.abs(b.vz) > 0.004)) trailPush(b);
				});

				// The next shot once everything has stopped, after a random pause in which
				// the trails fade out. A shot that never settles (it should not) is stopped
				// after 30 s.
				if (moving()) {
					stillFor = 0;
					planning = null;
					busyFor += dt;
					if (busyFor > 30) balls.forEach(function (b) { if (b.state === 'play') { b.vx = b.vz = b.sx = b.sz = b.wy = 0; } });
				} else {
					busyFor = 0;
					if (shot && !shot.shown) {
						shot.shown = true;
						var told = shot.words + ' · ' + (shot.potted.length ? 'potted ' + shot.potted.join(' and ').replace('potted the cue ball', 'the cue ball in') : 'missed');
						var nx = shot.next;
						if (nx && nx.ball.state === 'play' && cue.state === 'play') {
							var sp = spotOn(nx.ball, nx.pk);
							if (sp) told += ' · the white ' + Math.hypot(cue.x - sp[0], cue.z - sp[1]).toFixed(1) + ' balls from its spot';
						}
						if (shotEl) shotEl.textContent = told;
					}
					stillFor += dt;
					trailFade = clamp01(1 - stillFor / (nextWait * 0.85));
					if (!planning) planning = startPlanning();
					var ready = planning ? planStep(planning) : false;
					if (stillFor > nextWait && ready) {
						shoot(planning);
						planning = null; stillFor = 0; nextWait = 1 + Math.random() * 1.4;
					}
				}

				readLight();
				var key = [light.x, light.y, cw, ch, S.linePx, S.shadow, S.blur, S.glow, logoImg ? logoFor : ''].join();
				if (key !== layerKey) { layerKey = key; drawLayer(); }
				ctx.clearRect(0, 0, cw, ch);
				ctx.drawImage(layer, 0, 0);
				drawTrails();
				// Balls going into the void first, then those on the table, then any falling
				['drop', 'play', 'fall'].forEach(function (st) {
					balls.filter(function (b) { return b.state === st; }).forEach(drawBall);
				});
				requestAnimationFrame(frame);
			} catch (e) {
				failed = true;
				TDC.error(AREA, 'the animation stopped.', e, statusEl);
			}
		}

		/* ---------- the sliders ---------- */
		document.querySelectorAll('[data-hero]').forEach(function (input) {
			var key = input.dataset.hero, store = key in P ? P : S, out = document.getElementById(input.id + '-out');
			function take() {
				store[key] = parseFloat(input.value);
				if (out) out.textContent = key === 'miss' ? Math.round(store[key] * 100) + '%' : input.value;
			}
			input.value = store[key];
			take();
			input.addEventListener('input', take);
		});

		readTokens();
		loadLogo();
		fit();
		new ResizeObserver(fit).observe(stage);
		new MutationObserver(function () { readTokens(); loadLogo(); layerKey = ''; })
			.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
		requestAnimationFrame(frame);
	}
})();
