//// Imports ////

/// path
// For resolving relative paths
const path = require('path');

/// child_process
// For running Jar files
const { spawn } = require('child_process');

/// os
// For determining amount of RAM system has
const os = require('os');

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

/// node-fetch
// Node version of fetch API from browsers. Used for downloading files and
// scraping websites
const fetch = require('node-fetch');

/// uuid
// For identifying servers on something other than a name
const uuid = require('uuid').v4;

/// gamedig
// For querying Minecraft servers
const Gamedig = require('gamedig');

/// klaw
// For "walking" directories
const klaw = require('klaw');

/// randomstring
// For generating rcon passwords when user specifies none
const randomstring = require('randomstring');

/// rcon
// For sending remote commands to a running server
const rcon = require('rcon');

/// process-exists
// For checking if the server process has exited before restarting
const procExists = require('process-exists');

// Express "setup"
const express = require('express');
const app = express();


//// Constants ////

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

/// DOWNLOAD_LINKS
// Collection of links for where Jar files can be downloaded from.
// TODO: Add 1.16 link to PaperMC once 1.16 servers are available
// TODO: Add support for Bedrock edition, if it ever leaves Alpha stages.
//       Current Bedrock link is also not Direct Download.
const DOWNLOAD_LINKS = {
	vanilla: 'https://mcversions.net/mcversions.json',
	paper: {
		1.15: 'https://papermc.io/ci/job/Paper-1.15/lastSuccessfulBuild/artifact/paperclip.jar',
		1.14: 'https://papermc.io/ci/job/Paper-1.14/lastSuccessfulBuild/artifact/paperclip.jar',
		1.13: 'https://papermc.io/ci/job/Paper-1.13/lastSuccessfulBuild/artifact/paperclip.jar',
		1.12: 'https://papermc.io/ci/job/Paper/lastSuccessfulBuild/artifact/paperclip.jar'
	},
	bedrock: 'https://www.minecraft.net/en-us/download/server/bedrock'
};

/// PLAYER_UUID_LINK
// Link for where to grab info on Minecraft Player UUID's. These are helpful
// for opping / whitelisting players before they have joined.
const PLAYER_UUID_LINK = 'https://playerdb.co/api/player/minecraft/';

/// MEMORY_SPLIT
// Amount of dedicated RAM for a Jar file is total free system memory divided
// by this constant. This may need to be tweaked depending on your system!
// For example, Windows users may want to lower this as Windows itself uses a
// large amount of memory. On a 16GB system with 12GB free, a value of 3 gives
// ~4GB of RAM to a single server Jar file. This may have issues with
// experimental flags!
const MEMORY_SPLIT = 3;

/// JAVA_INSTALLATIONS
// A collection of where Java may be installed on certain operating systems.
// Types are from: https://nodejs.org/api/os.html#os_os_type
// When checking against these, make sure to use os.type().toLowerCase()
// TODO: Update windows and macos
const JAVA_INSTALLATIONS = {
	linux: '/usr/lib/jvm/', // All Linux-based systems
	windows_nt: '', // Microsoft Windows based systems
	darwin: '' // Apple macOS
};

/// JAVA_DOWNLOAD
// A list of links to download Java for a certain platform
const JAVA_DOWNLOAD = 'https://www.java.com/en/download/manual.jsp';


//// Global variables //// (Keep this section as small as possible)

/// ACTIVE_SERVERS
// Stores the subprocess object created from "spawning" a Jar file.
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

