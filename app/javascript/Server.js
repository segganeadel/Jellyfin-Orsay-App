var Server = {
	serverAddr : "",
	UserID : "",
	UserName : "",
	Device : "Samsung Smart TV",
	DeviceID : "00000000000000000000000000000000",
	AuthenticationToken : null,
}

//------------------------------------------------------------
//      Getter & Setter Functions
//------------------------------------------------------------

Server.getAuthToken = function() {
	return this.AuthenticationToken;
}

Server.getServerAddr = function() {
	return this.serverAddr;
}

// A truncated or malformed response should read as "no data" rather than
// throwing out of whichever screen asked for it.
Server.parseResponse = function(text) {
	try {
		return JSON.parse(text);
	} catch (e) {
		FileLog.write("Server : could not parse response - " + e);
		return null;
	}
}

// Jellyfin keys a session on DeviceId, so two TVs reporting the same id share
// one session: their progress overwrites each other's and stopping playback on
// one kills the other's transcode. Deriving the id from the MAC gave every set
// that fell back to the placeholder MAC an identical id, so generate a random
// id once per installation and keep it in the settings file instead.
Server.ensureDeviceID = function(seed) {
	var stored = File.getTVProperty("DeviceId");
	if (stored && stored.length == 32) {
		this.DeviceID = stored;
		return;
	}

	var id;
	if (seed && seed.length >= 32) {
		id = seed.substring(0, 32); //Keep an existing install's identity on upgrade.
	} else {
		var hex = "0123456789abcdef";
		id = "";
		for (var i = 0; i < 24; i++) {
			id += hex.charAt(Math.floor(Math.random() * 16));
		}
		//Mix in the clock so two sets booting together cannot land on the same id.
		id += ("00000000" + (new Date().getTime() % 0xffffffff).toString(16)).slice(-8);
	}

	this.DeviceID = id;
	File.setTVProperty("DeviceId", id);
}

Server.setServerAddr = function(serverAddr) {
	this.serverAddr = serverAddr;
}

Server.getUserID = function() {
	return this.UserID;
}

Server.setUserID = function(UserID) {
	this.UserID = UserID;
}

Server.getUserName = function() {
	return this.UserName;
}

Server.setUserName = function(UserName) {
	this.UserName = UserName;
}

Server.setUserFavourites = function(UserFavourites) {
	this.UserFavourites = UserFavourites;
}

Server.getUserFavourites = function(UserFavourites) {
	return this.UserFavourites;
}

Server.setDevice = function(Device) {
	this.Device = Device;
}

//Used in Settings
Server.getDevice = function() {
	return this.Device;
}

Server.setDeviceID = function(DeviceID) {
	this.DeviceID = DeviceID;
}

//Required in Transcoding functions + guiPlayer
Server.getDeviceID = function() {
	return this.DeviceID;
}
//------------------------------------------------------------
//      Generic Functions
//------------------------------------------------------------
Server.getCustomURL = function(SortParams) {
	if (SortParams != null){
		return  Server.getServerAddr() + SortParams;
	} else {
		return  Server.getServerAddr();
	}
}

Server.getItemTypeURL = function(SortParams) {
	if (SortParams != null){
		return  Server.getServerAddr() + "/Users/" + Server.getUserID() + "/Items?format=json" + SortParams;
	} else {
		return  Server.getServerAddr() + "/Users/" + Server.getUserID() + "/Items?format=json";
	}
}

Server.getThemeMedia = function(ItemID) {
	return  Server.getServerAddr() + "/Items/" + ItemID + "/ThemeMedia?UserId=" + Server.getUserID() + "&InheritFromParent=true&format=json"
}

Server.getChildItemsURL = function(ParentID, SortParams) {
	if (SortParams != null){
		return  Server.getServerAddr() + "/Users/" + Server.getUserID() + "/Items?ParentId="+ParentID+"&format=json" + SortParams;
	} else {
		return  Server.getServerAddr() + "/Users/" + Server.getUserID() + "/Items?ParentId="+ParentID+"&format=json";
	}
}

