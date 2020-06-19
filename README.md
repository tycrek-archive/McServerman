# McServerman

[//]: # ( :heavy_check_mark: )
[//]: # ( :x: )

#### *A web-based GUI for managing Minecraft servers*

I created this because I'm officially annoyed with managing my various servers through the command line. I'm also quarantined for [COVID-19](https://en.wikipedia.org/wiki/Coronavirus_disease_2019) and I am bored.

For now I'm only planning to add support for Vanilla and [PaperMC](https://papermc.io/) servers. If there is interest I may add more in the future (such as [Bedrock](https://minecraft.gamepedia.com/Bedrock_Edition) or [Pixelmon](https://pixelmonmod.com/wiki/index.php?title=Pixelmon)).

If you like this project, consider [donating](https://jmoore.dev/donate). I do all this in my spare time without making any profit so anything is appreciated!

## Features

#### Creating Minecraft servers

- :heavy_check_mark: Download Vanilla ([Java Edition](https://minecraft.gamepedia.com/Java_Edition)) Jar
- :heavy_check_mark: Download [PaperMC](https://papermc.io/) (Spigot) Jar
- :heavy_check_mark: Automatically "sign" EULA
- :x: [Bedrock Editon](https://minecraft.gamepedia.com/Bedrock_Edition) servers
- :x: [Snapshot](https://minecraft.gamepedia.com/Tutorials/How_to_install_a_snapshot) servers
- :x: Import existing servers

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

- :x: Upload existing worlds
- :heavy_check_mark: Download active world
- :x: Backup/Restore
- :x: Regenerate world
- :x: World switching (example: switching between a parkour map and a survival map)
- :x: Upgrade for new versions (example: 1.14 -> 1.15)

#### Player operations

- :x: Whitelist
- :x: Blacklist *(PaperMC only)*
- :x: "Op" and "Deop"
- :x: Bans
- :x: Run the above functions before players have ever joined using player UUID's
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

- :x: McServerman password authentication
- :x: McServerman [OAuth authentication](https://stackoverflow.com/questions/4201431/what-exactly-is-oauth-open-authorization) (maybe)
- :x: Decent Wiki pages (installation, usage, etc.)
- :x: Automatically set up `systemd` on Linux for McServerman
- :x: Auto port-forward with [UPnP](https://en.wikipedia.org/wiki/Universal_Plug_and_Play) (or a guide on port forwarding)
- :x: Web console with [RCON](https://en.wikipedia.org/wiki/Remote_administration) *(RCON is working; however Web console is not added yet!)*
- :x: Mobile-friendly version
- :x: [Progressive Web APP](https://www.howtogeek.com/342121/what-are-progressive-web-apps/) (PWA)

## Installation

#### Requirements

- Supported OS:
  - **Linux** - Recommended
  - **Windows** - Experimental
  - **macOS** - Not supported
- Latest LTS **[Node.js](https://nodejs.org/en/download/)** *(verified working with Node 13.12, but others may work as well)*
- Also ensure both **NPM** & **Git** are installed and working
- Preferably at least **8GB RAM** (for the Minecraft server; McServerman alone runs on a potato)
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
7. To stop McServerman, go to the console or terminal where you ran `node app.js` and press `CTRL-C` on your keyboard. Any active Minecraft servers will stay active, so this is usually safe.

## Limitations

1. Development is slow because I get distracted easily.
2. Currently only works on Linux. macOS and ~~Windows~~ support will probably need to be done by other developers as I don't own either system. **Update**: Basic Windows support is now available

## Contributing

Some stuff that would be really helpful to me:

1. New features
2. Code cleanup
3. Translations?

## Acknowledgements

- [Mojang](https://www.mojang.com/) and [Markus Persson (Notch)](https://en.wikipedia.org/wiki/Markus_Persson) for making the best [lasagna recipe I have ever tasted](https://www.minecraft.net/en-us/)
- [PaperMC](https://papermc.io/) for a fantastic third-party server. [PaperMC GitHub](https://github.com/PaperMC)
- [VSCodium](https://vscodium.com/) because @#$% Microsoft.
- [MCVersions.net](https://mcversions.net/) for providing download links for server Jar files
- [PlayerDB](https://playerdb.co/) for providing information on player UUID (assists in player operations before they have ever joined)
- [Official Minecraft Wiki - Gamepedia](https://minecraft.gamepedia.com/Server.properties)
- [Daniel Ennis](https://aikar.co/author/daniel-ennis-aikar/) for providing [invaluable information](https://aikar.co/2018/07/02/tuning-the-jvm-g1gc-garbage-collector-flags-for-minecraft/) on JVM garbage collection to improve running Minecraft servers

## The name "McServerman"

I thought it would be funny because it sounds like "McDonalds".

## Hotel?

Trivago.