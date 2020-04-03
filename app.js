/* Imports */
const path = require('path');
const log = require('pino')({
	prettyPrint: process.env.NODE_ENV === 'production' ? false : true
});
const express = require('express');
const app = express();

/* Constants */
const HOST = '0.0.0.0'; // ONLY change if using a different interface! If unsure, leave as 0.0.0.0
const PORT = 7767;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

setRoutes();
app.listen(PORT, HOST, () => log.info(`Server hosted on ${HOST}:${PORT}`));

/* Routes */
function setRoutes() {
	app.get('*', (req, res) => res.send('Hello!'));
}