Server.getPlaybackInfoURL = function(itemId) {
	return Server.getServerAddr() + "/Items/" + itemId + "/PlaybackInfo?UserId=" + Server.getUserID();
}

Server.getPlaybackInfo = function(itemId) {
	var url = Server.getPlaybackInfoURL(itemId);
	return Server.getContent(url);
}

// Ask the server how to play an item, telling it what this panel can decode.
// The reply marks each source direct playable or supplies a transcode URL, so
// the decision is made against the real file rather than guessed from a table.
// Returns null on any failure, and the caller falls back to deciding locally.
Server.postPlaybackInfo = function(itemId, opts) {
	opts = opts || {};

	var url = this.getServerAddr() + "/Items/" + itemId +
	          "/PlaybackInfo?userId=" + encodeURIComponent(this.getUserID());

	var body = {
		"UserId" : this.getUserID(),
		"DeviceProfile" : GuiPlayer_DeviceProfile.build(),
		"MaxStreamingBitrate" : GuiPlayer_DeviceProfile.getMaxBitrate(),
		"StartTimeTicks" : opts.startTimeTicks || 0,
		"AutoOpenLiveStream" : true,
		"EnableDirectPlay" : true,
		"EnableDirectStream" : true,
		"EnableTranscoding" : true,
		"AllowVideoStreamCopy" : true,
		"AllowAudioStreamCopy" : true
	};
	if (opts.mediaSourceId) { body.MediaSourceId = opts.mediaSourceId; }
	if (opts.audioStreamIndex != null) { body.AudioStreamIndex = opts.audioStreamIndex; }
	if (opts.subtitleStreamIndex != null) { body.SubtitleStreamIndex = opts.subtitleStreamIndex; }

	var xmlHttp = new XMLHttpRequest();
	if (!xmlHttp) { return null; }

	try {
		xmlHttp.open("POST", url, false); //Sync: the answer is needed before playback can start.
		xmlHttp = this.setRequestHeaders(xmlHttp);
		xmlHttp.send(JSON.stringify(body));
	} catch (e) {
		FileLog.write("PlaybackInfo : POST failed - " + e);
		return null;
	}

	if (xmlHttp.status != 200) {
		FileLog.write("PlaybackInfo : POST returned HTTP " + xmlHttp.status);
		return null;
	}

	var parsed = Server.parseResponse(xmlHttp.responseText);
	if (parsed == null || parsed.MediaSources == null || parsed.MediaSources.length == 0) {
		FileLog.write("PlaybackInfo : POST returned no media sources");
		return null;
	}
	return parsed;
}

// Live TV holds a tuner open until the stream is closed explicitly.
Server.closeLiveStream = function(liveStreamId) {
	if (!liveStreamId) { return; }
	var url = this.serverAddr + "/LiveStreams/Close?liveStreamId=" + encodeURIComponent(liveStreamId);
	var xmlHttp = new XMLHttpRequest();
	if (xmlHttp) {
		xmlHttp.open("POST", url, true);
		xmlHttp = this.setRequestHeaders(xmlHttp);
		xmlHttp.send(null);
	}
}

Server.getItemInfoURL = function(ParentID, SortParams) {
	if (SortParams != null){
		return  Server.getServerAddr() + "/Users/" + Server.getUserID() + "/Items/"+ParentID+"?format=json" + SortParams;
	} else {
		return  Server.getServerAddr() + "/Users/" + Server.getUserID() + "/Items/"+ParentID+"?format=json";
	}
}

Server.getItemIntrosUrl = function(itemId, SortParams) {
	return  Server.getServerAddr() + "/Users/" + Server.getUserID() + "/Items/"+itemId+"/Intros"; //?format=json";
}

Server.getSearchURL = function(searchTermString) {
	var parsedSearchTermString = Support.parseSearchTerm(searchTermString);
	return Server.getServerAddr() + "/Search/Hints?format=json&UserId=" + Server.getUserID() + "&SearchTerm=" + parsedSearchTermString;
}

