//NOTE
//
//Samsung Player accepts seconds
//Samsung Current time works in seconds * 1000
//Jellyfin works in seconds * 10000000

var GuiPlayer = {	
		plugin : null,
		pluginAudio : null,
		pluginScreen : null,
		
		Status : "STOPPED",
		currentTime : 0,
		updateTimeCount : 0,
		setThreeD : false,
		PlayMethod : "",
		videoStartTime : null,
		offsetSeconds : 0, //For transcode, this holds the position the transcode started in the file
		
		playingMediaSource : null,
		playingMediaSourceIndex : null,
		playingURL : null,
		playingTranscodeStatus : null,
		playingVideoIndex : null,
		playingAudioIndex : null,
		playingSubtitleIndex : null,
			
		VideoData : null,
		PlayerData : null,
		PlayerDataSubtitle : null,
		PlayerIndex : null,
		PlaySessionId : null,
		LiveStreamId : null,
		
		subtitleInterval : null,
		subtitleShowingIndex : 0,
		subtitleSeeking : false,
		startParams : [],
		infoTimer : null,

		//Scanning speed: 1 is normal, negative is backwards. There is no way to
		//read it back from the player, so it is tracked here.
		playbackSpeed : 1,
		playStartedAt : null,
		speedUnsupported : false,

		//Read from the player once the stream is open, rather than taken from
		//the server's description of the source file.
		decodedWidth : null,
		decodedHeight : null,
		playerDuration : null
};


GuiPlayer.init = function() {
	GuiMusicPlayer.stopOnAppExit();
	
	this.plugin = document.getElementById("pluginPlayer");
	this.pluginAudio = document.getElementById("pluginObjectAudio");
	this.pluginScreen = document.getElementById("pluginScreen");
	
	//Set up Player
	this.plugin.OnConnectionFailed = 'GuiPlayer.handleConnectionFailed';
	this.plugin.OnAuthenticationFailed = 'GuiPlayer.handleAuthenticationFailed';
	this.plugin.OnNetworkDisconnected = 'GuiPlayer.handleOnNetworkDisconnected';
	this.plugin.OnRenderError = 'GuiPlayer.handleRenderError';
	this.plugin.OnStreamNotFound = 'GuiPlayer.handleStreamNotFound';
	this.plugin.OnRenderingComplete = 'GuiPlayer.handleOnRenderingComplete';
	this.plugin.OnCurrentPlayTime = 'GuiPlayer.setCurrentTime';
    this.plugin.OnBufferingStart = 'GuiPlayer.onBufferingStart';
    this.plugin.OnBufferingProgress = 'GuiPlayer.onBufferingProgress';
    this.plugin.OnBufferingComplete = 'GuiPlayer.onBufferingComplete';  
    this.plugin.OnStreamInfoReady = 'GuiPlayer.OnStreamInfoReady'; 
    this.setupBuffers();
};

//The player was given a total buffer size and nothing else, leaving the rest
//at firmware defaults. The two that matter are how much is gathered before
//playback starts and how much has to be gathered again after a stall, which is
//what makes buffering flap on a weak connection.
GuiPlayer.setupBuffers = function() {
	//40MB is well beyond the guide's own 5MB example and the call can simply
	//fail on a set with less to spare, silently leaving the default. Step down
	//until one is accepted.
	var sizes = [40*1024*1024, 20*1024*1024, 10*1024*1024, 5*1024*1024];
	for (var i = 0; i < sizes.length; i++) {
		var ok = false;
		try { ok = this.plugin.SetTotalBufferSize(sizes[i]); } catch (e) { ok = false; }
		if (ok !== false) {
			FileLog.write("Playback : total buffer " + Math.round(sizes[i]/1048576) + "MB");
			break;
		}
	}

	//Sizes are in bytes, despite the guide's prose saying percent - both its
	//syntax and its examples pass byte counts.
	try { this.plugin.SetInitialBuffer(1024*1024); } catch (e) {}
	try { this.plugin.SetPendingBuffer(512*1024); } catch (e) {}
};

GuiPlayer.start = function(title,url,startingPlaybackTick,playedFromPage,isCinemaMode,featureUrl) { 
	if (GuiMusicPlayer.Status == "PLAYING" || GuiMusicPlayer.Status == "PAUSED") {
		GuiMusicPlayer.stopPlayback();
	}
	
	//Run only once in loading initial request - subsequent vids should go thru the startPlayback
	this.startParams = [title,url,startingPlaybackTick,playedFromPage,isCinemaMode,featureUrl];
	
	//Display Loading 
	document.getElementById("guiPlayer_Loading").style.visibility = "";

    //Get Item Data (Media Streams)
    this.VideoData = Server.getContent(url);
    //Every exit from here has to clear the spinner, or it is left over a page
    //that is no longer doing anything - which is what the stuck "Loading" was.
    if (this.VideoData == null) { this.abandonStart(); return; }
    
    this.PlayerIndex = 0; // Play All  - Default
    if (title == "PlayAll") {
    	if (this.VideoData.TotalRecordCount == 0) {
    		this.abandonStart();
    		return;
    	}
    	if (this.startParams[4] === true && this.startParams[5] != null) {
    		//We are in Cinema Mode. Add the main feature to the end of the intros playlist.
    		this.featureData = Server.getContent(this.startParams[5]);
    		this.VideoData.Items.push(this.featureData);
    	}
    	this.PlayerData = this.VideoData.Items[this.PlayerIndex];
    } else {
    	if (this.VideoData.LocationType == "Virtual") {
    		this.abandonStart();
    		return;
    	}
    	//Enter Cinema Mode?
    	var introsUrl = Server.getItemIntrosUrl(this.VideoData.Id);
    	var intros = Server.getContent(introsUrl);
    	if (File.getUserProperty("EnableCinemaMode") && intros != null && intros.TotalRecordCount > 0 && startingPlaybackTick == 0) {
    		FileLog.write("Playback: Switching to Cinema Mode.");
    		//Start again in Cinema Mode.
    		GuiPlayer.start("PlayAll",introsUrl,0,"GuiPage_ItemDetails",true,this.startParams[1]);
    		return;
    	} else {
    		this.PlayerData = this.VideoData;
    	}
    }

    //Take focus to no input
	document.getElementById("NoKeyInput").focus();
    
	//Load Versions
    GuiPlayer_Versions.start(this.PlayerData,startingPlaybackTick,playedFromPage);
};

