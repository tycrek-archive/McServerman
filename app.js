//// Imports ////
const path = require('path'); // For resolving relative paths
const fs = require('fs-extra'); // A better fs module. Includes more functions and adds Promises to existing fs functions
const log = require('pino')({ prettyPrint: process.env.NODE_ENV === 'production' ? false : true }); // Good log tool (common log levels are info, warn, error, etc.)
const Sass = require('node-sass'); // Converts Sass code to CSS
const fetch = require('node-fetch'); // Node version of fetch API from browsers. Used for downloading files and scraping websites
const cheerio = require('cheerio'); // Makes it easier to parse HTML for scraping Jar download links
const { spawn } = require('child_process'); // Used for running Jar files
const moment = require('moment'); // Time... is a funny thing
const uuid = require('uuid').v4; // For identifying servers on something other than a name
const Gamedig = require('gamedig'); // For queryins Minecraft servers

// Express "setup"
const express = require('express');
const app = express();


//// Constants ////

/// HOST
// ONLY change if using a different network interface to run McSm! If unsure, leave as 0.0.0.0
const HOST = '0.0.0.0';

/// PORT
// 7767 is the decimal representation of MC (short for "M"ine"c"raft). Can be changed easily
// but it is recommended to leave it as is.
const PORT = 7767;

/// USER_CONFIG
// Poorly named yet very important variable. Path to where McSm's server list is.
// Because of its importance, it will NOT go into the PATHS constant.
const USER_CONFIG = path.join(__dirname, 'config/user/config.json');

/// PATHS
// Stores absolute paths for certain items based on their relative path.
// This is mostly to avoid having ugly  path.join(__dirname, 'file')  all over the codebase.
const PATHS = {
	static: path.join(__dirname, 'static'),
	fonts: path.join(__dirname, 'fonts'),
	pages: path.join(__dirname, 'views/pages'),
	sass: path.join(__dirname, 'sass/main.scss'),
	properties: path.join(__dirname, 'config/properties.json')
};

/// DOWNLOAD_LINKS
// Collection of links for where Jar files can be downloaded from.
// TODO: Add 1.16 link to PaperMC once 1.16 servers are available
// TODO: Add support for Bedrock edition, if it ever leaves Alpha stages. Current Bedrock link is also not Direct Download.
const DOWNLOAD_LINKS = {
	vanilla: 'https://mcversions.net/download/',
	paper: {
		1.15: 'https://papermc.io/ci/job/Paper-1.15/lastSuccessfulBuild/artifact/paperclip.jar',
		1.14: 'https://papermc.io/ci/job/Paper-1.14/lastSuccessfulBuild/artifact/paperclip.jar',
		1.13: 'https://papermc.io/ci/job/Paper-1.13/lastSuccessfulBuild/artifact/paperclip.jar',
		1.12: 'https://papermc.io/ci/job/Paper/lastSuccessfulBuild/artifact/paperclip.jar'
	},
	bedrock: 'https://www.minecraft.net/en-us/download/server/bedrock'
};

/// PLAYER_UUID_LINK
// Link for where to grab info on Minecraft Player UUID's. These are helpful for opping/whitelisting players before they have joined.
const PLAYER_UUID_LINK = 'https://mcuuid.net/?q=';


//// Global variables //// (Keep this section as small as possible)

/// ACTIVE_SERVERS
// Stores the subprocess object created from "spawning" a Jar file.
// TODO: Write to a file for when McSm crashes or restarts
var ACTIVE_SERVERS = {};


//// Express app setup ////

// Static paths (for stuff like JavaScript and Fonts)
app.use(express.static(PATHS.static));
app.use('/fonts', express.static(PATHS.fonts));

// Set the rendering engine.
// Tells Express to render using Pug.js (requires pug package from npm)
app.set('views', PATHS.pages);
app.set('view engine', 'pug');

// Set our Express routes. app is globally set so we do not need to pass it.
setRoutes();