Server.getAdditionalPartsURL = function(ShowID) {
	return  Server.getServerAddr() + "/Videos/" + ShowID +  "/AdditionalParts?format=json&userId="+Server.getUserID();
}

Server.getAdjacentEpisodesURL = function(ShowID,SeasonID,EpisodeID) {
	return  Server.getServerAddr() + "/Shows/" + ShowID +  "/Episodes?format=json&ImageTypeLimit=1&seasonId="+SeasonID+"&userId="+Server.getUserID() +"&AdjacentTo=" + EpisodeID;
}

Server.getSeasonEpisodesURL = function(ShowID,SeasonID) {
	return  Server.getServerAddr() + "/Shows/" + ShowID +  "/Episodes?format=json&ImageTypeLimit=1&seasonId="+SeasonID+"&userId="+Server.getUserID();
}

Server.getImageURL = function(itemId,imagetype,maxwidth,maxheight,unplayedcount,played,playedpercentage,chapter) {
	var query = "";
	switch (imagetype) {
	case "Primary":
		query = "/Items/"+ itemId +"/Images/Primary/0?maxwidth="+maxwidth+"&maxheight="+maxheight + "&quality=90";
		break;
	case "Banner":
		query = "/Items/"+ itemId +"/Images/Banner/0?maxwidth="+maxwidth+"&maxheight="+maxheight + "&quality=90";
		break;
	case "Backdrop":
		query = "/Items/"+ itemId +"/Images/Backdrop/0?maxwidth="+maxwidth+"&maxheight="+maxheight + "&quality=90";
		break;
	case "Thumb":
		query = "/Items/"+ itemId +"/Images/Thumb/0?maxwidth="+maxwidth+"&maxheight="+maxheight + "&quality=90";
		break;
	case "Logo":
		query = "/Items/"+ itemId +"/Images/Logo/0?maxwidth="+maxwidth+"&maxheight="+maxheight + "&quality=90";
		break;
	case "Disc":
		query = "/Items/"+ itemId +"/Images/Disc/0?maxwidth="+maxwidth+"&maxheight="+maxheight + "&quality=90";
		break;
	case "UsersPrimary":
		query = "/Users/" + itemId + "/Images/Primary?maxwidth="+maxwidth+"&maxheight="+maxheight + "&quality=90";
		break;
	case "Chapter":
		query = "/Items/" + itemId + "/Images/Chapter/" + chapter + "?maxwidth="+maxwidth+"&maxheight="+maxheight + "&quality=90";
		break;
	}

	// Image endpoints are loaded via <img src> / blob XHR that bypass
	// setRequestHeaders, so the token must ride along in the query string.
	var token = Server.getAuthToken();
	var authQuery = token ? "&api_key=" + token : "";

	if (Main.isImageCaching()) {
			var found = false;

			for (var i = 0; i <Support.imageCachejson.Images.length; i++) {
				//Is image in cache - If so use it
				if (Support.imageCachejson.Images[i].URL == query) {
					found = true;
					break;
				}
			}

			if (found == true) {
				//Use data URI from file
				return Support.imageCachejson.Images[i].DataURI;
			} else {
				//Use URL & Add to Cache
				var full = Server.getServerAddr() +  query + authQuery;

				var xhr = new XMLHttpRequest();
				xhr.open('GET', full, true);
				xhr.responseType = 'blob';

				xhr.onload = function(e) {
				  if (this.status == 200) {
				    var blob = this.response;
			    	Support.imageCachejson.Images[Support.imageCachejson.Images.length] = {"URL":query,"DataURI":window.URL.createObjectURL(blob)};
				  }
				};
				xhr.send();


				return full;
			}
	} else {
		return Server.getServerAddr() +  query + authQuery;
	}
}

Server.getScreenSaverImageURL = function(itemId,imagetype,maxwidth,maxheight) {
	var query = "";
	switch (imagetype) {
		case "Backdrop":
			query =   Server.getServerAddr() + "/Items/"+ itemId +"/Images/Backdrop/0?quality=90&maxwidth="+maxwidth+"&maxheight="+maxheight;
			break;
		case "Primary":
			query =   Server.getServerAddr() + "/Items/"+ itemId +"/Images/Primary/0?quality=90&maxwidth="+maxwidth+"&maxheight="+maxheight;
			break;
	}
	var token = Server.getAuthToken();
	return token ? query + "&api_key=" + token : query;
}

