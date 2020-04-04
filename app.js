/* Imports */
const path = require('path');
const fs = require('fs-extra');
const log = require('pino')({ prettyPrint: process.env.NODE_ENV === 'production' ? false : true });
const Sass = require('node-sass');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { spawn } = require('child_process');
const moment = require('moment');

// Express
const express = require('express');
const app = express();


/* Constants */
const HOST = '0.0.0.0'; // ONLY change if using a different interface! If unsure, leave as 0.0.0.0
const PORT = 7767;
const USER_CONFIG = path.join(__dirname, 'config/user/config.json');
const DOWNLOAD_LINKS = {
	vanilla: 'https://mcversions.net/download/', // Vanilla must have version appended in format of MAJOR.MINOR.PATCH. Example: https://mcversions.net/download/1.15.2
	paper: {
		// TODO: Add 1.16 when it is available
		1.15: 'https://papermc.io/ci/job/Paper-1.15/lastSuccessfulBuild/artifact/paperclip.jar',
		1.14: 'https://papermc.io/ci/job/Paper-1.14/lastSuccessfulBuild/artifact/paperclip.jar',
		1.13: 'https://papermc.io/ci/job/Paper-1.13/lastSuccessfulBuild/artifact/paperclip.jar',
		1.12: 'https://papermc.io/ci/job/Paper/lastSuccessfulBuild/artifact/paperclip.jar'
	},
	// TODO: Bedrock currently is NOT supported. This link is not a Direct Download. Rather, the HTML will have to be parsed to find the correct link.
	bedrock: 'https://www.minecraft.net/en-us/download/server/bedrock'
};
const UUID_LINK = 'https://mcuuid.net/?q=';


/* Express app setup */
app.use(express.static(path.join(__dirname, 'static')));
app.use('/fonts', express.static(path.join(__dirname, 'fonts')))

// Tell Express to render using Pug.js (requires pug package from npm)
app.set('views', path.join(__dirname, 'views/pages'));
app.set('view engine', 'pug');

setRoutes();
app.listen(PORT, HOST, () => log.info(`Server hosted on ${HOST}:${PORT}`));


/* Routes */
function setRoutes() {
	//// Standard routes ////
	app.get('/', (_req, res) => res.render('index'));
	app.get('/css', (_req, res, next) => renderSass(res, next));

	//// Page routes ////
	// Returns HTML from res.render
	app.get('/pages/home', (_req, res, next) => {
		fs.pathExists(USER_CONFIG, (err, exists) => {
			err ? next(err) : fs.readJson(exists ? USER_CONFIG : path.join(__dirname, 'config/__default.json'), (err, config) => {
				err ? next(err) : res.render(exists ? 'home' : 'setup', config);
			});
		});
	});

	//// Server management routes //// MUST return json type
	// NEW SERVER
	app.get('/servers/new/:type/:version/:name', (req, res, next) => {
		let type = req.params.type;
		let version = req.params.version;
		let name = req.params.name;

		let destPath = path.join(__dirname, `servers/${name}-${type}-${version}/`);
		let destFile = `${name}-${type}-${version}.jar`;
		let dest = path.join(destPath, destFile);

		let success = false;

		fs.ensureDir(destPath)
			.then(() => type === 'vanilla' ? getVanillaUrl(version) : DOWNLOAD_LINKS.paper[version])
			.then((url) => downloadJar(url, dest))
			.then(() => runJar(destPath, destFile))
			.then(() => signEula(path.join(destPath, 'eula.txt')))
			.then(() => writeNewConfig(name, version, type, destPath, destFile))
			.then(() => success = true)
			.catch((err) => log.error(err))
			.finally(() => res.type('json').send({ success: success }));
	});


	//// ERRORS
	// HTTP 404
	app.use((_req, res) => res.status(404).send('404 NOT FOUND'));
	// HTTP 500
	app.use((err, _req, res, _next) => {
		log.error(err.stack);
		res.status(500).send('500 SERVER ERROR');
	});
}

// Render the Sass files (scss) to regular CSS
function renderSass(res, next) {
	// personal note for dev: DO NOT move this back into setRoutes. I know you want to, but don't
	Sass.render({
		file: path.join(__dirname, 'sass/main.scss'),
		outputStyle: 'compressed'
	}, (err, result) => {
		err ? next(err) : res.type('css').send(result.css)
	});
}

// Scrape the download URL for Vanilla Minecraft from mcversions.net
function getVanillaUrl(version) {
	return new Promise((resolve, reject) => {
		fetch(DOWNLOAD_LINKS.vanilla + version)
			.then((response) => response.text())
			// The site doesn't have DOM ID's which makes parsing the correct link difficult, sketchy string splits it is!
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

// Runs the specified Jar file TODO: Runtime options
function runJar(directory, jar) {
	log.info(`Running Jar file in ${directory}`);
	return new Promise((resolve, reject) => {
		let java = spawn('java', ['-jar', jar], { cwd: directory, windowsHide: true });
		java.stdout.on('data', (data) => log.info(`stdout: ${data}`));
		java.stderr.on('data', (data) => log.error(`stderr: ${data}`));
		java.on('close', (code) => {
			let msg = `Child process exited with code ${code}`;
			code != 0
				? reject(log.warn(msg))
				: resolve(log.info(msg));
		});
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

// Creates a new USER_CONFIG file. This should only happen on first time setup
function writeNewConfig(name, version, type, directory, jarFile) {
	log.info(`Writing NEW configuration to ${USER_CONFIG}`);
	return new Promise((resolve, reject) => {
		let newConfig = { "servers": [] };
		let server = { // JSON object, not JavaScript object!
			"name": name,
			"version": version,
			"type": type,
			"directory": directory,
			"jarFile": jarFile,
			"lastAccess": moment().valueOf() // For sorting
		};
		newConfig.servers.push(server);
		fs.ensureFile(USER_CONFIG)
			.then(() => fs.writeJson(USER_CONFIG, newConfig, { spaces: '\t' }))
			.then(() => log.info('Done writing config!'))
			.then(() => resolve())
			.catch((err) => reject(err));
	});
}

// Gets a player UUID for whitelist/blacklist etc. operations before the player has joined the server
function getPlayerUuid(name) {
	log.info(`Attempting to grab UUID for Player '${name}`);
	return new Promise((resolve, reject) => {
		fetch(UUID_LINK + name)
			.then((response) => response.text())
			.then((dom) => cheerio.load(dom)('#results_id').val())
			.then((uuid) => resolve(uuid))
			.catch((err) => reject(err));
	});
}

//TODO: Add https://aikar.co/2018/07/02/tuning-the-jvm-g1gc-garbage-collector-flags-for-minecraft/ when implementing running servers