// Run the app!
app.listen(PORT, HOST, () => log.info(`Server hosted on ${HOST}:${PORT}`));


//// Routes ////
function setRoutes() {
	//// Standard routes ////
	// Routes required for the client to have basic browser functions; i.e. not app specific

	/// Index
	// Very basic, does not do much at all since mcsm.js immediately calls /page/home
	app.get('/', (_req, res) => res.render('index'));

	/// CSS
	// When client wants CSS, we render it on demand(aside from internal caching)
	app.get('/css', (_req, res, next) => renderSass(res, next));


	//// Page routes ////
	// Page routes (/page/foobar) are requested when LOAD_PAGE() is called in mcsm.js.
	// These routes MUST return HTML data, typically from callin res.render()
	// With that said, they ARE permitted to forward their request to the 404 and 500 error
	// handlers.

	/// Home page
	// If the config defined in USER_CONFIG does not exist, we assume that it is a new
	// installtion. Otherwise, load the config and return it to the client.
	app.get('/pages/home', (_req, res, next) => {
		fs.pathExists(USER_CONFIG)
			.then((exists) => exists ? fs.readJson(USER_CONFIG) : {})
			.then((config) => res.render(Object.keys(config).length !== 0 ? 'home' : 'setup', config))
			.catch((err) => next(err));
	});

	/// Setup page
	// Simply loads setup.pug. It does not currently use req or next, but they are there for future use if needed
	app.get('/pages/setup', (_req, res, _next) => res.render('setup'));

	/// Main server dashboard
	// Loads the server.properties into server.pug for the given suuid ("Server UUID")
	app.get('/pages/server/:suuid', (req, res, next) => {
		fs.readJson(USER_CONFIG)
			.then((json) => json.servers)
			.then((servers) => {
				for (let i = 0; i < servers.length; i++)
					if (servers[i].suuid === req.params.suuid)
						return getServerProperties(servers[i]);
				throw Error('No such server exists!');
			})
			.then((config) => res.render('server', config))
			.catch((err) => next(err));
	});


	//// Server management routes ////
	// These calls MUST return json type. The JSON object should have the following keys:
	//  success: boolean (if successful. If false, client triggers a catch())
	//  msg: string (Can be error message or status message)
	//  ***: any (any other object may be attached if it suites the function calling the route).

	/// New Server
	app.get('/servers/new/:type/:version/:name', (req, res, _next) => {
		let type = req.params.type;
		let version = req.params.version;
		let name = req.params.name;
		let suuid = uuid();

		let destPath = path.join(__dirname, `servers/${name}-${type}-${version}/`);
		let destFile = `${name}-${type}-${version}.jar`;
		let dest = path.join(destPath, destFile);

		// If the path already exists, then it probably means there is already a server with the same name
		fs.pathExists(destPath)
			.then((exists) => {
				if (exists) throw Error('Path already exists!');
				else return;
			})

			// Create the path so we can download the Jar file
			.then(() => fs.ensureDir(destPath))

			// PaperMC has direct download links; Vanilla does not, so we need an extra step to get the DDL link.
			.then(() => type === 'vanilla' ? getVanillaUrl(version) : DOWNLOAD_LINKS.paper[version])
			.then((url) => downloadJar(url, dest))

			// Run the Jar for the first time, ommiting the Wait flag because we want to wait for it to generate some files.
			.then(() => runJar(destPath, destFile, suuid))

			// This is why we wait for ^ to exit: we need to "sign" the EULA.
			//It might be against Mojang's ToS to do this in code, but we should be fine. Right?!
			.then(() => signEula(path.join(destPath, 'eula.txt')))

			// Write a config to USER_CONFIG with our brand new shiny server!
			.then(() => writeUserConfig(name, version, type, suuid, destPath, destFile))

			// Respond to the client
			.then(() => res.send(buildServerResponse(true, '')))
			.catch((err) => res.send(buildServerResponse(false, err)));
	});

	/// Update server.properties
	// Probably should do this as POST but Express wanted JSON data for POST which
	// the client does not send for this function. This should be fine since I highly
	// doubt that anyones server.properties will be more than 8MB!
	app.get('/servers/update/server.properties/:suuid/:data', (req, res, _next) => {
		let suuid = req.params.suuid;
		let properties = Buffer.from(req.params.data, 'base64').toString(); // for the love of god do NOT change this

		properties = properties.replace('enable-rcon=false', 'enable-rcon=true');
		properties = properties.replace('enable-query=false', 'enable-query=true');

		getServerFromConfig(suuid)
			.then((server) => fs.writeFile(path.join(server.directory, 'server.properties'), properties))
			.then(() => res.send(buildServerResponse(true, 'Success!')))
			.catch((err) => res.send(buildServerResponse(false, err)));
	});

	/// Start server
	// Start a server with the given suuid. Fails to start if the server is already running.
	app.get('/servers/start/:suuid', (req, res, _next) => {
		let suuid = req.params.suuid;

		if (ACTIVE_SERVERS.hasOwnProperty(suuid))
			return res.send(buildServerResponse(false, Error('Server already running!')));

		getServerFromConfig(suuid)
			.then((server) => runJar(server.directory, server.jarFile, suuid, false))
			.then(() => res.send(buildServerResponse(true, 'Server started!')))
			.catch((err) => res.send(buildServerResponse(false, err)));
	});

	/// Stop server
	// Attempts to stop the server by sending the 'stop' command to the server process.
	app.get('/servers/stop/:suuid', (req, res, _next) => {
		let suuid = req.params.suuid;

		// Obviously we can't stop the server if it isn't running yet...
		if (!ACTIVE_SERVERS.hasOwnProperty(suuid))
			return res.send(buildServerResponse(false, Error('Server not running!')));

		getServerFromConfig(suuid)
			.then((server) => getServerProperties(server))
			.then((properties) => properties.properties['rcon.password'])
			.then((password) => {
				// Send the 'stop' command to the Jar with RCON
				//let stopped = ACTIVE_SERVERS[suuid].stdin.write('stop\n');
				//ACTIVE_SERVERS[suuid].stdin.end();
				let conn = new (require('rcon'))('0.0.0.0', 25575, password);
				conn.connect();
				conn.on('auth', () => conn.send('stop'));
				conn.on('response', (str) => {
					conn.disconnect();
					res.send(buildServerResponse(true, str));
				});
			})
			.catch((err) => res.send(buildServerResponse(false, err)));
	});

	/// Query a (hopefully running) server
	// Query a server to check if it is online using Gamedig: https://github.com/sonicsnes/node-gamedig
	app.get('/servers/query/:suuid', (req, res, _next) => {
		let suuid = req.params.suuid;

		let host = '';
		let port = -1;

		getServerFromConfig(suuid)
			.then((server) => server.directory)
			.then((directory) => fs.readFile(path.join(directory, 'server.properties')))
			.then((bytes) => bytes.toString())
			.then((properties) => {
				let lines = properties.split('\n');
				for (i = 0; i < lines.length; i++) {
					if (lines[i].startsWith('enable-query') && lines[i].split('=')[1].trim() === 'false') throw Error('Query not permitted!');
					if (lines[i].startsWith('query.port')) port = lines[i].split('=')[1];
					if (lines[i].startsWith('server-ip')) host = lines[i].split('=')[1];
				}
				if (port == -1) throw Error('Unable to locate server, does server.properties file exist?');
			})
			.then(() => Gamedig.query({
				type: 'minecraft',
				host: host === '' ? '0.0.0.0' : host,
				port: port
			}))
			.then((state) => res.send(buildServerResponse(true, 'Online', state)))
			// Print a debug log and DON'T pass the actual error since the console would be overcrowded otherwise
			.catch((err) => (log.debug(err), res.send(buildServerResponse(false, err.message, err))));
	});


	//// HTTP Errors ////

	/// HTTP 404
	app.use((_req, res) => res.status(404).send('404 NOT FOUND'));

	/// HTTP 500
	app.use((err, _req, res, _next) => (log.error(err.stack), res.status(500).send('500 SERVER ERROR')));
}