//Give up before playback began: take the spinner down and hand the screen back.
GuiPlayer.abandonStart = function() {
	var el = document.getElementById("guiPlayer_Loading");
	if (el != null) { el.style.visibility = "hidden"; }
	var page = document.getElementById("guiLoading");
	if (page != null) { page.style.visibility = "hidden"; }
};

GuiPlayer.startPlayback = function(TranscodeAlg, resumeTicksSamsung) {
	//Initiate Player for Video
	this.init();
	FileLog.write("Playback : Player Initialised");
	
	//Turn off Screensaver
    Support.screensaverOff();
	pluginAPI.setOffScreenSaver();  

	//Reset Vars
	this.Status = "STOPPED";
	this.currentTime = 0;
    this.updateTimeCount = 0;
    this.setThreeD = false;
	this.offsetSeconds = 0;
	this.PlayerDataSubtitle = null;
	this.subtitleShowingIndex = 0;
	this.subtitleSeeking = false;
	this.videoStartTime = resumeTicksSamsung;
	//Measured from the stream once OnStreamInfoReady fires. Cleared here so a
	//previous title's numbers cannot be used for this one if it never does.
	this.decodedWidth = null;
	this.decodedHeight = null;
	this.playerDuration = null;
	this.playbackSpeed = 1;
	this.playStartedAt = new Date().getTime();
	
	//Expand TranscodeAlg to useful variables!!!
	this.playingMediaSourceIndex = TranscodeAlg[0];
	this.playingMediaSource = this.PlayerData.MediaSources[TranscodeAlg[0]];
	this.playingURL = TranscodeAlg[1];
	this.playingTranscodeStatus = TranscodeAlg[2];
	this.playingVideoIndex = TranscodeAlg[3];
	this.playingAudioIndex = TranscodeAlg[4];
	this.playingSubtitleIndex = TranscodeAlg[5];
	
	//Set PlayMethod. Jellyfin only accepts DirectPlay/DirectStream/Transcode here,
	//and rejects the whole playback report if the value is empty - which silently
	//cost us the resume point on every audio-transcoded title. Everything that is
	//not a straight direct play goes through the transcoder, so report Transcode.
	if (this.playingTranscodeStatus == "Direct Play"){
		this.PlayMethod = "DirectPlay";
	} else {
		this.PlayMethod = "Transcode";
	}

    //Set offsetSeconds time
    this.offsetSeconds = 0;

    //Set up GuiPlayer_Display
    GuiPlayer_Display.setDisplay(this.PlayerData,this.playingMediaSource,this.playingTranscodeStatus,this.offsetSeconds,this.playingVideoIndex,this.playingAudioIndex,this.playingSubtitleIndex,this.playingMediaSourceIndex);
    
	//Set Resolution Display
	this.setDisplaySize();
	
	//Subtitles - If resuming find the correct index to start from!
    FileLog.write("Playback : Start Subtitle Processing");
	this.setSubtitles(this.playingSubtitleIndex);
	this.updateSubtitleTime(resumeTicksSamsung,"NewSubs");
	FileLog.write("Playback : End Subtitle Processing");

	//Create Tools Menu
	GuiPlayer_Display.createToolsMenu();
	
	//Reuse the session GuiPlayer_Versions already opened. Asking for PlaybackInfo
	//again mints a second PlaySessionId server-side that nothing ever stops, so
	//the first one lingers until the server's idle reaper clears it.
	var playbackInfo = GuiPlayer_Versions.playbackInfo;
	if (playbackInfo == null) {
		playbackInfo = Server.getPlaybackInfo(this.PlayerData.Id);
	}
	this.PlaySessionId = playbackInfo ? playbackInfo.PlaySessionId : null;

	//Appending a null id would report progress against a session that does not exist.
	var url = this.playingURL;
	if (this.PlaySessionId) {
		url += '&PlaySessionId=' + this.PlaySessionId;
	}

	// DEPRECATED: StartTimeTicks is not supported by Jellyfin >= 10.7.x
	//Update URL with resumeticks
	//url += '&StartTimeTicks=' + (resumeTicksSamsung*10000);

	//The Samsung player needs to be told a URL is HLS; without this it treats
	//the .m3u8 as a plain file and fails with OnNetworkDisconnected, so every
	//transcoded or remuxed stream refused to start. Subtitles are unaffected -
	//the app fetches SRT separately and renders them itself.
	if (this.PlayMethod != "DirectPlay") {
		url += '|COMPONENT=HLS';
	}

	//A transcode has to be started, and ffmpeg produces nothing for the first
	//few seconds. The default start timeout can expire in that window and
	//surface as a connection failure, so allow longer when the server is
	//encoding than when it is simply sending a file.
	try {
		this.plugin.SetInitialTimeOut(this.PlayMethod == "DirectPlay" ? 30 : 60);
	} catch (e) {}

	//Live TV holds a tuner until the stream is closed, so remember which one.
	this.LiveStreamId = null;
	if (playbackInfo != null && playbackInfo.MediaSources != null) {
		var negotiated = playbackInfo.MediaSources[this.playingMediaSourceIndex];
		if (negotiated != null && negotiated.LiveStreamId) {
			this.LiveStreamId = negotiated.LiveStreamId;
			FileLog.write("Playback : live stream " + this.LiveStreamId);
		}
	}

	//Update Server content is playing * update time
	Server.videoStarted(this.PlayerData.Id,this.playingMediaSource.Id,this.PlayMethod,this.PlaySessionId);
	FileLog.write("Playback : E+ Series Playback - Load URL");
    
	var position = Math.round(resumeTicksSamsung / 1000);
    this.plugin.ResumePlay(url,position); 
};

