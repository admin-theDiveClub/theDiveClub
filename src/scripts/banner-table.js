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
// on the sliders on an iPad (14 Nov), retuned on /sandbox/banner/ (17 Nov): cloth speed 2,
// cloth spin 45, cushion speed
// 0.25, cushion spin 0.9, ball-ball 0.35, swerve 0.1; shadow 1, blur 1.2, no misses. Before its
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

	// The speed-ups that change the look (UV, 16 Nov: "implement all and let me decide"),
	// each off, so every page looks as it did until UV chooses; switched on
	// /sandbox/banner/ (sandbox-banner-controls.js) through quality().
	//   glow       'full': the features' glow blurred at full size; 'quarter': blurred on a
	//              picture a quarter the size and enlarged (C1)
	//   frost      'full' (3px), 'light' (1.5px) or 'off': the frosted circles (G)
	//   sharp      the most pixels per CSS pixel drawn: 2, 1.5 or 1
	//   autoSharp, autoFrost, autoPlan: once the phone is struggling (H; under about 22
	//              frames a second for 2 s, and from then on for the page's life), sharpness
	//              1.5 at most, the frost off, and shots planned 2 ms a frame, not 5 (I)
	var Q = { glow: 'full', frost: 'full', sharp: 2, autoSharp: false, autoFrost: false, autoPlan: false };
	var live = [];   // the tables on the page, told when Q changes
	function quality(changes) {
		if (changes) Object.keys(changes).forEach(function (k) { if (k in Q) Q[k] = changes[k]; });
		live.forEach(function (t) { t.qualityChanged(); });
		return Q;
	}

	/* ---------- the tunables ---------- */
	// Physics: the game's, with the cloth's grip and the swerve on sliders. Shared by every
	// table on the page; only /sandbox/banner/ changes them (tune(), sandbox-banner-controls.js,
	// UV 17 Nov), and only in memory, so a reload is back to these.
	var P = { cs: 3, cg: 20, ks: 0.5, kg: 0.4, bb: 0.1, sw: 0.1, side: 0.8, wyKeep: 0.1 };   // UV's, 23 Nov (cg 10 -> 20, kg 0.2 -> 0.4, sw 0.15 -> 0.1; the same in hero.js)
	var S = { speed: 1, linePx: 2, shadow: 1, blur: 1.2, glow: 1, miss: 0 };                     // UV's, 14 Nov
	function tune(changes) {
		if (changes) Object.keys(changes).forEach(function (k) {
			if (k in P) P[k] = changes[k];
			else if (k in S) S[k] = changes[k];
		});
		live.forEach(function (t) { t.tuned(); });
		var all = {};
		Object.keys(P).forEach(function (k) { all[k] = P[k]; });
		Object.keys(S).forEach(function (k) { all[k] = S[k]; });
		return all;
	}

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
		var statusEl = opts.status || null, shotEl = opts.shot || null, perfEl = opts.perf || null;
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
			stage.style.removeProperty('--banner-out-z');
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
			// The knuckle (UV, 16 Nov: "add in a bevel to the existing line", "only the middle
			// pockets"): where a cushion turns into a middle pocket's jaw, the corner is cut
			// off by a straight bevel reaching BEVEL back along the cushion and along the jaw,
			// half a ball (UV: "bold"). The corner pockets are as they were. Balls come off a
			// bevel as off any cushion. The mouth is still measured between the noses.
			var BEVEL = 0.5;
			var EDGE_PX = 4;                // CSS px a pocket's line and glow reach past its hole: kept inside the page card
			var FIT_GAP = 0;                // EDGE_PX in balls, set by fit
			var POCKET_MAX = 32;            // CSS px: the widest a pocket may be (UV, 14 Nov)
			var PIT_Y = -R - 0.75;          // a potted ball's centre, at rest in the pocket
			var GRAV = 26, STOPV = 0.22, PMIN = 5, PMAX = 80;   // PMAX 48 -> 120 (UV, 17 Nov: long tables and doubles fell short), 120 -> 80 (UV, 18 Nov: lower); a quarter of a ball a step at 120
			var SWERVE_FADE = 2;   // balls a second: slower than this, swerve fades with the speed
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
			// Which sides carry the middle pockets is chosen once, from the banner as the page
			// first shows it (UV, 24 Nov: "a table should never switch pockets to the longer
			// side; we want strange table sizes to be possible"): the longer sides at the first
			// measuring after the loading screen lifts, and kept for the page's life, whatever
			// the banner does afterwards. Until then (behind the screen) the longer sides. It
			// was the longer sides every frame, and a near-square banner flipped for ever:
			// the padding the pockets set (--banner-in-x, -z) reflowed the text and made the
			// other side the longer one (Basil's venue page, 24 Nov)
			var midFixed = null;
			function midSides() { return midFixed !== null ? midFixed : CZ >= CX; }
			var pockets = [], JAWS = [], BED = [], bedP = null;

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
				var onX = midSides(), mx = line, mz = line, rm = MM / 2;
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
			// hole; each with the way along its cushion away from the mouth, a), the point a
			// shot aims at and how wide an angle it takes a ball from
			function corner(sx, sz, key) {
				var ix = -sx / Math.SQRT2, iz = -sz / Math.SQRT2;
				return mkPocket(key, true, sx * HX, sz * HZ, CM / 2, ix, iz,
					[sx * (HX - CA), sz * HZ], [sx * HX, sz * (HZ - CA)], [-sx, 0], [0, -sz]);
			}
			function middleX(sx, key) {
				var r = MM / 2;
				return mkPocket(key, false, sx * (HX + r - MID_LIP), 0, r, -sx, 0, [sx * HX, -MM / 2], [sx * HX, MM / 2], [0, -1], [0, 1]);
			}
			function middleZ(sz, key) {
				var r = MM / 2;
				return mkPocket(key, false, 0, sz * (HZ + r - MID_LIP), r, 0, -sz, [-MM / 2, sz * HZ], [MM / 2, sz * HZ], [-1, 0], [1, 0]);
			}
			function mkPocket(key, isCorner, x, z, r, ix, iz, j1, j2, a1, a2) {
				var pk = { key: key, corner: isCorner, x: x, z: z, r: r, ix: ix, iz: iz };
				pk.mx = (j1[0] + j2[0]) / 2; pk.mz = (j1[1] + j2[1]) / 2;
				// A jaw runs straight back from the nose, along the pocket, to the hole; at a
				// middle pocket the bevel cuts the nose off from P on the cushion to Q on the jaw
				pk.jaws = [j1, j2].map(function (J, n) {
					var t = (x - J[0]) * -ix + (z - J[1]) * -iz, a = n ? a2 : a1;
					var j = { J: J, T: [J[0] - ix * t, J[1] - iz * t] };
					if (!isCorner) { j.P = [J[0] + a[0] * BEVEL, J[1] + a[1] * BEVEL]; j.Q = [J[0] - ix * BEVEL, J[1] - iz * BEVEL]; }
					return j;
				});
				// What a ball comes off: each jaw (from Q to the hole, past a bevel), and each bevel
				pk.segs = [];
				pk.jaws.forEach(function (j) {
					if (isCorner) pk.segs.push({ J: j.J, T: j.T });
					else pk.segs.push({ J: j.Q, T: j.T }, { J: j.P, T: j.Q });
				});
				pk.ax = pk.mx - ix * 0.3; pk.az = pk.mz - iz * 0.3;   // just inside the mouth
				pk.take = isCorner ? 40 : 35;                         // the widest angle it takes, from straight in
				return pk;
			}
			// Where along a rail the cushion is cut away for a mouth (a middle one with its
			// bevels): the left and right cushions (at z) and the top and bottom ones (at x)
			function mouthOnX(z) { return Math.abs(z) > HZ - CA || (midOnX && Math.abs(z) < MM / 2 + BEVEL); }
			function mouthOnZ(x) { return Math.abs(x) > HX - CA || (!midOnX && Math.abs(x) < MM / 2 + BEVEL); }

			// The bed's edge, clockwise: the cushions' noses and, at each pocket, in along one
			// jaw (across its bevel first at a middle pocket), round the back of the hole and
			// out the other way
			function bedOutline() {
				var pts = [];
				function ang(p, pk) { return Math.atan2(p[1] - pk.z, p[0] - pk.x); }
				pockets.forEach(function (pk) {
					var a = pk.jaws[0], b = pk.jaws[1];
					var da = Math.atan2(b.J[1], b.J[0]) - Math.atan2(a.J[1], a.J[0]);
					while (da <= -Math.PI) da += 2 * Math.PI;
					while (da > Math.PI) da -= 2 * Math.PI;
					var inJ = da > 0 ? a : b, outJ = da > 0 ? b : a;   // met first going clockwise
					if (pk.corner) pts.push(inJ.J, inJ.T); else pts.push(inJ.P, inJ.Q, inJ.T);
					// Round the back of the hole: whichever way passes away from the table
					var a0 = ang(inJ.T, pk), a1 = ang(outJ.T, pk), back = Math.atan2(-pk.iz, -pk.ix);
					var up = a1; while (up <= a0) up += 2 * Math.PI;
					var down = a1; while (down >= a0) down -= 2 * Math.PI;
					var mid = (a0 + up) / 2, end = Math.cos(mid - back) > 0 ? up : down;
					for (var i = 1; i < 16; i++) {
						var t = a0 + (end - a0) * i / 16;
						pts.push([pk.x + pk.r * Math.cos(t), pk.z + pk.r * Math.sin(t)]);
					}
					if (pk.corner) pts.push(outJ.T, outJ.J); else pts.push(outJ.T, outJ.Q, outJ.P);
				});
				return pts;
			}

			// The table at a new size. The middle pockets sit on the sides midSides chose.
			function buildTable(hx, hz) {
				HX = hx; HZ = hz; LX = HX - R; LZ = HZ - R;
				OX = CX + 1; OZ = CZ + 1;   // past the card a ball is lost
				midOnX = midSides();        // as tableIn has it
				var tl = corner(-1, -1, 'tl'), tr = corner(1, -1, 'tr'), br = corner(1, 1, 'br'), bl = corner(-1, 1, 'bl');
				// Clockwise from the top left
				pockets = midOnX ? [tl, tr, middleX(1, 'm1'), br, bl, middleX(-1, 'm2')]
					: [tl, middleZ(-1, 'm1'), tr, br, middleZ(1, 'm2'), bl];
				JAWS = [];
				pockets.forEach(function (pk) { pk.segs.forEach(function (j) { JAWS.push(j); }); });
				BED = bedOutline();
				bedP = null;   // the outline's path, built again for the new size
				// A ball on its way down a pocket stays with that pocket as it moves
				if (balls) balls.forEach(function (b) {
					if (b.pk) b.pk = pockets.filter(function (pk) { return pk.key === b.pk.key; })[0] || nearestPocket(b);
				});
			}

			// The tunables (P, S) are the script's, above: shared by every table

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
			var C = {}, tokVer = 0;   // tokVer: counts the reads, so a ball painted in old colours is painted again
			function readTokens() {
				tokVer++;
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
			// The frosted circles, in a box the balls' canvas's size that clips them (16 Nov:
			// a ball dropping in from above the camera is drawn large and far out, and its
			// circle reached past the page's edge, so the page scrolled sideways). The
			// balls' canvas cuts the ball off at the same edge, so nothing that showed is lost.
			var frosts = document.createElement('div');
			frosts.className = 'banner-frosts';
			wrap.appendChild(frosts);
			// The look-changing speed-ups (Q, above): whether this phone is struggling, from
			// a running average of the time between frames (ms), measured from 3 s after
			// the table starts; once struggling, it stays so for the page's life, so the
			// lighter drawing never flicks back and forth
			var startedAt = performance.now(), frameMs = 1000 / 60, slowFor = 0, struggling = false, frostOff = false, perfAt = 0;
			// The light (UV, 16 Nov: stutters "when the light moves and the balls are moving at
			// the same time"): every move of page-light.js's light redraws the table's blurs
			// and restyles the page. From the first stutter (a frame more than twice the usual
			// time between frames, and at least 40 ms: at 30 frames a second, a steady 30 is
			// not one) the light holds while any ball moves, for the rest of the visit, and
			// drifts on from where it was in the pauses. Site-wide, on every banner (UV).
			var usualMs = 1000 / 60, stutterSeen = false, lightHeld = false;
			function sharpNow() { return struggling && Q.autoSharp ? Math.min(Q.sharp, 1.5) : Q.sharp; }
			function frostNow() { return struggling && Q.autoFrost ? 'off' : Q.frost; }
			function planMsNow() { return struggling && Q.autoPlan ? 2 : PLAN_MS; }
			function applyFrost() {
				var f = frostNow();
				frostOff = f === 'off';
				frosts.style.setProperty('--banner-frost', f === 'light' ? '1.5px' : '3px');
			}
			applyFrost();
			// The table changes only when the light or the banner's size changes, so it is
			// drawn on a layer of its own, a canvas on the page under the trails' (16 Nov: it
			// was copied onto the trails' canvas every frame)
			var layer = document.createElement('canvas');
			layer.className = 'banner-table';
			wrap.insertBefore(layer, canvas);
			var lctx = layer.getContext('2d');
			var dpr = 1, cw = 0, ch = 0, sc = 10, cx = 0, cy = 0, layerKey = '', boxKey = '', bleed = 0, topOff = 0;
			var sizeDirty = true, sizeWatchUntil = 0;
			function sizeMayChange() { sizeDirty = true; sizeWatchUntil = performance.now() + 600; }
			var sizeWatch = new ResizeObserver(sizeMayChange);
			sizeWatch.observe(stage);
			var pageCard = stage.closest('.tdc-card');
			if (pageCard) sizeWatch.observe(pageCard);
			window.addEventListener('resize', sizeMayChange);
			['click', 'transitionrun', 'transitionend', 'animationstart', 'animationend'].forEach(function (ev) {
				stage.addEventListener(ev, sizeMayChange, true);
			});
			// The loading screen lifting: measured again, at the same size too, so the middle
			// pockets' sides are chosen now (midSides)
			function loaderChanged(e) {
				if (midFixed !== null || (e.detail && e.detail.up)) return;
				boxKey = '';
				sizeMayChange();
			}
			document.addEventListener('tdc-loader', loaderChanged);

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
			// Read only while the banner may be changing size (16 Nov: reading it every frame
			// made the browser lay the page out again every frame, after the frosted circles
			// moved): from a tap on it, a transition on it, a resize watcher's word or the
			// window's, and for a moment after each, so a banner opening or closing is still
			// read every frame and its cushions follow it in the same frame
			if (!sizeDirty && performance.now() > sizeWatchUntil) return null;
			sizeDirty = false;
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
				var d = Math.min(window.devicePixelRatio || 1, sharpNow());
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
				[layer, canvas, top, frosts].forEach(function (el) {
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
				forceDraw = true; trailsShown = false;   // the canvases were cleared
				// The banner's own rounded card is not drawn, so the pockets may reach its corners
				CX = w / 2 / ballPx; CZ = h / 2 / ballPx; CARD_R = 0; FIT_GAP = EDGE_PX / ballPx;
				// The middle pockets' sides, chosen at the first measuring with the page shown (midSides)
				if (midFixed === null && (typeof TDCLoader === 'undefined' || !TDCLoader.up)) midFixed = CZ >= CX;
				var bed = tableIn(0), hx = bed[0], hz = bed[1];
				// The content padded in as far as the cushions came in (sandbox.css). Set only
				// when it changes: it changes the banner's size, which is read again next frame.
				// (from the banner's own edge: the cushions may sit out in the card's margin)
				var padX = Math.round(bed[2] * ballPx - bl) + 'px', padZ = Math.round(bed[3] * ballPx) + 'px';
				if (stage.style.getPropertyValue('--banner-in-x') !== padX) stage.style.setProperty('--banner-in-x', padX);
				if (stage.style.getPropertyValue('--banner-in-z') !== padZ) stage.style.setProperty('--banner-in-z', padZ);
				// How far the table's lowest pocket, line and glow included, stops short of the
				// banner's foot (UV, 24 Nov: "too much space above the I'm interested button"):
				// banner-table.css takes it off the gap under the banner, so the gap is measured
				// from the table as drawn. A corner's hole sits on the corner point; a middle
				// pocket on the top and bottom cushions reaches MM - MID_LIP past it. Only the
				// banner's margin reads it, so setting it never changes the banner's size.
				var low = Math.max(hz + CM / 2, midSides() ? 0 : hz + MM - MID_LIP) + FIT_GAP;
				var padOut = Math.max(0, Math.round((CZ - low) * ballPx)) + 'px';
				if (stage.style.getPropertyValue('--banner-out-z') !== padOut) stage.style.setProperty('--banner-out-z', padOut);
				var dX = hx - HX, dZ = hz - HZ, oldX = HX, oldZ = HZ;
				buildTable(hx, hz);
				shapesDirty = true;   // where the banner's raised and sunken parts lie, read again
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
			// The same outline built once per size, for what is drawn every frame (16 Nov)
			function bedPath2D() { if (!bedP) { bedP = new Path2D(); bedPath(bedP); } return bedP; }
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
				var body = document.createElement('canvas'), feat = document.createElement('canvas'), glow = document.createElement('canvas');
				var frost = document.createElement('div');
				frost.className = 'banner-frost';
				frost.hidden = true;
				frosts.appendChild(frost);
				return { kind: kind, name: name, body: body, feat: feat, bctx: body.getContext('2d'), fctx: feat.getContext('2d'), size: 0,
					glow: glow, gctx: glow.getContext('2d'), gm: 0,
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
			/* ---------- no trail over the banner's raised and sunken parts (UV, 16 Nov) ---------- */
			// A line is drawn on the table's surface only: never over anything in the banner
			// drawn raised or sunken (a badge, a picture's well, a team's hexagon, a league's
			// shield). Found by their look, not a list (findShapes): a visible shadow on the
			// element or on its picture's layer (::after; design.css, "Pictures set into the
			// page"), or a .tdc-shaped hexagon or shield, whose clip path is read from the page
			// so the gap is the shape exactly (TDC.teamPic, TDC.leaguePic); anything else by
			// its box and corner radius. Looked for again when the banner's content changes;
			// placed again (placeShapes) when it changes or the table changes size.
			var shapeEls = [], shapeMask = null, shapesScan = true, shapesDirty = true;
			// A shadow that shows: not none, and some colour in it not fully see-through
			function shows(shadow) {
				if (!shadow || shadow === 'none') return false;
				return (shadow.match(/(rgba?|color)\([^)]*\)/g) || []).some(function (c) { return !/(,|\/)\s*0\)$/.test(c); });
			}
			function findShapes() {
				shapeEls = [];
				var all = stage.querySelectorAll('*');
				for (var i = 0; i < all.length; i++) {
					var el = all[i], inside = false;
					for (var k = 0; k < shapeEls.length; k++) if (shapeEls[k].contains(el)) { inside = true; break; }
					if (inside) continue;
					el.tdcShape = null;
					if (el.classList.contains('tdc-shaped')) {
						var m = /url\(["']?#([^"')]+)/.exec(el.style.clipPath || '');
						var clip = m && document.getElementById(m[1]), path = clip && clip.querySelector('path');
						if (path) { el.tdcShape = path.getAttribute('d'); shapeEls.push(el); continue; }
					}
					if (shows(getComputedStyle(el).boxShadow) || shows(getComputedStyle(el, '::after').boxShadow)) shapeEls.push(el);
				}
			}
			// A box with rounded corners, as a path (Path2D's own roundRect is newer than some phones)
			function roundBox(p, x, y, w, h, r) {
				r = Math.max(0, Math.min(r, w / 2, h / 2));
				p.moveTo(x + r, y);
				p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r);
				p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r);
				p.closePath();
			}
			// One path: the whole canvas with every part cut out of it (clipped to with evenodd)
			function placeShapes() {
				shapeMask = null;
				if (!shapeEls.length) return;
				var cr = canvas.getBoundingClientRect(), mask = new Path2D(), any = false;
				mask.rect(-cw, -ch, cw * 3, ch * 3);
				shapeEls.forEach(function (el) {
					var r = el.getBoundingClientRect();
					if (!r.width || !r.height) return;   // hidden (a folded detail)
					var x0 = (r.left - cr.left) * dpr, y0 = (r.top - cr.top) * dpr, w = r.width * dpr, h = r.height * dpr;
					if (el.tdcShape) {
						// The clip's path is in a 100 box, stretched over the element (tdc.js)
						mask.addPath(new Path2D(el.tdcShape), new DOMMatrix().translate(x0, y0).scale(w / 100, h / 100));
					} else {
						var rad = getComputedStyle(el).borderTopLeftRadius, rv = parseFloat(rad) || 0;
						if (/%/.test(rad)) rv = rv / 100 * Math.min(r.width, r.height);
						roundBox(mask, x0, y0, w, h, rv * dpr);
					}
					any = true;
				});
				if (any) shapeMask = mask;
			}
			// Content changes (a lineup arriving, a picture loading): look again
			var shapeWatch = new MutationObserver(function () { shapesScan = true; shapesDirty = true; });
			shapeWatch.observe(stage, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden', 'open', 'src', 'style'] });
			stage.addEventListener('load', function () { shapesScan = true; shapesDirty = true; }, true);

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
							// Fading out below SWERVE_FADE (UV, 17 Nov): a push of one strength at any
							// speed turned a slow ball on the spot, round another ball when touching it
							var px = b.vz / sp, pz = -b.vx / sp, fade = Math.min(1, sp / SWERVE_FADE);
							b.vx += P.sw * b.wy * fade * px * dt; b.vz += P.sw * b.wy * fade * pz * dt;
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

			// Every double on offer on obj (UV, 17 Nov): off one cushion into a pocket, competing
			// with the direct pots (a straight double outscores a thin cut, never an easy pot;
			// BANK_WEIGHT). The point on the cushion is a mirror's, but with the cushion taking
			// 1 - ks of the speed into it, so the ball comes off flatter: from a balls off the
			// line to a pocket b off it, the cushion is met a / (a + b / e) of the way along.
			// 4 cushions x 6 pockets of sums, no simulation; the copy of the table then checks
			// each as it does a pot. dOP is the leg after the cushion, d1 the leg to it, k the
			// share of speed kept off it (for paceFor).
			var BANK_WEIGHT = 0.7;   // 0.35 -> 0.7 (UV, 18 Nov: doubles more often, about twice)
			function doublesOn(obj, fx, fz) {
				var out = [], e = Math.max(0.05, 1 - P.ks);
				[[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (n) {
					var side = !!n[0], s = n[0] || n[1], lim = side ? LX : LZ;   // the cushion where a ball's centre meets it
					var a = lim - (side ? obj.x : obj.z) * s;
					if (a < 0.3) return;
					pockets.forEach(function (pk) {
						var b = lim - (side ? pk.ax : pk.az) * s;
						if (b < 1) return;   // a pocket on this cushion
						var f = a / (a + b / e);
						var bx = side ? lim * s : obj.x + (pk.ax - obj.x) * f;
						var bz = side ? obj.z + (pk.az - obj.z) * f : lim * s;
						var along = side ? bz : bx, mouth = side ? mouthOnX : mouthOnZ;
						if (mouth(along - 0.5) || mouth(along + 0.5)) return;   // no cushion there
						var d1 = Math.hypot(bx - obj.x, bz - obj.z), d2 = Math.hypot(pk.ax - bx, pk.az - bz);
						if (d1 < 0.5 || d2 < 0.5) return;
						var ux = (bx - obj.x) / d1, uz = (bz - obj.z) / d1, vx = (pk.ax - bx) / d2, vz = (pk.az - bz) / d2;
						if (-(vx * pk.ix + vz * pk.iz) < Math.cos(rad(pk.take))) return;
						var gx = obj.x - ux * D2, gz = obj.z - uz * D2;   // the ghost ball
						if (Math.abs(gx) > LX || Math.abs(gz) > LZ) return;
						var cx2 = gx - fx, cz2 = gz - fz, dCG = Math.hypot(cx2, cz2);
						if (dCG < 0.4) return;
						var ax = cx2 / dCG, az = cz2 / dCG, cut = ax * ux + az * uz;
						if (cut < Math.cos(rad(72))) return;
						if (!pathClear(fx, fz, gx, gz, [cue, obj])) return;
						if (!pathClear(obj.x, obj.z, bx, bz, [cue, obj])) return;
						if (!pathClear(bx, bz, pk.ax, pk.az, [cue, obj])) return;
						var into = Math.abs(side ? ux : uz), k = Math.sqrt(1 - into * into + e * e * into * into);
						var score = BANK_WEIGHT * cut * cut / (1 + 0.05 * (d1 + d2 + dCG));
						out.push({ obj: obj, pk: pk, ax: ax, az: az, cut: cut, dOP: d2, d1: d1, k: k, dCG: dCG, score: score, bank: true });
					});
				});
				return out;
			}

			// Two-cushion doubles (UV, 17 Nov: "use parallel shift"): off the two cushions that meet
			// at a corner. Each takes 1 - ks off the speed into it and the two are square to each
			// other, so each part of the speed is cut once and the ball leaves the second cushion
			// parallel to the way it came in: the parallel shift. From a ball a and b off the two
			// cushions to a pocket A and B off them, the line runs (A + e a) / (B + e b) along the
			// side for each one along the end (e = 1 is the plain double mirror); which cushion
			// comes first follows from it. Weighted below one cushion's (BANK2_WEIGHT); the copy of
			// the table checks each. d2 is the leg between the cushions, k2 the speed kept off the
			// second (for paceFor).
			var BANK2_WEIGHT = 0.5;   // 0.2 -> 0.5 (UV, 18 Nov: two-cushion doubles more often)
			function doubles2On(obj, fx, fz) {
				var out = [], e = Math.max(0.05, 1 - P.ks);
				[[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (c) {
					var sx = c[0], sz = c[1];
					var a = LX - obj.x * sx, b = LZ - obj.z * sz;   // the ball off the side and end cushions, in the corner's frame
					if (a < 0.3 || b < 0.3) return;
					pockets.forEach(function (pk) {
						var A = LX - pk.ax * sx, B = LZ - pk.az * sz;
						if (A < 1 && B < 1) return;   // the corner's own pocket
						var r = (A + e * a) / (B + e * b), n = Math.hypot(r, 1), ux = r / n, uz = 1 / n;   // towards the corner
						var p1, p2, k1, sideFirst = a < r * b;
						if (sideFirst) {
							p1 = [LX, LZ - b + uz * a / ux];
							p2 = [LX - e * ux * (b / uz - a / ux), LZ];
							k1 = Math.sqrt(uz * uz + e * e * ux * ux);
						} else {
							p1 = [LX - a + ux * b / uz, LZ];
							p2 = [LX, LZ - e * uz * (a / ux - b / uz)];
							k1 = Math.sqrt(ux * ux + e * e * uz * uz);
						}
						if (p2[0] < -LX || p2[1] < -LZ) return;   // across the table before the second cushion
						var b1x = p1[0] * sx, b1z = p1[1] * sz, b2x = p2[0] * sx, b2z = p2[1] * sz;   // back to the table's frame
						// No cushion where a pocket's mouth is: the first on the side, then the end, or the other way
						if (sideFirst ? (mouthOnX(b1z - 0.5) || mouthOnX(b1z + 0.5) || mouthOnZ(b2x - 0.5) || mouthOnZ(b2x + 0.5))
							: (mouthOnZ(b1x - 0.5) || mouthOnZ(b1x + 0.5) || mouthOnX(b2z - 0.5) || mouthOnX(b2z + 0.5))) return;
						var d1 = Math.hypot(b1x - obj.x, b1z - obj.z), d2 = Math.hypot(b2x - b1x, b2z - b1z), d3 = Math.hypot(pk.ax - b2x, pk.az - b2z);
						if (d1 < 0.5 || d2 < 0.5 || d3 < 0.5) return;
						var wx = ux * sx, wz = uz * sz;   // the first leg's way, in the table's frame
						var vx = (pk.ax - b2x) / d3, vz = (pk.az - b2z) / d3;
						if (vx * wx + vz * wz > -0.98) return;   // the pocket is not on the parallel line back
						if (-(vx * pk.ix + vz * pk.iz) < Math.cos(rad(pk.take))) return;
						var gx = obj.x - wx * D2, gz = obj.z - wz * D2;   // the ghost ball
						if (Math.abs(gx) > LX || Math.abs(gz) > LZ) return;
						var cx2 = gx - fx, cz2 = gz - fz, dCG = Math.hypot(cx2, cz2);
						if (dCG < 0.4) return;
						var ax = cx2 / dCG, az = cz2 / dCG, cut = ax * wx + az * wz;
						if (cut < Math.cos(rad(72))) return;
						if (!pathClear(fx, fz, gx, gz, [cue, obj])) return;
						if (!pathClear(obj.x, obj.z, b1x, b1z, [cue, obj])) return;
						if (!pathClear(b1x, b1z, b2x, b2z, [cue, obj])) return;
						if (!pathClear(b2x, b2z, pk.ax, pk.az, [cue, obj])) return;
						var score = BANK2_WEIGHT * cut * cut / (1 + 0.05 * (d1 + d2 + d3 + dCG));
						out.push({ obj: obj, pk: pk, ax: ax, az: az, cut: cut, dOP: d3, d2: d2, k2: e / k1, d1: d1, k: k1, dCG: dCG, score: score, bank: true, rails: 2 });
					});
				});
				return out;
			}

			// Kicks (UV, 18 Nov): when a ball is in the cue ball's way to the target, the cue ball
			// goes off one or two cushions to it. routesTo gives the cue ball's ways from (fx, fz)
			// to a point (gx, gz) by the doubles' own geometry: one cushion met a / (a + b / e) of
			// the way along, two cushions at a corner by parallel shift. Every leg clear of the
			// balls; only the last may end against obj. legs are the lengths, keeps the share of
			// speed each cushion leaves (for paceFor), (vx, vz) the way the cue ball arrives.
			var KICK_WEIGHT = 0.5, KICK2_WEIGHT = 0.35;
			function routesTo(fx, fz, gx, gz, obj) {
				var out = [], e = Math.max(0.05, 1 - P.ks);
				function route(pts, keeps) {
					var legs = [], len = 0, n = pts.length;
					for (var i = 0; i + 1 < n; i++) {
						var d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
						if (d < 0.5) return;
						if (!pathClear(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], i + 2 === n ? [cue, obj] : [cue])) return;
						legs.push(d); len += d;
					}
					out.push({ ax: (pts[1][0] - pts[0][0]) / legs[0], az: (pts[1][1] - pts[0][1]) / legs[0],
						vx: (pts[n - 1][0] - pts[n - 2][0]) / legs[n - 2], vz: (pts[n - 1][1] - pts[n - 2][1]) / legs[n - 2],
						legs: legs, keeps: keeps, len: len, rails: n - 2 });
				}
				// One cushion
				[[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (nn) {
					var side = !!nn[0], s = nn[0] || nn[1], lim = side ? LX : LZ;
					var a = lim - (side ? fx : fz) * s, b = lim - (side ? gx : gz) * s;
					if (a < 0.3 || b < 0.3) return;
					var f = a / (a + b / e);
					var bx = side ? lim * s : fx + (gx - fx) * f, bz = side ? fz + (gz - fz) * f : lim * s;
					var along = side ? bz : bx, mouth = side ? mouthOnX : mouthOnZ;
					if (mouth(along - 0.5) || mouth(along + 0.5)) return;   // no cushion there
					var d1 = Math.hypot(bx - fx, bz - fz) || 1, into = Math.abs(side ? (bx - fx) / d1 : (bz - fz) / d1);
					route([[fx, fz], [bx, bz], [gx, gz]], [Math.sqrt(1 - into * into + e * e * into * into)]);
				});
				// Two cushions meeting at a corner (as doubles2On)
				[[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (c) {
					var sx = c[0], sz = c[1];
					var a = LX - fx * sx, b = LZ - fz * sz, A = LX - gx * sx, B = LZ - gz * sz;
					if (a < 0.3 || b < 0.3 || A < 0.3 || B < 0.3) return;
					var r = (A + e * a) / (B + e * b), n = Math.hypot(r, 1), ux = r / n, uz = 1 / n;   // towards the corner
					var p1, p2, k1, sideFirst = a < r * b;
					if (sideFirst) {
						p1 = [LX, LZ - b + uz * a / ux];
						p2 = [LX - e * ux * (b / uz - a / ux), LZ];
						k1 = Math.sqrt(uz * uz + e * e * ux * ux);
					} else {
						p1 = [LX - a + ux * b / uz, LZ];
						p2 = [LX, LZ - e * uz * (a / ux - b / uz)];
						k1 = Math.sqrt(ux * ux + e * e * uz * uz);
					}
					if (p2[0] < -LX || p2[1] < -LZ) return;   // across the table before the second cushion
					var b1x = p1[0] * sx, b1z = p1[1] * sz, b2x = p2[0] * sx, b2z = p2[1] * sz;
					if (sideFirst ? (mouthOnX(b1z - 0.5) || mouthOnX(b1z + 0.5) || mouthOnZ(b2x - 0.5) || mouthOnZ(b2x + 0.5))
						: (mouthOnZ(b1x - 0.5) || mouthOnZ(b1x + 0.5) || mouthOnX(b2z - 0.5) || mouthOnX(b2z + 0.5))) return;
					var d3 = Math.hypot(gx - b2x, gz - b2z) || 1;
					if (((gx - b2x) * ux * sx + (gz - b2z) * uz * sz) / d3 > -0.98) return;   // the point is not on the parallel line back
					route([[fx, fz], [b1x, b1z], [b2x, b2z], [gx, gz]], [k1, e / k1]);
				});
				return out;
			}
			// Kicks that pot obj: the cue ball off the cushions onto the ghost ball, arriving at a
			// cut it can make. Offered only when obj is blocked (startPlanning)
			function kicksOn(obj, fx, fz) {
				var out = [];
				pockets.forEach(function (pk) {
					var px = pk.ax - obj.x, pz = pk.az - obj.z, dOP = Math.hypot(px, pz);
					if (dOP < 0.5) return;
					var ux = px / dOP, uz = pz / dOP;
					if (-(ux * pk.ix + uz * pk.iz) < Math.cos(rad(pk.take))) return;
					var gx = obj.x - ux * D2, gz = obj.z - uz * D2;   // the ghost ball
					if (Math.abs(gx) > LX || Math.abs(gz) > LZ) return;
					if (!pathClear(obj.x, obj.z, pk.ax, pk.az, [cue, obj])) return;
					routesTo(fx, fz, gx, gz, obj).forEach(function (rt) {
						var cut = rt.vx * ux + rt.vz * uz;
						if (cut < Math.cos(rad(72))) return;
						var score = (rt.rails === 2 ? KICK2_WEIGHT : KICK_WEIGHT) * cut * cut / (1 + 0.05 * (dOP + rt.len));
						out.push({ obj: obj, pk: pk, ax: rt.ax, az: rt.az, cut: cut, dOP: dOP, dCG: rt.legs[rt.legs.length - 1], kick: rt, score: score });
					});
				});
				return out;
			}
			// No pot on and obj blocked: a kick that simply reaches it, full on, instead of a
			// thin hit straight through the ball in the way. One cushion preferred, shorter preferred
			function kickToHit(obj) {
				var rts = routesTo(cue.x, cue.z, obj.x, obj.z, obj);
				if (!rts.length) return null;
				var rt = pick(rts, function (o) { return (o.rails === 2 ? 0.5 : 1) / (1 + 0.05 * o.len); });
				return { obj: obj, pk: null, ax: rt.ax, az: rt.az, cut: 0.5, dOP: 8, dCG: rt.legs[rt.legs.length - 1], kick: rt };
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
				var need = arrive * arrive + 2 * P.cs * (plan.dOP + 0.8);   // on into the hole
				if (plan.rails === 2) need = need / (plan.k2 * plan.k2) + 2 * P.cs * plan.d2;   // two cushions: the second's loss, then the leg between
				if (plan.bank) need = need / (plan.k * plan.k) + 2 * P.cs * plan.d1;   // a double: what the cushion takes, then the way to it
				var v0 = 7 / 5 * Math.sqrt(need);
				var vc = v0 / (Math.max(0.25, plan.cut) * (1 - P.bb));
				if (plan.kick) {   // a kick: back along the cue ball's legs, through each cushion's loss
					var cn = vc * vc, L = plan.kick.legs, K = plan.kick.keeps;
					for (var i = L.length - 1; i >= 0; i--) { cn += 2 * P.cs * L[i]; if (i > 0) cn /= K[i - 1] * K[i - 1]; }
					return Math.sqrt(cn);
				}
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
				return { plan: plan, tipY: Math.random() * 1.6 - 0.8, tipX: !plan.kick && Math.random() < 0.4 ? Math.random() - 0.5 : 0, arrive: 1 + Math.random() * 8 };   // no side on a kick: it would throw the cue ball off its cushions
			}
			function startPlanning() {
				if (!target || target.state !== 'play') {
					var on = objs.filter(function (o) { return o.state === 'play'; });
					if (!on.length) return null;
					target = on[0];
				}
				var other = objs.filter(function (o) { return o !== target; })[0] || null;
				var next = other && other.state === 'play' ? nextLine(other) : null;
				var blocked = !pathClear(cue.x, cue.z, target.x, target.z, [cue, target]);   // a ball in the cue ball's straight way to the target (UV, 18 Nov)
				var all = potsOn(target, cue.x, cue.z).concat(doublesOn(target, cue.x, cue.z), doubles2On(target, cue.x, cue.z),
					blocked ? kicksOn(target, cue.x, cue.z) : []);   // pots, doubles and, when blocked, kicks together (UV, 17 and 18 Nov)
				var options = all.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, 3);
				var queue = [];
				for (var i = 0; options.length && i < PLAN_WIDE; i++) queue.push(randomTry(options[i % options.length]));
				return { target: target, other: other, next: next, options: options, queue: queue, tried: [], round: 0, all: all, blocked: blocked };
			}
			function planStep(pl) {
				var t0 = performance.now();
				while (pl.queue.length && performance.now() - t0 < planMsNow()) {
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
				} else if (pl.blocked && (plan = kickToHit(pl.target))) {
					// No pot on and a ball in the way: kick off the cushions onto the target (UV, 18 Nov)
					power = paceFor(plan, 3);
					tipY = (Math.random() * 2 - 1) * 0.5; tipX = 0;
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
				if (plan.kick) words += 'a ' + (plan.kick.rails === 2 ? 'two' : 'one') + '-cushion kick ' + (plan.pk ? 'on ' + plan.obj.name + ' to a ' + (plan.pk.corner ? 'corner' : 'middle pocket') + (miss ? ', meant to miss' : '') : 'to hit ' + plan.obj.name + ', a ball in the way');
				else if (plan.bank) words += 'a ' + (plan.rails === 2 ? 'two-cushion ' : '') + 'double on ' + plan.obj.name + ' to a ' + (plan.pk.corner ? 'corner' : 'middle pocket') + (miss ? ', meant to miss' : '');
				else if (plan.pk) words += 'a ' + Math.round(Math.acos(Math.min(1, plan.cut)) * 180 / Math.PI) + '° cut on ' + plan.obj.name + ' to a ' + (plan.pk.corner ? 'corner' : 'middle pocket') + (miss ? ', meant to miss' : '');
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
			// stripe), which are drawn with a glow of their own. Painted again only when the
			// ball has turned or changed size or colour (16 Nov: a ball at rest was painted
			// pixel by pixel every frame)
			function paintBall(b, rp) {
				var size = Math.ceil(rp * 2) + 4;
				var same = b.size === size && b.prp === rp && b.pv === tokVer && b.pg === S.glow && b.pd === dpr;
				if (same && b.pq === b.q && b.pgq === Q.glow) return;
				var fd, half = size / 2, px, n = size * size;
				if (!same) {
					if (b.size !== size) {
						b.body.width = b.body.height = b.feat.width = b.feat.height = size;
						b.size = size;
						b.bodyData = b.bctx.createImageData(size, size);
						b.featData = b.fctx.createImageData(size, size);
						b.gU = new Float64Array(n); b.gV = new Float64Array(n); b.gNz = new Float64Array(n);
						b.gCov = new Float64Array(n); b.gEw = new Float64Array(n);
					}
					// Where each pixel lies on the sphere, and the body, which looks the same
					// however the ball has turned: worked out once per size and colour, not
					// every frame (16 Nov)
					var bd = b.bodyData.data, rimK = 0.6 * S.glow * C.glow[3], gl = C.glow;
					for (var j0 = 0; j0 < size; j0++) {
						var v0 = (j0 + 0.5 - half) / rp;
						for (var i0 = 0; i0 < size; i0++) {
							var u0 = (i0 + 0.5 - half) / rp, o0 = (j0 * size + i0) * 4;
							px = j0 * size + i0;
							var d2 = u0 * u0 + v0 * v0, cov0 = clamp01((1 - Math.sqrt(d2)) * rp + 0.5);
							b.gCov[px] = cov0;
							if (cov0 <= 0) { bd[o0 + 3] = 0; continue; }
							var nzA = Math.sqrt(Math.max(0, 1 - d2));   // towards the camera
							b.gU[px] = u0; b.gV[px] = v0; b.gNz[px] = nzA;
							b.gEw[px] = 1 / (rp * Math.max(nzA, 0.2));     // a pixel, as an angle on the ball
							var rim = rimK * Math.pow(1 - nzA, 2);
							bd[o0] = gl[0]; bd[o0 + 1] = gl[1]; bd[o0 + 2] = gl[2];
							bd[o0 + 3] = 255 * cov0 * rim;
						}
					}
					b.bctx.putImageData(b.bodyData, 0, 0);
				}
				fd = b.featData.data;
				// The world to the ball's own frame: the rotation of its conjugate
				var x = -b.q[0], y = -b.q[1], z = -b.q[2], w = b.q[3];
				var m00 = 1 - 2 * (y * y + z * z), m01 = 2 * (x * y - z * w), m02 = 2 * (x * z + y * w);
				var m10 = 2 * (x * y + z * w), m11 = 1 - 2 * (x * x + z * z), m12 = 2 * (y * z - x * w);
				var m20 = 2 * (x * z - y * w), m21 = 2 * (y * z + x * w), m22 = 1 - 2 * (x * x + y * y);
				var fc = b.kind === 'spots' ? C.yellow : C.teal;
				for (var j = 0; j < size; j++) {
					for (var i = 0; i < size; i++) {
						var o = (j * size + i) * 4;
						px = j * size + i;
						var cov = b.gCov[px];
						if (cov <= 0) { fd[o + 3] = 0; continue; }
						var u = b.gU[px], v = b.gV[px], nz0 = b.gNz[px], ew = b.gEw[px];
						// The surface's normal on the table: up is +y
						var nx, ny = nz0, nz;
						nx = u; nz = v;
						var bx = m00 * nx + m01 * ny + m02 * nz;
						var by = m10 * nx + m11 * ny + m12 * nz;
						var bz = m20 * nx + m21 * ny + m22 * nz;
						var f;
						if (b.kind === 'spots') {
							// The nearest of the six spots: only one axis can be 0.85 or more
							// (16 Nov: was a new list of all six for every pixel)
							f = 0;
							var axis = Math.max(Math.abs(bx), Math.abs(by), Math.abs(bz));
							if (axis >= 0.85) f = clamp01((SPOT_R - Math.acos(Math.min(1, axis))) / ew + 0.5);
						} else {
							var lat = Math.asin(Math.max(-1, Math.min(1, by)));
							f = clamp01((BAND - Math.abs(lat)) / ew + 0.5);
							if (b.kind === 'solid') f = 1 - f;
						}
						fd[o] = fc[0]; fd[o + 1] = fc[1]; fd[o + 2] = fc[2];
						fd[o + 3] = 255 * cov * f;
					}
				}
				b.fctx.putImageData(b.featData, 0, 0);
				b.pq = b.q; b.prp = rp; b.pv = tokVer; b.pg = S.glow; b.pd = dpr;
				// The features with their glow, in a picture of their own, made once per
				// painting rather than blurred onto the table every frame (16 Nov). A
				// blur reaches 1.5 times its size, so the picture has that much room round it.
				var gb = 8 * S.glow * dpr, m = Math.ceil(gb * 1.5) + 2, gs = size + 2 * m, g = b.gctx;
				if (b.glow.width !== gs) b.glow.width = b.glow.height = gs; else g.clearRect(0, 0, gs, gs);
				b.gm = m; b.pgq = Q.glow;
				if (S.glow > 0 && Q.glow === 'quarter') {
					// C1 (Q.glow): the glow alone blurred on a picture a quarter the size,
					// enlarged under the crisp features. The shape is drawn off that picture and
					// its shadow thrown back onto it, so only the glow lands there.
					var k = 4, ls = Math.ceil(gs / k);
					if (!b.low) { b.low = document.createElement('canvas'); b.lctx = b.low.getContext('2d'); }
					if (b.low.width !== ls) b.low.width = b.low.height = ls; else b.lctx.clearRect(0, 0, ls, ls);
					var lc = b.lctx;
					lc.shadowColor = css(b === cue ? C.yellowGlow : C.glow, S.glow);
					lc.shadowBlur = gb / k; lc.shadowOffsetX = 4 * ls; lc.shadowOffsetY = 0;
					lc.drawImage(b.feat, m / k - 4 * ls, m / k, size / k, size / k);
					g.drawImage(b.low, 0, 0, ls * k, ls * k);
					g.drawImage(b.feat, m, m);
					return;
				}
				if (S.glow > 0) setShadow(g, css(b === cue ? C.yellowGlow : C.glow, S.glow), 0, 0, 8 * S.glow);
				g.drawImage(b.feat, m, m);
				noShadow(g);
			}

			// A ball's shadow on the cloth as a picture, blurred once for its size and the
			// page's blur and drawn at the shadow's strength (16 Nov: it was blurred afresh
			// for every ball on every frame). Black at full strength; drawImage's
			// globalAlpha gives the strength, as the shadow colour's alpha did.
			var shC = document.createElement('canvas'), shR = -1, shB = -1;
			function shadowSprite() {
				var r = R * sc, bl = (C.blur * S.blur / 2) * dpr;
				if (r === shR && bl === shB) return shC;
				shR = r; shB = bl;
				var m = Math.ceil(bl * 1.5) + 2, s = 2 * (Math.ceil(r) + m), g;
				shC.width = shC.height = s;
				g = shC.getContext('2d');
				g.shadowColor = '#000'; g.shadowBlur = bl; g.shadowOffsetX = 4 * s; g.shadowOffsetY = 0;
				g.beginPath(); g.arc(s / 2 - 4 * s, s / 2, r, 0, Math.PI * 2); g.fillStyle = '#000'; g.fill();
				return shC;
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
				if (b.state === 'gone') { if (!fr.hidden) fr.hidden = true; return; }
				var L = light, B = C.blur * S.blur, c = tctx;
				var k = CAM_D / (CAM_D - b.y);   // nearer the camera, larger and further out
				var p0 = W(b.x, b.z), p = [cx + (p0[0] - cx) * k, cy + (p0[1] - cy) * k];
				var rp = R * sc * k;
				var under = b.y < 0;
				// Fading into the void below the pocket; appearing at once from above
				var alpha = under ? clamp01(1 - b.y / VOID_Y) : clamp01((DROP_H - b.y) / 3);
				// Frosted where it is see-through (UV, 14 Nov): a blurred circle under it, over
				// the banner's text. Not while it goes down the pocket, where the table hides it.
				// (each style written only when it changes, 16 Nov)
				var hide = under || alpha <= 0 || frostOff;
				if (fr.hidden !== hide) fr.hidden = hide;
				if (!hide) {
					var dc = 2 * rp / dpr;
					if (fr.tdcD !== dc) { fr.tdcD = dc; fr.style.width = fr.style.height = dc + 'px'; }
					var tf = 'translate(' + (p[0] / dpr - dc / 2) + 'px,' + (p[1] / dpr - dc / 2) + 'px)';   // in the frosts' box, which lies over the canvas
					if (fr.tdcT !== tf) { fr.tdcT = tf; fr.style.transform = tf; }
					if (fr.tdcA !== alpha) { fr.tdcA = alpha; fr.style.opacity = alpha; }
				}
				paintBall(b, rp);
				// Its shadow on the cloth, as a small raised button's (--nm-raised-small): the
				// higher the ball, the further off, softer and fainter
				// The ball is see-through, so its shadow is kept outside it, as a box-shadow is
				if (!under) {
					var h = b.y, off = 0.6 + h * 0.12;
					c.save();
					c.beginPath(); everything(c); circlePath(p[0], p[1], rp)(c); c.clip('evenodd');
					if (h === 0) {
						// On the cloth: the ready-made shadow (shadowSprite)
						var spr = shadowSprite();
						c.globalAlpha = clamp01(C.darkA * S.shadow * alpha);
						c.drawImage(spr, p0[0] + L.x * off * dpr - spr.width / 2, p0[1] + L.y * off * dpr - spr.height / 2);
					} else shadowOnly(c, p0[0], p0[1], R * sc, dark(alpha / (1 + h * 0.08)), L.x * off, L.y * off, (B / 2) * (1 + h * 0.1));
					c.restore();
				}
				c.save();
				c.globalAlpha = alpha;
				// Through the hole: the table hides whatever is not over it
				if (under && b.pk) { c.beginPath(); pocketPath(b.pk)(c); c.clip(); }
				c.drawImage(b.body, p[0] - b.size / 2, p[1] - b.size / 2);
				c.drawImage(b.glow, p[0] - b.size / 2 - b.gm, p[1] - b.size / 2 - b.gm);
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
				ctx.clip(bedPath2D());
				// Nor over the banner's raised and sunken parts (UV, 16 Nov; placeShapes)
				if (shapeMask) ctx.clip(shapeMask, 'evenodd');
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
			var LIGHT_MS = 200, layerLight = '', layerAt = -1e9, trailsShown = false;
			var DRAW_ORDER = ['gone', 'drop', 'play', 'fall'];
			// What the balls' canvas shows, as numbers: drawn again only when one differs.
			// forceDraw: the canvas was cleared by a new size (fit).
			var sigNow = [], sigWas = [], forceDraw = true;
			function ballsChanged() {
				var s = sigNow, n = 0;
				s[n++] = light.x; s[n++] = light.y; s[n++] = tokVer; s[n++] = S.glow; s[n++] = S.shadow; s[n++] = S.blur;
				s[n++] = sc; s[n++] = cx; s[n++] = cy; s[n++] = dpr; s[n++] = bleed; s[n++] = topOff;
				for (var i = 0; i < balls.length; i++) {
					var b = balls[i];
					s[n++] = DRAW_ORDER.indexOf(b.state); s[n++] = b.x; s[n++] = b.z; s[n++] = b.y;
					s[n++] = b.q[0]; s[n++] = b.q[1]; s[n++] = b.q[2]; s[n++] = b.q[3];
				}
				s.length = n;
				var changed = forceDraw || n !== sigWas.length;
				for (var k = 0; !changed && k < n; k++) if (s[k] !== sigWas[k]) changed = true;
				sigNow = sigWas; sigWas = s; forceDraw = false;
				return changed;
			}
			// Plays only while seen and while the app is in front with focus (UV, 16 Nov)
			var awake = function () { return typeof TDCPrefs === 'undefined' || TDCPrefs.awake; };
			function run() {
				if (raf || failed || !seen || !awake()) return;
				last = performance.now();
				raf = requestAnimationFrame(frame);
			}
			function pause() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
			function frame(now) {
				raf = 0;
				if (failed || !seen || !awake()) return;
				try {
					var raw = now - last, real = Math.min(raw / 1000, 0.05), dt = real * S.speed;
					last = now;
					// Struggling (Q): the time between frames, averaged, over 45 ms for 2 s
					if (now - startedAt > 3000) {
						frameMs = frameMs * 0.92 + Math.min(raw, 250) * 0.08;
						if (!struggling) {
							slowFor = frameMs > 45 ? slowFor + raw / 1000 : 0;
							if (slowFor > 2) { struggling = true; qualityChanged(); }
						}
					}
					// The light (above). A gap over a second is the page coming back from the
					// background, not a stutter.
					var rolling = moving();
					if (now - startedAt > 3000 && raw < 1000) {
						if (!stutterSeen && rolling && raw > Math.max(40, 2 * usualMs)) stutterSeen = true;
						if (raw <= 2 * usualMs) usualMs = usualMs * 0.95 + raw * 0.05;
					}
					lightHeld = stutterSeen && rolling;
					if (lightHeld) window.TDCLightHeldUntil = Math.max(window.TDCLightHeldUntil || 0, performance.now() + 250);
					if (perfEl && now - perfAt > 500) {
						perfAt = now;
						perfEl.textContent = Math.round(1000 / frameMs) + ' frames a second' + (struggling ? ' · struggling' : '') +
							(lightHeld ? ' · light held' : stutterSeen ? ' · stutter seen' : '');
					}
					// The banner's size: as it opens or closes, the right and bottom cushions
					// move and push what they reach. No shot is planned or played until it has
					// held still a moment, as the planner plays shots on a copy of the table.
					var grew = fit();
					if (shapesScan) { shapesScan = false; findShapes(); }
					if (shapesDirty) { shapesDirty = false; placeShapes(); trailsShown = true; }   // the trails drawn again round them
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
					// The table: at once for a new size or look; for the light alone at most
					// every LIGHT_MS (16 Nov: its blurs were drawn again for every half pixel
					// the drifting light moved)
					var key = [cw, ch, HX, HZ, S.linePx, S.shadow, S.blur, S.glow].join(), lk = light.x + ',' + light.y;
					if (key !== layerKey || (lk !== layerLight && now - layerAt >= LIGHT_MS)) {
						layerKey = key; layerLight = lk; layerAt = now;
						drawLayer();
					}
					// The trails, only while there are any (16 Nov)
					var anyTrail = false;
					for (var ti = 0; ti < balls.length; ti++) if (balls[ti].fade > 0 && balls[ti].trail.length >= 2) anyTrail = true;
					if (anyTrail || trailsShown) {
						ctx.clearRect(0, 0, cw, ch);
						if (anyTrail) drawTrails();
						trailsShown = anyTrail;
					}
					// Over the banner's text: balls going into the void first, then those on the
					// table, then any falling (a ball gone hides its frosted circle). Only when
					// something about them has changed (16 Nov: at rest they were drawn afresh
					// every frame).
					if (ballsChanged()) {
						tctx.clearRect(0, 0, cw, ch);
						for (var si = 0; si < DRAW_ORDER.length; si++) {
							for (var bi = 0; bi < balls.length; bi++) if (balls[bi].state === DRAW_ORDER[si]) drawBall(balls[bi]);
						}
					}
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
			// in a part of the page that is hidden (another tab), it stops; and while the
			// app is in the background or its window has lost focus (UV, 16 Nov)
			var seeWatch = new IntersectionObserver(function (es) {
				seen = es[es.length - 1].isIntersecting;
				if (seen) run();
				else pause();
			});
			seeWatch.observe(wrap);
			function awakeChanged(on) { if (on) run(); else pause(); }
			// A switch on the sandbox changed (quality), or this phone began to struggle
			function qualityChanged() { applyFrost(); sizeMayChange(); forceDraw = true; }
			var me = {
				qualityChanged: qualityChanged,
				tuned: function () { forceDraw = true; },   // a slider on the sandbox moved
				awakeChanged: awakeChanged,
				stop: function () {
					live.splice(live.indexOf(me), 1);
					failed = true;
					if (raf) cancelAnimationFrame(raf);
					raf = 0;
					themeWatch.disconnect();
					seeWatch.disconnect();
					sizeWatch.disconnect();
					shapeWatch.disconnect();
					window.removeEventListener('resize', sizeMayChange);
					document.removeEventListener('tdc-loader', loaderChanged);
					unwrap();
				}
			};
			live.push(me);
			return me;
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
			else if (!off && !el.tdcTable) el.tdcTable = attach(el, { status: byId(el.dataset.bannerStatus), shot: byId(el.dataset.bannerShot), perf: byId(el.dataset.bannerPerf) });
		});
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
	else sync();
	// The app sent to the background or out of focus, and back (prefs.js; UV, 16 Nov)
	if (typeof TDCPrefs !== 'undefined') TDCPrefs.onAwake(function (on) { live.forEach(function (t) { t.awakeChanged(on); }); });
	new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
	matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', sync);

	return { attach: attach, sync: sync, quality: quality, tune: tune };
})();
