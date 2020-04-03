/* Imports */
const path = require('path');
const fs = require('fs-extra');
const log = require('pino')({
	prettyPrint: process.env.NODE_ENV === 'production' ? false : true
});
const Sass = require('node-sass');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const express = require('express');
const app = express();


/* Constants */
const HOST = '0.0.0.0'; // ONLY change if using a different interface! If unsure, leave as 0.0.0.0
const PORT = 7767;
const DOWNLOAD_LINKS = {
	vanilla: 'https://mcversions.net/download/', // Vanilla must have version appended in format of MAJOR.MINOR.PATCH. Example: https://mcversions.net/download/1.15.2
	paper: 'https://papermc.io/ci/job/Paper-1.15/lastSuccessfulBuild/artifact/paperclip.jar', // PaperMC may need to be updated for 1.16
	bedrock: 'https://www.minecraft.net/en-us/download/server/bedrock' // Bedrock currently is NOT supported. This link is not a Direct Download. Rather, the HTML will have to be parsed to find the correct link.
};
const JAVA_VERSIONS = [
	"1.15.2",
	"1.15.1",
	"1.15",
	"1.14.4",
	"1.14.3",
	"1.14.2",
	"1.14.1",
	"1.14",
	"1.13.2",
	"1.13.1",
	"1.13",
	"1.12.2",
	"1.12.1",
	"1.12",
	"1.11.2",
	"1.11.1",
	"1.11",
	"1.10.2",
	"1.10.1",
	"1.10",
	"1.9.4",
	"1.9.3",
	"1.9.2",
	"1.9.1",
	"1.9",
	"1.8.9",
	"1.8.8",
	"1.8.7",
	"1.8.6",
	"1.8.5",
	"1.8.4",
	"1.8.3",
	"1.8.2",
	"1.8.1",
	"1.8",
	"1.7.10",
	"1.7.9",
	"1.7.8",
	"1.7.7",
	"1.7.6",
	"1.7.5",
	"1.7.4",
	"1.7.3",
	"1.7.2",
	"1.7.1",
	"1.7",
	"1.6.4",
	"1.6.2",
	"1.6.1",
	"1.5.2",
	"1.5.1",
	"1.5",
	"1.4.7",
	"1.4.6",
	"1.4.5",
	"1.4.4",
	"1.4.2",
	"1.3.2",
	"1.3.1",
	"1.2.5",
	"1.2.4",
	"1.2.3",
	"1.2.2",
	"1.2.1",
	"1.1",
	"1.0.0"
];


/* Express app setup */
app.use(express.static(path.join(__dirname, 'javascript')));
app.use('/fonts', express.static(path.join(__dirname, 'fonts')))

// Pug rendering engine
app.set('views', path.join(__dirname, 'views/pages'));
app.set('view engine', 'pug');

setRoutes();
app.listen(PORT, HOST, () => log.info(`Server hosted on ${HOST}:${PORT}`));

/* Routes */
function setRoutes() {
	app.get('/', (_req, res) => res.render('index'));
	app.get('/css', (_req, res, next) => Sass.render({ file: path.join(__dirname, 'sass/main.scss'), outputStyle: 'compressed' }, (err, result) => err ? next(err) : res.type('css').send(result.css)));

	//// PAGES
	// Returns HTML from res.render
	app.get('/pages/home', (req, res, next) => {
		let userConfig = path.join(__dirname, 'config/user/config.json');
		fs.pathExists(userConfig, (err, exists) => {
			if (err) next(err);
			else exists
				? fs.readJson(userConfig, (err, config) => {
					if (err) next(err);
					else res.render('home', config);
				})
				: fs.readJson(path.join(__dirname, 'config/__default.json'), (err, config) => {
					if (err) next(err);
					else res.render('setup', config);
				});
		});
	});

	//// SERVER MANAGEMENT
	app.get('/servers/new/:type/:version/:name', (req, res, next) => {
		let type = req.params.type;
		let version = req.params.version;
		let name = req.params.name;

		let destPath = path.join(__dirname, `servers/${name}-${type}-${version}/`);
		let destFile = `${name}-${type}-${version}.jar`;

		if (type === 'vanilla') {
			fs.ensureDir(destPath)
				.then(() => fetch(DOWNLOAD_LINKS.vanilla + version))
				.then((response) => response.text())
				.then((dom) => {
					let $ = cheerio.load(dom);
					// most likely unstable HTML parsing to get the download url
					let url = $('.downloads').html().split('href="')[1].split('" download')[0];
					return fetch(url);
				})
				.then((response) => {
					let stream = response.body.pipe(fs.createWriteStream(path.join(destPath, destFile)));
					return new Promise((resolve, reject) => {
						stream.on('finish', resolve());
						stream.on('error', (err) => reject(err));
					})
				})
				.catch((err) => log.error(err))
				.finally(() => {
					res.type('json').send({ t: type, v: version, n: name });
				});
		} else {
			res.type('json').send({ foo: 'bar' });
		}
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