GuiPlayer.stopPlayback = function() {
	//Playback turned the television's own screensaver off so it could not cut
	//in over a film. Turn it back on now, or one video leaves the set without
	//a screensaver for the rest of the session.
	Support.screensaverOn();
	pluginAPI.setOnScreenSaver();

	FileLog.write("Playback : Stopping");
	this.clearGuiItems();
	this.plugin.Stop();
	this.Status = "STOPPED";
	//The stream is gone; scanning state goes with it. speedUnsupported is a
	//property of the hardware, so that is deliberately kept.
	this.playbackSpeed = 1;
	Server.videoStopped(this.PlayerData.Id,this.playingMediaSource.Id,this.currentTime,this.PlayMethod,this.PlaySessionId,this.PlayerData.RunTimeTicks);
	
	//Tell the server to tear down the encode. This was gated to D-series, which
	//left every other model relying on the stop report alone to reap ffmpeg.
	if (this.PlayMethod != "DirectPlay") {
		Server.stopHLSTranscode(this.PlaySessionId);
	}

	//Release the tuner. Without this it stays held until the server times the
	//stream out, and the next attempt to watch live TV finds none free.
	if (this.LiveStreamId) {
		Server.closeLiveStream(this.LiveStreamId);
		this.LiveStreamId = null;
	}
};

GuiPlayer.setDisplaySize = function() {
	var stream = this.playingMediaSource.MediaStreams[this.playingVideoIndex];
	var aspectRatio = (stream === undefined) ? "16:9" : stream.AspectRatio;

	//Prefer what the decoder reports once it knows. The source description is
	//only a guess at what will arrive, and is simply wrong when the server
	//rescaled the picture on its way out.
	var width = this.decodedWidth;
	var height = this.decodedHeight;
	if (!(width > 0 && height > 0)) {
		if (stream === undefined) { width = null; height = null; }
		else { width = stream.Width; height = stream.Height; }
	}

	if (aspectRatio == "16:9") {
		this.plugin.SetDisplayArea(0, 0, 960, 540);
	} else if (aspectRatio == "4:3") {
		var newResolutionX = Math.round(540 * 4 / 3);
		var newResolutionY = 540;
		var centering = Math.round((960 - newResolutionX)/2);

		this.plugin.SetDisplayArea(parseInt(centering), parseInt(0), parseInt(newResolutionX), parseInt(newResolutionY));
	} else if (width > 0 && height > 0) {
		//Scale Video
		var ratioToShrinkX = 960 / width;
		var ratioToShrinkY = 540 / height;

		if (ratioToShrinkX < ratioToShrinkY) {
			var newResolutionX = 960;
			var newResolutionY = Math.round(height * ratioToShrinkX);
			var centering = Math.round((540-newResolutionY)/2);

			this.plugin.SetDisplayArea(parseInt(0), parseInt(centering), parseInt(newResolutionX), parseInt(newResolutionY));
		} else {
			var newResolutionX = Math.round(width * ratioToShrinkY);
			var newResolutionY = 540;
			var centering = Math.round((960-newResolutionX)/2);

			this.plugin.SetDisplayArea(parseInt(centering), parseInt(0), parseInt(newResolutionX), parseInt(newResolutionY));
		}
	} else {
		//No dimensions from either source: fill the screen rather than
		//dereferencing a stream that is not there.
		this.plugin.SetDisplayArea(0, 0, 960, 540);
	}
};

GuiPlayer.setSubtitles = function(selectedSubtitleIndex) {
	if (selectedSubtitleIndex > -1) {
		var Stream = this.playingMediaSource.MediaStreams[selectedSubtitleIndex];
		if (Stream.IsTextSubtitleStream) {
			//Set Colour & Size from User Settings
			Support.styleSubtitles("guiPlayer_Subtitles");
			
		    var url = Server.getCustomURL("/Videos/"+ this.PlayerData.Id+"/"+this.playingMediaSource.Id+"/Subtitles/"+selectedSubtitleIndex+"/Stream.srt?api_key=" + Server.getAuthToken());
		    this.PlayerDataSubtitle = Server.getSubtitles(url);
			FileLog.write("Subtitles : loaded "+url);
			
		    if (this.PlayerDataSubtitle == null) { 
		    	this.playingSubtitleIndex = -1; 
		    	return; 
		    } else {
		    	this.playingSubtitleIndex = selectedSubtitleIndex;
		    }
		    try{
		    	 this.PlayerDataSubtitle = parser.fromSrt(this.PlayerDataSubtitle,true);
		    }catch(e){
		        //On a malformed file this left the raw text in place, and the sort
		        //below then threw outside the try and killed playback.
		        FileLog.write("Subtitles : could not parse the subtitle file - " + e);
		        this.PlayerDataSubtitle = null;
		        this.playingSubtitleIndex = -1;
		        return;
		    }

			// subtitles may not be sorted ascending by startTime, but we require it
			this.PlayerDataSubtitle.sort(function(a, b) {
				return a.startTime - b.startTime;
			});
		}
	}
};

GuiPlayer.updateSubtitleTime = function(newTime,direction) {
	if (this.playingSubtitleIndex != -1) {
		//Clear Down Subtitles
		this.subtitleSeeking = true;
		document.getElementById("guiPlayer_Subtitles").innerHTML = "";
		document.getElementById("guiPlayer_Subtitles").style.visibility = "hidden";
		
		if (direction == "FF") {
			if (newTime > this.PlayerDataSubtitle[this.PlayerDataSubtitle.length -1].startTime) {
				this.subtitleShowingIndex = this.PlayerDataSubtitle.length -1;
			} else {
				for (var index = this.subtitleShowingIndex; index < this.PlayerDataSubtitle.length; index++) {
					if (newTime <= this.PlayerDataSubtitle[index].startTime) {
						this.subtitleShowingIndex = index;
						break;
					}
				}
			}
		} else if (direction == "RW") {
			if (newTime < this.PlayerDataSubtitle[1].startTime) {
				this.subtitleShowingIndex = 1;
			} else {
				for (var index = 1; index <= this.subtitleShowingIndex; index++) {
					if (newTime <= this.PlayerDataSubtitle[index].startTime) {
						this.subtitleShowingIndex = index;
						break;
					}
				}
			}	
		} else {
			this.subtitleShowingIndex = 0;
			for (var index = 0; index < this.PlayerDataSubtitle.length; index++) {				
				if (newTime <= this.PlayerDataSubtitle[index].startTime) {
					this.subtitleShowingIndex = index;
					break;
				}
			}	
		}
		FileLog.write("Subtitle : new subtitleShowingIndex:  "+this.subtitleShowingIndex +" @ "+newTime);
		this.subtitleSeeking = false;
	}
};


//--------------------------------------------------------------------------------------------------

