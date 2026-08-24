var widgetAPI = new Common.API.Widget();
var pluginAPI = new Common.API.Plugin();
var tvKey = new Common.API.TVKeyValue();
	
var Main =
{
		version : "v2.2.9a",
		requiredServerVersion : "10.7.6",
		requiredDevServerVersion : "3.0.5507.2131",
		
		//TV Series Version
		modelYear : null,
		width : 1920,
		height : 1080,
		backdropWidth : 1920,
		backdropHeight : 1080,
		posterWidth : 473,
		posterHeight : 267,
		seriesPosterWidth : 180,
		seriesPosterHeight : 270,
		seriesPosterLargeWidth : 235,
		seriesPosterLargeHeight : 350,
		
		forceDeleteSettings : false,
		highlightColour : 1,
		
		enableMusic : true,
		enableLiveTV : true,
		enableCollections : true,
		enableChannels : true,
		enableImageCache : true,
		
		enableScreensaver : true,
		isScreensaverRunning : false,
};

Main.getModelYear = function() {
	return this.modelYear;
};

//---------------------------------------------------------------------------
//  Audio hardware
//
//  Whether Dolby or DTS can be passed through is a property of the set and
//  whatever is plugged into it, not something the user should have to know.
//  These are asked once at startup; the answers refine the manual settings
//  rather than replace them, because the plugin returns a negative value when
//  it cannot answer and that must not read as "unsupported".
//---------------------------------------------------------------------------

//PL_AUDIO_OUTPUT_DEVICE: 0 main speaker, 1 earphone, 2 subwoofer,
//3 external (component/composite), 4 receiver (HDMI/SPDIF).
Main.probeAudioCapabilities = function() {
	var pluginAudio = document.getElementById("pluginObjectAudio");
	this.audioOutputDevice = null;
	this.audioDolby = null;
	this.audioDTS = null;

	if (pluginAudio == null) { return; }

	try { this.audioOutputDevice = pluginAudio.GetOutputDevice(); } catch (e) {}
	try { this.audioDolby = pluginAudio.CheckExternalOutMode(1); } catch (e) {}
	try { this.audioDTS = pluginAudio.CheckExternalOutMode(2); } catch (e) {}

	FileLog.write("Audio : output device " + this.audioOutputDevice +
	              " (4 = receiver), dolby " + this.audioDolby + ", dts " + this.audioDTS);
};

//True only when we positively know sound leaves over HDMI or SPDIF. Anything
//else, including "could not tell", is treated as not knowing.
Main.hasReceiver = function() {
	return this.audioOutputDevice === 4;
};

//A positive result is the hardware saying yes. Zero means no. Anything else -
//negative, null, never asked - means it could not tell, so defer to the user.
Main.canPassThrough = function(probed, userSetting) {
	if (probed > 0) { return true; }
	if (probed === 0) { return false; }
	return userSetting == true;
};

Main.supportsDolby = function() {
	return this.canPassThrough(this.audioDolby, File.getTVProperty("Dolby"));
};

Main.supportsDTS = function() {
	return this.canPassThrough(this.audioDTS, File.getTVProperty("DTS"));
};

Main.isMusicEnabled = function() {
	return this.enableMusic;
};

Main.isLiveTVEnabled = function() {
	return this.enableLiveTV;
};

Main.isCollectionsEnabled = function() {
	return this.enableCollections;
};

Main.isChannelsEnabled = function() {
	return this.enableChannels;
};

Main.isScreensaverEnabled = function() {
	return this.enableScreensaver;
};

Main.isImageCaching = function() {
	return this.enableImageCache;
};

Main.getRequiredServerVersion = function() {
	return this.requiredServerVersion;
};

Main.getVersion = function() {
	return this.version;
};

Main.getIsScreensaverRunning = function() {
	return this.isScreensaverRunning;
};

Main.setIsScreensaverRunning = function() {
	if (this.isScreensaverRunning == false) {
		this.isScreensaverRunning = true;
	} else {
		this.isScreensaverRunning = false;
	}
};

