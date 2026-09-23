// Auth logic for The Dive Club login page

const form = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submit-btn');
const googleBtn = document.getElementById('google-signin');
const toggleLink = document.getElementById('toggle-mode');
const formTitle = document.getElementById('form-title');
const statusMsg = document.getElementById('status-msg');

let mode = 'login'; // or 'signup'

function setStatus(message, type) {
	statusMsg.textContent = message;
	statusMsg.className = 'status' + (type ? ' ' + type : '');
}

function updateModeUI() {
	if (mode === 'login') {
		formTitle.textContent = 'Log In';
		submitBtn.textContent = 'Log In';
		toggleLink.textContent = "Don't have an account? Sign up";
	} else {
		formTitle.textContent = 'Sign Up';
		submitBtn.textContent = 'Sign Up';
		toggleLink.textContent = 'Already have an account? Log in';
	}
	setStatus('');
}

toggleLink.addEventListener('click', () => {
	mode = mode === 'login' ? 'signup' : 'login';
	updateModeUI();
});

form.addEventListener('submit', async (e) => {
	e.preventDefault();
	submitBtn.disabled = true;
	setStatus('');

	const email = emailInput.value.trim();
	const password = passwordInput.value;

	let result;
	if (mode === 'login') {
		result = await supabaseClient.auth.signInWithPassword({ email, password });
	} else {
		result = await supabaseClient.auth.signUp({ email, password });
	}

	submitBtn.disabled = false;

	if (result.error) {
		setStatus(result.error.message, 'error');
		return;
	}

	if (mode === 'signup') {
		setStatus('Account created — check your email to confirm, then log in.', 'success');
		mode = 'login';
		updateModeUI();
	} else {
		setStatus('Logged in — redirecting…', 'success');
		window.location.href = '/'; // change this to wherever a logged-in user should land
	}
});

googleBtn.addEventListener('click', async () => {
	const { error } = await supabaseClient.auth.signInWithOAuth({
		provider: 'google',
		options: {
			redirectTo: window.location.origin + '/' // where Google sends the user back to after login
		}
	});
	if (error) {
		setStatus(error.message, 'error');
	}
	// on success, the browser navigates away to Google automatically — nothing else to do here
});

// If someone's already logged in, skip the login page entirely
(async () => {
	const { data: { session } } = await supabaseClient.auth.getSession();
	if (session) {
		window.location.href = '/';
	}
})();