GuiPlayer.handleOnRenderingComplete = function() {
	GuiPlayer.stopPlayback();
	FileLog.write("Playback : Rendering Complete");
	
	if (this.startParams[0] == "PlayAll") {
	////Call Resume Option - Check playlist first, then AutoPlay property, then return
		this.PlayerIndex++;
		if (this.VideoData.Items.length > this.PlayerIndex) {	
			//Take focus to no input
			document.getElementById("NoKeyInput").focus();
			
			this.PlayerData = this.VideoData.Items[this.PlayerIndex];
			GuiPlayer_Versions.start(this.PlayerData,0,this.startParams[3]);
		} else {
			this.PlayerIndex = 0;
			GuiPlayer_Display.restorePreviousMenu();
		}
	} else if (File.getUserProperty("AutoPlay")){
		if (this.PlayerData.Type == "Episode") {
			this.AdjacentData = Server.getContent(Server.getAdjacentEpisodesURL(this.PlayerData.SeriesId,this.PlayerData.SeasonId,this.PlayerData.Id));
			if (this.AdjacentData == null) { return; }
			
			if (this.AdjacentData.Items.length == 2 && (this.AdjacentData.Items[1].IndexNumber > this.PlayerData.IndexNumber)) {
				var url = Server.getItemInfoURL(this.AdjacentData.Items[1].Id);
				//Take focus to no input
				document.getElementById("NoKeyInput").focus();
				this.PlayerData = Server.getContent(url);
				if (this.PlayerData == null) { return; }
				GuiPlayer_Versions.start(this.PlayerData,0,this.startParams[3]);
			} else if (this.AdjacentData.Items.length > 2) {
				//Take focus to no input
				document.getElementById("NoKeyInput").focus();
				var url = Server.getItemInfoURL(this.AdjacentData.Items[2].Id);
				this.PlayerData = Server.getContent(url);
				if (this.PlayerData == null) { return; }
				GuiPlayer_Versions.start(this.PlayerData,0,this.startParams[3]);
			} else {
				GuiPlayer_Display.restorePreviousMenu();
			}
		} else {
			GuiPlayer_Display.restorePreviousMenu();
		}
	} else {
		GuiPlayer_Display.restorePreviousMenu();
	}
};

GuiPlayer.handleOnNetworkDisconnected = function() {
	//Transcoded files throw this error at end of playback?
	FileLog.write("Playback : Network Disconnected");
	GuiNotifications.setNotification(this.playingURL,"NETWORK DISCONNECTED");
	GuiPlayer.stopPlayback();
	GuiPlayer_Display.restorePreviousMenu();
};

GuiPlayer.handleConnectionFailed = function() {
	FileLog.write("Playback : Network Disconnected");
	GuiNotifications.setNotification(this.playingURL,"CONNECTION ERROR");
	GuiPlayer.stopPlayback();
	GuiPlayer_Display.restorePreviousMenu();
};

GuiPlayer.handleAuthenticationFailed = function() {
	FileLog.write("Playback : Authentication Error");
	GuiNotifications.setNotification("AUTHENTICATION ERROR");
	GuiPlayer.stopPlayback();
	GuiPlayer_Display.restorePreviousMenu();
};

GuiPlayer.handleRenderError = function(RenderErrorType) {
	FileLog.write("Playback : Render Error " + RenderErrorType);
    GuiNotifications.setNotification("Rendor Error Type : " + RenderErrorType);
    GuiPlayer.stopPlayback();
    GuiPlayer_Display.restorePreviousMenu();
};

GuiPlayer.handleStreamNotFound = function() {
	FileLog.write("Playback : Stream Not Found");
	GuiNotifications.setNotification("STREAM NOT FOUND");
	GuiPlayer.stopPlayback();
	GuiPlayer_Display.restorePreviousMenu();
};

GuiPlayer.setCurrentTime = function(time) {
	if (GuiPlayer_Display.statsVisible) { GuiPlayer_Display.updateStats(); }
	if (this.Status == "PLAYING") {
		this.currentTime = parseInt(time);

		//Subtitle Update
		if (this.playingSubtitleIndex != null && this.PlayerDataSubtitle != null && this.subtitleSeeking == false) {
			if (this.currentTime >= this.PlayerDataSubtitle[this.subtitleShowingIndex].endTime) {
				document.getElementById("guiPlayer_Subtitles").innerHTML = "";
				document.getElementById("guiPlayer_Subtitles").style.visibility = "hidden";
				if (this.PlayerDataSubtitle.length -1 > this.subtitleShowingIndex){
					this.subtitleShowingIndex++;
				}
			}
			if (this.currentTime >= this.PlayerDataSubtitle[this.subtitleShowingIndex].startTime && this.currentTime < this.PlayerDataSubtitle[this.subtitleShowingIndex].endTime && document.getElementById("guiPlayer_Subtitles").innerHTML != this.PlayerDataSubtitle.text) {
				var subtitleText = this.PlayerDataSubtitle[this.subtitleShowingIndex].text;
				subtitleText = subtitleText.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br />$2'); //support two-line subtitles

				// remove redundant breaks
				subtitleText = subtitleText.replace(/^<br \/>/, '');
				subtitleText = subtitleText.replace(/<br \/>$/, '');

				document.getElementById("guiPlayer_Subtitles").innerHTML = subtitleText; 
				document.getElementById("guiPlayer_Subtitles").style.visibility = "";
			}
		}
		
		//Update GUIs
		if (this.PlayerData.Type == "ChannelVideoItem") {
			document.getElementById("guiPlayer_Info_ProgressBar_Current").style.width = "0%";
			document.getElementById("guiPlayer_Info_Time").innerHTML = Support.convertTicksToTimeSingle(this.currentTime);
		} else {
			if (time > 0 && this.setThreeD == false) {
				//Check 3D & Audio
			    //Set Samsung Audio Output between DTS or PCM
			    this.setupAudioConfiguration();
			    this.setupThreeDConfiguration();			
			    this.setThreeD = true;
			}
			percentage = (100 * this.currentTime / this.getDurationMs());	
			document.getElementById("guiPlayer_Info_ProgressBar_Current").style.width = percentage + "%";
			document.getElementById("guiPlayer_Info_Time").innerHTML = Support.convertTicksToTime(this.currentTime, this.getDurationMs());
			this.updateTimeCount++;
			if (this.updateTimeCount == 8) {
				this.updateTimeCount = 0;
				Server.videoTime(this.PlayerData.Id,this.playingMediaSource.Id,this.currentTime,this.PlayMethod,this.PlaySessionId);
			}
		}
	}
};

