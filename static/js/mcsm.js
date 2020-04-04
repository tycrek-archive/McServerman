const PAGES = {
	home: {
		url: '/pages/home',
		callback: () => {
			$('input#vanilla').on('change', () => {
				$('option.vanilla-versions').show();
				$('.papermc-versions').hide();
				$('.vanilla-versions[value="1.15.2"]').prop('selected', true)
			});
			$('input#papermc').on('change', () => {
				$('option.vanilla-versions').hide();
				$('.papermc-versions').show();
				$('.papermc-versions[value="1.15"]').prop('selected', true)
			});
		}
	}
}

function __MAIN__() {
	$(window).on('load', () => {
		setTimeout(() => {
			LOAD_PAGE(PAGES.home);
		}, 500);
	});
}

function LOAD_PAGE(page) {
	fetch(page.url)
		.then((response) => response.text())
		.then((body) => {
			$('#primary').html(body);
		})
		.then(() => page.callback())
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
	$('#new-server-submit').val('Please wait');

	fetch(`/servers/new/${type}/${version}/${name.replace(/[^a-zA-Z0-9\.\-\_ ]/g, '')}`)
		.then((response) => response.json())
		.then((json) => {
			alert(json.success);
			$('#new-server-submit').prop('disabled', false);
			$('#new-server-submit').val('Create server');
		})
		.catch((err) => alert(err));
}


__MAIN__(); // MUST be at end of script!