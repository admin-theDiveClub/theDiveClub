// The short link's code, a section of a league's and a tournament's Settings
// (UV, 9 Nov; docs/design/short-links.md). Saved by its own button, not the
// tab's Save: the change takes effect on the live link at once.
//
// The T- or L- is fixed and only letters and digits can be typed, so nobody can
// make an invalid code. The field says Too short, Taken or Available as you type,
// asking tdc_short_code_status once the typing stops. Only whoever set the code
// may change it (tdc_short_link says so): anybody else running it sees the code
// and who can. After saving it reads the code again rather than trusting the form.
//
// A page says where to draw it and calls load().
//
// Needs: tdc.js.

const TDCShortCode = (() => {
	const SITE = 'thediveclub.org/';
	const CHECK_AFTER_MS = 350;

	const FEEDBACK = {
		available: ['Available', 'success'],
		yours: ['', ''],
		too_short: ['Too short: at least 2 characters.', 'error'],
		too_long: ['Too long: at most 8 characters.', 'error'],
		invalid: ['Letters and numbers only.', 'error'],
		blocked: ['That code is not allowed. Try another.', 'error'],
		taken: ['Taken. Try another.', 'error']
	};

	function create(box, area, kind, id) {
		const prefix = kind === 'tournament' ? 'T-' : 'L-';
		const inputId = box.id + '-input';

		const node = (tag, cls, text) => {
			const n = document.createElement(tag);
			if (cls) n.className = cls;
			if (text !== undefined) n.textContent = text;
			return n;
		};

		const field = node('div', 'field');
		const label = node('label', null, 'Short link');
		label.htmlFor = inputId;

		const row = node('div', 'short-code-row');
		const fixed = node('span', 'short-code-prefix', prefix);
		const input = node('input');
		input.type = 'text';
		input.id = inputId;
		input.maxLength = 8;
		input.autocomplete = 'off';
		input.spellcheck = false;
		input.setAttribute('autocapitalize', 'characters');
		const save = node('button', 'btn btn-secondary btn-sm', 'Save');
		save.type = 'button';
		save.disabled = true;
		row.append(fixed, input, save);

		const preview = node('div', 'hint');
		const note = node('div', 'hint');
		const status = node('div', 'status');
		status.setAttribute('aria-live', 'polite');

		field.append(label, row, preview, note, status);
		box.replaceChildren(field);

		let current = '';      // the code as last read, without the T- or L-
		let canChange = false;
		let asked = 0;         // retires a check overtaken by more typing
		let timer = null;

		function showPreview() {
			const code = prefix + input.value;
			preview.textContent = `${SITE}${code}. Matches in it take this code and a number: ${code}-1, ${code}-2.`;
		}

		function say(result) {
			const words = FEEDBACK[result];
			if (!words) {
				TDC.error(area, `unknown answer "${result}" about this code.`, null, status);
				return;
			}
			TDC.status(status, words[0], words[1]);
		}

		async function check(value) {
			const mine = ++asked;
			const work = Promise.resolve(supabaseClient.rpc('tdc_short_code_status', { p_kind: kind, p_id: id, p_code: value }));
			TDC.busy(input, work);
			const { data, error } = await work;
			if (mine !== asked) return;
			if (error) { TDC.showSupabaseError(area, error, status); return; }
			say(data);
			save.disabled = data !== 'available';
		}

		// Not every character typed is worth asking about, and the two that
		// need no answer are said at once.
		input.addEventListener('input', () => {
			const clean = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
			if (clean !== input.value) input.value = clean;
			showPreview();

			clearTimeout(timer);
			asked++;
			save.disabled = true;
			TDC.status(status, '', '');

			if (clean === current) return;
			if (clean.length < 2) { say('too_short'); return; }
			timer = setTimeout(() => check(clean), CHECK_AFTER_MS);
		});

		save.addEventListener('click', () => TDC.busy(save, (async () => {
			const code = input.value;
			save.disabled = true;
			const { error } = await supabaseClient.rpc('tdc_set_short_code', { p_kind: kind, p_id: id, p_code: code });
			if (error) { TDC.showSupabaseError(area, error, status); await read(); return; }
			if (await read()) {
				TDC.status(status, `Saved. Your link is now ${SITE}${prefix}${current}.`, 'success');
			}
		})(), status));

		async function read() {
			const { data, error } = await supabaseClient.rpc('tdc_short_link', { p_kind: kind, p_id: id });
			if (error) { TDC.showSupabaseError(area, error, status); return false; }

			current = data.code.slice(prefix.length);
			canChange = !!data.can_change;
			input.value = current;
			input.disabled = !canChange;
			save.disabled = true;
			save.hidden = !canChange;
			showPreview();

			note.className = canChange ? 'hint warn' : 'hint';
			note.textContent = canChange
				? 'Changing it stops the old link and every match link straight away, and anybody can then take the old code.'
				: (data.set_by ? `Only ${data.set_by} can change this code.` : 'Only the person who set this code can change it.');
			return true;
		}

		// Shown again as a tab: read again, unless a change is half made.
		function load() {
			if (input.value !== current) return Promise.resolve(false);
			return read();
		}

		return { load };
	}

	return { create };
})();