GuiPlayer.onBufferingStart = function() {
	if (GuiMusicPlayer.Status == "PLAYING"){
		return;
	}
	this.Status = "PLAYING";
	FileLog.write("Playback : Buffering...");
	
	//Show Loading Screen
    document.getElementById("guiPlayer_Loading").style.visibility = "";
	
	//Stop Subtitle Display - Mainly for Transcode pauses
	if (this.playingSubtitleIndex != null) {
		this.subtitleSeeking = true;
	}
};

GuiPlayer.onBufferingProgress = function(percent) {
	GuiPlayer_Display.lastBufferPercent = percent;
	if (document.getElementById("guiPlayer_Loading").style.visibility == "" && percent > 5){
		document.getElementById("guiPlayer_Loading").innerHTML = "Buffering " + percent + "%";
	}
	FileLog.write("Playback : Buffering " + percent + "%");
};

GuiPlayer.onBufferingComplete = function() {
	if (GuiMusicPlayer.Status == "PLAYING"){
		return;
	}
	FileLog.write("Playback : Buffering Complete");
    
  //Start Subtitle Display - Mainly for Transcode pauses
	if (this.playingSubtitleIndex != null) {
		this.subtitleSeeking = false;
	}
    
    //Hide Loading Screen
	document.getElementById("guiPlayer_Loading").innerHTML = "Loading";
    document.getElementById("guiPlayer_Loading").style.visibility = "hidden";
    
	//Setup Volume & Mute Keys
	//Volume & Mute Control - Works!
	var NNaviPlugin = document.getElementById("pluginObjectNNavi");
    NNaviPlugin.SetBannerState(PL_NNAVI_STATE_BANNER_VOL);
    pluginAPI.unregistKey(tvKey.KEY_VOL_UP);
    pluginAPI.unregistKey(tvKey.KEY_VOL_DOWN);
    pluginAPI.unregistKey(tvKey.KEY_MUTE);
       
	//Set Focus for Key Events - Must be done on successful load of video
	document.getElementById("GuiPlayer").focus();
};

GuiPlayer.OnStreamInfoReady = function() {
	FileLog.write("Playback : Stream Info Ready");

	//The player only has answers once this event has fired, and this is the
	//first point at which the real stream can be measured rather than assumed
	//from the server's description of the source file.
	this.decodedWidth = null;
	this.decodedHeight = null;
	this.playerDuration = null;

	try {
		var w = this.plugin.GetVideoWidth();
		var h = this.plugin.GetVideoHeight();
		if (w > 0 && h > 0) { this.decodedWidth = w; this.decodedHeight = h; }
	} catch (e) {
		FileLog.write("Playback : could not read the video size - " + e);
	}

	try {
		var d = this.plugin.GetDuration();
		if (d > 0) { this.playerDuration = d; }
	} catch (e) {
		FileLog.write("Playback : could not read the duration - " + e);
	}

	FileLog.write("Playback : decoded " + this.decodedWidth + "x" + this.decodedHeight +
	              ", duration " + this.playerDuration + "ms");

	//The picture was sized from the source file before playback began, so a
	//stream the server rescaled was letterboxed against the wrong dimensions.
	if (this.decodedWidth != null) {
		this.setDisplaySize();
	}

	document.getElementById("guiPlayer_Info_Time").innerHTML = Support.convertTicksToTime(this.currentTime, this.getDurationMs());
};

//Length of what is actually playing. The player knows better than the source
//metadata, which is wrong whenever the server delivered something else.
GuiPlayer.getDurationMs = function() {
	if (this.playerDuration > 0) { return this.playerDuration; }
	return this.PlayerData.RunTimeTicks / 10000;
};

GuiPlayer.clearGuiItems = function() {
	//Neither the stats panel nor the bar should outlive the video.
	GuiPlayer_Display.statsVisible = false;
	var statsEl = document.getElementById("guiPlayer_Stats");
	if (statsEl != null) { statsEl.style.visibility = "hidden"; }
	GuiPlayer_Display.hideBar();
	if (this.infoTimer != null){
		clearTimeout(this.infoTimer);
	}
	document.getElementById("guiPlayer_Osd").style.opacity = 0;
	document.getElementById("guiPlayer_Tools").style.opacity = 0;
	document.getElementById("guiPlayer_Subtitles").innerHTML = "";
	document.getElementById("guiPlayer_Subtitles").style.visibility = "hidden";
};

//-----------------------------------------------------------------------------------------------------------------------------------------
//       GUIPLAYER PLAYBACK KEY HANDLERS
//-----------------------------------------------------------------------------------------------------------------------------------------

GuiPlayer.keyDown = function() {
	var keyCode = event.keyCode;

	switch(keyCode) {
		case tvKey.KEY_RETURN:
			FileLog.write("Playback : Return By User");
			widgetAPI.blockNavigation(event);
			this.stopPlayback();
            GuiPlayer_Display.restorePreviousMenu();
			break;	
		case tvKey.KEY_RIGHT:
			this.handleRightKey();
			break;
		case tvKey.KEY_LEFT:
			this.handleLeftKey();
			break;		
		case tvKey.KEY_PLAY:
		case tvKey.KEY_UP:
			this.handlePlayKey();
			break;
		case tvKey.KEY_STOP:
			this.handleStopKey();
            break;
		case tvKey.KEY_PAUSE:
			this.handlePauseKey();
            break;   
        case tvKey.KEY_FF:
            this.handleFFKey();      
            break;       
        case tvKey.KEY_RW:
            this.handleRWKey();
            break;
        case tvKey.KEY_INFO:	
			GuiPlayer.handleInfoKey();
			break;
        case tvKey.KEY_3D:	
        	GuiPlayer.setupThreeDConfiguration();
			break;
        case tvKey.KEY_YELLOW:
        	GuiPlayer_Display.toggleStats();
        	break;
        case tvKey.KEY_TOOLS:
        case tvKey.KEY_DOWN:
        	widgetAPI.blockNavigation(event);
        	if (this.infoTimer != null) { clearTimeout(this.infoTimer); }
        	GuiPlayer_Display.showBar();
        	document.getElementById("GuiPlayer_Tools").focus();
        	break;
        case tvKey.KEY_EXIT:
        	FileLog.write("EXIT KEY");
            widgetAPI.blockNavigation(event);
            this.stopPlayback();
            GuiPlayer_Display.restorePreviousMenu();
            break;	
	}
};