Server.getBackgroundImageURL = function(itemId,imagetype,maxwidth,maxheight,unplayedcount,played,playedpercentage,totalbackdrops) {
	var query = "";
	var index =  Math.floor((Math.random()*totalbackdrops)+0);

	switch (imagetype) {

	case "Backdrop":
		query =   Server.getServerAddr() + "/Items/"+ itemId +"/Images/Backdrop/"+index+"?maxwidth="+maxwidth+"&maxheight="+maxheight;
		break;
	//Callers ask for Primary too. Without this the switch fell through and the
	//function returned "&Quality=90&api_key=..." with no address or path at all.
	case "Primary":
		query =   Server.getServerAddr() + "/Items/"+ itemId +"/Images/Primary/0?maxwidth="+maxwidth+"&maxheight="+maxheight;
		break;
	default:
		FileLog.write("Image : no background URL for image type " + imagetype);
		return null;
	}

	query = query + "&Quality=90";

	var token = Server.getAuthToken();
	return token ? query + "&api_key=" + token : query;
}

Server.getStreamUrl = function(itemId,mediaSourceId){
	var streamparams = '/master.m3u8?VideoCodec=h264&Profile=high&Level=41&MaxVideoBitDepth=8&MaxWidth=1920&VideoBitrate=10000000&AudioCodec=aac&audioBitrate=360000&TranscodingMaxAudioChannels=6&MediaSourceId='+mediaSourceId + '&api_key=' + Server.getAuthToken();
	var streamUrl = Server.getServerAddr() + '/Videos/' + itemId + streamparams + '&DeviceId='+Server.getDeviceID();
	return streamUrl;
}


Server.setRequestHeaders = function (xmlHttp, UserId) {
	// Build authorization header parts
	var authParts = [
		'Client="Samsung TV"',
		'Device="' + this.Device + '"',
		'DeviceId="' + this.DeviceID + '"',
		'Version="' + Main.getVersion() + '"'
	];

	// Add token if authenticated (modern Jellyfin expects token in header)
	if (this.AuthenticationToken != null) {
		authParts.push('Token="' + this.AuthenticationToken + '"');
	}

	var authHeader = "MediaBrowser " + authParts.join(", ");

	// Modern Jellyfin 10.11+: standard Authorization header
	xmlHttp.setRequestHeader("Authorization", authHeader);

	// Legacy fallback for older Jellyfin/Emby servers
	xmlHttp.setRequestHeader("X-Emby-Authorization", authHeader);
	if (this.AuthenticationToken != null) {
		xmlHttp.setRequestHeader("X-MediaBrowser-Token", this.AuthenticationToken);
	}

	xmlHttp.setRequestHeader("Content-Type", 'application/json; charset=UTF-8');
	return xmlHttp;
}

Server.getMoviesViewQueryPart = function() {
	var ParentId = Server.getUserViewId("movies", "UserView");

	if (ParentId == null) {
		return "";
	} else {
		return "&ParentId="+ParentId;
	}
}

Server.getTvViewQueryPart = function() {
	var ParentId = Server.getUserViewId("tvshows", "UserView");

	if (ParentId == null) {
		return "";
	} else {
		return "&ParentId="+ParentId;
	}
}

Server.getUserViewId = function (collectionType, Type) {
	var folderId = null;
	var userViews = Server.getUserViews();
	for (var i = 0; i < userViews.Items.length; i++){
		if ((Type === undefined || userViews.Items[i].Type == Type) && userViews.Items[i].CollectionType == collectionType){
			folderId = userViews.Items[i].Id;
		}
	}
	return folderId;
}

Server.getUserViews = function () {
	var url = this.serverAddr + "/Users/" + Server.getUserID() + "/Views?format=json&SortBy=SortName&SortOrder=Ascending";
	var userViews = Server.getContent(url);
	return userViews;
}