Main.onLoad = function()
{	
	//Support.removeSplashScreen();
	//Setup Logging
	FileLog.loadFile(false); // doesn't return contents, done to ensure file exists
	FileLog.write("---------------------------------------------------------------------",true);
	FileLog.write("Jellyfin Application Started");
	
	if (Main.isImageCaching()) {
		var fileSystemObj = new FileSystem();
		fileSystemObj.deleteCommonFile(curWidget.id + '/cache.json');
		Support.imageCachejson = {"Images":[]};
	}
	
	document.getElementById("splashscreen_version").innerHTML = Main.version;
	
	//Turn ON screensaver
	pluginAPI.setOnScreenSaver();
	FileLog.write("Screensaver enabled.");
	Support.clock();
	widgetAPI.sendReadyEvent();
	window.onShow = Main.initKeys();	

	//Set DeviceID & Device Name
	var NNaviPlugin = document.getElementById("pluginObjectNNavi");
	var pluginNetwork = document.getElementById("pluginObjectNetwork");
	var pluginTV = document.getElementById("pluginObjectTV");
	FileLog.write("Plugins initialised.");

	//Asking the plugin costs a round-trip and the answer cannot change while
	//the app is running, so ask once. This was being called fourteen times.
	var productCode = pluginTV.GetProductCode(0);
	Main.productCode = productCode;
	Main.probeAudioCapabilities();

	//Firmware and player build. GetPlayerVersion carries no security type, so
	//it always answers, and it is what the guide points at for telling which
	//player calls a set supports. Both go in the log and the stats panel: the
	//capability table is a guess per model, and these say which build made it.
	try { Main.firmware = NNaviPlugin.GetFirmware(); } catch (e) { Main.firmware = null; }
	try { Main.playerVersion = document.getElementById("pluginPlayer").GetPlayerVersion(); } catch (e) { Main.playerVersion = null; }
	FileLog.write("Device : firmware " + Main.firmware + ", player " + Main.playerVersion);

	//GetActiveType reports the interface in use: 1 wired, 0 wireless, -1 none.
	var interfaceType = pluginNetwork.GetActiveType();
	Main.interfaceType = interfaceType;
	FileLog.write("Active network interface is "+interfaceType+" (1=wired, 0=wireless)");

	//These return 1 connected / 0 not connected / -1 on error. -1 is truthy in JS,
	//so testing them directly treated an error as success - compare explicitly.
	var phyConnection = 0, http = 0, gateway = 0;
	if (interfaceType == 1 || interfaceType == 0) {
		phyConnection = pluginNetwork.CheckPhysicalConnection(interfaceType);
		FileLog.write("Check physical connection returned "+phyConnection);
		http = pluginNetwork.CheckHTTP(interfaceType);
		FileLog.write("Check HTTP returned "+http);
		gateway = pluginNetwork.CheckGateway(interfaceType);
		FileLog.write("Check gateway returned "+gateway);
	} else {
		FileLog.write("No active network interface reported.");
	}
	
	//Get the model year - Used for transcoding
	if (productCode.substring(0,2) == "HT" || productCode.substring(0,2) == "BD"){
		this.modelYear = productCode.substring(3,4);

	} else if (productCode.substring(4,7) == "H52") {
		this.modelYear = "F";
	} else if (productCode.substring(4,7) == "J43") {
		this.modelYear = "F";
	} else if (productCode.substring(4,7) == "J52") {
		this.modelYear = "F";
	} else if (productCode.substring(4,7) == "J53") {
		this.modelYear = "F";
	} else if (productCode.substring(4,7) == "J62") {
		this.modelYear = "F";
	} else if (productCode.substring(4,7) == "J55") {
		this.modelYear = "H";
	} else if (productCode.substring(4,7) == "J63") {
		this.modelYear = "H";
	} else if (productCode.substring(4,7) == "J64") {
		this.modelYear = "H";
	} else if (productCode.substring(4,6) == "HU") {
		this.modelYear = "HU";
	} else if (productCode.substring(4,7) == "K85") {
		this.modelYear = "HU";
	} else {
		this.modelYear = productCode.substring(4,5);
	}
	FileLog.write("Model Year is " + this.modelYear);
	
	//These checks are advisory only, and deliberately do not gate startup.
	//CheckHTTP tests general HTTP connectivity, which fails on a LAN that has no
	//route to the internet - but this app only ever talks to a Jellyfin server
	//on that same LAN, so an offline network is perfectly usable. Refusing to
	//start left the user on a dead screen with no way forward.
	if (phyConnection != 1 || http != 1 || gateway != 1) {
		FileLog.write("Network checks reported physical=" + phyConnection +
		              " http=" + http + " gateway=" + gateway + " - starting anyway");
	}

	//Ask for the MAC of the interface actually in use - GetMAC(1) is the
	//wired NIC, which returns nothing on a Wi-Fi only set.
	var MAC = pluginNetwork.GetMAC(interfaceType);
	if (MAC == false || MAC == null) {
		MAC = null;
	}
	FileLog.write("MAC address is "+MAC);
	Server.setDevice ("Samsung " + productCode);

    //Load Settings File - Check if file needs to be deleted due to development
    var fileJson = File.readSettings();
    var version = File.checkVersion(fileJson);
    if (version == "Undefined" ) {
    	//Delete Settings file and reload
    	File.deleteSettingsFile();
    	fileJson = File.readSettings();
    } else if (version != this.version) {
    	if (this.forceDeleteSettings == true) {
    		//Delete Settings file and reload
    		File.deleteSettingsFile();
	    	fileJson = File.readSettings();
    	} else {
    		//Update version in settings file to current version
    		fileJson.Version = this.version;
    	} 	File.writeAll(fileJson);
    }

    //Needs the settings file, so it has to come after the load above.
    //Seed from the DUID when we have a real MAC so an existing install keeps
    //its identity; otherwise a random per-install id is generated.
    Server.ensureDeviceID(MAC ? NNaviPlugin.GetDUID(MAC) : null);
    FileLog.write("Device ID is "+Server.getDeviceID());

    //Allow Evo Kit owners to override the model year.
    if (fileJson.TV !== undefined && fileJson.TV.ModelOverride !== undefined && fileJson.TV.ModelOverride != "None") {
    	switch(fileJson.TV.ModelOverride){
    	case "SEK1000":
    		this.modelYear = "F";
    		break;
    	case "SEK2000":
    		this.modelYear = "H";
    		break;
    	case "SEK2500":
    		this.modelYear = "H";
    		break;
    	}
    	FileLog.write("Model Year Override: " + this.modelYear);
    }
    
    //Check if Server exists
    if (fileJson.Servers.length > 1) {
    	//If no default show user Servers page (Can set default on that page)
    	var foundDefault = false;
    	for (var index = 0; index < fileJson.Servers.length; index++) {
    		if (fileJson.Servers[index].Default == true) {
    			foundDefault = true;
    			FileLog.write("Default server found.");
    			File.setServerEntry(index);
    			Server.testConnectionSettings(fileJson.Servers[index].Path,true);    				
    			break;
    		}
    	}
    	if (foundDefault == false) {
    		FileLog.write("Multiple servers defined. Loading the select server page.");
    		GuiPage_Servers.start();
    	}
    } else if (fileJson.Servers.length == 1) {
    	//If 1 server auto login with that
		FileLog.write("Jellyfin server name found in settings. Auto-connecting.");
    	File.setServerEntry(0);
    	Server.testConnectionSettings(fileJson.Servers[0].Path,true);
    } else {
    	//No Server Defined - Load GuiPage_IP
    	FileLog.write("No server defined. Loading the new server page.");
    	GuiPage_NewServer.start();
    }
};

Main.initKeys = function() {
	pluginAPI.registKey(tvKey.KEY_TOOLS);
	pluginAPI.registKey(tvKey.KEY_3D);
	//Every screen with a text field builds an IMEShell, but the keys it needs
	//were only registered on the add-server page. Reaching login directly -
	//which is what happens once a server is saved and the app auto-connects -
	//left the on-screen keyboard without its remote keys. Register once here
	//so it works wherever the keyboard is opened.
	pluginAPI.registIMEKey();
	FileLog.write("Key handlers initialised.");
};

Main.onUnload = function()
{
	// The image cache holds blob: URLs that are only valid for this page
	// session, so there is nothing worth persisting here.
	Support.screensaverOff();
	GuiImagePlayer.kill();
	GuiMusicPlayer.stopOnAppExit();
	GuiPlayer.stopOnAppExit();
	FileLog.flush();
	pluginAPI.unregistKey(tvKey.KEY_TOOLS);
	pluginAPI.unregistKey(tvKey.KEY_3D);
	pluginAPI.unregistIMEKey();
};