GuiPlayer.handleRightKey = function() {
	if (this.startParams[0] == "PlayAll") {
		this.PlayerIndex++;
		if (this.VideoData.Items.length > this.PlayerIndex) {	
			this.stopPlayback();
			this.PlayerData = this.VideoData.Items[this.PlayerIndex];
			GuiPlayer_Versions.start(this.PlayerData,0,this.startParams[3]);
		} else {
			//Reset PlayerData to correct index!!
			this.PlayerIndex--;
			this.PlayerData = this.VideoData.Items[this.PlayerIndex];
		}
	} else {
		GuiPlayer.handleFFKey();
	}
};

GuiPlayer.handleLeftKey = function() {
	if (this.startParams[0] == "PlayAll") {
		this.PlayerIndex--;
		if (this.PlayerIndex >= 0) {	
			this.stopPlayback();
			this.PlayerData = this.VideoData.Items[this.PlayerIndex];
			GuiPlayer_Versions.start(this.PlayerData,0,this.startParams[3]);
		} else {
			//Reset PlayerData to correct index!!
			this.PlayerIndex++;
			this.PlayerData = this.VideoData.Items[this.PlayerIndex];
		}
	} else {
		GuiPlayer.handleRWKey();
	}
};

GuiPlayer.handlePlayKey = function() {
	this.resetSpeed();
	//Back to playing: the bar can start counting itself down again.
	setTimeout(function(){
		GuiPlayer_Display.updatePlayPauseLabel();
		GuiPlayer_Display.scheduleBarHide();
	}, 50);
	if (this.playingMediaSource != null) {
		Server.videoUnpaused(this.PlayerData.Id, this.playingMediaSource.Id, this.currentTime, this.PlayMethod, this.PlaySessionId);
	}
	if (this.Status == "PAUSED") {
		FileLog.write("Playback : Play by User");
		this.Status = "PLAYING";
		this.plugin.Resume();
		document.getElementById("guiPlayer_Subtitles").style.bottom="100px";
		if (document.getElementById("guiPlayer_Osd").style.opacity == 0) {
			$('#guiPlayer_Osd').css('opacity',0).animate({opacity:1}, 500);
		}
		Support.clock();
		if (this.infoTimer != null){
			document.getElementById("guiPlayer_ItemDetails").style.visibility="hidden";
			document.getElementById("guiPlayer_ItemDetails2").style.visibility="";
			clearTimeout(this.infoTimer);
		}
		this.infoTimer = setTimeout(function(){
			$('#guiPlayer_Osd').css('opacity',1).animate({opacity:0}, 500);
			setTimeout(function(){
				document.getElementById("guiPlayer_Subtitles").style.top="auto";
				document.getElementById("guiPlayer_Subtitles").style.bottom="60px";
			}, 500);
		}, 3000);
	}
	else
	{
		document.getElementById("guiPlayer_Subtitles").style.bottom="100px";
		if (document.getElementById("guiPlayer_Osd").style.opacity == 0) {
			$('#guiPlayer_Osd').css('opacity',0).animate({opacity:1}, 500);
		}
		if (this.infoTimer != null){
			document.getElementById("guiPlayer_ItemDetails").style.visibility="hidden";
			document.getElementById("guiPlayer_ItemDetails2").style.visibility="";
			clearTimeout(this.infoTimer);
		}
		this.infoTimer = setTimeout(function(){
			$('#guiPlayer_Osd').css('opacity',1).animate({opacity:0}, 500);
			setTimeout(function(){
				document.getElementById("guiPlayer_Subtitles").style.top="auto";
				document.getElementById("guiPlayer_Subtitles").style.bottom="60px";
			}, 500);
		}, 3000);
	}
};

GuiPlayer.handleStopKey = function() {
    FileLog.write("Playback : Stopped by User");
    this.stopPlayback();
    setTimeout(function(){
	    document.getElementById("guiPlayer_ItemDetails").style.visibility="hidden";
		document.getElementById("guiPlayer_ItemDetails2").style.visibility="";
	    GuiPlayer_Display.restorePreviousMenu();
    }, 250);
};

GuiPlayer.handlePauseKey = function() {
	this.resetSpeed();
	//A paused picture with no controls tells the user nothing, so show the bar
	//and leave it up until playback resumes.
	setTimeout(function(){ GuiPlayer_Display.showBar(); }, 50);
	if(this.Status == "PLAYING") {
		document.getElementById("guiPlayer_Subtitles").style.bottom="100px";
		if (document.getElementById("guiPlayer_Osd").style.opacity == 0) {
			$('#guiPlayer_Osd').css('opacity',0).animate({opacity:1}, 500);
		}
		FileLog.write("Playback : Paused by User");
		this.plugin.Pause();
		this.Status = "PAUSED";
		Server.videoPaused(this.PlayerData.Id,this.playingMediaSource.Id,this.currentTime,this.PlayMethod,this.PlaySessionId);           	
		if (this.infoTimer != null){
			clearTimeout(this.infoTimer);
		}
		this.infoTimer = setTimeout(function(){
			setTimeout(function(){
				document.getElementById("guiPlayer_ItemDetails").style.visibility="hidden";
				document.getElementById("guiPlayer_ItemDetails2").style.visibility="";
			}, 500);
			$('#guiPlayer_Osd').css('opacity',1).animate({opacity:0}, 500);
			setTimeout(function(){
				document.getElementById("guiPlayer_Subtitles").style.top="auto";
				document.getElementById("guiPlayer_Subtitles").style.bottom="60px";
			}, 500);
		}, 10000);
	} 
};

//Shared by fast forward and rewind: bring the on-screen display up, then fade
//it again once the user stops pressing.
GuiPlayer.showSeekOsd = function() {
	document.getElementById("guiPlayer_Subtitles").style.bottom="100px";
	if (document.getElementById("guiPlayer_Osd").style.opacity == 0) {
		$('#guiPlayer_Osd').css('opacity',0).animate({opacity:1}, 500);
	}
	if (this.infoTimer != null){
		clearTimeout(this.infoTimer);
	}
	this.infoTimer = setTimeout(function(){
		setTimeout(function(){
			document.getElementById("guiPlayer_ItemDetails").style.visibility="hidden";
			document.getElementById("guiPlayer_ItemDetails2").style.visibility="";
			document.getElementById("guiPlayer_Subtitles").style.top="auto";
			document.getElementById("guiPlayer_Subtitles").style.bottom="60px";
		}, 500);
		$('#guiPlayer_Osd').css('opacity',1).animate({opacity:0}, 500);
	}, 3000);
};

