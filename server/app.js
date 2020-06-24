//#region imports

/// path
// For resolving relative paths
const path = require('path');

/// fs-extra
// A better fs module. Includes more functions and adds Promises to existing
// fs functions
const fs = require('fs-extra');

/// moment
// For tracking usage and other stuff like Timestamp manipulation
const moment = require('moment');

/// pino (depends on: pino-pretty)
// Good log tool (common log levels are info, warn, error, etc.)
const log = require('pino')({
	prettyPrint: process.env.NODE_ENV === 'production' ? false : true,
	timestamp: () => `,"time": ${moment().format('YYYY-MM-DD hh:mm:ss A')} `
});

/// node-sass
// Converts Sass code to CSS
const Sass = require('node-sass');


// Express "setup"
const express = require('express');
const app = express();

const Minecraft = require('./minecraft');

//#endregion

//#region constants

/// HOST
// ONLY change if using a different network interface to run McSm! If unsure,
// leave as 0.0.0.0
const HOST = '0.0.0.0';

/// PORT
// 7767 is the decimal representation of MC (short for "M"ine"c"raft). Can be
// changed easily but it is recommended to leave it as is.
const PORT = 7767;

/// USER_CONFIG
// Poorly named yet very important variable. Path to where McSm's server list
// is. Because of its importance, it will NOT go into the PATHS constant.
const USER_CONFIG = path.join(__dirname, '..', 'config/user/config.json');

/// PATHS
// Stores absolute paths for certain items based on their relative path. This
// is mostly to avoid having ugly  path.join(__dirname, 'file')  all over the
// codebase.
const PATHS = {
	static: path.join(__dirname, '..', 'static'),
	fonts: path.join(__dirname, '..', 'fonts'),
	pages: path.join(__dirname, '..', 'views/pages'),
	sass: path.join(__dirname, '..', 'sass/main.scss'),
	properties: path.join(__dirname, '..', 'config/properties.json')
};

//// Global variables //// (Keep this section as small as possible)

/// SERVERS
// Stores the subprocess object created from "spawning" a Jar file.
var SERVERS = {};

/// TEMP_DOWNLOADS
// Keeps track of any zip files requested for download
var TEMP_DOWNLOADS = {};

//#endregion

//#region Express app setup

// Static paths (for stuff like JavaScript and Fonts)
app.use(express.static(PATHS.static));
app.use('/fonts', express.static(PATHS.fonts));

// Set the rendering engine.
// Tells Express to render using Pug.js (requires pug package from npm)
app.set('views', PATHS.pages);
app.set('view engine', 'pug');

// Set our Express routes. app is globally set so we do not need to pass it.
setRoutes();

//#endregion

// Load server configs and import any active servers
refreshActiveServers()
	// Put catch first since we CAN run if refreshActiveServers throws errors, we just want to print them
	.catch((err) => log.warn(err))
	.then(() => app.listen(PORT, HOST, () => (log.info(`Server hosted on ${HOST}:${PORT}`), log.info(`Click this link to open in browser: http://127.0.0.1:7767`))));


