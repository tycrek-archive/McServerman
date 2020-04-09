# McServerman

#### *A web-based GUI for managing Minecraft servers*

I created this because I'm officially annoyed with managing my various servers through the command line. I'm also quarantined for [COVID-19](https://en.wikipedia.org/wiki/Coronavirus_disease_2019) and I am bored.

For now I'm only planning to add support for Vanilla and [PaperMC](https://papermc.io/) servers. If there is interest I may add more in the future (such as [Bedrock](https://minecraft.gamepedia.com/Bedrock_Edition) or [Pixelmon](https://pixelmonmod.com/wiki/index.php?title=Pixelmon)).

## Features/Todo

- [x] Download Vanilla Jar
- [x] Download [PaperMC](https://papermc.io/) (Spigot) Jar
- [x] Automatically "sign" EULA
- [x] Manage multiple servers (only lists right now, no editing function yet)
- [ ] Download Java 8 JRE for best compatibility
- [x] Run Jar using Java 8 JRE (currently only works on Linux)
- [ ] Player manager (whitelist/blacklist, ops, history, etc.)
- [x] GUI `server.properties` editor with explanations/recommended settings
- [ ] Upload/download/backup/restore Worlds
- [ ] Install plugins (Paper/Spigot)
- [ ] Auto port-forward with UPnP (or a guide on port forwarding)
- [ ] Web console with RCON (RCON is working; however Web console is not added yet!)
- [ ] World upgrade for new versions (e.x. 1.14 -> 1.15)
- [ ] Statistics with funky graphs
- [ ] Alerts (shutdown, player join, etc.)
- [ ] System resource monitor
- [ ] Wiki (installation, usage, etc.)
- [ ] Bedrock support
- [ ] Password authentication
- [ ] OAuth authentication (maybe)
- [ ] Snapshot servers
- *I'll update this list with more when I think of new features*

## Installation

#### Requirements

- Latest LTS **[Node.js](https://nodejs.org/en/download/)** *(verified working with Node 13.12, but others may work as well)*
- Also ensure **NPM** is installed and works
- Currently only works on **Linux** *(verified working with Manjaro)*
- Preferably at least **8GB RAM**
- Command line experience is very helpful

#### Installation

1. Open a terminal and navigate to a directory of your choice
2. Run: `git clone https://github.com/tycrek/McServerman.git`
3. Navigate to the cloned directory
4. Run: `npm i` to install dependencies (see `package.json` for a list of dependencies)
5. Run: `node app.js`
6. If all goes as planned, you should see: `Server hosted on 0.0.0.0:7767`

## Usage

1. After running `node app.js`, open your browser and navigate to: [localhost:7767](http://localhost:7767)
2. If this is the first time the app is run, you will be greeted with the setup page (import coming soon).
    1. Select **Server type**
	2. Select desired **Game version**
	3. Name your server
	4. Click **Create server** and wait
3. After the first server has been created, the homepage will be a list of your servers. To manage a server, click the **View** button for that server.
4. The server dashboard page lists if the server is online or offline; number of connected (and maximum) players; and other helpful information.
5. Start the server by selecting **Start/Stop**. It is important that you **wait** for the Status indicator to show "Online" before stopping the server or attempting to start it again (this will be improved in the future).
6. You can edit the `server.properties` file from the server dashboard. Make sure you click **Save changes** once you have made your edits.
    - **Note**: In order for McServerman to function optimally, it will force enable `enable-query` and `enable-rcon`. Make sure you set `rcon.password`, otherwise you may not be able to safely stop the server and you could lose data!
7. To stop McServerman, go to the console or terminal where you ran `node app.js` and press `CTRL-C` on your keyboard. Any active Minecraft servers will stay active, so this is usually safe.

## Limitations

1. Development is slow because I get distracted easily.

## Contributing

If you really want to contribute to this, sure, why not, go ahead.

1. New features
2. Code cleanup
3. Translations?

## Acknowledgements

- [Mojang](https://www.mojang.com/) and [Markus Persson (Notch)](https://en.wikipedia.org/wiki/Markus_Persson) for making the best [lasagna recipe I have ever tasted](https://www.minecraft.net/en-us/)
- [PaperMC](https://papermc.io/) for a fantastic third-party server. [PaperMC GitHub](https://github.com/PaperMC)
- [VSCodium](https://vscodium.com/) because @#$% Microsoft.
- [MCVersions.net](https://mcversions.net/) for providing download links for Server Jar files
- [MCUUID](https://mcuuid.net/) for providing information on player UUID (assists in player operations before they have ever joined)
- [Official Minecraft Wiki - Gamepedia](https://minecraft.gamepedia.com/Server.properties)
- [Daniel Ennis](https://aikar.co/author/daniel-ennis-aikar/) for providing [invaluable information](https://aikar.co/2018/07/02/tuning-the-jvm-g1gc-garbage-collector-flags-for-minecraft/) on JVM garbage collection to improve running Minecraft servers

## Hotel?

Trivago.