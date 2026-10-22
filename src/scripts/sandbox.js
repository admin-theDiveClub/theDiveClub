/* UI sandbox (/sandbox/). A scratch page: no data layer, no sign-in.
   Reads the live tokens, previews artwork, and adjusts the labelled parts of
   the logo. Nothing else. */
(function () {
	'use strict';

	var STORE_KEY = 'tdc.sandbox.theme';
	var INKSCAPE_NS = 'http://www.inkscape.org/namespaces/inkscape';
	var XLINK_NS = 'http://www.w3.org/1999/xlink';
	var root = document.documentElement;

	/* ── Errors are shown, never swallowed ─────────────────────────── */
	function fail(message, err, targetId) {
		console.error('[Sandbox] ' + message, err || '');
		var el = document.getElementById(targetId || 'sb-status');
		if (el) {
			el.textContent = 'TDC (Error): ' + message;
			el.className = 'status error';
		}
	}
	function clearFail(targetId) {
		var el = document.getElementById(targetId || 'sb-status');
		if (el) { el.textContent = ''; el.className = 'status'; }
	}

	/* ── Theme ─────────────────────────────────────────────────────── */
	function setTheme(name, remember) {
		root.setAttribute('data-theme', name === 'light' ? 'light' : '');
		if (remember) {
			try { localStorage.setItem(STORE_KEY, name); } catch (e) { /* storage can be blocked; the theme still applies */ }
		}
		document.querySelectorAll('[data-theme-set]').forEach(function (b) {
			b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-set') === name));
		});
		renderPalette();
	}
	function savedTheme() {
		try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
	}

	/* ── Reading tokens ────────────────────────────────────────────── */
	var COLOURS = [
		['Brand',       ['--color-primary', '--color-on-primary', '--color-cream', '--color-ink']],
		['Backgrounds', ['--bg-base', '--bg-surface']],
		['Text',        ['--text-primary', '--text-muted']],
		['Borders',     ['--border-color']],
		['States',      ['--color-success', '--color-warning', '--color-error', '--color-owner']],
		['Depth',       ['--alpha-1', '--alpha-2', '--alpha-3', '--alpha-4', '--hover-wash']]
	];
	var TRANSLUCENT = ['--bg-surface', '--alpha-1', '--alpha-2', '--alpha-3', '--alpha-4', '--hover-wash'];

	function tokenValue(name) {
		return getComputedStyle(root).getPropertyValue(name).trim();
	}

	var probe = document.createElement('span');
	probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
	document.body.appendChild(probe);

	/* Resolve any token to [r, g, b, a] by letting the browser compute it. */
	function colourOf(name) {
		if (!tokenValue(name)) throw new Error('The token ' + name + ' has no value');
		probe.style.color = '';
		probe.style.color = 'var(' + name + ')';
		var computed = getComputedStyle(probe).color;
		var n = (computed.match(/[\d.]+(?:e-?\d+)?/g) || []).map(Number);
		if (n.length < 3) throw new Error('Could not read ' + name + ' as a colour (' + computed + ')');
		if (/^color\(/.test(computed)) n = n.slice(0, 3).map(function (v) { return v * 255; }).concat(n.slice(3));
		return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
	}
	function over(fg, bg) {
		var a = fg[3];
		return [0, 1, 2].map(function (i) { return fg[i] * a + bg[i] * (1 - a); }).concat([1]);
	}
	function luminance(c) {
		var l = c.slice(0, 3).map(function (v) {
			v = v / 255;
			return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
		});
		return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
	}
	function ratio(a, b) {
		var la = luminance(a), lb = luminance(b);
		return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
	}

	/* ── Palette ───────────────────────────────────────────────────── */
	var PAIRS = [
		['Text on page',      '--text-primary',   '--bg-base'],
		['Muted text on page', '--text-muted',    '--bg-base'],
		['Primary on page',   '--color-primary',  '--bg-base'],
		['Text on button',    '--color-on-primary', '--color-primary'],
		['Text on surface',   '--text-primary',   '--bg-surface'],
		['Muted on surface',  '--text-muted',     '--bg-surface'],
		['Success on page',   '--color-success',  '--bg-base'],
		['Warning on page',   '--color-warning',  '--bg-base'],
		['Error on page',     '--color-error',    '--bg-base'],
		['Owner on page',     '--color-owner',    '--bg-base']
	];

	function rating(r) {
		if (r >= 7)   return ['AAA', 'paid'];
		if (r >= 4.5) return ['Text', 'paid'];
		if (r >= 3)   return ['UI only', 'warn'];
		return ['Fails', 'disputed'];
	}

	function renderSwatches() {
		var host = document.getElementById('sb-swatches');
		host.innerHTML = '';
		COLOURS.forEach(function (group) {
			var title = document.createElement('h3');
			title.className = 'sb-group-title';
			title.textContent = group[0];
			host.appendChild(title);

			var grid = document.createElement('div');
			grid.className = 'sb-grid';
			group[1].forEach(function (name) {
				var card = document.createElement('div');
				card.className = 'sb-swatch';

				var chip = document.createElement('div');
				chip.className = 'sb-chip' + (TRANSLUCENT.indexOf(name) >= 0 ? ' on-cream' : '');
				var fill = document.createElement('div');
				fill.className = 'sb-fill';
				fill.style.setProperty('--sb-fill', 'var(' + name + ')');
				chip.appendChild(fill);

				var text = document.createElement('div');
				text.className = 'sb-swatch-text';
				var label = document.createElement('span');
				label.className = 'sb-swatch-name';
				label.textContent = name;
				var value = document.createElement('span');
				value.className = 'sb-swatch-value';
				value.textContent = tokenValue(name) || '(missing)';
				text.appendChild(label);
				text.appendChild(value);

				card.appendChild(chip);
				card.appendChild(text);
				grid.appendChild(card);
			});
			host.appendChild(grid);
		});
	}

	function renderContrast() {
		var body = document.querySelector('#sb-contrast tbody');
		body.innerHTML = '';
		var base = colourOf('--bg-base');
		PAIRS.forEach(function (pair) {
			var fg = over(colourOf(pair[1]), base);
			var bg = over(colourOf(pair[2]), base);
			var r = ratio(fg, bg);
			var grade = rating(r);

			var tr = document.createElement('tr');

			var name = document.createElement('td');
			name.textContent = pair[0];
			var sub = document.createElement('span');
			sub.className = 'sub';
			sub.textContent = pair[1] + ' on ' + pair[2];
			name.appendChild(sub);

			var sampleCell = document.createElement('td');
			var sample = document.createElement('span');
			sample.className = 'sb-sample';
			sample.style.setProperty('--sb-fg', 'var(' + pair[1] + ')');
			sample.style.setProperty('--sb-bg', 'var(' + pair[2] + ')');
			sample.textContent = 'Aa';
			sampleCell.appendChild(sample);

			var num = document.createElement('td');
			num.className = 'num';
			num.textContent = r.toFixed(1);

			var gradeCell = document.createElement('td');
			var badge = document.createElement('span');
			badge.className = 'badge ' + grade[1];
			badge.textContent = grade[0];
			gradeCell.appendChild(badge);

			tr.appendChild(name);
			tr.appendChild(sampleCell);
			tr.appendChild(num);
			tr.appendChild(gradeCell);
			body.appendChild(tr);
		});
	}

	function renderPalette() {
		try {
			renderSwatches();
			renderContrast();
		} catch (e) {
			fail(e.message, e);
		}
	}

	/* ── Artwork ───────────────────────────────────────────────────── */
	var sourceSel = document.getElementById('sb-source');
	var fileInput = document.getElementById('sb-file');
	var modeSel = document.getElementById('sb-mode');
	var backdropSel = document.getElementById('sb-backdrop');
	var sizeInput = document.getElementById('sb-size');
	var sizeOut = document.getElementById('sb-size-out');
	var stage = document.getElementById('sb-stage');
	var stageBox = document.getElementById('sb-stage-box');
	var ART_STATUS = 'sb-art-status';

	var localUrl = null;
	var drawCount = 0;

	function currentSource() {
		var opt = sourceSel.options[sourceSel.selectedIndex];
		if (opt.value === 'local') return { url: localUrl, label: opt.textContent, local: true };
		/* A fresh query each time, so a file that was just replaced shows up. */
		return { url: opt.value + '?t=' + Date.now(), label: opt.textContent, local: false };
	}

	/* The SVG is the person's own file, but it is still stripped of anything
	   that could run before it is placed in the page. Event handlers are the
	   real ones (onload, onclick...): letters only, so Inkscape's own
	   attributes such as only_selected are left alone. */
	function cleanSvg(text) {
		var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
		if (doc.querySelector('parsererror')) throw new Error('That file is not valid SVG');
		var svg = doc.documentElement;
		if (svg.nodeName.toLowerCase() !== 'svg') throw new Error('That file does not start with an svg element');

		svg.querySelectorAll('script, foreignObject').forEach(function (n) { n.remove(); });
		[svg].concat(Array.prototype.slice.call(svg.querySelectorAll('*'))).forEach(function (el) {
			Array.prototype.slice.call(el.attributes).forEach(function (a) {
				var isHandler = /^on[a-z]+$/i.test(a.name);
				var isScriptLink = /^(xlink:)?href$/i.test(a.name) && /^\s*javascript:/i.test(a.value);
				if (isHandler || isScriptLink) el.removeAttribute(a.name);
			});
		});

		/* Let it scale to the stage: size comes from the viewBox, not fixed pixels. */
		if (!svg.getAttribute('viewBox')) {
			var w = parseFloat(svg.getAttribute('width')), h = parseFloat(svg.getAttribute('height'));
			if (w > 0 && h > 0) svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
		}
		svg.removeAttribute('width');
		svg.removeAttribute('height');
		return document.importNode(svg, true);
	}

	function drawArt() {
		var mine = ++drawCount;
		var src = currentSource();
		stage.innerHTML = '';
		stage.style.width = sizeInput.value + 'px';
		stageBox.className = 'sb-stage bd-' + backdropSel.value;
		sizeOut.textContent = sizeInput.value + ' px';
		logo.unbind(modeSel.value === 'img' ? 'Switch Render as to Inline to use these controls.' : null);

		if (!src.url) { fail('No local file has been chosen yet', null, ART_STATUS); return; }

		if (modeSel.value === 'img') {
			var img = new Image();
			img.alt = 'Artwork under test';
			img.onload = function () { if (mine === drawCount) clearFail(ART_STATUS); };
			img.onerror = function () {
				if (mine !== drawCount) return;
				fail('Could not load ' + src.label + (src.label.indexOf('Sandbox slot') === 0 ? '. The file has not been added yet.' : '.'), null, ART_STATUS);
			};
			img.src = src.url;
			stage.appendChild(img);
			return;
		}

		fetch(src.url)
			.then(function (res) {
				if (!res.ok) throw new Error('Could not load ' + src.label + ' (' + res.status + ')');
				return res.text();
			})
			.then(function (text) {
				if (mine !== drawCount) return;
				var svg = cleanSvg(text);
				stage.appendChild(svg);
				clearFail(ART_STATUS);
				logo.bind(svg);
			})
			.catch(function (e) {
				if (mine === drawCount) fail(e.message, e, ART_STATUS);
			});
	}

	function useLocalFile(file) {
		if (!file) return;
		if (!/\.svg$/i.test(file.name) && file.type !== 'image/svg+xml') {
			fail(file.name + ' is not an SVG file', null, ART_STATUS);
			return;
		}
		if (localUrl) URL.revokeObjectURL(localUrl);
		localUrl = URL.createObjectURL(file);

		var opt = sourceSel.querySelector('option[value="local"]');
		if (!opt) {
			opt = document.createElement('option');
			opt.value = 'local';
			sourceSel.insertBefore(opt, sourceSel.firstChild);
		}
		opt.textContent = 'Local file: ' + file.name;
		sourceSel.value = 'local';
		drawArt();
	}

	/* ── Logo controls ─────────────────────────────────────────────────
	   The parts of the logo are found by their Inkscape labels, not their
	   ids (Inkscape's ids are generic and change). The naming is:
	     sha_*      flat shadows        black, opacity is the control
	     col_m_*    primary colour      any colour, no alpha
	     col_l_*    light colour        any colour, no alpha
	     blu_*      blurred shadows     black, opacity and blur are the controls
	     gra_m_all  the gradient        black, stop opacities and one offset
	   Everything is read from the file first, so the controls always start
	   at what the file says, and edited on the live DOM only. */
	var logo = (function () {
		var panel = document.getElementById('sb-logo');
		var note = document.getElementById('sb-logo-note');
		var $ = function (id) { return document.getElementById(id); };
		var BASE_BLUR = 12.5; /* the blur % the file was saved at, per the brief */

		var parts = null; /* { sha, colm, coll, blu, gra, blurs, stops } once bound */
		var currentBlur = BASE_BLUR;

		function labelOf(el) { return el.getAttributeNS(INKSCAPE_NS, 'label') || ''; }

		function byId(svg, id) { return svg.querySelector('[id="' + id.replace(/"/g, '') + '"]'); }

		function urlId(value) {
			var m = /url\(\s*["']?#([^"')\s]+)/.exec(value || '');
			return m ? m[1] : null;
		}

		/* A gradient's stops may sit on a gradient it links to (Inkscape does this). */
		function stopsFor(svg, el) {
			var id = urlId(el.style.fill || el.getAttribute('fill'));
			var g = id && byId(svg, id);
			var hops = 0;
			while (g && !g.querySelector('stop') && hops++ < 5) {
				var href = g.getAttributeNS(XLINK_NS, 'href') || g.getAttribute('href');
				g = href && byId(svg, href.replace(/^#/, ''));
			}
			return g ? Array.prototype.slice.call(g.querySelectorAll('stop')) : [];
		}

		function blurFor(svg, el) {
			var id = urlId(el.style.filter || el.getAttribute('filter'));
			var filter = id && byId(svg, id);
			var fe = filter && filter.querySelector('feGaussianBlur');
			if (!fe) return null;
			var num = function (name, fallback) {
				var v = parseFloat(filter.getAttribute(name));
				return isNaN(v) ? fallback : v;
			};
			return {
				filter: filter,
				fe: fe,
				std: parseFloat(fe.getAttribute('stdDeviation')),
				x: num('x', -0.1), y: num('y', -0.1), w: num('width', 1.2), h: num('height', 1.2)
			};
		}

		function hex(computed) {
			var n = (computed.match(/[\d.]+/g) || []).slice(0, 3).map(function (v) { return Math.round(Number(v)); });
			if (n.length < 3) return null;
			return '#' + n.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
		}
		function pct(v) { return String(Math.round(v * 100)); }
		function rgb(h) {
			return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16); }).join(',');
		}
		function round2(v) { return Math.round(v * 100) / 100; }

		function names(list) {
			return list.map(labelOf).join(', ');
		}

		function setEnabled(on) {
			panel.querySelectorAll('input, button, textarea').forEach(function (el) { el.disabled = !on; });
		}

		function unbind(message) {
			parts = null;
			setEnabled(false);
			note.textContent = message || 'Choose a source to load the logo.';
			$('sb-logo-values').value = '';
		}

		function bind(svg) {
			var all = Array.prototype.slice.call(svg.querySelectorAll('*'));
			var withPrefix = function (prefix) {
				return all.filter(function (el) { return labelOf(el).indexOf(prefix) === 0; });
			};
			var p = {
				sha: withPrefix('sha_'),
				colm: withPrefix('col_m_'),
				coll: withPrefix('col_l_'),
				blu: withPrefix('blu_'),
				gra: all.filter(function (el) { return labelOf(el) === 'gra_m_all'; })[0] || null
			};
			p.blurs = p.blu.map(function (el) { return blurFor(svg, el); }).filter(Boolean);
			p.stops = p.gra ? stopsFor(svg, p.gra) : [];

			var found = p.sha.length + p.colm.length + p.coll.length + p.blu.length + (p.gra ? 1 : 0);
			if (!found) {
				unbind('This SVG has no parts labelled sha_, col_m_, col_l_, blu_ or gra_m_all, so there is nothing to adjust.');
				return;
			}
			parts = p;
			setEnabled(true);
			note.textContent = 'Each control edits every part with that prefix. The values start at whatever the file says.';

			/* Groups with nothing behind them are switched off and say so. */
			var gate = function (list, ids, label) {
				ids.forEach(function (id) {
					$(id).disabled = !list.length;
				});
				if (!list.length) fail('No ' + label + ' parts were found in this SVG', null, ART_STATUS);
			};

			if (p.sha.length) {
				var sha = parseFloat(getComputedStyle(p.sha[0]).fillOpacity);
				$('sb-sha').value = pct(sha);
				$('sb-sha-parts').textContent = names(p.sha);
			}
			if (p.colm.length) {
				var cm = hex(getComputedStyle(p.colm[0]).fill);
				$('sb-colm').value = cm; $('sb-colm-hex').value = cm;
				$('sb-colm-parts').textContent = names(p.colm);
			}
			if (p.coll.length) {
				var cl = hex(getComputedStyle(p.coll[0]).fill);
				$('sb-coll').value = cl; $('sb-coll-hex').value = cl;
				$('sb-coll-parts').textContent = names(p.coll);
			}
			if (p.blu.length) {
				$('sb-blu').value = pct(parseFloat(getComputedStyle(p.blu[0]).fillOpacity));
				$('sb-blu-parts').textContent = names(p.blu);
			}
			currentBlur = BASE_BLUR;
			$('sb-blur').value = BASE_BLUR;
			if (p.stops.length >= 3) {
				$('sb-g0').value = round2(parseFloat(getComputedStyle(p.stops[0]).stopOpacity));
				$('sb-g1').value = round2(parseFloat(getComputedStyle(p.stops[1]).stopOpacity));
				$('sb-g2').value = round2(parseFloat(getComputedStyle(p.stops[2]).stopOpacity));
				$('sb-goff').value = round2(parseFloat(p.stops[1].getAttribute('offset')));
				/* Stop 1 may only move between its neighbours. */
				$('sb-goff').min = p.stops[0].getAttribute('offset');
				$('sb-goff').max = p.stops[2].getAttribute('offset');
			}

			gate(p.sha, ['sb-sha'], 'sha_');
			gate(p.colm, ['sb-colm', 'sb-colm-hex'], 'col_m_');
			gate(p.coll, ['sb-coll', 'sb-coll-hex'], 'col_l_');
			gate(p.blu, ['sb-blu'], 'blu_');
			if (!p.blurs.length) $('sb-blur').disabled = true;
			if (p.stops.length < 3) {
				['sb-g0', 'sb-g1', 'sb-g2', 'sb-goff'].forEach(function (id) { $(id).disabled = true; });
				fail(p.gra ? 'The gra_m_all gradient needs three stops and has ' + p.stops.length : 'No gra_m_all part was found in this SVG', null, ART_STATUS);
			}
			readouts();
		}

		/* The blur % is a multiplier on the saved filter: Inkscape sets the
		   deviation in proportion to the percentage for a given shape, so a
		   change of x% to y% is y/x on the deviation. The filter region is
		   scaled the same way, or a bigger blur would be cut off at the edge. */
		function applyBlur(pctValue) {
			var k = pctValue / BASE_BLUR;
			parts.blurs.forEach(function (b) {
				b.fe.setAttribute('stdDeviation', String(b.std * k));
				b.filter.setAttribute('x', String(b.x * k));
				b.filter.setAttribute('y', String(b.y * k));
				b.filter.setAttribute('width', String(1 + (b.w - 1) * k));
				b.filter.setAttribute('height', String(1 + (b.h - 1) * k));
			});
		}

		function validHex(v) {
			return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null;
		}

		/* Each control writes only its own value. Writing them all on every
		   move would quietly round the ones left alone (a range input snaps
		   to its step), changing the file's numbers without being asked. */
		var writers = {
			'sb-sha': function () {
				var v = String(Number($('sb-sha').value) / 100);
				parts.sha.forEach(function (el) { el.style.setProperty('fill-opacity', v); });
			},
			'sb-colm': function () {
				parts.colm.forEach(function (el) { el.style.setProperty('fill', $('sb-colm').value); });
			},
			'sb-coll': function () {
				parts.coll.forEach(function (el) { el.style.setProperty('fill', $('sb-coll').value); });
			},
			'sb-blu': function () {
				var v = String(Number($('sb-blu').value) / 100);
				parts.blu.forEach(function (el) { el.style.setProperty('fill-opacity', v); });
			},
			'sb-blur': function () {
				currentBlur = Math.min(15, Math.max(10, Number($('sb-blur').value)));
				applyBlur(currentBlur);
			},
			'sb-g0': function () { parts.stops[0].style.setProperty('stop-opacity', $('sb-g0').value); },
			'sb-g1': function () { parts.stops[1].style.setProperty('stop-opacity', $('sb-g1').value); },
			'sb-g2': function () { parts.stops[2].style.setProperty('stop-opacity', $('sb-g2').value); },
			'sb-goff': function () { parts.stops[1].setAttribute('offset', $('sb-goff').value); }
		};

		function apply(id) {
			if (!parts) return;
			writers[id]();
			readouts();
		}

		/* What is actually in the SVG now, which is what the numbers report.
		   The sliders can only show a rounded value; the file may hold more. */
		function readouts() {
			if (!parts) return;
			var num = function (v, digits) { return String(Number(Number(v).toFixed(digits))); };
			var opacity = function (el) { return parseFloat(getComputedStyle(el).fillOpacity); };
			var stopOp = function (i) { return parseFloat(getComputedStyle(parts.stops[i]).stopOpacity); };
			var sha = parts.sha.length ? Math.round(opacity(parts.sha[0]) * 10000) / 100 : null;
			var blu = parts.blu.length ? Math.round(opacity(parts.blu[0]) * 10000) / 100 : null;
			var cm = parts.colm.length ? hex(getComputedStyle(parts.colm[0]).fill) : null;
			var cl = parts.coll.length ? hex(getComputedStyle(parts.coll[0]).fill) : null;
			var haveStops = parts.stops.length >= 3;
			var off = haveStops ? parseFloat(parts.stops[1].getAttribute('offset')) : null;

			$('sb-sha-out').textContent = sha === null ? '' : num(sha, 2);
			$('sb-blu-out').textContent = blu === null ? '' : num(blu, 2);
			$('sb-blur-out').textContent = currentBlur.toFixed(1) + ' %';
			$('sb-g0-out').textContent = haveStops ? num(stopOp(0), 3) : '';
			$('sb-g1-out').textContent = haveStops ? num(stopOp(1), 3) : '';
			$('sb-g2-out').textContent = haveStops ? num(stopOp(2), 3) : '';
			$('sb-goff-out').textContent = haveStops ? num(off, 3) : '';

			var lines = [];
			if (sha !== null) lines.push('sha_*      rgba(0,0,0,' + num(sha / 100, 4) + ')   X = ' + num(sha, 2));
			if (cm) lines.push('col_m_*    rgb(' + rgb(cm) + ')   ' + cm);
			if (cl) lines.push('col_l_*    rgb(' + rgb(cl) + ')   ' + cl);
			if (blu !== null) lines.push('blu_*      rgba(0,0,0,' + num(blu / 100, 4) + ')   X = ' + num(blu, 2));
			if (parts.blurs.length) lines.push('blur       ' + currentBlur.toFixed(1) + ' %');
			if (haveStops) lines.push('gra_m_all  stop0 X = ' + num(stopOp(0), 3) + ', stop1 X = ' + num(stopOp(1), 3) + ' at offset ' + num(off, 4) + ', stop2 X = ' + num(stopOp(2), 3));
			$('sb-logo-values').value = lines.join('\n');
		}

		/* Colours: the picker and the hex box stay in step; a bad hex is reported. */
		function wireColour(pickerId, hexId) {
			$(pickerId).addEventListener('input', function () {
				$(hexId).value = $(pickerId).value;
				apply(pickerId);
			});
			$(hexId).addEventListener('change', function () {
				var raw = $(hexId).value.trim();
				var v = validHex(raw.charAt(0) === '#' ? raw : '#' + raw);
				if (!v) {
					fail('"' + raw + '" is not a six-digit hex colour, like #3593dd', null, ART_STATUS);
					$(hexId).value = $(pickerId).value;
					return;
				}
				clearFail(ART_STATUS);
				$(pickerId).value = v;
				$(hexId).value = v;
				apply(pickerId);
			});
		}
		wireColour('sb-colm', 'sb-colm-hex');
		wireColour('sb-coll', 'sb-coll-hex');
		['sb-sha', 'sb-blu', 'sb-blur', 'sb-g0', 'sb-g1', 'sb-g2', 'sb-goff'].forEach(function (id) {
			$(id).addEventListener('input', function () { apply(id); });
		});

		$('sb-logo-reset').addEventListener('click', drawArt);
		$('sb-logo-copy').addEventListener('click', function () {
			var text = $('sb-logo-values').value;
			if (!navigator.clipboard) { fail('This browser cannot copy from here. Select the text and copy it by hand.', null, ART_STATUS); return; }
			navigator.clipboard.writeText(text).then(
				function () { clearFail(ART_STATUS); },
				function (e) { fail('Could not copy. Select the text and copy it by hand.', e, ART_STATUS); }
			);
		});

		unbind();
		return { bind: bind, unbind: unbind };
	})();

	/* ── Wiring ────────────────────────────────────────────────────── */
	document.querySelectorAll('[data-theme-set]').forEach(function (b) {
		b.addEventListener('click', function () { setTheme(b.getAttribute('data-theme-set'), true); });
	});
	[sourceSel, modeSel, backdropSel].forEach(function (el) { el.addEventListener('change', drawArt); });
	sizeInput.addEventListener('input', function () {
		stage.style.width = sizeInput.value + 'px';
		sizeOut.textContent = sizeInput.value + ' px';
	});
	fileInput.addEventListener('change', function () { useLocalFile(fileInput.files[0]); });

	setTheme(savedTheme() === 'light' ? 'light' : 'dark', false);

	/* If a file has been saved into the sandbox slot, start on it. Otherwise
	   start on the primary logo, which always exists. The dropdown says which. */
	fetch('/resources/branding/sandbox.svg', { method: 'HEAD', cache: 'no-store' })
		.then(function (res) {
			if (res.ok) sourceSel.value = '/resources/branding/sandbox.svg';
		})
		.catch(function () { /* no probe result: the default stays selected and is visible in the dropdown */ })
		.then(drawArt);
})();
