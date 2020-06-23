const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const moment = require('moment');
const rcon = require('rcon');
const Gamedig = require('gamedig');
const log = require('pino')({
	prettyPrint: process.env.NODE_ENV === 'production' ? false : true,
	timestamp: () => `,"time": ${moment().format('YYYY-MM-DD hh:mm:ss A')} `
});

const USER_CONFIG = path.join(__dirname, '..', 'config/user/config.json');
const OS_TYPES = {
	linux: 0,
	windows_nt: 1,
	darwin: 2
};

/*
  - start
  - stop
  - restart
  - whitelist
  - blacklist
  - op
  - Write properties JSON > MC DONE
  - Read properties MC > JSON DONE
  - query DONE
  - eula DONE
*/

class Minecraft {
	constructor(suuid) {
		this.suuid = suuid;
	}

	getConfig() {
		return new Promise((resolve, reject) => {
			fs.readJson(USER_CONFIG)
				.then((json) => {
					for (let i = 0; i < json.servers.length; i++)
						if (json.servers[i].suuid === this.suuid)
							resolve(json.servers[i]);
					throw Error('No such server exists!');
				})
				.catch((err) => reject(err));
		});
	}

	start() {
		return new Promise((resolve, reject) => {
			this.getConfig()
				.then((config) => runJar(config.directory, config.jar, false))
				.then(resolve())
				.catch((err) => reject(err));
		});
	}

	stop() {
		return new Promise((resolve, reject) => {
			this.readProperties()
				.then((p) => ({ host: p.properties['server-ip'], port: p.properties['rcon.port'], password: p.properties['rcon.password'] }))
				.then((conn) => sendRconCommand(conn.host, conn.port, conn.password, 'stop'));
		});
	}

	restart() {
		// stop, wait, start
	}

	whitelist() {

	}

	blacklist() {

	}

	op() {

	}

	readProperties() {
		return new Promise((resolve, reject) => {
			let server;
			this.getConfig()
				.then((config) => server = config)
				.then(fs.readdir(server.directory))
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

	writeProperties(properties) {
		return new Promise((resolve, reject) => {
			// Force enable query and rcon
			properties = properties.replace('enable-query=false', 'enable-query=true');
			properties = properties.replace('enable-rcon=false', 'enable-rcon=true');

			// Add an rcon password if needed
			let splitProp = properties.split('\n');
			for (let i = 0; i < splitProp.length; i++)
				if (splitProp[i].trim() === 'rcon.password=')
					properties = properties.replace('rcon.password=', `rcon.password=${randomstring.generate(12)}`);

			this.getConfig()
				.then((config) => fs.writeFile(path.join(config.directory, 'server.properties'), properties))
				.then(resolve())
				.catch((err) => reject(err));
		});
	}

	signEula() {
		return new Promise((resolve, reject) => {
			let eulaPath;
			this.getConfig()
				.then((config) => eulaPath = path.join(config.directory, 'eula.txt'))
				.then(fs.readFile(eulaPath))
				.then((bytes) => (bytes.toString()))
				.then((text) => text.replace('false', 'true'))
				.then((signed) => fs.writeFile(eulaPath, signed))
				.then(resolve())
				.catch((err) => reject(err));
		});
	}

	query() {
		return new Promise((resolve, reject) => {
			this.readProperties()
				.then((p) => ({ host: p.properties['server-ip'], port: p.properties['query.port'] }))
				.then((conn) =>
					Gamedig.query({
						type: 'minecraft',
						host: conn.host.trim() === '' || conn.host == null ? '0.0.0.0' : conn.host,
						port: conn.port
					}))
				.then((state) => resolve(state))
				.catch((err) => (log.debug(err), reject(err)));
		});
	}

	//TODO: isRunning()
}

function sendRconCommand(host, port, password, command) {
	return new Promise((resolve, reject) => {
		host = host.trim() = '' || host == null ? '0.0.0.0' : host;

		let conn = new rcon(host, port, password);
		conn.connect();
		conn.on('error', (err) => log.warn(err));
		conn.on('auth', () => conn.send(command));
		conn.on('response', (response) => {
			conn.disconnect();
			resolve(response);
		});
	});
}

//#region java

function runJar(directory, jar, wait = true, useExperimentalFlags = true) {
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
				//ACTIVE_SERVERS[suuid] = java.pid;

				// Print stdout and stderr
				java.stdout.on('data', (out) => log.info(`[${java.pid}] stdout: ${out.toString().trim()}`));
				java.stderr.on('data', (err) => log.error(`[${java.pid}] stderr: ${err.toString().trim()}`));

				// This is only called if we wait for the server to exit.
				// This typically only happens on first time run to generate
				// the EULA and server.properties
				java.on('close', (exitCode) => {

					// Make sure we delete it from the active servers since it
					// is no longer active
					//delete ACTIVE_SERVERS[suuid];

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

function getJavaPath() {
	return new Promise((resolve, reject) => {
		let system = os.type().toLowerCase();
		if (system = OS_TYPES.windows_nt) {
			getJavaVersionFromBin('java')
				.then((version) => {
					if (version) resolve('java');
					else throw Error('Wrong Java version; please install Java 8');
				})
				.catch((err) => reject(err));
		} else {
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
		}
	});
}

function walkDir(dir) {
	return new Promise((resolve, reject) => {
		let items = [];
		klaw(dir, { depthLimit: 4 }) // Might be too much or too little!
			.on('data', (item) => items.push(item))
			.on('end', () => resolve(items))
			.on('error', (err, item) => reject(err));
	});
}

function getJavaVersionFromBin() {
	return new Promise((resolve, reject) => {
		let args = ['-d64', '-version'];
		let options = { windowsHide: true, detached: true };
		let java = spawn(bin, args, options);

		let output = '';

		// For some reason, -version prints to stderr. Because of this, we
		// can't print errors so instead we append it to output.
		java.stdout.on('data', (out) => output += out.toString().trim());
		java.stderr.on('data', (err) => output += err.toString().trim());
		java.on('close', (exitCode) => exitCode != 0 ? reject(output) : resolve(output.includes('1.8.') ? 8 : -1));
	});
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

//#endregion

