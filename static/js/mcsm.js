const PAGES = {
	home: {
		url: '/pages/home',
		callback: setupRadioButtonVersionSwap
	},
	setup: {
		url: '/pages/setup',
		callback: setupRadioButtonVersionSwap
	}
}

// __MAIN__ simply waits for the app to be ready. Note we use window and not document
function __MAIN__() {
	$(window).on('load', () => LOAD_PAGE(PAGES.home));
}

// Loads the specified page (or URL if override is true). Also runs a callback if the page has one.
function LOAD_PAGE(page, override = false) {

	// Server dashboard pages load an interval that isn't clear normally, so we clear it here. The
	// catch block is empty since this will run every time we call LOAD_PAGE, not just when leaving
	// a dashboard, and we don't want to flood the console or have the script completely stop.
	try { clearInterval(statusInterval); } catch { };

	// Fade out the current content, replace it with loading, and fade in.
	// TODO: Improve the fade callbacks so it doesn't take as long
	$('#primary').fadeOut(() => $('#primary').html(`<center><br><br><br><br><h1>Loading...</h1></center>`));
	$('#primary').fadeIn();

	// Fetch the page or URL
	fetch(!override ? page.url : page)
		.then((response) => response.text())
		.then((body) => {
			// Fade out "Loading..." and load the content.
			$('#primary').fadeOut(() => $('#primary').html(body));

			// If the page has a callback, we call it.
			$('#primary').fadeIn(() => page.callback && page.callback());
		})
		.catch((err) => alert(`Error: ${err.message}`));
}

// Tells McServerman server to create a new Minecraft server!
function newServer() {
	let type = $('input[name=server_type]:checked').val();
	let version = $('#server_version').val();
	let name = $('#server_name').val().replace(/[^a-zA-Z0-9\.\-\_]/g, '');

	// Disable the inputs/buttons so the user does not try to edit stuff during creation
	// TODO: Give these an identical class to disable them all at once
	$('#new-server-submit').prop('disabled', true);
	$('input[name="server_type"').prop('disabled', true);
	$('#server_version').prop('disabled', true);
	$('#server_name').prop('disabled', true);

	// Change the value of the "Create server" button for Fun! Funky! Wild! Visual Effects! (TM)
	$('#new-server-submit').val('Please wait');

	// Send the information to McSm
	fetch(`/servers/new/${type}/${version}/${name}`)
		.then((response) => response.json())
		.then((json) => {

			// Re-enable the buttons
			$('#new-server-submit').prop('disabled', false);
			$('input[name="server_type"').prop('disabled', false);
			$('#server_version').prop('disabled', false);
			$('#server_name').prop('disabled', false);

			// Reset the button value
			$('#new-server-submit').val('Create server');

			// Load the homepage if it worked, otherwise tell the user.
			if (json.success) LOAD_PAGE(PAGES.home);
			else alert(`Failed, please try again!${json.message ? `\n\n${json.message}` : ''}`);
		})
		.catch((err) => alert(`Error: ${err}`));
}

// Swaps the version dropdown list depending on which server type is specified
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

// Send the updated server properties to the server
function saveProperties(suuid) {
	let properties = '';

	// Disable buttons so user does not interfere with saving
	$('button').prop('disabled', true);
	$('button#save-properties').html('<strong>Please wait</strong>');

	// Iterate over every property input field and convert it to something server.properties can use
	$('input.server-properties').each((_index, element) => {
		let value = element.type === 'checkbox' ? element.checked.toString() : element.value;
		properties += `${element.id}=${value}\n`;
	});

	// Send the properties to the server!
	// HUGE thanks to https://stackoverflow.com/a/45844934 for helping me figure out how to encode stuff properly.
	fetch(`/servers/update/server.properties/${suuid}/${btoa(unescape(encodeURIComponent(properties)))}`)
		.then((response) => response.json())
		.then((json) => alert(json.message))
		.then(() => $('button').prop('disabled', false))
		.then(() => LOAD_PAGE(`/pages/server/${suuid}`, true));
}

// Start or stop the server
function startStopServer(suuid) {
	let status = $('#server-status');

	if (status.text() !== 'Online') {
		fetch(`/servers/start/${suuid}`)
			.then((response) => response.json())
			.then((json) => {
				if (!json.success) throw Error(json.message.message);
				else status.html('Online');
			})
			.catch((err) => alert(err));
	} else {
		fetch(`/servers/stop/${suuid}`)
			.then((response) => response.json())
			.then((json) => {
				if (!json.success) throw Error(json.message.message);
				else status.html('Offline');
			})
			.catch((err) => alert(err));
	}
}

// Restart the server (or start it if not running yet)
function restartServer(suuid) {
	let status = $('#server-status');
	if (status.text() !== 'Online') startStopServer(suuid);
	else {
		fetch(`/servers/restart/${suuid}`)
			.then((response) => response.json())
			.then((json) => {
				if (!json.success) throw Error(json.message.message);
				else status.html('Online')
			})
			.catch((err) => alert(err));
	}
}

