const PAGES = {
	home: '/pages/home'
}

function __MAIN__() {
	$(window).on('load', () => {
		setTimeout(() => {
			LOAD_PAGE(PAGES.home);
		}, 500);
	});
}

function LOAD_PAGE(page) {
	fetch(page)
		.then((response) => response.text())
		.then((body) => {
			$('#primary').html(body);
		})
		.catch((err) => alert('Error!'));
}

function newServer() {
	let type = $('input[name=server_type]:checked').val();
	let version = $('#server_version').val();
	let name = $('#server_name').val();

	console.log(type);
	console.log(version);
	console.log(name);

	$('#new-server-submit').prop('disabled', true);

	fetch(`/servers/new/${type}/${version}/${name.replace(/[^a-zA-Z0-9\.\-\_ ]/g, '')}`)
		.then((response) => response.json())
		.then((json) => {
			console.log(json);
			$('#new-server-submit').prop('disabled', false);
		})
		.catch((err) => alert(err));
}


__MAIN__(); // MUST be at end of script!