//Try to scan at speed rather than jumping in fixed steps.
//
//Two things stop this being usable everywhere. The guide says SetPlaybackSpeed
//has to follow Play(), and this app uses ResumePlay, so whether it works at all
//is a question only the hardware can answer - hence the return value is checked
//and a false sends us straight back to jumping. And scanning through a stream
//the server is still encoding outruns the transcode, so it is only attempted on
//a direct play.
//
//There is no way to read the current speed back, and no event when it changes,
//so the value is tracked here.
GuiPlayer.trySetSpeed = function(direction) {
	if (this.PlayMethod != "DirectPlay") { return false; }
	if (this.speedUnsupported) { return false; }

	//Steps through 2, 4, 8 in the direction asked for. Pressing the opposite
	//key starts again at the slowest speed that way.
	var next;
	if (direction > 0) {
		next = (this.playbackSpeed >= 2) ? this.playbackSpeed * 2 : 2;
		if (next > 8) { next = 2; }
	} else {
		next = (this.playbackSpeed <= -2) ? this.playbackSpeed * 2 : -2;
		if (next < -8) { next = -2; }
	}

	var ok = false;
	try { ok = this.plugin.SetPlaybackSpeed(next); } catch (e) { ok = false; }

	if (ok === false || ok === undefined) {
		//Remember, so every later press goes straight to jumping.
		this.speedUnsupported = true;
		FileLog.write("Playback : scanning not available, using jumps");
		return false;
	}

	this.playbackSpeed = next;
	FileLog.write("Playback : scanning at " + next + "x");
	return true;
};

//Back to normal speed. Safe to call when already normal.
GuiPlayer.resetSpeed = function() {
	if (this.playbackSpeed == 1) { return; }
	try { this.plugin.SetPlaybackSpeed(1); } catch (e) {}
	this.playbackSpeed = 1;
	FileLog.write("Playback : back to normal speed");
};

GuiPlayer.handleFFKey = function() {
	FileLog.write("Playback : Fast Forward");
	if (this.Status != "PLAYING") { return; }

	if (!this.trySetSpeed(1)) {
		//Jump* takes seconds, currentTime is in milliseconds. Re-indexing the
		//subtitles by a different amount than the jump left them out of step.
		GuiPlayer.updateSubtitleTime(this.currentTime + 30000,"FF");
		this.plugin.JumpForward(30);
	}
	this.showSeekOsd();
};

GuiPlayer.handleRWKey = function() {
	FileLog.write("Playback : Rewind");
	if (this.Status != "PLAYING") { return; }

	if (!this.trySetSpeed(-1)) {
		GuiPlayer.updateSubtitleTime(this.currentTime - 10000,"RW");
		this.plugin.JumpBackward(10);
	}
	this.showSeekOsd();
};

GuiPlayer.handleInfoKey = function () {
	if (this.infoTimer != null){
		clearTimeout(this.infoTimer);
	}
	if (document.getElementById("guiPlayer_Osd").style.opacity == 0 || 
			document.getElementById("guiPlayer_ItemDetails").style.visibility == "hidden"){ //Full info called
		document.getElementById("guiPlayer_ItemDetails").style.visibility="";
		document.getElementById("guiPlayer_ItemDetails2").style.visibility="hidden";
		document.getElementById("guiPlayer_Subtitles").style.top="170px";
		if (document.getElementById("guiPlayer_Osd").style.opacity == 0) {
			$('#guiPlayer_Osd').css('opacity',0).animate({opacity:1}, 500);
		}
		this.infoTimer = setTimeout(function(){
			setTimeout(function(){
				document.getElementById("guiPlayer_ItemDetails").style.visibility="hidden";
				document.getElementById("guiPlayer_ItemDetails2").style.visibility="";
				document.getElementById("guiPlayer_Subtitles").style.top="auto";
				document.getElementById("guiPlayer_Subtitles").style.bottom="60px";
			}, 500);
			$('#guiPlayer_Osd').css('opacity',1).animate({opacity:0}, 500);
		}, 10000);
	} else { //Full info cancelled while on screen.
		$('#guiPlayer_Osd').css('opacity',1).animate({opacity:0}, 500);
		this.infoTimer = setTimeout(function(){
			document.getElementById("guiPlayer_ItemDetails").style.visibility="hidden";
			document.getElementById("guiPlayer_ItemDetails2").style.visibility="";
			document.getElementById("guiPlayer_Subtitles").style.top="auto";
			document.getElementById("guiPlayer_Subtitles").style.bottom="60px";
		}, 500);
	}
};

//-----------------------------------------------------------------------------------------------------------------------------------------
//       GUIPLAYER 3D & AUDIO OUTPUT SETTERS
//-----------------------------------------------------------------------------------------------------------------------------------------

//PL_SCREEN_3DEFFECT_MODE: 0 off, 1 top and bottom, 2 side by side.
GuiPlayer.setupThreeDConfiguration = function() {
	var format = (this.playingMediaSource == null) ? undefined : this.playingMediaSource.Video3DFormat;
	if (format === undefined || format === null) {
		this.pluginScreen.Set3DEffectMode(0);
		return;
	}

	//Documented as returning a positive value when supported and a negative one
	//when not, so a bare truthiness test counted -1 as a yes.
	var supported = -1;
	try { supported = this.pluginScreen.Flag3DEffectSupport(); } catch (e) { supported = -1; }
	if (!(supported > 0)) {
		this.pluginScreen.Set3DEffectMode(0);
		return;
	}

	var mode = 0;
	switch (format) {
	case "FullSideBySide":
	case "HalfSideBySide":
		mode = 2;
		break;
	//Jellyfin reports these too, and they used to fall through to "off",
	//leaving a top-and-bottom file playing as a squashed flat picture.
	case "FullTopAndBottom":
	case "HalfTopAndBottom":
		mode = 1;
		break;
	default:
		mode = 0;
		break;
	}

	//The guide's own examples check a mode is available before selecting it.
	if (mode != 0) {
		var allowed = -1;
		try { allowed = this.pluginScreen.Check3DEffectMode(mode); } catch (e) { allowed = -1; }
		if (!(allowed > 0)) {
			FileLog.write("Video : 3D mode " + mode + " not available, playing flat");
			mode = 0;
		}
	}

	FileLog.write("Video : 3D format " + format + " -> mode " + mode);
	this.pluginScreen.Set3DEffectMode(mode);
};