// Load server configs and import any active servers
refreshActiveServers()
	// Run the app!
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
			.then((config) => res.render(Object.keys(config).length !== 0 ? 'home' : 'setup', config))
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
		getServerFromConfig(req.params.suuid)
			.then((server) => getServerProperties(server))
			.then((config) => res.render('server', config))
			.catch((err) => next(err));
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
		let type = req.params.type;
		let version = req.params.version;
		let name = req.params.name;
		let suuid = uuid();

		let destPath = path.join(__dirname, `../mc-servers/${name}-${type}-${version}/`);
		let destFile = `${name}-${type}-${version}.jar`;
		let dest = path.join(destPath, destFile);

		// If the path already exists, then it probably means there is alread
		// a server with the same name
		fs.pathExists(destPath)
			.then((exists) => {
				if (exists) throw Error('Path already exists!');
				else return;
			})

			// Create the path so we can download the Jar file
			.then(() => fs.ensureDir(destPath))

			// PaperMC has direct download links; Vanilla does not, so we need
			// an extra step to get the DDL link.
			.then(() => type === 'vanilla' ? getVanillaUrl(version) : DOWNLOAD_LINKS.paper[version])
			.then((url) => downloadJar(url, dest))

			// Run the Jar for the first time, ommiting the Wait flag because
			// we want to wait for it to generate some files.
			.then(() => runJar(destPath, destFile, suuid))

			// This is why we wait for ^ to exit: we need to "sign" the EULA.
			// It might be against Mojang's ToS to do this in code, but we
			// should be fine. Right ?!
			.then(() => signEula(path.join(destPath, 'eula.txt')))

			// Write a config to USER_CONFIG with our brand new shiny server!
			.then(() => writeUserConfig(name, version, type, suuid, destPath, destFile))

			// Read/write server.properties to ensure query and RCON are
			// enabled by default
			.then(() => fs.readdir(destPath))
			.then((files) => {
				if (!files.includes('server.properties')) throw Error('Missing server.properties file!');
				else return fs.readFile(path.join(destPath, 'server.properties'));
			})
			.then((bytes) => bytes.toString())
			.then((properties) => writeServerProperties(suuid, properties))

			// Respond to the client
			.then(() => res.send(buildServerResponse(true, '')))
			.catch((err) => res.send(buildServerResponse(false, err)));
	});

	/// Update server.properties
	// Probably should do this as POST but Express wanted JSON data for POST
	// which the client does not send for this function. This should be fine
	// since I highly doubt that anyones server.properties will be more than 8MB!
	app.get('/servers/update/server.properties/:suuid/:data', (req, res, _next) => {
		let suuid = req.params.suuid;

		// for the love of god do NOT change this
		let properties = Buffer.from(req.params.data, 'base64').toString();

		writeServerProperties(suuid, properties)
			.then(() => res.send(buildServerResponse(true, 'Success!')))
			.catch((err) => res.send(buildServerResponse(false, err)));
	});

	/// Start server
	// Start a server with the given suuid. Fails to start if the server is
	// already running.
	app.get('/servers/start/:suuid', (req, res, _next) => {
		let suuid = req.params.suuid;

		if (ACTIVE_SERVERS.hasOwnProperty(suuid))
			return res.send(buildServerResponse(false, Error('Server already running!')));

		startServer(suuid)
			.then(() => res.send(buildServerResponse(true, 'Server started!')))
			.catch((err) => res.send(buildServerResponse(false, err)));
	});

	/// Stop server
	// Attempts to stop the server by sending the 'stop' command to the server
	// process using RCON.
	app.get('/servers/stop/:suuid', (req, res, _next) => {
		let suuid = req.params.suuid;

		// Obviously we can't stop the server if it isn't running yet
		if (!ACTIVE_SERVERS.hasOwnProperty(suuid))
			return res.send(buildServerResponse(false, Error('Server not running!')));

		// Attempt to stop the server with RCON (this also removes it from
		// ACTIVE_SERVERS)
		stopServer(suuid)
			.then((response) => res.send(buildServerResponse(true, response)))
			.catch((err) => res.send(buildServerResponse(false, err)));
	});

	/// Restart server
	// Attempts to stop the running server, wait for it's process ID to exit,
	// then start the server again.
	app.get('/servers/restart/:suuid', (req, res, _next) => {
		let suuid = req.params.suuid;

		// Obviously we can't restart the server if it isn't running yet
		if (!ACTIVE_SERVERS.hasOwnProperty(suuid))
			return res.send(buildServerResponse(false, Error('Server not running!')));

		restartServer(suuid)
			.then(() => res.send(buildServerResponse(true, 'Server restarted!')))
			.catch((err) => res.send(buildServerResponse(false, err)));
	})

	/// Query a (hopefully running) server
	// Query a server to check if it is online using Gamedig:
	// https://github.com/sonicsnes/node-gamedig
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
			.then(() => queryServer(host, port))
			.then((state) => res.send(buildServerResponse(true, 'Online', state)))
			// Print a debug log and DON'T pass the actual error since the
			// console would be overcrowded otherwise
			.catch((err) => (log.debug(err), res.send(buildServerResponse(false, err.message, err))));
	});


	//// HTTP Errors ////

	/// HTTP 404
	app.use((_req, res) => res.status(404).send('404 NOT FOUND'));

	/// HTTP 500
	app.use((err, _req, res, _next) => (log.error(err.stack), res.status(500).send('500 SERVER ERROR')));
}