//------------------------------------------------------------
//      Settings Functions
//------------------------------------------------------------
Server.updateUserConfiguration = function(contentToPost) {
	var url = this.serverAddr + "/Users/" + Server.getUserID() + "/Configuration";
	var xmlHttp = new XMLHttpRequest();
	if (xmlHttp) {
		xmlHttp.open("POST", url , true); //must be true!
		xmlHttp = this.setRequestHeaders(xmlHttp);
		xmlHttp.send(contentToPost);
	}
}

//------------------------------------------------------------
//      Player Functions
//------------------------------------------------------------
Server.getSubtitles = function(url) {
	xmlHttp = new XMLHttpRequest();
	if (xmlHttp) {
		xmlHttp.open("GET", url , false); //must be false
		xmlHttp = this.setRequestHeaders(xmlHttp);
		xmlHttp.send(null);

		if (xmlHttp.status != 200) {
			alert (xmlHttp.status);
			return null;
		} else {
			return xmlHttp.responseText;
		}
	} else {
		alert ("Bad xmlHTTP Request");
		Server.Logout();
		GuiNotifications.setNotification("The TV could not create a request to the server.","Server Error",false);
		GuiUsers.start(true);
		return null;
	}
}


Server.videoStarted = function(showId,MediaSourceID,PlayMethod,PlaySessionId) {
	var url = this.serverAddr + "/Sessions/Playing";
	xmlHttp = new XMLHttpRequest();
	if (xmlHttp) {
		var contentToPost = '{"QueueableMediaTypes":["Video"],"CanSeek":false,"ItemId":"'+showId+'","PlaySessionId":"'+PlaySessionId+'","MediaSourceId":"'+MediaSourceID+'","IsPaused":false,"IsMuted":false,"PositionTicks":0,"PlayMethod":"'+PlayMethod+'"}';
		xmlHttp.open("POST", url , true); //must be true!
		xmlHttp = this.setRequestHeaders(xmlHttp);
		xmlHttp.send(contentToPost);
	}
}

Server.videoStopped = function(showId,MediaSourceID,ticks,PlayMethod,PlaySessionId) {
	var url = this.serverAddr + "/Sessions/Playing/Stopped";
	xmlHttp = new XMLHttpRequest();
	if (xmlHttp) {
		var contentToPost = '{"QueueableMediaTypes":["Video"],"CanSeek":false,"ItemId":"'+showId+'","PlaySessionId":"'+PlaySessionId+'","MediaSourceId":"'+MediaSourceID+'","IsPaused":false,"IsMuted":false,"PositionTicks":'+(ticks*10000)+',"PlayMethod":"'+PlayMethod+'"}';
		xmlHttp.open("POST", url , true); //must be true!
		xmlHttp = this.setRequestHeaders(xmlHttp);
		xmlHttp.send(contentToPost);
	}
}

Server.videoPaused = function(showId,MediaSourceID,ticks,PlayMethod,PlaySessionId) {
	var url = this.serverAddr + "/Sessions/Playing/Progress";
	xmlHttp = new XMLHttpRequest();
	if (xmlHttp) {
		var contentToPost = '{"QueueableMediaTypes":["Video"],"CanSeek":false,"ItemId":"'+showId+'","PlaySessionId":"'+PlaySessionId+'","MediaSourceId":"'+MediaSourceID+'","IsPaused":true,"IsMuted":false,"PositionTicks":'+(ticks*10000)+',"PlayMethod":"'+PlayMethod+'"}';
		xmlHttp.open("POST", url , true); //must be true!
		xmlHttp = this.setRequestHeaders(xmlHttp);
		xmlHttp.send(contentToPost);
	}
}