// Deletes a server after confirming with the user
function deleteServer(suuid) {
	if (confirm('Are you sure you want to delete this server? This cannot be undone!')) {
		fetch(`/servers/delete/${suuid}`)
			.then((response) => response.json())
			.then((json) => {
				if (!json.success) throw Error(json.message.message);
				else LOAD_PAGE(PAGES.home);
			})
			.catch((err) => alert(err))
	}
}

// Downloads a world as a .zip
function downloadWorld(suuid) {
	if (confirm('Are you sure you want to download this world?')) {
		fetch(`/servers/download/${suuid}`)
			.then((response) => response.json())
			.then((json) => {
				if (!json.success) throw Error(json.message.message);
				else {
					let win = window.open(`/download/${json.message}`);
					win.focus();
				}
			})
			.catch((err) => alert(err))
	}
}

// Ask McServerman server to query the Minecraft server so we can see if it is actually online
// TODO: Make this work from the homepage maybe?
function queryServer() {
	let suuid = $('#server-title').attr('suuid');

	fetch(`/servers/query/${suuid}`)
		.then((response) => response.json())
		.then((json) => {
			if (!json.success) throw Error('Failed');
			let playerCount = json.data.players.length;
			if (playerCount > 1) playerCount -= 1;
			$('#server-status').html('Online'); // TODO: play with states from https://github.com/sonicsnes/node-gamedig
			$('#server-players').html(`${playerCount}/${json.data.maxplayers}`);
		})
		.catch((err) => $('#server-status').html('Offline'));
}

// Add player to whitelist
function addToWhitelist() {
	let suuid = $('#server-title').attr('suuid');
	let player = $('#whitelist-new-name').val();
	fetch(`/servers/whitelist/add/${suuid}/${player.replaceAll(/[^0-9a-zA-Z_]+/g, '')}`)
		.then((response) => response.json())
		.then((json) => {
			if (!json.success) alert(json.message);
			else LOAD_PAGE(`/pages/server/${suuid}`, true);
		});
}

// Remove player from whitelist
function removeFromWhitelist(puuid) {
	let suuid = $('#server-title').attr('suuid');
	fetch(`/servers/whitelist/remove/${suuid}/${puuid}`)
		.then((response) => response.json())
		.then((json) => {
			if (!json.success) alert(json.message);
			else LOAD_PAGE(`/pages/server/${suuid}`, true);
		});
}

// Add player to op
function addToOp() {
	let suuid = $('#server-title').attr('suuid');
	let player = $('#op-new-name').val();
	fetch(`/servers/op/add/${suuid}/${player.replaceAll(/[^0-9a-zA-Z_]+/g, '')}`)
		.then((response) => response.json())
		.then((json) => {
			if (!json.success) alert(json.message);
			else LOAD_PAGE(`/pages/server/${suuid}`, true);
		});
}

// Remove player from op
function removeFromOp(puuid) {
	let suuid = $('#server-title').attr('suuid');
	fetch(`/servers/op/remove/${suuid}/${puuid}`)
		.then((response) => response.json())
		.then((json) => {
			if (!json.success) alert(json.message);
			else LOAD_PAGE(`/pages/server/${suuid}`, true);
		});
}

// Ban player
function banPlayer() {
	let suuid = $('#server-title').attr('suuid');
	let player = $('#ban-player-name').val();
	let reason = Base64.encode($('#ban-player-reason').val());
	fetch(`/servers/ban/add/${suuid}/${player}/${reason}`)
		.then((response) => response.json())
		.then((json) => {
			if (!json.success) alert(json.message);
			else LOAD_PAGE(`/pages/server/${suuid}`, true);
		});
}

// Unban player
function unbanPlayer(puuid) {
	let suuid = $('#server-title').attr('suuid');
	fetch(`/servers/ban/remove/${suuid}/${puuid}`)
		.then((response) => response.json())
		.then((json) => {
			if (!json.success) alert(json.message);
			else LOAD_PAGE(`/pages/server/${suuid}`, true);
		});
}

// Ban IP
function banIP() {
	let suuid = $('#server-title').attr('suuid');
	let ip = $('#ban-ip-address').val();
	let reason = Base64.encode($('#ban-ip-reason').val());
	fetch(`/servers/ban-ip/add/${suuid}/${ip}/${reason}`)
		.then((response) => response.json())
		.then((json) => {
			if (!json.success) alert(json.message);
			else LOAD_PAGE(`/pages/server/${suuid}`, true);
		});
}

// Unban IP
function unbanIP(ip) {
	let suuid = $('#server-title').attr('suuid');
	fetch(`/servers/ban-ip/remove/${suuid}/${ip}`)
		.then((response) => response.json())
		.then((json) => {
			if (!json.success) alert(json.message);
			else LOAD_PAGE(`/pages/server/${suuid}`, true);
		});
}

// MUST be at end of script!
__MAIN__();