//// Functions ////

// Refresh any active Minecraft servers when McSm is launched. This helps
// because if McSm crashes, Minecraft servers stay online. ACTIVE_SERVERS won't
// have a subprocess object though.
function refreshActiveServers() {
	return new Promise((resolve, reject) => {
		let numServers;
		let count = 0;
		fs.pathExists(USER_CONFIG)
			.then((exists) => {
				if (!exists) throw Error('No valid User Config found!');
				else return;
			})
			.then(() => fs.readJson(USER_CONFIG))
			.then((config) => {
				numServers = config.servers.length;
				config.servers.forEach((server) => {
					getServerProperties(server)
						.then((p) => queryServer(p.properties['server-ip'], p.properties['query.port']))
						.then((_state) => {
							count++;
							// Usually we would NOT use Sync, but since this is
							// only run at the start it is fine.
							ACTIVE_SERVERS[server.suuid] = fs.readFileSync(path.join(server.directory, '.pid')).toString().trim();
						})
						.catch((err) => {
							log.warn(err);
							log.warn('The above warning is OK! It simply means the server is not running yet.');
							count++;
						})
						.finally(() => count == numServers && resolve());
				});
			})
			.catch((err) => reject(err));
	});
}

// Render the Sass files (scss) to regular CSS
function renderSass(res, next) {
	Sass.render({ file: PATHS.sass, outputStyle: 'compressed' }, (err, result) => err ? next(err) : res.type('css').send(result.css));
}