Server.videoTime = function(showId,MediaSourceID,ticks,PlayMethod,PlaySessionId) {
	var url = this.serverAddr + "/Sessions/Playing/Progress";
	xmlHttp = new XMLHttpRequest();
	if (xmlHttp) {
		var contentToPost = '{"QueueableMediaTypes":["Video"],"CanSeek":false,"ItemId":"'+showId+'","PlaySessionId":"'+PlaySessionId+'","MediaSourceId":"'+MediaSourceID+'","IsPaused":false,"IsMuted":false,"PositionTicks":'+(ticks*10000)+',"PlayMethod":"'+PlayMethod+'"}';
		xmlHttp.open("POST", url , true); //must be true!
		xmlHttp = this.setRequestHeaders(xmlHttp);
		xmlHttp.send(contentToPost);
	}
}

Server.stopHLSTranscode = function(playSessionId) {
	var url = this.serverAddr + "/Videos/ActiveEncodings?DeviceId="+this.DeviceID + (playSessionId ? "&PlaySessionId="+playSessionId : "");
	xmlHttp = new XMLHttpRequest();
	if (xmlHttp) {
		xmlHttp.open("DELETE", url , true); //ActiveEncodings is a DELETE endpoint
		xmlHttp = this.setRequestHeaders(xmlHttp);
		xmlHttp.send(null);
	}
}

//------------------------------------------------------------
//      Item Watched Status Functions
//------------------------------------------------------------

Server.setWatchedStatus = function(id) {
	var url = this.serverAddr + "/Users/" + this.UserID + "/PlayedItems/" + id;
	xmlHttp = new XMLHttpRequest();
	if (xmlHttp) {
		xmlHttp.open("POST", url , true); //must be true!
		xmlHttp = this.setRequestHeaders(xmlHttp);
		xmlHttp.send(null);
	}
}

Server.deleteWatchedStatus = function(id) {
	var url = this.serverAddr + "/Users/" + this.UserID + "/PlayedItems/" + id;
	xmlHttp = new XMLHttpRequest();
	if (xmlHttp) {
		xmlHttp.open("DELETE", url , true); //must be true!
		xmlHttp = this.setRequestHeaders(xmlHttp);
		xmlHttp.send(null);
	}
}


//------------------------------------------------------------
//       Item Favourite Status Functions
//------------------------------------------------------------

Server.setFavourite = function(id) {
	var url = this.serverAddr + "/Users/" + this.UserID + "/FavoriteItems/" + id;
	xmlHttp = new XMLHttpRequest();
	if (xmlHttp) {
		xmlHttp.open("POST", url , true); //must be true!
		xmlHttp = this.setRequestHeaders(xmlHttp);
		xmlHttp.send(null);
	}
}

Server.deleteFavourite = function(id) {
	var url = this.serverAddr + "/Users/" + this.UserID + "/FavoriteItems/" + id;
	xmlHttp = new XMLHttpRequest();
	if (xmlHttp) {
		xmlHttp.open("DELETE", url , true); //must be true!
		xmlHttp = this.setRequestHeaders(xmlHttp);
		xmlHttp.send(null);
	}
}

//------------------------------------------------------------
//       GuiIP Functions
//------------------------------------------------------------
Server.createPlaylist = function(name, ids, mediaType) {
	//A name with a space, & or # used to break or truncate the request.
	var url = this.serverAddr + "/Playlists?Name=" + encodeURIComponent(name) + "&Ids=" + ids + "&userId="+Server.getUserID() + "&MediaType=" + mediaType;
	xmlHttp = new XMLHttpRequest();
	if (xmlHttp) {
		xmlHttp.open("POST", url , true); //must be true!
		xmlHttp = this.setRequestHeaders(xmlHttp);
		xmlHttp.send(null);
	}
}

Server.deletePlaylist = function(playlistId) {
	var url = this.serverAddr + "/Items/"+playlistId;
	xmlHttp = new XMLHttpRequest();
	if (xmlHttp) {
		xmlHttp.open("DELETE", url , true); //must be true!
		xmlHttp = this.setRequestHeaders(xmlHttp);
		xmlHttp.send(null);
	}
}

Server.addToPlaylist = function(playlistId, ids) {
	var url = this.serverAddr + "/Playlists/"+ playlistId + "/Items?Ids=" + ids + "&userId="+Server.getUserID();
	xmlHttp = new XMLHttpRequest();
	if (xmlHttp) {
		xmlHttp.open("POST", url , true); //must be true!
		xmlHttp = this.setRequestHeaders(xmlHttp);
		xmlHttp.send(null);
	}
}

