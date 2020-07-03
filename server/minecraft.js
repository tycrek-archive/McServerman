//#region imports

/// fs-extra
// A better fs module. Includes more functions and adds Promises to existing fs functions
const fs = require('fs-extra');

/// os
// For determining amount of RAM system has
const os = require('os');

/// path
// For resolving relative paths
const path = require('path');

/// child_process
// For running Jar files
const { spawn } = require('child_process');

/// moment
// For tracking usage and other stuff like Timestamp manipulation
const moment = require('moment');

/// rcon
// For sending remote commands to a running server
const rcon = require('rcon');

/// gamedig
// For querying Minecraft servers
const Gamedig = require('gamedig');

/// process-exists
// For checking if the server process has exited before restarting
const procExists = require('process-exists');

/// uuid
// For identifying servers on something other than a name
const uuid = require('uuid').v4;

/// klaw
// For "walking" directories
const klaw = require('klaw');

/// randomstring
// For generating rcon passwords when user specifies none
const randomstring = require('randomstring');

/// node-fetch
// Node version of fetch API from browsers. Used for downloading files and scraping websites
const fetch = require('node-fetch');

/// adm-zip
// zip/unzip world folders
const AdmZip = require('adm-zip');

/// pino (depends on: pino-pretty)
// Good log tool (common log levels are info, warn, error, etc.) Note: don't change timestamp
const log = require('pino')({
	prettyPrint: process.env.NODE_ENV === 'production' ? false : true,
	timestamp: () => `,"time": ${moment().format('YYYY-MM-DD hh:mm:ss A')} `
});

//#endregion

//#region constants

/// MEMORY_SPLIT
// Amount of dedicated RAM for a Jar file is total free system memory divided
// by this constant. This may need to be tweaked depending on your system!
// For example, Windows users may want to lower this as Windows itself uses a
// large amount of memory. On a 16GB system with 12GB free, a value of 3 gives
// ~4GB of RAM to a single server Jar file. This may have issues with
// experimental flags!
const MEMORY_SPLIT = 3;

/// USER_CONFIG
// Poorly named yet very important variable. Path to where McSm's server list
// is. Because of its importance, it will NOT go into the PATHS constant.
const USER_CONFIG = path.join(__dirname, '..', 'config/user/config.json');

/// OS_TYPES
const OS_TYPES = {
	linux: 0,
	windows_nt: 1,
	darwin: 2
};

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

/// JAVA_DOWNLOAD
// A list of links to download Java for a certain platform
const JAVA_DOWNLOAD = 'https://www.java.com/en/download/manual.jsp';

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

/// DOWNLOAD_LINKS
// Collection of links for where Jar files can be downloaded from.
// TODO: Add support for Bedrock edition, if it ever leaves Alpha stages.
// Current Bedrock link is also not Direct Download.
const DOWNLOAD_LINKS = {
	vanilla: 'https://mcversions.net/mcversions.json',
	paper: 'https://papermc.io/api/v1/paper/~~v~~/latest/download',
	bedrock: 'https://www.minecraft.net/en-us/download/server/bedrock'
};

/// PLAYER_UUID_LINK
// Link for where to grab info on Minecraft Player UUID's. These are helpful
// for opping / whitelisting players before they have joined.
const PLAYER_UUID_LINK = 'https://playerdb.co/api/player/minecraft/';

/// BAN_TIMESTAMP_FORMAT
// Timestamp for formatting "created" in player/ip ban files
const BAN_TIMESTAMP_FORMAT = 'YYYY-MM-DD HH:mm:ss ZZ';

//#endregion

// TODO: Whitelist/op/ban players using RCON if server online
class Minecraft {
	constructor(suuid) {
		this.suuid = suuid == null ? uuid() : suuid;
	}

	//#region setup/config/management

	// Return config for server from USER_CONFIG
	getConfig() {
		return new Promise((resolve, reject) => {
			fs.readJson(USER_CONFIG)
				.then((json) => {
					// Iterate over all servers in config and match SUUID's
					for (let i = 0; i < json.servers.length; i++)
						if (json.servers[i].suuid === this.suuid)
							resolve(json.servers[i]);
					throw Error('No such server exists!');
				})
				.catch((err) => reject(err));
		});
	}