//// Functions ////

// Render the Sass files (scss) to regular CSS
function renderSass(res, next) {
	// personal note for dev: DO NOT move this back into setRoutes. I know you want to, but don't
	Sass.render({ file: PATHS.sass, outputStyle: 'compressed' }, (err, result) => err ? next(err) : res.type('css').send(result.css));
}

// Scrape the download URL for Vanilla Minecraft from mcversions.net
function getVanillaUrl(version) {
	return new Promise((resolve, reject) => {
		fetch(DOWNLOAD_LINKS.vanilla + version)
			.then((response) => response.text())
			// The site doesn't have DOM ID's which makes parsing the correct link difficult, sketchy string splits it is!
			// If the site ever changes its layout, this will most likely need to be fixed.
			.then((dom) => cheerio.load(dom)('.downloads').html().split('href="')[1].split('" download')[0])
			.then((url) => resolve(url))
			.catch((err) => reject(err));
	});
}

// Downloads a server jar from the source. Saves to dest
function downloadJar(source, dest) {
	log.info(`Downloading server Jar from ${source}`);
	return new Promise((resolve, reject) => {
		let startTime = moment().valueOf(), endTime;
		fetch(source)
			.then((response) => {
				let stream = response.body.pipe(fs.createWriteStream(dest));
				return new Promise((resolve, reject) => {
					stream.on('finish', () => resolve());
					stream.on('error', (err) => reject(err));
				});
			})
			.then(() => endTime = moment().valueOf())
			.then(() => log.info(`Server Jar downloaded to ${dest}, taking ${(endTime - startTime) / 1000} seconds`))
			.then(() => resolve())
			.catch((err) => reject(err));
	});
}