Server.removeFromPlaylist = function(playlistId, ids) {
	var url = this.serverAddr + "/Playlists/"+ playlistId + "/Items?EntryIds=" + ids + "&userId="+Server.getUserID();
	xmlHttp = new XMLHttpRequest();
	if (xmlHttp) {
		xmlHttp.open("DELETE", url , true); //must be true!
		xmlHttp = this.setRequestHeaders(xmlHttp);
		xmlHttp.send(null);
	}
}

Server.POST = function(url, item) {
	xmlHttp = new XMLHttpRequest();
	if (xmlHttp) {
		xmlHttp.open("POST", url , true); //must be true!
		xmlHttp = this.setRequestHeaders(xmlHttp);
		if (item){
			xmlHttp.send(JSON.stringify(item));
		} else {
			xmlHttp.send(null);
		}
	}
}

Server.DELETE = function(url, item) {
	xmlHttp = new XMLHttpRequest();
	if (xmlHttp) {
		xmlHttp.open("DELETE", url , true); //must be true!
		xmlHttp = this.setRequestHeaders(xmlHttp);
		if (item){
			xmlHttp.send(JSON.stringify(item));
		} else {
			xmlHttp.send(null);
		}
	}
}
//------------------------------------------------------------
//      Connection Settings - Auto-detect base path
//------------------------------------------------------------
// Base paths to try: root, /jellyfin (legacy), /emby (legacy)
Server._basePaths = ["", "/jellyfin", "/emby"];

Server.testConnectionSettings = function (server, fromFile) {
	Server._tryConnectWithPath(server, 0, fromFile);
};

Server._tryConnectWithPath = function (server, pathIndex, fromFile) {
	if (pathIndex >= Server._basePaths.length) {
		// All paths exhausted - connection failed
		GuiNotifications.setNotification("Jellyfin server not found at any known path.", "Network Error", true);
		Support.removeSplashScreen();
		setTimeout(function() {
			if (fromFile) {
				GuiPage_Servers.start();
			} else {
				GuiPage_NewServer.start();
			}
		}, 3000);
		return;
	}

	var basePath = Server._basePaths[pathIndex];
	// Accept host, host:port, or a full URL; only default to http:// when no scheme was given.
	var serverBase = /^https?:\/\//i.test(server) ? server : "http://" + server;
	var testUrl = serverBase + basePath + "/System/Info/Public?format=json";

	var xmlHttp = new XMLHttpRequest();
	xmlHttp.open("GET", testUrl, false);
	xmlHttp.setRequestHeader("Content-Type", "application/json");

	try {
		xmlHttp.send(null);
	} catch (e) {
		// Network error - try next path
		Server._tryConnectWithPath(server, pathIndex + 1, fromFile);
		return;
	}

	if (xmlHttp.status === 200) {
		// Success!
		var json = Server.parseResponse(xmlHttp.responseText);
		if (json == null) {
			//Answered, but not with something we can read - keep looking.
			Server._tryConnectWithPath(server, pathIndex + 1, fromFile);
			return;
		}
		GuiNotifications.setNotification(
			'Connected to "' + json.ServerName + '"',
			json.ProductName + " v" + json.Version,
			true
		);

		if (!fromFile) {
			File.saveServerToFile(json.Id, json.ServerName, server);
		}

		// Set Server.serverAddr with detected base path
		Server.setServerAddr(serverBase + basePath);

		// Check Server Version - reuse the info we just fetched.
		if (ServerVersion.checkServerVersion(json)) {
			GuiUsers.start(true);
		} else {
			ServerVersion.start();
		}
	} else if (xmlHttp.status === 404) {
		// Path not found - try next
		Server._tryConnectWithPath(server, pathIndex + 1, fromFile);
	} else if (xmlHttp.status === 0) {
		// No network response
		GuiNotifications.setNotification("Your Jellyfin server is not responding.", "Network Error " + xmlHttp.status, true);
		Support.removeSplashScreen();
		setTimeout(function() {
			if (fromFile) {
				GuiPage_Servers.start();
			} else {
				GuiPage_NewServer.start();
			}
		}, 3000);
	} else {
		// Other error (500, etc.)
		GuiNotifications.setNotification("Jellyfin server connection error.", "Network Error " + xmlHttp.status, true);
		Support.removeSplashScreen();
		setTimeout(function() {
			if (fromFile) {
				GuiPage_Servers.start();
			} else {
				GuiPage_NewServer.start();
			}
		}, 3000);
	}
};

