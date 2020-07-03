# McServerman

[//]: # ( :heavy_check_mark: )
[//]: # ( :x: )

#### *A web-based GUI for managing Minecraft servers*

I created this because I'm annoyed with managing my various servers through the command line. I'm also quarantined for [COVID-19](https://en.wikipedia.org/wiki/Coronavirus_disease_2019) and I am bored. For now I'm only planning to add support for Vanilla and [PaperMC](https://papermc.io/) servers. If there is interest I may add more in the future (such as [Bedrock](https://minecraft.gamepedia.com/Bedrock_Edition) or [Pixelmon](https://pixelmonmod.com/wiki/index.php?title=Pixelmon)).

If you like this project, consider [donating](https://jmoore.dev/donate). I do all this in my spare time without making any profit so anything is appreciated!

- ###### Current version: 0.1.0a
- ###### Next version 0.2.0a

## Features

#### Creating Minecraft servers

- :heavy_check_mark: Download Vanilla ([Java Edition](https://minecraft.gamepedia.com/Java_Edition)) Jar
- :heavy_check_mark: Download [PaperMC](https://papermc.io/) (Spigot) Jar
- :heavy_check_mark: Automatically "sign" EULA
- :heavy_check_mark: Import existing servers
- :x: [Bedrock Editon](https://minecraft.gamepedia.com/Bedrock_Edition) servers
- :x: [Snapshot](https://minecraft.gamepedia.com/Tutorials/How_to_install_a_snapshot) servers

#### Managing Minecraft servers

- :heavy_check_mark: Manage multiple servers
- :heavy_check_mark: GUI `server.properties` editor with explanations & recommended settings
- :heavy_check_mark: Start/stop servers (even after McServerman has restarted!)
- :heavy_check_mark: Restart servers
- :heavy_check_mark: Delete servers
- :heavy_check_mark: Run Jar using Java 8 JRE
- :x: Install & manage plugins (PaperMC/Spigot)
- :x: Download Java 8 JRE for best compatibility

#### World management

- :heavy_check_mark: Upload existing worlds
- :heavy_check_mark: Download active world (currently downloads entire server)
- :x: Backup/Restore (not the same as download/upload: these are server-side restore points)
- :x: Regenerate world (i.e. erase current world and start a new one)
- :x: World switching (example: switching between a parkour map and a survival map)
- :x: Create new worlds with option to set custom seeds
- :x: Upgrade for new versions (example: 1.12 -> 1.13). See [here](https://www.beastnode.com/portal/index.php?rp=/knowledgebase/191/Optional-Server-Startup-Parameters.html) and [here](https://www.minecraftforum.net/forums/support/java-edition-support/2914616-1-13-faqs-read-before-posting) for notes on the `--forceUpgrade` flag.

#### Player operations

- :heavy_check_mark: Whitelist
- :heavy_check_mark: "Op" and "Deop"
- :heavy_check_mark: Bans (player and IP)
- :heavy_check_mark: Run the above functions before players have ever joined using player UUID's
- :x: List all players who have previously joined and run the above functions on them

#### Statistics

- :x: System & server uptime
- :x: System & server resource usage (monitor & historical data)
- :x: World size (including growth over time)
- :x: Graphs!
- :x: Player statistics (# of joins; average playtime; etc.)
- :x: Insights (Interesting tidbits on existing statistics)

#### Alerts

- :x: Email or SMS
- :x: Server crashes
- :x: Heavy resource usage/lag
- :x: Player alerts (join, auto-kick, etc.)
- :x: Backup tasks

#### Awesome stuff

- :x: password authentication
- :x: [OAuth authentication](https://stackoverflow.com/questions/4201431/what-exactly-is-oauth-open-authorization) (maybe)
- :x: Decent Wiki pages (installation, usage, etc.)
- :x: Automatically set up `systemd` on Linux for McServerman
- :x: Auto port-forward with [UPnP](https://en.wikipedia.org/wiki/Universal_Plug_and_Play) (or a guide on port forwarding)
- :x: Web console with [RCON](https://en.wikipedia.org/wiki/Remote_administration) *(RCON is working; however Web console is not added yet!)*
- :x: Mobile-friendly version
- :x: [Progressive Web APP](https://www.howtogeek.com/342121/what-are-progressive-web-apps/) (PWA)
- :x: Run using [paperd](https://github.com/PaperMC/paperd) on Unix systems

## Installation

#### Requirements

- Supported OS:
  - **Linux** - Recommended
  - **Windows** - Experimental
  - **macOS** - Not supported but probably works
- Latest LTS **[Node.js](https://nodejs.org/en/download/)** *(verified working with Node 13.12, but others may work as well)*
- Also ensure both **NPM** & **Git** are installed and working
- Preferably at least **8GB RAM** (for the Minecraft server; McServerman alone runs on a potato)
- Java 8 64-bit (will **not** run on 32-bit. 32-bit support will not be added due to RAM limitations)
- Command line experience is very helpful

#### Installation

**Linux** (Windows/macOS probably work with this as well)

```
$ git clone https://github.com/tycrek/McServerman.git
$ cd McServerman/
$ npm i
$ node app.js
```

If all goes as planned, you should see: `Server hosted on 0.0.0.0:7767`

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
    - **Note**: In order for McServerman to function optimally, it will force enable `enable-query` and `enable-rcon`. Make sure you set `rcon.password`, otherwise you may not be able to safely stop the server and you could lose data! If you do not set `rcon.password`, McServerman will create one for you.
7. You can also add/remove players from the server whitelist in the table below the properties table. Make sure to also enable the whitelist in `server.properties`. To use the updated whitelist, restart your Minecraft server.
8. To stop McServerman, go to the console or terminal where you ran `node app.js` and press `CTRL+C` on your keyboard. Any active Minecraft servers will stay active, so this is usually safe.

## Supported Minecraft versions

Assume all versions include patch unless specified. i.e. 1.15 includes 1.15.2, etc.

- ![](https://img.shields.io/badge/-supported-brightgreen) All features tested and confirmed working or stable. Even so, take this with a grain of salt until McServerman as a whole is stable.
- ![](https://img.shields.io/badge/-experimental-orange) Briefly tested but might have problems. Use at your own risk.
- ![](https://img.shields.io/badge/-borked-red) Tested and known to not work.
- ![](https://img.shields.io/badge/-not%20supported-lightgrey) Not tested. Unconfirmed if anything works.

| Version | Vanilla | Paper |
| ------- | ------- | ----- |
| 1.16 | ![](https://img.shields.io/badge/-experimental-orange) | ![](https://img.shields.io/badge/-experimental-orange) |
| 1.15 | ![](https://img.shields.io/badge/-supported-brightgreen) | ![](https://img.shields.io/badge/-supported-brightgreen) |
| 1.14 | ![](https://img.shields.io/badge/-not%20supported-lightgrey) | ![](https://img.shields.io/badge/-not%20supported-lightgrey) |
| 1.13 | ![](https://img.shields.io/badge/-not%20supported-lightgrey) | ![](https://img.shields.io/badge/-not%20supported-lightgrey) |
| 1.12 | ![](https://img.shields.io/badge/-not%20supported-lightgrey) | ![](https://img.shields.io/badge/-supported-brightgreen) |
| 1.11 | ![](https://img.shields.io/badge/-not%20supported-lightgrey) | ![](https://img.shields.io/badge/-not%20supported-lightgrey) |
| 1.10 | ![](https://img.shields.io/badge/-not%20supported-lightgrey) | ![](https://img.shields.io/badge/-not%20supported-lightgrey) |
| 1.9 | ![](https://img.shields.io/badge/-not%20supported-lightgrey) | ![](https://img.shields.io/badge/-not%20supported-lightgrey) |
| 1.8 | ![](https://img.shields.io/badge/-not%20supported-lightgrey) | ![](https://img.shields.io/badge/-not%20supported-lightgrey) |
| 1.7 & below | ![](https://img.shields.io/badge/-not%20supported-lightgrey) | ![](https://img.shields.io/badge/-not%20supported-lightgrey) |

## Limitations

1. Development is slow because I get distracted easily.
2. Currently only works on Linux. macOS and ~~Windows~~ support will probably need to be done by other developers as I don't own either system. **Update**: Basic Windows support is now available
3. 32-bit operating systems and Java are **not** supported. This is on purpose. Buy a new computer if this is a problem.

## Contributing

Some stuff that would be really helpful to me:

1. New features
2. Code cleanup
3. Security improvements
4. Bug fixes
5. Translations?

## Acknowledgements

- [Mojang](https://www.mojang.com/) and [Markus Persson (Notch)](https://en.wikipedia.org/wiki/Markus_Persson) for making the best [lasagna recipe I have ever tasted](https://www.minecraft.net/en-us/)
- [PaperMC](https://papermc.io/) for a fantastic third-party server. [PaperMC GitHub](https://github.com/PaperMC)
- [VSCodium](https://vscodium.com/) because @#$% Microsoft.
- [MCVersions.net](https://mcversions.net/) for providing download links for server Jar files
- [PlayerDB](https://playerdb.co/) for providing information on player UUID (assists in player operations before they have ever joined)
- [Official Minecraft Wiki - Gamepedia](https://minecraft.gamepedia.com/Server.properties)
- [Daniel Ennis](https://aikar.co/author/daniel-ennis-aikar/) for providing [invaluable information](https://aikar.co/2018/07/02/tuning-the-jvm-g1gc-garbage-collector-flags-for-minecraft/) on JVM garbage collection to improve running Minecraft servers

## The name "McServerman"

I thought it would be funny because it sounds like "McDonalds". The full name is "Minecraft Server Manager".

## Hotel?

Trivago.