// Runs the specified Jar file
function runJar(directory, jar, suuid, wait = true) {
	log.info(`Running Jar file in ${directory}`);
	return new Promise((resolve, reject) => {

		// Set up the subprocess
		let bin = 'java'; // TODO: Fix for detecting proper Java version
		let args = ['-jar', jar, 'nogui']; // TODO: Runtime options
		let options = { cwd: directory, windowsHide: true, detached: true };

		// Spawn the subprocess and...
		let java = spawn(bin, args, options);

		// ... add it to the server list
		ACTIVE_SERVERS[suuid] = java;

		// Print stdout and stderr
		java.stdout.on('data', (out) => log.info(`[${java.pid}] stdout: ${out.toString().trim()}`));
		java.stderr.on('data', (err) => log.error(`[${java.pid}] stderr: ${err.toString().trim()}`));

		// This is only called if we wait for the server to exit.
		// This typically only happens on first time run to generate the EULA and server.properties
		java.on('close', (exitCode) => {

			// Make sure we delete it from the active servers since it is no longer active
			delete ACTIVE_SERVERS[suuid];

			let msg = `Child process [${java.pid}] exited with code ${exitCode}`;
			wait ? (exitCode != 0 ? reject(log.warn(msg)) : resolve(log.info(msg))) : (exitCode != 0 ? log.warn(msg) : log.info(msg));
		});
		if (!wait) resolve();
	});
}

// Opens the specified EULA file and changes "false" to "true" automatically
function signEula(eulaPath) {
	log.info(`Signing EULA ${eulaPath}`);
	return new Promise((resolve, reject) => {
		fs.readFile(eulaPath)
			.then((bytes) => bytes.toString())
			.then((text) => text.replace('false', 'true'))
			.then((signed) => fs.writeFile(eulaPath, signed))
			.then(() => resolve())
			.catch((err) => reject(err));
	});
}

