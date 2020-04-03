/* Imports */
const path = require('path');
const log = require('pino')({
	prettyPrint: process.env.NODE_ENV === 'production' ? false : true
});
const Sass = require('node-sass');
const express = require('express');
const app = express();


/* Constants */
const HOST = '0.0.0.0'; // ONLY change if using a different interface! If unsure, leave as 0.0.0.0
const PORT = 7767;
const DOWNLOAD_LINKS = {
	vanilla: 'https://mcversions.net/download', // Vanilla must have version appended in format of MAJOR.MINOR.PATCH. Example: https://mcversions.net/download/1.15.2
	paper: 'https://papermc.io/ci/job/Paper-1.15/lastSuccessfulBuild/artifact/paperclip.jar', // PaperMC may need to be updated for 1.16
	bedrock: 'https://www.minecraft.net/en-us/download/server/bedrock' // Bedrock currently is NOT supported. This link is not a Direct Download. Rather, the HTML will have to be parsed to find the correct link.
};


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

	// HTTP 404
	app.use((_req, res) => res.status(404).send('404 NOT FOUND'));

	// HTTP 500
	app.use((err, _req, res, _next) => {
		log.error(err.stack);
		res.status(500).send('500 SERVER ERROR');
	});
}