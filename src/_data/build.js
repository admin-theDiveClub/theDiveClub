// Build stamp, available in templates as {{ build.version }}.
// It changes on every build, so ?v= links make browsers fetch fresh styles and scripts after each deploy.
module.exports = {
	version: Date.now().toString(36)
};