// Scrape the download URL for Vanilla Minecraft
// from mcversions.net/mcversions.json
function getVanillaUrl(version) {
	return new Promise((resolve, reject) => {
		fetch(DOWNLOAD_LINKS.vanilla)
			.then((response) => response.json())
			.then((json) => json.stable[version].server)
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
// Note on useExperimentalFlags: The flags come from this link:
// https://aikar.co/2018/07/02/tuning-the-jvm-g1gc-garbage-collector-flags-for-minecraft/
// They may cause issues on some versions of Minecraft (the page says they DO
// work on 1.8-1.15+). If there are errors with versions lower than 1.8, open a
// pull request on the GitHub repo for this project OR set useExperimentalFlags
// to false
function runJar(directory, jar, suuid, wait = true, useExperimentalFlags = true) {
	log.info(`Running Jar file in ${directory}`);
	return new Promise((resolve, reject) => {

		// Set up the subprocess
		let java;
		let bin = 'java';
		let args = ['-jar', jar, 'nogui'];
		let options = { cwd: directory, windowsHide: true, detached: true };

		getJavaPath()
			.then((javaPath) => bin = javaPath)
			.then(() => getJavaVersionFromBin(bin))
			.then((version) => useExperimentalFlags ? buildExperimentalFlags(version).concat(args) : args)
			.then((args) => spawn(bin, args, options))
			.then((spawnedProcess) => java = spawnedProcess)
			.then(() => fs.ensureFile(path.join(directory, '.pid')))
			.then(() => fs.writeFile(path.join(directory, '.pid'), java.pid))
			.then(() => {
				ACTIVE_SERVERS[suuid] = java.pid;

				// Print stdout and stderr
				java.stdout.on('data', (out) => log.info(`[${java.pid}] stdout: ${out.toString().trim()}`));
				java.stderr.on('data', (err) => log.error(`[${java.pid}] stderr: ${err.toString().trim()}`));

				// This is only called if we wait for the server to exit.
				// This typically only happens on first time run to generate
				// the EULA and server.properties
				java.on('close', (exitCode) => {

					// Make sure we delete it from the active servers since it
					// is no longer active
					delete ACTIVE_SERVERS[suuid];

					let msg = `Child process [${java.pid}] exited with code ${exitCode}`;
					wait ? (exitCode != 0 ? reject(log.warn(msg)) : resolve(log.info(msg))) : (exitCode != 0 ? log.warn(msg) : log.info(msg));
				});
				if (!wait) resolve();
			})
			.catch((err) => {
				log.error(err);
				if (Object(err).toString().includes('No java')) reject(`Please visit this link for Java installation instructions: ${JAVA_DOWNLOAD}`);
				if (Object(err).toString().includes('Wrong Java')) reject(`Wrong Java version; please install Java 8: ${JAVA_DOWNLOAD}`);
				else reject(err);
			});
	});
}

// Starts a server
function startServer(suuid) {
	return new Promise((resolve, reject) => {
		getServerFromConfig(suuid)
			.then((server) => runJar(server.directory, server.jarFile, suuid, false))
			.then(() => resolve())
			.catch((err) => reject(err));
	});
}

// Sends an RCON command to stop a running server
function stopServer(suuid) {
	log.info(`Stopping server ${suuid}`)
	return new Promise((resolve, reject) => {
		sendRconCommand(suuid, 'stop')
			.then((response) => {
				log.info(`RCON reply from server ${suuid}: ${response}`);
				delete ACTIVE_SERVERS[suuid];
				return response;
			})
			.then((response) => resolve(response))
			.catch((err) => reject(err));
	});
}

// Restarts the server
function restartServer(suuid) {
	log.info(`Restarting server ${suuid}`);
	return new Promise((resolve, reject) => {
		let pid = ACTIVE_SERVERS[suuid];
		stopServer(suuid)
			.then(() => _waitForExit(pid))
			.then(() => startServer(suuid))
			.then(() => resolve())
			.catch((err) => reject(err));
	});

	// Uses process-exit to wait for the processt to... exit.
	function _waitForExit(pid) {
		return new Promise(async (resolve, reject) => {
			try {
				// First we assume that the process is already running (it
				// should be if we made it this far)
				let exists = true;

				// While it exists, simply keep checking until it does not
				// exist anymore
				while (exists) {
					log.debug(`Waiting for process [${pid}] to exit...`);

					// Docs for process-exists use async/await, I might update
					// to Promise in the future if possible

					// map is a map of all processes matching pid and java. I
					// definitely could have misread the docs (very lacking!)
					// so I may not need to use .all and 'java'. However, it
					// works right now so I'm not too concerned.
					let map = await procExists.all([pid, 'java']);
					exists = map.get(pid);
				}
				log.info(`Process [${pid}] has exited!`);
				resolve();
			} catch (err) {
				reject(err);
			}
		});
	}
}

// Send an RCON command to the specified server
function sendRconCommand(suuid, command) {
	return new Promise((resolve, reject) => {
		getServerFromConfig(suuid)
			.then((server) => getServerProperties(server))
			.then((p) => ({
				host: p.properties['server-ip'] !== '' ? p.properties['server-ip'] : '0.0.0.0',
				port: p.properties['rcon.port'],
				password: p.properties['rcon.password']
			}))
			.then((params) => {
				let conn = new rcon(params.host, params.port, params.password);
				conn.connect();
				conn.on('error', (err) => log.warn(err));
				conn.on('auth', () => conn.send(command));
				conn.on('response', (response) => {
					conn.disconnect();
					resolve(response);
				});
			})
			.catch((err) => reject(err));
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

// Get server metadata from USER_CONFIG. Server metadata is information only
// relevant to McSm.
function getServerFromConfig(suuid) {
	return new Promise((resolve, reject) => {
		fs.readJson(USER_CONFIG)
			.then((json) => {
				for (let i = 0; i < json.servers.length; i++)
					if (json.servers[i].suuid === suuid)
						return json.servers[i];
				throw Error('No such server exists!');
			})
			.then((server) => resolve(server))
			.catch((err) => reject(err));
	});
}

// Reads server.properties for specified server and converts it to a JSON
// format.
// TODO: Update last access date
// TODO: This ^ todo is in the completely wrong spot
function getServerProperties(server) {
	return new Promise((resolve, reject) => {

		let jsonProperties = { properties: {} };

		// First we scan the directory to make sure it has the
		// server.properties file
		fs.readdir(server.directory)
			.then((files) => {
				if (!files.includes('server.properties')) throw Error('Missing server.properties file!');
				else return fs.readFile(path.join(server.directory, 'server.properties'));
			})
			.then((bytes) => bytes.toString())
			.then((properties) => {
				// Split the server.properties file by newline to parse each
				// rule

				properties.split('\n').forEach((property) => {

					// Remove any whitespace
					property = property.trim();

					// If line is blank or is a comment, ignore it
					if (property === '' || property.startsWith('#')) return;

					// Split by server.properties rule delimiter
					let splitProp = property.split('=');

					// Key is obviously the first
					let key = splitProp[0];

					// Splice to remove key (.pop() did not work) and rejoin if
					// MOTD has = in it
					let value = splitProp.splice(1).join('=');

					// Add rule to JSON
					jsonProperties.properties[key] = value;
				});

				// Also provide our server information for the dashboard
				jsonProperties['__server__'] = server;

				// Read the Properties helper file as it contains defaults,
				// types, and descriptions.
				return fs.readJson(PATHS.properties);
			})
			.then((propertyInfo) => jsonProperties['__info__'] = propertyInfo)
			.then(() => resolve(jsonProperties))
			.catch((err) => reject(err));
	});
}

// Write server.properties file and force enable query, rcon, and set an rcon
// password if the user did not specify one.
function writeServerProperties(suuid, properties) {
	log.info(`Writing server.properties for ${suuid}`);
	return new Promise((resolve, reject) => {

		// Force enable query and rcon
		properties = properties.replace('enable-query=false', 'enable-query=true');
		properties = properties.replace('enable-rcon=false', 'enable-rcon=true');

		// Add an rcon password if needed
		let splitProp = properties.split('\n');
		for (let i = 0; i < splitProp.length; i++)
			if (splitProp[i].trim() === 'rcon.password=')
				properties = properties.replace('rcon.password=', `rcon.password=${randomstring.generate(12)}`);

		getServerFromConfig(suuid)
			.then((server) => fs.writeFile(path.join(server.directory, 'server.properties'), properties))
			.then(() => resolve())
			.catch((err) => reject(err));
	});
}

// Builds a somewhat universal response object for any /servers/* requests
// If the request has an error, we can pass that error as the "message" so we
// can print it and attach it without messing around with overloaded functions.
// I think ?
function buildServerResponse(s, m, d = {}) {
	if (typeof (m) === typeof (Object)) m = Object(m).toString();
	return { success: s, message: m, data: d };
}

// Send a GameSpy4 query to the specified Minecraft server
function queryServer(host, port) {
	return new Promise((resolve, reject) => {
		Gamedig.query({
			type: 'minecraft',
			host: host.trim() === '' || host == null ? '0.0.0.0' : host,
			port: port
		})
			.then((state) => resolve(state))
			.catch((err) => (log.debug(err), reject(err)));
	})
}

// Builds a set of experimental flags to run the JVM. Massive thanks to:
// https://aikar.co/2018/07/02/tuning-the-jvm-g1gc-garbage-collector-flags-for-minecraft/
function buildExperimentalFlags(version) {

	// Get total and free memory in Gigabytes
	let RAM = {
		system: os.totalmem() / 1e9,
		free: os.freemem() / 1e9
	};
	let dedicatedRam = Math.round(RAM.free / MEMORY_SPLIT);

	// Set up inital flags
	let ramFlag = `-Xms${dedicatedRam}G -Xmx${dedicatedRam}G`;
	let flags = '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:-OmitStackTraceInFastThrow -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=8 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:MaxTenuringThreshold=1 -Dusing.aikars.flags=true -Daikars.new.flags=true';

	// Adjust flags for more than 12GB dedicated RAM
	if (dedicatedRam > 12) {
		flags = flags.replace('-XX:G1NewSizePercent=30', '-XX:G1NewSizePercent=40');
		flags = flags.replace('-XX:G1MaxNewSizePercent=40', '-XX:G1MaxNewSizePercent=50');
		flags = flags.replace('-XX:G1HeapRegionSize=8M', '-XX:G1HeapRegionSize=16M');
		flags = flags.replace('-XX:G1ReservePercent=20', '-XX:G1ReservePercent=15');
		flags = flags.replace('-XX:InitiatingHeapOccupancyPercent=15', '-XX:InitiatingHeapOccupancyPercent=20');
	}
	// Improve GC logging for certain Java version
	if (version >= 8 && version <= 10) flags += ' -Xloggc:gc.log -verbose:gc -XX:+PrintGCDetails -XX:+PrintGCDateStamps -XX:+PrintGCTimeStamps -XX:+UseGCLogFileRotation -XX:NumberOfGCLogFiles=5 -XX:GCLogFileSize=1M';
	if (version == 8) flags += ' -XX:+UseLargePagesInMetaspace';

	// NOTE: java 11+ is purposely broken as I cannot guarantee stability
	if ('java=11+' === 'this will NOT work') flags += ' -Xlog:gc*:logs/gc.log:time,uptime:filecount=5,filesize=1M';

	return `${ramFlag} ${flags}`.split(' ');
}

// Get the path of Java 8 installed on the system (hopefully)
function getJavaPath() {
	return new Promise((resolve, reject) => {
		let system = os.type().toLowerCase();
		fs.pathExists(JAVA_INSTALLATIONS[system])
			.then((exists) => {
				if (!exists) throw Error('No java installation found!');
				else return fs.readdir(JAVA_INSTALLATIONS[system])
			})
			.then((list) => {
				for (let i = 0; i < list.length; i++)
					if (list[i].includes('-8-')) // Matching -8- may break in the future
						return list[i];
			})
			.then((java8) => path.join(JAVA_INSTALLATIONS[system], java8))
			.then((fullPath) => walkDir(fullPath))
			.then((files) => {
				for (let i = 0; i < files.length; i++)
					if (files[i].path.endsWith('/java')) return files[i];
			})
			.then((file) => resolve(file.path))
			.catch((err) => reject(err));
	});
}

function walkDir(dir) {
	return new Promise((resolve, reject) => {
		let items = [];
		klaw(dir, { depthLimit: 4 }) // Might be too much or too little!
			.on('data', (item) => items.push(item))
			.on('end', () => resolve(items))
			.on('error', (err, item) => reject(err));
	})
}

// Run the version command on the specified java binary. Version 8 is optimal.
function getJavaVersionFromBin(bin) {
	return new Promise((resolve, reject) => {
		let args = ['-version'];
		let options = { windowsHide: true, detached: true };
		let java = spawn(bin, args, options);

		let output = '';

		// For some reason, -version prints to stderr. Because of this, we
		// can't print errors so instead we append it to output.
		java.stdout.on('data', (out) => output += out.toString().trim());
		java.stderr.on('data', (err) => output += err.toString().trim());
		java.on('close', (exitCode) => exitCode != 0 ? reject() : resolve(output.includes('1.8.') ? 8 : -1));
	})
}

// Gets a player UUID for whitelist/blacklist/op/etc. operations before the
// player has joined the server.
function getPlayerUuid(name) {
	log.info(`Attempting to grab UUID for Player '${name}`);
	return new Promise((resolve, reject) => {
		fetch(PLAYER_UUID_LINK + name)
			.then((response) => response.json())
			.then((json) => {
				if (json.error) throw Error(json.message);
				else return json.data.player.id;
			})
			.then((puuid) => resolve(puuid))
			.catch((err) => reject(err));
	});
}

// TODO: Log file monitoring: https://www.hosthorde.com/forums/resources/understanding-minecraft-server-log-files.75/