	// Creates a new Minecraft server
	create(mType, mVersion, mName) {
		log.info(`Creating new server "${mName}" with type/version ${mType}/${mVersion}`);
		return new Promise((resolve, reject) => {
			let suuid = this.suuid;
			let type = mType;
			let version = mVersion;
			let name = mName;

			let destPath = path.join(__dirname, `../mc-servers/${name}-${type}-${version}/`);
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
				.then(() => type === 'vanilla' ? getVanillaUrl(version) : DOWNLOAD_LINKS.paper.replace('~~v~~', version))
				.then((url) => downloadJar(url, dest))

				// Run the Jar for the first time, ommiting the Wait flag because we want to wait for it to generate some files.
				.then(() => runJar(destPath, destFile, suuid))

				// This is why we wait for ^ to exit: we need to "sign" the EULA.
				// It might be against Mojang's ToS to do this in code, but we
				// should be fine. Right ?!
				.then(() => this.signEula(path.join(destPath, 'eula.txt')))

				// Write a config to USER_CONFIG with our brand new shiny server!
				.then(() => writeUserConfig(name, version, type, suuid, destPath, destFile))

				// Read/write server.properties to ensure query and RCON are enabled by default
				.then(() => fs.readdir(destPath))
				.then((files) => {
					if (!files.includes('server.properties')) throw Error('Missing server.properties file!');
					else return fs.readFile(path.join(destPath, 'server.properties'));
				})
				.then((bytes) => bytes.toString())
				.then((properties) => this.writeProperties(properties))

				// Create an empty whitelist file
				.then(() => fs.ensureFile(path.join(destPath, 'whitelist.json')))
				.then(() => fs.writeJson(path.join(destPath, 'whitelist.json'), []))

				// Create an empty ops file
				.then(() => fs.ensureFile(path.join(destPath, 'ops.json')))
				.then(() => fs.writeJson(path.join(destPath, 'ops.json'), []))

				// Creates empty ban files (player/ip)
				.then(() => fs.ensureFile(path.join(destPath, 'banned-players.json')))
				.then(() => fs.writeJson(path.join(destPath, 'banned-players.json'), []))
				.then(() => fs.ensureFile(path.join(destPath, 'banned-ips.json')))
				.then(() => fs.writeJson(path.join(destPath, 'banned-ips.json'), []))

				// Respond to the client
				.then(() => resolve())
				.catch((err) => reject(err));
		});
	}

	import(mType, mVersion, mName, mDirectory, mJar) {
		log.info(`Importing server ${mName} from ${mDirectory}`);
		return new Promise((resolve, reject) => {
			let suuid = this.suuid;
			let type = mType;
			let version = mVersion;
			let name = mName;
			let directory = mDirectory;
			let jar = mJar;

			// If the path doesn't exist then we obviously can't import it
			fs.pathExists(path.join(directory, jar))
				.then((exists) => {
					if (!exists) throw Error('Path does not exist!');
					else return;
				})

				// We must assume the server has already been set up so all we do is write the config
				.then(() => writeUserConfig(name, version, type, suuid, directory, jar))

				// Read/write server.properties to ensure query and RCON are enabled by default
				.then(() => fs.readFile(path.join(directory, 'server.properties')))
				.then((bytes) => bytes.toString())
				.then((properties) => this.writeProperties(properties))

				.then(() => resolve())
				.catch((err) => reject(err));
		});
	}

	// Deletes the server folder and removes from USER_CONFIG
	remove() {
		log.info(`Removing server ${this.suuid}`);
		return new Promise((resolve, reject) => {
			this.getConfig()
				.then((config) => fs.remove(config.directory))
				.then(() => fs.readJson(USER_CONFIG))
				.then((json) => {
					let servers = json.servers;
					for (let i = 0; i < servers.length; i++)
						if (servers[i].suuid === this.suuid)
							servers.splice(i, 1);
					json.servers = servers;
					return json;
				})
				.then((json) => fs.writeJson(USER_CONFIG, json, { spaces: '\t' }))
				.then(() => resolve())
				.then((err) => reject(err));
		});
	}