GuiPlayer.setupAudioConfiguration = function() {

	//A video-only file has no audio stream to configure output for.
	if (this.playingAudioIndex == -1 || this.playingMediaSource == null) {
		if (this.pluginAudio != null) { this.pluginAudio.SetExternalOutMode(0); }
		return;
	}
	var audioInfoStream = this.playingMediaSource.MediaStreams[this.playingAudioIndex];
	var codec = (audioInfoStream && audioInfoStream.Codec) ? audioInfoStream.Codec.toLowerCase() : "none";
	
	//If audio has been transcoded need to manually set codec as codec in stream info will be wrong
	if ((File.getTVProperty("Dolby") && File.getTVProperty("AACtoDolby")) && audioInfoStream.Codec.toLowerCase() == "aac") {
		codec = "ac3";
	}

	//Passing a bitstream out only makes sense when something downstream can
	//decode it. With no receiver attached the sound has to be PCM, whatever the
	//settings say - switching to Dolby or DTS in that case produced silence.
	if (this.pluginAudio == null) { return; }

	var mode = 0; //PCM
	if (Main.hasReceiver() || Main.audioOutputDevice == null) {
		if (codec == "dca" || codec == "dts") {
			if (File.getTVProperty("DTS") && Main.supportsDTS()) { mode = 2; }
		} else if (codec == "ac3" || codec == "eac3") {
			if (File.getTVProperty("Dolby") && Main.supportsDolby()) { mode = 1; }
		}
	}

	//Ask before setting, as the guide's examples do; a mode the path cannot
	//carry is refused and we would be left with no sound.
	if (mode != 0) {
		var allowed = -1;
		try { allowed = this.pluginAudio.CheckExternalOutMode(mode); } catch (e) { allowed = -1; }
		if (!(allowed > 0)) {
			FileLog.write("Audio : output mode " + mode + " refused, falling back to PCM");
			mode = 0;
		}
	}

	FileLog.write("Audio : " + codec + " -> output mode " + mode + " (0 PCM, 1 Dolby, 2 DTS)");
	GuiPlayer_Display.lastAudioOutMode = mode;
	this.pluginAudio.SetExternalOutMode(mode);
};

GuiPlayer.getTranscodeProgress = function() {
	//Get Session Data (Media Streams)
    var SessionData = Server.getContent(Server.getCustomURL("/Sessions?format=json"));
    if (SessionData == null) { return; }
    
    for (var index = 0; index < SessionData.length; index++) {
    	if (SessionData[index].DeviceId == Server.getDeviceID()) {
    		//Null while direct playing - there is no transcode to report on.
    		if (SessionData[index].TranscodingInfo == null) { return null; }
    		return Math.floor(SessionData[index].TranscodingInfo.CompletionPercentage);
    	}
    }
    return null;  
};

GuiPlayer.checkTranscodeCanSkip = function(newtime) {
	var transcodeProgress = this.getTranscodeProgress();
	if (transcodeProgress == null) { return false; } //Progress unknown - don't claim we can skip.

	var transcodePosition = (transcodeProgress / 100) * (this.getDurationMs() - this.offsetSeconds);
	if ((newtime > this.offsetSeconds) && newtime < transcodePosition) {
		return true;
	} else {
		return false;
	}
};

GuiPlayer.newPlaybackPosition = function(startPositionTicks) {
	document.getElementById("NoKeyInput").focus();
	this.stopPlayback();

	this.setDisplaySize();

	var url = this.playingURL;
	if (this.PlaySessionId) {
		url += '&PlaySessionId=' + this.PlaySessionId;
	}

	//See startPlayback: the player needs the HLS marker to read an .m3u8.
	if (this.PlayMethod != "DirectPlay") {
		url += '|COMPONENT=HLS';
	}

	var position = Math.round(startPositionTicks / 10000000);
    this.plugin.ResumePlay(url,position);
    this.updateSubtitleTime(startPositionTicks / 10000,"NewSubs");
};

GuiPlayer.newSubtitleIndex = function (newSubtitleIndex) {
	if (newSubtitleIndex == -1 && this.playingSubtitleIndex != null) {
		//Turn Off Subtitles
		this.PlayerDataSubtitle = null;
		this.playingSubtitleIndex = -1;
		this.subtitleShowingIndex = 0;
		this.subtitleSeeking = false;
		document.getElementById("guiPlayer_Subtitles").innerHTML = "";
		document.getElementById("guiPlayer_Subtitles").style.visibility = "hidden";
		document.getElementById("GuiPlayer").focus();	
	} else {
		//Check its not already selected 
		if (newSubtitleIndex != this.playingSubtitleIndex) {
			//Prevent displaying Subs while loading
			this.subtitleSeeking = true; 
			document.getElementById("guiPlayer_Subtitles").innerHTML = "";
			document.getElementById("guiPlayer_Subtitles").style.visibility = "hidden";
			
			//Update SubtitleIndex and reset index
			this.playingSubtitleIndex = newSubtitleIndex;
			
			//Load New Subtitle File
			this.setSubtitles(this.playingSubtitleIndex);
		    
		    //Update subs index
		    this.updateSubtitleTime(this.currentTime,"NewSubs");
		    
		    //Load Back to main page GUI
		    document.getElementById("GuiPlayer").focus();
		} else {
			//Do Nothing!
			document.getElementById("GuiPlayer").focus();
		}		
	}	
	//Keep the Subtitles menu up to date with the currently playing subs.
	GuiPlayer_Display.playingSubtitleIndex = this.playingSubtitleIndex;
};

//-----------------------------------------------------------------------------------------------------------------------------------------
//       GUIPLAYER STOP HANDLER ON APP EXIT
//-----------------------------------------------------------------------------------------------------------------------------------------

GuiPlayer.stopOnAppExit = function() {
	if (this.plugin != null) {
		this.plugin.Stop();
		this.plugin = null;
	}
};