//// Routes ////
function setRoutes() {
	//// Standard routes ////
	// Routes required for the client to have basic browser functions; i.e. not
	// app specific

	/// Index
	// Very basic, does not do much at all since mcsm.js immediately calls
	// /page/home
	app.get('/', (_req, res) => res.render('index'));

	/// CSS
	// When client wants CSS, we render it on demand(aside from internal
	// caching)
	app.get('/css', (_req, res, next) => renderSass(res, next));


	//// Page routes ////
	// Page routes (/page/foobar) are requested when LOAD_PAGE() is called in
	// mcsm.js. These routes MUST return HTML data, typically from calling
	// res.render(). With that said, they ARE permitted to forward their
	// request to the 404 and 500 error handlers.

	/// Home page
	// If the config defined in USER_CONFIG does not exist, we assume that it
	// is a new installtion. Otherwise, load the config and return it to the
	// client.
	app.get('/pages/home', (_req, res, next) => {
		fs.pathExists(USER_CONFIG)
			.then((exists) => exists ? fs.readJson(USER_CONFIG) : {})
			.then((config) => res.render(Object.keys(config).length === 0 || config.servers.length === 0 ? 'setup' : 'home', config))
			.catch((err) => next(err));
	});

	/// Setup page
	// Simply loads setup.pug. It does not currently use req or next, but they
	// are there for future use if needed
	app.get('/pages/setup', (_req, res, _next) => res.render('setup'));

	/// Main server dashboard
	// Loads the server.properties into server.pug for the given
	// suuid("Server UUID")
	app.get('/pages/server/:suuid', (req, res, next) => {
		let mc = SERVERS[req.params.suuid];

		Promise.all([mc.readProperties(), mc.readWhitelist()])
			.then((data) => {
				data[0].whitelist = data[1];
				return data[0];
			})
			.then((config) => res.render('server', config))
			.catch((err) => next(err));
	});


	//// Other stuff ////

	/// Download
	// Downloads whatever is linked to did ("download ID")
	app.get('/download/:did', (req, res, _next) => {
		res.download(TEMP_DOWNLOADS[req.params.did]);
	});


	//// Server management routes ////
	// These calls MUST return json type. The JSON object should have the
	// following keys:
	//  success: boolean (if successful. If false, client triggers a catch())
	//  msg: string (Can be error message or status message)
	//  ***: any (any other object may be attached if it suites the function
	//       calling the route).

	/// New Server
	app.get('/servers/new/:type/:version/:name', (req, res, _next) => {
		let p = req.params;
		let mc = new Minecraft();
		mc.create(p.type, p.version, p.name)
			.then(() => SERVERS[mc.suuid] = mc)
			.then(() => res.send(buildServerResponse(true, '')))
			.catch((err) => res.send(buildServerResponse(false, err)));
	});

	/// Update server.properties
	// Probably should do this as POST but Express wanted JSON data for POST
	// which the client does not send for this function. This should be fine
	// since I highly doubt that anyones server.properties will be more than 8MB!
	app.get('/servers/update/server.properties/:suuid/:data', (req, res, _next) => {
		let suuid = req.params.suuid;
		let properties = Buffer.from(req.params.data, 'base64').toString();
		let mc = SERVERS[suuid];

		mc.writeProperties(properties)
			.then(() => res.send(buildServerResponse(true, 'Success!')))
			.catch((err) => res.send(buildServerResponse(false, err)));
	});

	app.get('/servers/delete/:suuid', async (req, res, _next) => {
		let suuid = req.params.suuid;
		let mc = SERVERS[suuid];

		if (await mc.isRunning())
			return res.send(buildServerResponse(false, 'Stop the server before deleting!'));

		mc.remove()
			.then(() => res.send(buildServerResponse(true, 'Server deleted.')))
			.catch((err) => res.send(buildServerResponse(false, err)));
	});

	// Start server
	app.get('/servers/start/:suuid', async (req, res, _next) => {
		let suuid = req.params.suuid;
		let mc = SERVERS[suuid];

		if (await mc.isRunning())
			return res.send(buildServerResponse(false, Error('Server already running!')));

		mc.start()
			.then(() => res.send(buildServerResponse(true, 'Server started!')))
			.catch((err) => res.send(buildServerResponse(false, err)));
	});

	// Stop server
	app.get('/servers/stop/:suuid', async (req, res, _next) => {
		let suuid = req.params.suuid;
		let mc = SERVERS[suuid];

		if (!(await mc.isRunning()))
			return res.send(buildServerResponse(false, Error('Server not running!')));

		mc.stop()
			.then((response) => res.send(buildServerResponse(true, response)))
			.catch((err) => res.send(buildServerResponse(false, err)));
	});

	/// Restart server
	app.get('/servers/restart/:suuid', async (req, res, _next) => {
		let suuid = req.params.suuid;
		let mc = SERVERS[suuid];

		if (!(await mc.isRunning()))
			return res.send(buildServerResponse(false, Error('Server not running!')));

		mc.restart()
			.then(() => res.send(buildServerResponse(true, 'Server restarted!')))
			.catch((err) => res.send(buildServerResponse(false, err)));
	})

	/// Query a (hopefully running) server
	// Query a server to check if it is online using Gamedig:
	// https://github.com/sonicsnes/node-gamedig
	app.get('/servers/query/:suuid', (req, res, _next) => {
		let suuid = req.params.suuid;
		let mc = SERVERS[suuid];

		mc.query()
			.then((state) => res.send(buildServerResponse(true, 'Online', state)))
			.catch((err) => res.send(buildServerResponse(false, err.message, err)));
	});

	// Zip a server folder
	app.get('/servers/download/:suuid', (req, res, next) => {
		let suuid = req.params.suuid;
		let mc = SERVERS[suuid];
		let dl; // object with keys 'did' and 'archivePath'

		mc.downloadWorld()
			.then((mDl) => dl = mDl)
			.then(() => TEMP_DOWNLOADS[dl.did] = dl.archivePath)
			.then(() => res.send(buildServerResponse(true, dl.did)))
			.catch((err) => next(err));

	});

	// Adds player to whitelist
	app.get('/servers/whitelist/add/:suuid/:player', (req, res, _next) => {
		let suuid = req.params.suuid;
		let player = req.params.player;
		let mc = SERVERS[suuid];

		mc.whitelistAdd(player)
			.then(() => res.send(buildServerResponse(true, `Player ${player} added to whitelist`)))
			.catch((err) => res.send(buildServerResponse(false, err)));
	});

	// Removes player from whitelist
	app.get('/servers/whitelist/remove/:suuid/:puuid', (req, res, _next) => {
		let suuid = req.params.suuid;
		let puuid = req.params.puuid;
		let mc = SERVERS[suuid];

		mc.whitelistRemove(puuid)
			.then(() => res.send(buildServerResponse(true, 'Player removed from whitelist')))
			.catch((err) => res.send(buildServerResponse(false, err)));
	});


	//// HTTP Errors ////

	/// HTTP 404
	app.use((_req, res) => res.status(404).send('404 NOT FOUND'));

	/// HTTP 500
	app.use((err, _req, res, _next) => (log.error(err.stack), res.status(500).send('500 SERVER ERROR')));
}

