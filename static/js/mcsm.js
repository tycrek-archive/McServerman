const PAGES = {
	home: {
		url: '/pages/home',
		callback: setupRadioButtonVersionSwap
	},
	setup: {
		url: '/pages/setup',
		callback: setupRadioButtonVersionSwap
	},
	server: {
		url: '/pages/server'
	}
}

function __MAIN__() {
	$(window).on('load', () => {
		setTimeout(() => {
			LOAD_PAGE(PAGES.home);
		}, 500);
	});
}

function LOAD_PAGE(page, override = false) {
	$('#primary').fadeOut(() => $('#primary').html(`<center><br><br><br><br><h1>Loading...</h1></center>`));
	$('#primary').fadeIn();
	fetch(!override ? page.url : page)
		.then((response) => response.text())
		.then((body) => {
			$('#primary').fadeOut(() => $('#primary').html(body));
			$('#primary').fadeIn(() => page.callback && page.callback());
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
	$('input[name="server_type"').prop('disabled', true);
	$('#server_version').prop('disabled', true);
	$('#server_name').prop('disabled', true);

	$('#new-server-submit').val('Please wait');

	fetch(`/servers/new/${type}/${version}/${name.replace(/[^a-zA-Z0-9\.\-\_ ]/g, '')}`)
		.then((response) => response.json())
		.then((json) => {
			$('#new-server-submit').prop('disabled', false);
			$('input[name="server_type"').prop('disabled', false);
			$('#server_version').prop('disabled', false);
			$('#server_name').prop('disabled', false);

			$('#new-server-submit').val('Create server');

			if (json.success == true) LOAD_PAGE(PAGES.home);
			else alert('Failed, please try again!');
		})
		.catch((err) => alert(err));
}

function setupRadioButtonVersionSwap() {
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

function saveProperties(suuid) {
	let properties = '';

	// disable buttons so user does not interfere with saving
	$('button').prop('disabled', true);
	$('button#save-properties').html('<strong>Please wait</strong>');

	// $('input.server-properties#allow-nether').is(":checked")
	$('input.server-properties').each((_index, element) => {
		let property = element.id;
		let value = element.type === 'checkbox' ? element.checked.toString() : element.value;
		properties += `${property}=${value}\n`;
	});
	fetch(`/servers/update/server.properties/${suuid}/${btoa(unescape(encodeURIComponent(properties)))}`) // https://stackoverflow.com/a/45844934
		.then((response) => response.json())
		.then((json) => alert(json.msg))
		.then(() => $('button').prop('disabled', false))
		.then(() => LOAD_PAGE(`/pages/server/${suuid}`, true));
}


__MAIN__(); // MUST be at end of script!