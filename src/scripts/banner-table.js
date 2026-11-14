// The banner's pool table (UV, 14 Nov; DECISIONS 14 Nov): the site's banner. Every top
// banner marked data-banner-table gets it: the league's Season tab, the scorecard's top
// banner, the tournament poster, the venue page, and /sandbox/banner/. Under less motion
// (TDCPrefs.lessMotion) nothing is added and the banner is the one the site had, which
// is its reduced-motion form; switching less motion on or off adds or takes it away at
// once. Built on /sandbox/banner/ from the hero's table and balls (/sandbox/hero/, kept as
// it was). Styles in banner-table.css. Needs: tdc.js (TDC.error), prefs.js (TDCPrefs).
//
// What changed from the hero: the table takes the banner's shape and size, its edge on
// the banner's line (the ::before, hidden), with no markings or logo; the ball's size
// follows the banner's width only, so opening and closing the banner moves the right
// and bottom cushions and nothing else, and a cushion moving in pushes the balls it
// reaches (pushWalls); no shot is planned or played while the banner changes size; the
// pockets are the hero's, and the cushions come in until they fit in the card; the balls roll over the banner's
// text on a canvas of their own, each over a frosted circle (a backdrop blur); and a
// ball's line undraws from the moment that ball stops. The hero's notes follow.
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
var TDCBannerTable = (function () {
	'use strict';
	var AREA = 'Banner';

	// The table and balls round one banner (stage). They are drawn in a wrapper put round
	// it (.banner-wrap), not in it: a banner clips sideways (design.css, "nothing leaves
	// its card") and the table reaches out into the page card's margin. opts.status: where
	// an error is shown (one is made under the banner if none is given); opts.shot: the
	// sandbox's readout of each shot. Returns { stop }: everything added taken away again
	// and the banner left as it was.
	function attach(stage, opts) {
		opts = opts || {};
		var wrap = document.createElement('div');
		wrap.className = 'banner-wrap';
		stage.parentNode.insertBefore(wrap, stage);
		wrap.appendChild(stage);
		var statusEl = opts.status || null, shotEl = opts.shot || null;
		function fail(message, e) {
			if (!statusEl) {
				statusEl = document.createElement('div');
				statusEl.setAttribute('role', 'status');
				wrap.appendChild(statusEl);
			}
			TDC.error(AREA, message, e, statusEl);
		}
		function unwrap() {
			if (wrap.parentNode) wrap.parentNode.insertBefore(stage, wrap);
			wrap.remove();
			stage.style.removeProperty('--banner-in-x');
			stage.style.removeProperty('--banner-in-z');
		}
		try { return init(); } catch (e) {
			fail('the table could not be drawn.', e);
			return { stop: unwrap };
		}

		function init() {
			var root = document.documentElement;

			/* ---------- table geometry (from the game), live: the banner's shape ---------- */
			// The banner (UV, 14 Nov): the table takes the banner's shape and size, its edge on
			// the line the banner had just inside its own. The balls and pockets keep their
			// size as the banner opens and closes; only the cushions move (buildTable). There
			// are no markings and no logo: the banner's own content is shown on the cloth.
			var R = 0.5;                    // ball radius
			var D2 = R * 2;                 // contact distance between two balls
			// The pockets, from a real English 7ft table (UV, 13 Nov). The mouth is the gap
			// between the cushions' noses: about 3.5in at a corner and a little wider at the
			// middle, in 2in balls 1.8 and 1.9. The cushion is cut back there into two short
			// straight jaws that lead to the hole; the hole is as wide as the mouth and lies
			// behind it, in the rail: a corner's on the corner point, a middle's just behind
			// the cushion's nose line, so it comes only MID_LIP into the bed. The hero's pockets
			// exactly (UV, 14 Nov: "keep the current pocket design"); on the banner the
			// cushions come in from the card's edge until the pockets fit inside it (tableIn).
			var CM = 1.8, MM = 1.9, MID_LIP = 0.15;
			var CA = CM / Math.SQRT2;       // how far along a rail a corner's mouth reaches
			var EDGE_PX = 4;                // CSS px a pocket's line and glow reach past its hole: kept inside the page card
			var FIT_GAP = 0;                // EDGE_PX in balls, set by fit
			var POCKET_MAX = 32;            // CSS px: the widest a pocket may be (UV, 14 Nov)
			var PIT_Y = -R - 0.75;          // a potted ball's centre, at rest in the pocket
			var GRAV = 26, STOPV = 0.22, PMIN = 5, PMAX = 48;
			var SPOT_R = 0.28;              // a spot's angular radius on the cue ball
			var BAND = 0.40;                // half the stripe's angular width
			var TRAIL_MAX = 600, TRAIL_STEP = 0.06;
			var UNDRAW = 1;                 // seconds a ball's line takes to undraw once it stops
			// A ball potted falls into the void; a new one drops from above the camera (UV,
			// 13 Nov). The camera is CAM_D above the cloth: a ball nearer it is drawn larger
			// and further from the middle of the screen, as a camera sees it.
			// The landing (UV, 13 Nov: "a bit more realistic"): gravity nearer a real one, the
			// cloth taking two thirds of each bounce's speed so the bounces die quickly, and a
			// little roll from the first one, as a dropped ball seldom lands dead.
			var CAM_D = 46, DROP_H = 40, VOID_Y = -5, FALL_G = 120, BOUNCE = 0.35, SETTLE = 3;

			// Set by buildTable from the banner: the bed's half-width (x, across the screen)
			// and half-height (z, down it), the ball-centre limits at the cushions; and by
			// fit, the card's half-width and half-height and its corners' radius (all in balls)
			var HX = 9, HZ = 18, LX = 0, LZ = 0, OX = 0, OZ = 0, CX = 9.5, CZ = 18.5, CARD_R = 1;
			var midOnX = true;              // the middle pockets on the left and right cushions, or the top and bottom
			var pockets = [], JAWS = [], BED = [];

			// Does a hole of radius r at (x, z) lie inside the card, with FIT_GAP to spare?
			function fitsCard(x, z, r) {
				var ex = CX - FIT_GAP, ez = CZ - FIT_GAP, k = Math.max(0, CARD_R - FIT_GAP);
				var ax = Math.abs(x), az = Math.abs(z);
				if (ax + r > ex || az + r > ez) return false;
				if (ax > ex - k && az > ez - k) return Math.hypot(ax - (ex - k), az - (ez - k)) + r <= k;
				return true;
			}
			// How far in from the banner's edge the cushions sit (UV, 14 Nov: "pockets will
			// force the cushion edge inside of the card"): from the edge itself (line, 0;
			// UV, 14 Nov: "less padding between card edge and the new banner border"), each
			// side only as far in as its own pockets need, so the long sides, with the middle
			// pockets, come in further than the short ones
			function tableIn(line) {
				var onX = CZ >= CX, mx = line, mz = line, rm = MM / 2;
				// The middle pockets' sides: the hole reaches MM - MID_LIP past the cushion
				while (onX ? !fitsCard(CX - mx + rm - MID_LIP, 0, rm) : !fitsCard(0, CZ - mz + rm - MID_LIP, rm)) {
					if (onX) mx += 0.02; else mz += 0.02;
					if (mx > CX || mz > CZ) break;
				}
				// The corners: a hole on the corner point
				while (!fitsCard(CX - mx, CZ - mz, CM / 2) && mx < CX && mz < CZ) { mx += 0.02; mz += 0.02; }
				return [CX - mx, CZ - mz, mx, mz];
			}

			// Each pocket: its hole (x, z, r), its mouth's centre (mx, mz), the way into the
			// table (ix, iz), its two jaws (J: the cushion's nose, T: where the jaw meets the
			// hole), the point a shot aims at and how wide an angle it takes a ball from
			function corner(sx, sz, key) {
				var ix = -sx / Math.SQRT2, iz = -sz / Math.SQRT2;
				return mkPocket(key, true, sx * HX, sz * HZ, CM / 2, ix, iz,
					[sx * (HX - CA), sz * HZ], [sx * HX, sz * (HZ - CA)]);
			}
			function middleX(sx, key) {
				var r = MM / 2;
				return mkPocket(key, false, sx * (HX + r - MID_LIP), 0, r, -sx, 0, [sx * HX, -MM / 2], [sx * HX, MM / 2]);
			}
			function middleZ(sz, key) {
				var r = MM / 2;
				return mkPocket(key, false, 0, sz * (HZ + r - MID_LIP), r, 0, -sz, [-MM / 2, sz * HZ], [MM / 2, sz * HZ]);
			}
			function mkPocket(key, isCorner, x, z, r, ix, iz, j1, j2) {
				var pk = { key: key, corner: isCorner, x: x, z: z, r: r, ix: ix, iz: iz };
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
			// Where along a rail the cushion is cut away for a mouth: the left and right
			// cushions (at z) and the top and bottom ones (at x)
			function mouthOnX(z) { return Math.abs(z) > HZ - CA || (midOnX && Math.abs(z) < MM / 2); }
			function mouthOnZ(x) { return Math.abs(x) > HX - CA || (!midOnX && Math.abs(x) < MM / 2); }

			// The bed's edge, clockwise: the cushions' noses and, at each pocket, in along one
			// jaw, round the back of the hole and out along the other
			function bedOutline() {
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
			}

			// The table at a new size. The middle pockets sit on whichever sides are longer.
			function buildTable(hx, hz) {
				HX = hx; HZ = hz; LX = HX - R; LZ = HZ - R;
				OX = CX + 1; OZ = CZ + 1;   // past the card a ball is lost
				midOnX = CZ >= CX;          // the banner's long sides, as tableIn has it
				var tl = corner(-1, -1, 'tl'), tr = corner(1, -1, 'tr'), br = corner(1, 1, 'br'), bl = corner(-1, 1, 'bl');
				// Clockwise from the top left
				pockets = midOnX ? [tl, tr, middleX(1, 'm1'), br, bl, middleX(-1, 'm2')]
					: [tl, middleZ(-1, 'm1'), tr, br, middleZ(1, 'm2'), bl];
				JAWS = [];
				pockets.forEach(function (pk) { pk.jaws.forEach(function (j) { JAWS.push(j); }); });
				BED = bedOutline();
				// A ball on its way down a pocket stays with that pocket as it moves
				if (balls) balls.forEach(function (b) {
					if (b.pk) b.pk = pockets.filter(function (pk) { return pk.key === b.pk.key; })[0] || nearestPocket(b);
				});
			}

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

			/* ---------- the canvases ---------- */
			// The table and the trails under the banner's text; the balls and their shadows
			// over it, each with a frosted circle under it (a backdrop blur, sandbox.css)
			var canvas = document.createElement('canvas');
			canvas.className = 'banner-table';
			wrap.insertBefore(canvas, stage);
			var ctx = canvas.getContext('2d');
			var top = document.createElement('canvas');
			top.className = 'banner-balls';
			wrap.appendChild(top);
			var tctx = top.getContext('2d');
			// The table changes only when the light or the banner's size changes, so it is
			// drawn on a layer of its own
			var layer = document.createElement('canvas');
			var lctx = layer.getContext('2d');
			var dpr = 1, cw = 0, ch = 0, sc = 10, cx = 0, cy = 0, layerKey = '', boxKey = '', bleed = 0, topOff = 0;

			// The banner's size, read every frame. The ball's size follows the banner's width
			// only (UV, 14 Nov), so opening and closing it never changes the balls or the
			// pockets: a real table is 18 balls across and 36 long, so the width is taken as
			// the short side on an upright screen and the long side on a wide one. No pocket
			// is ever wider than POCKET_MAX (UV, 14 Nov: 32px), and the balls are sized down
			// to match it: the widest pocket, a middle one, is MM balls across. The table's
			// edge starts at the banner's edge and comes in as far as the pockets need (tableIn).
			// Returns how far the bed's half-width and half-height grew, in balls, when only
			// the banner's size changed at the same ball size; null otherwise.
			function fit() {
				var bw = stage.clientWidth, h = stage.clientHeight;
				if (!bw || !h) return null;
				// The table reaches out into the page card's side margin (UV, 14 Nov: "let the
				// new banner edge extend into that margin space"): the canvases are wider than
				// the banner by the card's own side padding, each side
				// (measured to the page card's inside edge, the nearer side, whatever lies between)
				var card = stage.closest('.tdc-card'), bl = 0;
				if (card) {
					var cr = card.getBoundingClientRect(), sr = stage.getBoundingClientRect();
					bl = Math.max(0, Math.floor(Math.min(sr.left - cr.left, cr.right - sr.right) - card.clientLeft));
				}
				var w = bw + 2 * bl;
				var d = Math.min(window.devicePixelRatio || 1, 2);
				var upright = window.innerWidth < window.innerHeight;
				var ballPx = Math.min(bw / (upright ? 18 : 36), POCKET_MAX / MM);
				// Where the corner pockets reach out into the card's margin, they are made
				// smaller to fit in it, line and glow included, and the balls with them (UV,
				// 14 Nov): a corner's hole, CM / 2 balls past the cushion, fits in the margin
				if (bl > EDGE_PX) ballPx = Math.min(ballPx, (bl - EDGE_PX) / (CM / 2));
				var key = [bw, h, d, ballPx, bl, stage.offsetTop].join();
				if (key === boxKey) return null;
				boxKey = key;
				bleed = bl; topOff = stage.offsetTop;
				[canvas, top].forEach(function (el) {
					el.style.left = el.style.right = -bl + 'px';
					el.style.top = topOff + 'px';
					el.style.height = h + 'px';
				});
				var sameBall = ballPx * d === sc && d === dpr;
				dpr = d; sc = ballPx * d;
				cw = Math.round(w * d); ch = Math.round(h * d);
				canvas.width = layer.width = top.width = cw;
				canvas.height = layer.height = top.height = ch;
				cx = cw / 2; cy = ch / 2;
				layerKey = '';
				// The banner's own rounded card is not drawn, so the pockets may reach its corners
				CX = w / 2 / ballPx; CZ = h / 2 / ballPx; CARD_R = 0; FIT_GAP = EDGE_PX / ballPx;
				var bed = tableIn(0), hx = bed[0], hz = bed[1];
				// The content padded in as far as the cushions came in (sandbox.css). Set only
				// when it changes: it changes the banner's size, which is read again next frame.
				// (from the banner's own edge: the cushions may sit out in the card's margin)
				var padX = Math.round(bed[2] * ballPx - bl) + 'px', padZ = Math.round(bed[3] * ballPx) + 'px';
				if (stage.style.getPropertyValue('--banner-in-x') !== padX) stage.style.setProperty('--banner-in-x', padX);
				if (stage.style.getPropertyValue('--banner-in-z') !== padZ) stage.style.setProperty('--banner-in-z', padZ);
				var dX = hx - HX, dZ = hz - HZ, oldX = HX, oldZ = HZ;
				buildTable(hx, hz);
				if (!balls) return null;
				if (sameBall) {
					// The banner's top left stays where it is on the page as it opens or
					// closes: the balls keep their place on the screen, so in the table's
					// own terms (from its middle) they move with it
					balls.forEach(function (b) {
						b.x -= dX; b.z -= dZ;
						b.trail.forEach(function (p) { if (p) { p[0] -= dX; p[1] -= dZ; } });
					});
					return { dX: dX, dZ: dZ };
				}
				// A new ball size (a new screen width): everything keeps its place on the table
				balls.forEach(function (b) {
					b.x *= hx / oldX; b.z *= hz / oldZ;
					b.x = Math.max(-LX, Math.min(LX, b.x)); b.z = Math.max(-LZ, Math.min(LZ, b.z));
					b.trail = [];
				});
				return null;
			}
			// The table to the screen (device px): x right, z down
			function W(x, z) { return [cx + x * sc, cy + z * sc]; }

			// The living wall (UV, 14 Nov): a cushion that moves in pushes whatever it
			// reaches. The right and bottom cushions move (the banner's top left stays put),
			// at ux and uz balls a second outward. A ball still or slower than the cushion is
			// carried at its speed; one running into it also bounces off it.
			function pushWalls(ux, uz) {
				var keep = 1 - P.ks;
				function wall(b, axis, s, u) {
					var lim = axis === 'x' ? LX : LZ, v = axis === 'x' ? 'vx' : 'vz';
					if (b[axis] * s <= lim) return;
					b[axis] = s * lim;
					var into = b[v] * s;   // the ball's own speed towards the cushion
					var out = u - Math.max(0, into) * keep;
					if (out < into) { b[v] = s * out; b.hit = true; }
				}
				balls.forEach(function (b) {
					if (b.state !== 'play') return;
					if (!mouthOnX(b.z)) { wall(b, 'x', 1, ux); wall(b, 'x', -1, 0); }
					if (!mouthOnZ(b.x)) { wall(b, 'z', 1, uz); wall(b, 'z', -1, 0); }
					for (var j = 0; j < JAWS.length; j++) jaw(b, JAWS[j]);
				});
			}

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

			/* ---------- the table, drawn when the light or the banner's size changes ---------- */
			function drawLayer() {
				var c = lctx, L = light, B = C.blur * S.blur, lit = css(C.lit, C.litA);
				c.clearRect(0, 0, cw, ch);
				// No rail: only the bed's edge and the pockets (UV, 13 Nov). The bed is sunk,
				// as a panel is (--nm-sunken)
				insetShadow(c, bedPath, dark(), L.x, L.y, B / 2);
				insetShadow(c, bedPath, lit, -L.x, -L.y, B / 2);
				// The pockets, sunk deeper
				pockets.forEach(function (pk) { pocketShade(c, pk); });
				// No markings and no logo on the banner (UV, 14 Nov): its content is on the cloth
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
				var frost = document.createElement('div');
				frost.className = 'banner-frost';
				frost.hidden = true;
				wrap.appendChild(frost);
				return { kind: kind, name: name, body: body, feat: feat, bctx: body.getContext('2d'), fctx: feat.getContext('2d'), size: 0,
					frost: frost, x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, sx: 0, sz: 0, wy: 0, hit: false, state: 'play', pk: null, t: 0,
					q: randomQuat(), trail: [], fade: 1, still: 0 };
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
			// The table at the banner's size before the balls are placed on it
			buildTable(HX, HZ);
			fit();
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
					if (!mouthOnX(b.z)) {
						if (b.x < -LX) { b.x = -LX; cushion(b, 1, 0); } else if (b.x > LX) { b.x = LX; cushion(b, -1, 0); }
					}
					if (!mouthOnZ(b.x)) {
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
						// Its old line is left to finish undrawing (UV, 14 Nov), not wiped; a break
						// in it, so the new ball's line never joins the old one across the table
						b.trail.push(null);
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
			var shot = null, shots = 0, stillFor = 0, nextWait = 1.2, busyFor = 0, resizedAgo = 99;
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
				balls.forEach(function (b) { b.trail = []; b.fade = 1; b.still = 0; });

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
						nx = u; nz = v;
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
				var fr = b.frost;
				if (b.state === 'gone') { fr.hidden = true; return; }
				var L = light, B = C.blur * S.blur, c = tctx;
				var k = CAM_D / (CAM_D - b.y);   // nearer the camera, larger and further out
				var p0 = W(b.x, b.z), p = [cx + (p0[0] - cx) * k, cy + (p0[1] - cy) * k];
				var rp = R * sc * k;
				var under = b.y < 0;
				// Fading into the void below the pocket; appearing at once from above
				var alpha = under ? clamp01(1 - b.y / VOID_Y) : clamp01((DROP_H - b.y) / 3);
				// Frosted where it is see-through (UV, 14 Nov): a blurred circle under it, over
				// the banner's text. Not while it goes down the pocket, where the table hides it.
				if (under || alpha <= 0) fr.hidden = true;
				else {
					var dc = 2 * rp / dpr;
					fr.hidden = false;
					fr.style.width = fr.style.height = dc + 'px';
					fr.style.transform = 'translate(' + (p[0] / dpr - dc / 2 - bleed) + 'px,' + (p[1] / dpr - dc / 2 + topOff) + 'px)';   // where the canvas sits in the wrapper
					fr.style.opacity = alpha;
				}
				paintBall(b, rp);
				// Its shadow on the cloth, as a small raised button's (--nm-raised-small): the
				// higher the ball, the further off, softer and fainter
				// The ball is see-through, so its shadow is kept outside it, as a box-shadow is
				if (!under) {
					var h = b.y, off = 0.6 + h * 0.12;
					c.save();
					c.beginPath(); everything(c); circlePath(p[0], p[1], rp)(c); c.clip('evenodd');
					shadowOnly(c, p0[0], p0[1], R * sc, dark(alpha / (1 + h * 0.08)), L.x * off, L.y * off, (B / 2) * (1 + h * 0.1));
					c.restore();
				}
				c.save();
				c.globalAlpha = alpha;
				// Through the hole: the table hides whatever is not over it
				if (under && b.pk) { c.beginPath(); pocketPath(b.pk)(c); c.clip(); }
				c.drawImage(b.body, p[0] - b.size / 2, p[1] - b.size / 2);
				if (S.glow > 0) setShadow(c, css(b === cue ? C.yellowGlow : C.glow, S.glow), 0, 0, 8 * S.glow);
				c.drawImage(b.feat, p[0] - b.size / 2, p[1] - b.size / 2);
				noShadow(c);
				c.restore();
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
				ctx.save();
				// Only on the table, its pockets included (UV, 14 Nov: nothing outside the edge)
				ctx.beginPath(); bedPath(ctx); ctx.clip();
				// The balls mask the trails (UV, 13 Nov): nothing is drawn where a ball is
				ctx.beginPath(); everything(ctx);
				balls.forEach(function (b) { var o = onScreen(b); if (o) circlePath(o.x, o.y, o.r)(ctx); });
				ctx.clip('evenodd');
				ctx.lineJoin = 'round'; ctx.lineCap = 'round';
				ctx.lineWidth = 1.5 * dpr;
				// Undrawn from its tail towards the ball, on every ball (UV, 13 Nov), each from
				// the moment it stops (UV, 14 Nov)
				balls.forEach(function (b) {
					var T = b.trail, n = T.length;
					if (n < 2 || b.fade <= 0) return;
					var from = (1 - b.fade) * (n - 1), i0 = Math.floor(from), part = from - i0;
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
			var last = performance.now(), failed = false, raf = 0, seen = false;
			function run() {
				if (raf || failed || !seen) return;
				last = performance.now();
				raf = requestAnimationFrame(frame);
			}
			function frame(now) {
				raf = 0;
				if (failed || !seen) return;
				try {
					var real = Math.min((now - last) / 1000, 0.05), dt = real * S.speed;
					last = now;
					// The banner's size: as it opens or closes, the right and bottom cushions
					// move and push what they reach. No shot is planned or played until it has
					// held still a moment, as the planner plays shots on a copy of the table.
					var grew = fit();
					resizedAgo += real;
					if (grew) {
						resizedAgo = 0;
						planning = null;
						if (dt > 0) pushWalls(2 * grew.dX / dt, 2 * grew.dZ / dt);
					}
					acc = Math.min(acc + dt, 0.1);
					while (acc >= STEP) { step(STEP); acc -= STEP; }
					balls.forEach(function (b) {
						spin(b, dt);
						var going = Math.abs(b.vx) > 0.004 || Math.abs(b.vz) > 0.004;
						if ((b.state === 'play' || b.state === 'drop') && going) trailPush(b);
						// A ball's line undraws from the moment it stops (UV, 14 Nov). Set off
						// again, it keeps what is still drawn and carries on from there.
						// A potted ball has stopped once it is gone down the pocket (UV, 14 Nov:
						// every ball undraws its own line), and stays stopped as its new one drops in
						if ((b.state === 'play' && !going) || b.state === 'gone' || b.state === 'fall') b.still += dt;
						else if (b.still > 0) {
							b.trail.splice(0, Math.floor((1 - b.fade) * Math.max(0, b.trail.length - 1)));
							b.still = 0;
						}
						b.fade = clamp01(1 - b.still / UNDRAW);
					});

					// The next shot once everything has stopped, after a random pause in which
					// the trails fade out. A shot that never settles (it should not) is stopped
					// after 30 s.
					if (moving() || resizedAgo < 0.3) {
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
						if (!planning) planning = startPlanning();
						var ready = planning ? planStep(planning) : false;
						// Not before every line has undrawn: a shot wipes what is left of them
						var undrawn = balls.every(function (b) { return b.fade <= 0 || b.trail.length < 2; });
						if (stillFor > nextWait && ready && undrawn) {
							shoot(planning);
							planning = null; stillFor = 0; nextWait = 1 + Math.random() * 1.4;
						}
					}

					readLight();
					var key = [light.x, light.y, cw, ch, HX, HZ, S.linePx, S.shadow, S.blur, S.glow].join();
					if (key !== layerKey) { layerKey = key; drawLayer(); }
					ctx.clearRect(0, 0, cw, ch);
					ctx.drawImage(layer, 0, 0);
					drawTrails();
					// Over the banner's text: balls going into the void first, then those on the
					// table, then any falling (a ball gone hides its frosted circle)
					tctx.clearRect(0, 0, cw, ch);
					balls.forEach(function (b) { if (b.state === 'gone') drawBall(b); });
					['drop', 'play', 'fall'].forEach(function (st) {
						balls.filter(function (b) { return b.state === st; }).forEach(drawBall);
					});
					raf = requestAnimationFrame(frame);
				} catch (e) {
					failed = true;
					fail('the animation stopped.', e);
				}
			}

			readTokens();
			var themeWatch = new MutationObserver(function () { readTokens(); layerKey = ''; });
			themeWatch.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
			// Only while it can be seen (UV, 14 Nov: a phone at the bar): off the screen, or
			// in a part of the page that is hidden (another tab), it stops; a browser tab in
			// the background gets no frames anyway
			var seeWatch = new IntersectionObserver(function (es) {
				seen = es[es.length - 1].isIntersecting;
				if (seen) run();
				else if (raf) { cancelAnimationFrame(raf); raf = 0; }
			});
			seeWatch.observe(wrap);
			return {
				stop: function () {
					failed = true;
					if (raf) cancelAnimationFrame(raf);
					raf = 0;
					themeWatch.disconnect();
					seeWatch.disconnect();
					unwrap();
				}
			};
		}
	}

	// The page's banners: each [data-banner-table] has the table, unless less motion is on
	function lessMotion() {
		return typeof TDCPrefs !== 'undefined' ? TDCPrefs.lessMotion : matchMedia('(prefers-reduced-motion: reduce)').matches;
	}
	function byId(id) { return id ? document.getElementById(id) : null; }
	function sync() {
		var off = lessMotion();
		document.querySelectorAll('[data-banner-table]').forEach(function (el) {
			if (off && el.tdcTable) { el.tdcTable.stop(); el.tdcTable = null; }
			else if (!off && !el.tdcTable) el.tdcTable = attach(el, { status: byId(el.dataset.bannerStatus), shot: byId(el.dataset.bannerShot) });
		});
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
	else sync();
	new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
	matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', sync);

	return { attach: attach, sync: sync };
})();