// Writes JSON data to USER_CONFIG. If file does not exist, it is created.
function writeUserConfig(name, version, type, suuid, directory, jarFile) {
	log.info(`Writing NEW configuration to ${USER_CONFIG}`);
	return new Promise((resolve, reject) => {
		let config = { "servers": [] };
		let server = { // JSON object, not JavaScript object!
			"name": name,
			"version": version,
			"type": type,
			"suuid": suuid,
			"directory": directory,
			"jarFile": jarFile,
			"lastAccess": moment().valueOf(), // For sorting
			"created": moment().valueOf()
		};
		fs.pathExists(USER_CONFIG)
			.then((exists) => exists ? fs.readJson(USER_CONFIG) : config)
			.then((mConfig) => config = mConfig)
			.then(() => config.servers.push(server))
			.then(() => fs.ensureFile(USER_CONFIG))
			.then(() => fs.writeJson(USER_CONFIG, config, { spaces: '\t' }))
			.then(() => log.info('Done writing config!'))
			.then(() => resolve())
			.catch((err) => reject(err));
	});
}

// Get server metadata from USER_CONFIG. Server metadata is information only relevant to McSm.
function getServerFromConfig(suuid) {
	return new Promise((resolve, reject) => {
		fs.readJson(USER_CONFIG)
			.then((json) => {
				for (let i = 0; i < json.servers.length; i++)
					if (json.servers[i].suuid === suuid)
						return json.servers[i];
			})
			.then((server) => resolve(server))
			.catch((err) => reject(err));
	});
}

// Reads server.properties for specified server and converts it to a JSON format.
//TODO: Update last access date
function getServerProperties(server) {
	return new Promise((resolve, reject) => {

		let jsonProperties = { properties: {} };

		// First we scan the directory to make sure it has the server.properties file
		fs.readdir(server.directory)
			.then((files) => {
				if (!files.includes('server.properties')) throw Error('Missing server.properties file!');
				else return fs.readFile(path.join(server.directory, 'server.properties'));
			})
			.then((bytes) => bytes.toString())
			.then((properties) => {
				// Split the server.properties file by newline to parse each rule

				properties.split('\n').forEach((property) => {

					// Remove any whitespace
					property = property.trim();

					// If line is blank or is a comment, ignore it
					if (property === '' || property.startsWith('#')) return;

					// Split by server.properties rule delimiter
					let splitProp = property.split('=');

					// Key is obviously the first
					let key = splitProp[0];

					// Splice to remove key (.pop() did not work) and rejoin if MOTD has = in it
					let value = splitProp.splice(1).join('=');

					// Add rule to JSON
					jsonProperties.properties[key] = value;
				});

				// Also provide our server information for the dashboard
				jsonProperties['__server__'] = server;

				// Read the Properties helper file as it contains defaults, types, and descriptions.
				return fs.readJson(PATHS.properties);
			})
			.then((propertyInfo) => jsonProperties['__info__'] = propertyInfo)
			.then(() => resolve(jsonProperties))
			.catch((err) => reject(err));
	});
}

// Builds a somewhat universal response object for any /servers/* requests
// If the request has an error, we can pass that error as the "message" so we
// can print it and attach it without messing around with overloaded functions. I think?
function buildServerResponse(s, m, d = {}) {
	if (typeof (m) === typeof (new Error)) (log.error(m), d.error = m);
	return { success: s, message: m, data: d };
}

// Gets a player UUID for whitelist/blacklist/op/etc. operations before the player has joined the server.
function getPlayerUuid(name) {
	log.info(`Attempting to grab UUID for Player '${name}`);
	return new Promise((resolve, reject) => {
		fetch(PLAYER_UUID_LINK + name)
			.then((response) => response.text())
			.then((dom) => cheerio.load(dom)('#results_id').val())
			.then((uuid) => resolve(uuid))
			.catch((err) => reject(err));
	});
}

//TODO: Add https://aikar.co/2018/07/02/tuning-the-jvm-g1gc-garbage-collector-flags-for-minecraft/ when implementing running servers
