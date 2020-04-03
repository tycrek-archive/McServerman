$(window).on('load', () => {
	setTimeout(() => {
		$('#primary').html(`
		<h1>Hello world!</h1>
		<p>This is a test of fonts! Hip, hooray?</p>
		<code>$ sudo apt update</code>`);
	}, 3000);
});