	// Reads server.properties and returns as json. Also returns server.properties helper data
	// and the server config from USER_CONFIG
	readProperties() {
		return new Promise((resolve, reject) => {
			let server;
			let jsonProperties = { properties: {} };

			this.getConfig()
				.then((config) => server = config)
				.then(() => fs.readdir(server.directory))
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

	// Writes to server.properties. Does NOT accept json data: must already be in server.properties format
	writeProperties(properties) {
		log.info(`Writing server.properties for ${this.suuid}`);
		return new Promise((resolve, reject) => {
			// Some versions don't set rcon properties by default
			if (!properties.includes('rcon.password')) properties = properties.concat('\nrcon.password=');
			if (!properties.includes('rcon.port')) properties = properties.concat('\nrcon.port=25575');


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
				.then(() => resolve())
				.catch((err) => reject(err));
		});
	}

	// Read the whitelist
	readWhitelist() {
		return new Promise((resolve, _reject) => {
			this.getConfig()
				.then((config) => fs.readJson(path.join(config.directory, 'whitelist.json')))
				.then((whitelist) => resolve(whitelist))
				.catch((err) => (log.warn(err), resolve([])));
		});
	}

	// Reads ops
	readOps() {
		return new Promise((resolve, _reject) => {
			this.getConfig()
				.then((config) => fs.readJson(path.join(config.directory, 'ops.json')))
				.then((ops) => resolve(ops))
				.catch((err) => (log.warn(err), resolve([])));
		});
	}

	// Read bans
	readBans() {
		return new Promise((resolve, _reject) => {
			this.getConfig()
				.then((config) => Promise.all([fs.readJson(path.join(config.directory, 'banned-players.json')), fs.readJson(path.join(config.directory, 'banned-ips.json'))]))
				.then((bans) => ({ players: bans[0], ips: bans[1] }))
				.then((banJson) => resolve(banJson))
				.catch((err) => (log.warn(err), resolve([])));
		});
	}

	// Automatically "sign" eula.txt
	signEula(eulaPath) {
		log.info(`Signing eula.txt for ${this.suuid}`);
		return new Promise((resolve, reject) => {
			// TODO: Figure out wtf is happening in here
			(eulaPath == null
				? this.getConfig().then((config) => eulaPath = path.join(config.directory, 'eula.txt'))
				: eulaPath);
			new Promise((resolve, reject) => {
				eulaPath == null
					? this.getConfig()
						.then((config) => eulaPath = path.join(config.directory, 'eula.txt'))
						.then(() => resolve())
						.catch((err) => reject(err))
					: resolve();
			})
				.then(() => fs.readFile(eulaPath))
				.then((bytes) => (bytes.toString()))
				.then((text) => text.replace('false', 'true'))
				.then((signed) => fs.writeFile(eulaPath, signed))
				.then(() => resolve())
				.catch((err) => reject(err));
		});
	}

	//#endregion

	//#region server controls

	// Start the server
	start() {
		log.info(`Starting server ${this.suuid}`);
		return new Promise((resolve, reject) => {
			let server;
			this.getConfig()
				.then((config) => server = config)

				// Read/write server.properties to ensure query and RCON are enabled by default
				.then(() => fs.readdir(server.directory))
				.then((files) => {
					if (!files.includes('server.properties')) throw Error('Missing server.properties file!');
					else return fs.readFile(path.join(server.directory, 'server.properties'));
				})
				.then((bytes) => bytes.toString())
				.then((properties) => this.writeProperties(properties))

				.then(() => runJar(server.directory, server.jarFile, false))
				.then(() => resolve())
				.catch((err) => reject(err));
		});
	}

	// Stop the server
	stop() { // TODO: don't resolve until pid has exited
		log.info(`Stopping server ${this.suuid}`);
		return new Promise((resolve, reject) => {
			this.readProperties()
				.then((p) => ({
					host: p.properties['server-ip'],
					port: p.properties['rcon.port'],
					password: p.properties['rcon.password']
				}))
				.then((conn) => sendRconCommand(conn.host, conn.port, conn.password, 'stop'))
				.then((response) => log.info(`RCON reply from server ${this.suuid}: ${response}`))
				.then(() => resolve())
				.catch((err) => reject(err));
		});
	}

	// Restart the server
	restart() {
		log.info(`Restarting server ${this.suuid}`);
		return new Promise((resolve, reject) => {
			let pid;
			this.getConfig()
				.then((config) => fs.readFile(path.join(config.directory, '.pid')))
				.then((bytes) => bytes.toString())
				.then((mPid) => pid = mPid)
				.then(() => this.stop())
				.then(() => _waitForExit(pid))
				.then(() => this.start())
				.then(() => resolve())
				.catch((err) => reject(err));
		});

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

	//#endregion

	//#region player operations

	// Add player to whitelist
	whitelistAdd(player) {
		log.info(`Adding player "${player}" to whitelist for server ${this.suuid}`);
		return new Promise((resolve, reject) => {
			let whitelistPath;
			this.getConfig()
				.then((config) => whitelistPath = path.join(config.directory, 'whitelist.json'))
				.then(() => Promise.all([fs.readJson(whitelistPath), getPlayerUuid(player)]))
				.then((data) => {
					data[0].push({ uuid: data[1], name: player });
					return data[0];
				})
				.then((whitelist) => fs.writeJson(whitelistPath, whitelist, { spaces: '\t' }))
				.then(() => resolve())
				.catch((err) => reject(err));
		});
	}

	// Removes player from whitelist
	whitelistRemove(puuid) {
		log.info(`Removing player "${puuid}" from whitelist for server ${this.suuid}`);
		return new Promise((resolve, reject) => {
			let whitelistPath;
			this.getConfig()
				.then((config) => whitelistPath = path.join(config.directory, 'whitelist.json'))
				.then(() => fs.readJson(whitelistPath))
				.then((whitelist) => {
					whitelist.forEach((player, index) => player.uuid === puuid && whitelist.splice(index, 1));
					return whitelist;
				})
				.then((whitelist) => fs.writeJson(whitelist, whitelistPath, { spaces: '\t' }))
				.then(() => resolve())
				.catch((err) => reject(err));
		});
	}

	// Ops a player
	opAdd(player) {
		log.info(`Adding player "${player}" to op for server ${this.suuid}`);
		return new Promise((resolve, reject) => {
			let opPath;
			this.getConfig()
				.then((config) => opPath = path.join(config.directory, 'ops.json'))
				.then(() => Promise.all([fs.readJson(opPath), getPlayerUuid(player), this.readProperties()]))
				.then((data) => {
					data[0].push({ uuid: data[1], name: player, level: data[2].properties['op-permission-level'] });
					return data[0];
				})
				.then((oplist) => fs.writeJson(opPath, oplist, { spaces: '\t' }))
				.then(() => resolve())
				.catch((err) => reject(err));
		});
	}

	// Deops a player
	opRemove(puuid) {
		log.info(`Removing player "${puuid}" from op for server ${this.suuid}`);
		return new Promise((resolve, reject) => {
			let opPath;
			this.getConfig()
				.then((config) => opPath = path.join(config.directory, 'ops.json'))
				.then(() => fs.readJson(opPath))
				.then((ops) => {
					ops.forEach((player, index) => player.uuid === puuid && ops.splice(index, 1));
					return ops;
				})
				.then((ops) => fs.writeJson(opPath, ops, { spaces: '\t' }))
				.then(() => resolve())
				.catch((err) => reject(err));
		});
	}

	// Bans a player
	banPlayerAdd(player, reason) {
		log.info(`Banning player "${player}" from server ${this.suuid}`);
		return new Promise((resolve, reject) => {
			let banPath;
			this.getConfig()
				.then((config) => banPath = path.join(config.directory, 'banned-players.json'))
				.then(() => Promise.all([fs.readJson(banPath), getPlayerUuid(player)]))
				.then((data) => {
					let ban = {
						uuid: data[1],
						name: player,
						created: moment().format(BAN_TIMESTAMP_FORMAT),
						source: '__McServerman__',
						expires: 'forever',
						reason: reason
					};
					data[0].push(ban);
					return data[0];
				})
				.then((bans) => fs.writeJson(banPath, bans, { spaces: '\t' }))
				.then(() => resolve())
				.catch((err) => reject(err));
		});
	}

	// Unbans a player
	banPlayerRemove(puuid) {
		log.info(`Unbanning player "${puuid} from server ${this.suuid}`);
		return new Promise((resolve, reject) => {
			let banPath;
			this.getConfig()
				.then((config) => banPath = path.join(config.directory, 'banned-players.json'))
				.then(() => fs.readJson(banPath))
				.then((bans) => {
					bans.forEach((player, index) => player.uuid === puuid && bans.splice(index, 1));
					return bans;
				})
				.then((bans) => fs.writeJson(banPath, bans, { spaces: '\t' }))
				.then(() => resolve())
				.catch((err) => reject(err));
		});
	}

	// Bans an IP
	banIPAdd(ip, reason) {
		log.info(`Banning IP "${ip}" from server ${this.suuid}`);
		return new Promise((resolve, reject) => {
			let banPath;
			this.getConfig()
				.then((config) => banPath = path.join(config.directory, 'banned-ips.json'))
				.then(() => fs.readJson(banPath))
				.then((bans) => {
					let ban = {
						ip: ip,
						created: moment().format(BAN_TIMESTAMP_FORMAT),
						source: '__McServerman__',
						expires: 'forever',
						reason: reason
					};
					bans.push(ban);
					return bans;
				})
				.then((bans) => fs.writeJson(banPath, bans, { spaces: '\t' }))
				.then(() => resolve())
				.catch((err) => reject(err));
		});
	}

	// Unbans an IP
	banIPRemove(ip) {
		log.info(`Unbanning IP "${ip} from server ${this.suuid}`);
		return new Promise((resolve, reject) => {
			let banPath;
			this.getConfig()
				.then((config) => banPath = path.join(config.directory, 'banned-ips.json'))
				.then(() => fs.readJson(banPath))
				.then((bans) => {
					bans.forEach((mIp, index) => mIp.ip === ip && bans.splice(index, 1));
					return bans;
				})
				.then((bans) => fs.writeJson(banPath, bans, { spaces: '\t' }))
				.then(() => resolve())
				.catch((err) => reject(err));
		});
	}

	//#endregion

	//#region other

	// Query the server
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

	// Returns boolean if server responded to query
	// Functions that call isRunning() also need to be async and call with await isRunning()
	async isRunning() {
		try {
			await this.query();
			return true;
		} catch (err) {
			return false;
		}
	}

	// Zips the server folder for the user to download.
	// TODO: Should just be world eventually.
	downloadWorld() {
		log.info(`Packaging server ${this.suuid} for download`);
		return new Promise((resolve, reject) => {
			let zip = new AdmZip();
			let server;
			let archivePath;
			let did = uuid();

			this.getConfig()
				.then((config) => server = config)
				.then(() => archivePath = path.join(__dirname, '../worlds/', `${server.name}-${server.version}-${moment().format('YYYY.MM.DD-HH.mm.ss')}.zip`))
				.then(() => zip.addLocalFolder(server.directory))
				.then(() => zip.writeZip(archivePath))
				.then(() => resolve({ did: did, archivePath: archivePath }))
				.catch((err) => reject(err));
		});
	}

	// Unzips an uploaded file
	uploadWorld(filename) {
		log.info(`Unzipping uploaded world "${filename}" to server ${this.suuid}`);
		return new Promise((resolve, reject) => {
			let zip; // AdmZip object for unzipping the uploaded zip
			let server; // Server config
			let worldName; // Name of the world to set in server properties

			this.getConfig()
				.then((config) => server = config)
				.then(() => fs.exists(path.join(server.directory, filename.replace('.zip', ''))))
				.then((exists) => {
					if (exists) throw Error('Path already exists!');
					else return;
				})
				.then(() => {
					zip = new AdmZip(path.join(server.directory, filename));
					zip.extractAllTo(path.join(server.directory));
					return filename.replace('.zip', '');
				})
				.then((mWorldName) => worldName = mWorldName)
				.then(() => this.readProperties())
				.then((p) => {
					p.properties['level-name'] = worldName;

					// Convert properties json to minecraft server.properties format
					let pText;
					Object.keys(p.properties).forEach((key, _index) => {
						pText += `${key}=${p.properties[key]}\n`;
					});
					return pText;
				})
				.then((properties) => this.writeProperties(properties))
				.then(() => resolve())
				.catch((err) => reject(err));
		});
	}

	//#endregion
}

// Writes JSON data to USER_CONFIG. If file does not exist, it is created.
function writeUserConfig(name, version, type, suuid, directory, jarFile) {
	log.info(`Writing configuration to ${USER_CONFIG}`);
	return new Promise((resolve, reject) => {
		let config = { "servers": [] };
		let server = { // JSON object, not JavaScript object!
			"name": name,
			"version": version,
			"type": type,
			"suuid": suuid,
			"directory": directory,
			"jarFile": jarFile,
			"lastAccess": moment().valueOf(), // For sorting (has yet to be implemented)
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

function sendRconCommand(host, port, password, command) {
	return new Promise((resolve, _reject) => {
		host = host.trim() === '' || host == null ? '0.0.0.0' : host;

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

// Gets a player UUID for whitelist/op/ban/etc. operations before the
// player has joined the server.
function getPlayerUuid(name) {
	log.info(`Fetching UUID for player "${name}"`);
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

//#region java

function getVanillaUrl(version) {
	log.info(`Fetching Vanilla URL for version ${version}`);
	return new Promise((resolve, reject) => {
		fetch(DOWNLOAD_LINKS.vanilla)
			.then((response) => response.json())
			.then((json) => json.stable[version].server)
			.then((url) => resolve(url))
			.catch((err) => reject(err));
	});
}

function downloadJar(source, dest) {
	log.info(`Download jar file from ${source} to ${dest}`);
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

function runJar(directory, jar, wait = true, useExperimentalFlags = true) {
	log.info(`Running jar file ${jar} in ${directory}`);
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
				// Print stdout and stderr
				java.stdout.on('data', (out) => log.info(`[${java.pid}] stdout: ${out.toString().trim()}`));
				java.stderr.on('data', (err) => log.error(`[${java.pid}] stderr: ${err.toString().trim()}`));

				// This is only called if we wait for the server to exit.
				// This typically only happens on first time run to generate
				// the EULA and server.properties
				java.on('close', (exitCode) => {
					let msg = `Child process [${java.pid}] exited with code ${exitCode}`;
					wait
						? (exitCode != 0
							? reject(log.warn(msg))
							: resolve(log.info(msg))
						)
						: (exitCode != 0
							? log.warn(msg)
							: log.info(msg)
						);
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
		if (system = OS_TYPES.windows_nt) { // This shouldn't work but it does so idk
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
					else return fs.readdir(JAVA_INSTALLATIONS[system]);
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
			.on('error', (err, _item) => reject(err));
	});
}

function getJavaVersionFromBin(bin) {
	return new Promise((resolve, reject) => {
		let args = ['-d64', '-version']; // -d64 is to check 64-bit java. 32-bit not supported due to RAM limitations
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
	// TODO: Improve ram selection to use system but fallback to free if unable to use system
	// TODO: Allow user to pick deditated wam
	// ? Potentially change variable name to deditatedWam

	// Set up inital flags
	let ramFlag = `-Xms${dedicatedRam}G -Xmx${dedicatedRam}G`;
	let flags = [
		'-XX:+UseG1GC',
		'-XX:+ParallelRefProcEnabled',
		'-XX:MaxGCPauseMillis=200',
		'-XX:+UnlockExperimentalVMOptions',
		'-XX:+DisableExplicitGC',
		'-XX:-OmitStackTraceInFastThrow',
		'-XX:+AlwaysPreTouch',
		'-XX:G1NewSizePercent=30',
		'-XX:G1MaxNewSizePercent=40',
		'-XX:G1HeapRegionSize=8M',
		'-XX:G1ReservePercent=20',
		'-XX:G1HeapWastePercent=5',
		'-XX:G1MixedGCCountTarget=8',
		'-XX:InitiatingHeapOccupancyPercent=15',
		'-XX:G1MixedGCLiveThresholdPercent=90',
		'-XX:G1RSetUpdatingPauseTimePercent=5',
		'-XX:SurvivorRatio=32',
		'-XX:MaxTenuringThreshold=1',
		'-Dusing.aikars.flags=true',
		'-Daikars.new.flags=true'
	].join(' ');

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

	// NOTE: java 11+ is purposely broken as I cannot guarantee stability and some versions won't work at all with 11
	if ('java=11+' === 'this will not work') flags += ' -Xlog:gc*:logs/gc.log:time,uptime:filecount=5,filesize=1M';

	return `${ramFlag} ${flags}`.split(' ');
}

//#endregion

module.exports = Minecraft;