//------------------------------------------------------------
//      GuiUsers Functions
//------------------------------------------------------------

Server.Authenticate = function(UserId, UserName, Password) {
	// The on-screen keyboard leaves stray whitespace in the input fields, and
	// the server compares the name literally - " adels" is not "adels". A TV
	// remote cannot type a deliberate leading or trailing space, so trimming
	// both fields is safe and stops a silent "bad username or password".
	UserName = (UserName == null) ? "" : String(UserName).replace(/^\s+|\s+$/g, "");
	Password = (Password == null) ? "" : String(Password).replace(/^\s+|\s+$/g, "");

	if (UserName == "") {
		FileLog.write("Auth : Refused - no username entered");
		return false;
	}

	var url = Server.getServerAddr() + "/Users/AuthenticateByName?format=json";
    var params =  JSON.stringify({"Username":UserName,"Pw":Password});

    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "POST", url , false ); //Authenticate must be false - need response before continuing!
    xmlHttp = this.setRequestHeaders(xmlHttp);

    try {
        xmlHttp.send(params);
    } catch (e) {
        FileLog.write("Auth : Request failed for user '" + UserName + "' - " + e);
        return false;
    }

    //Log what actually came back - the on-screen message cannot tell a rejected
    //password from an unreachable server, which makes this impossible to debug.
    FileLog.write("Auth : '" + UserName + "' -> HTTP " + xmlHttp.status);

    if (xmlHttp.status != 200) {
    	return false;
    } else {
    	var session = Server.parseResponse(xmlHttp.responseText);
    	if (session == null || session.User == null) {
    		FileLog.write("Auth : server returned 200 but no usable session");
    		return false;
    	}
    	this.AuthenticationToken = session.AccessToken;
    	this.setUserID(session.User.Id);
    	this.setUserName(UserName);
		FileLog.write("User "+ UserName +" authenticated. ");
    	return true;
    }
}

Server.Logout = function() {
	var url = this.serverAddr + "/Sessions/Logout";
	xmlHttp = new XMLHttpRequest();
	if (xmlHttp) {
		xmlHttp.open("POST", url , true); //must be true!
		xmlHttp = this.setRequestHeaders(xmlHttp);
		xmlHttp.send(null);
	}

	//Close down any running items
	GuiImagePlayer_Screensaver.kill();
	GuiImagePlayer.kill();
	GuiMusicPlayer.stopOnAppExit();
	GuiPlayer.stopOnAppExit();
	FileLog.write("---------------------------------------------------------------------");
}

//------------------------------------------------------------
//      Get Content - JSON REQUESTS
//------------------------------------------------------------
Server.getContent = function(url) {
	var xmlHttp = new XMLHttpRequest();
	if (xmlHttp) {
		xmlHttp.open("GET", url , false); //must be false
		xmlHttp = this.setRequestHeaders(xmlHttp);
		xmlHttp.send(null);

		if (xmlHttp.status != 200) {
			FileLog.write("Server Error: The HTTP status returned by the server was "+xmlHttp.status);
			FileLog.write(url);
			GuiNotifications.setNotification("The HTTP status code returned by the server was "+xmlHttp.status+".", "Server Error:");
			return null;
		} else {
			return Server.parseResponse(xmlHttp.responseText);
		}
	} else {
		alert ("Bad xmlHTTP Request");
		Server.Logout();
		GuiNotifications.setNotification("The TV could not create a request to the server.","Server Error",false);
		GuiUsers.start(true);
		return null;
	}
}