//// Functions ////

// Refresh any active Minecraft servers when McSm is launched. This helps
// because if McSm crashes, Minecraft servers stay online. SERVERS won't
// have a subprocess object though.
function refreshActiveServers() {
	return new Promise((resolve, reject) => {
		fs.pathExists(USER_CONFIG)
			.then((exists) => {
				if (!exists) throw Error('No valid User Config found!');
				else return;
			})
			.then(() => fs.readJson(USER_CONFIG))
			.then((config) =>
				config.servers.forEach((server) =>
					SERVERS[server.suuid] = new Minecraft(server.suuid)))
			.then(() => resolve())
			.catch((err) => reject(err));
	});
}

// Render the Sass files (scss) to regular CSS
function renderSass(res, next) {
	Sass.render({ file: PATHS.sass, outputStyle: 'compressed' }, (err, result) => err ? next(err) : res.type('css').send(result.css));
}

// Builds a somewhat universal response object for any /servers/* requests
// If the request has an error, we can pass that error as the "message" so we
// can print it and attach it without messing around with overloaded functions.
// I think ?
function buildServerResponse(s, m, d = {}) {
	!s && m !== 'Failed all 1 attempts' && log.warn(m);
	if (typeof (m) === typeof (Object)) m = Object(m).toString();
	return { success: s, message: m, data: d };//TODO: Fix the got damn errors!!!!!!!
}


// TODO: Log file monitoring: https://www.hosthorde.com/forums/resources/understanding-minecraft-server-log-files.75/