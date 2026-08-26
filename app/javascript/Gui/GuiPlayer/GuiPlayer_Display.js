var GuiPlayer_Display = {	
		PlayerData : null,
		playingMediaSource : null,
		playingMediaSourceIndex : null,
		playingTranscodeStatus : null,
		playingVideoIndex : null,
		playingAudioIndex : null,
		playingSubtitleIndex : null,
		offsetSeconds : 0,
		
		ItemData : null,
		
		videoToolsOptions : [],
		barTimer : null,
		videoToolsSelectedItem : 0,
		subtitleIndexes : [], 
		
		audioIndexes : [],
		chapterIndexes : [], 
		
		topLeftItem : 0,
		videoToolsSelectedItemSub : 0,
		maxDisplay : 5,
		videoToolsSubOptions : [],
		videoToolsaudioOptions : [],
		
		sliderCurrentTime : 0
};

GuiPlayer_Display.setDisplay = function(playerdata,playingmediasource,playingtranscodestatus,offsetSeconds,playingVideoIndex,playingAudioIndex,playingSubtitleIndex,playingmediasourceindex) {
	this.PlayerData = playerdata;
	this.playingMediaSource = playingmediasource;
	this.playingMediaSourceIndex = playingmediasourceindex;
	this.playingTranscodeStatus = playingtranscodestatus;
	this.offsetSeconds = offsetSeconds;
	this.playingVideoIndex = playingVideoIndex;
	this.playingAudioIndex = playingAudioIndex;
	this.playingSubtitleIndex = playingSubtitleIndex;
	
	//Reset Vars
	this.videoToolsOptions = [];
	this.videoToolsSelectedItem = 0;
	this.subtitleIndexes = [];
	this.audioIndexes = [];
	this.chapterIndexes = [];
	this.topLeftItme = 0;
	this.videoToolsSelectedItemSub = 0;
	
	//Reset Page Elements
	document.getElementById("guiPlayer_Info_Details").style.backgroundImage="";
	document.getElementById("guiPlayer_ItemDetails_Overview").innerHTML = "";
	document.getElementById("guiPlayer_ItemDetails_Title").innerHTML = "";
    document.getElementById("guiPlayer_ItemDetails_SubData").innerHTML = "";
	
	//Hide page!
    document.getElementById("pageContent").innerHTML = "";
    document.getElementById("page").style.visibility="hidden";
    document.getElementById("pageBackgroundFade").style.visibility="hidden";
    document.getElementById("pageBackgroundHolder").style.visibility="hidden";
    document.getElementById("pageBackground").style.visibility="hidden";
    //This one was never hidden, so an 86% black div sat over the video the whole
    //time it played. It is the reason the picture looked dimmed.
    document.getElementById("itemBackgroundFade").style.visibility="hidden";
    document.getElementById("guiPlayer_Loading").style.visibility = ""; 
    document.getElementById("guiPlayer_Ratings").innerHTML="";

    //Set PageContent
    var fileInfo = "";
    if (this.PlayerData.Type == "Episode") {
    	fileInfo = Support.getNameFormat(this.PlayerData.SeriesName, this.PlayerData.ParentIndexNumber, this.PlayerData.Name, this.PlayerData.IndexNumber);
    	fileInfo = fileInfo.replace("<br>", " ");
    	
    	//Add the series logo at the top left.
    	if (this.PlayerData.ParentLogoImageTag) {
    		document.getElementById("guiPlayer_Info_Details").innerHTML = "";
    		var imgsrc = Server.getImageURL(this.PlayerData.SeriesId,"Logo",820,110,0,false,0);
    		document.getElementById("guiPlayer_Info_Details").style.backgroundImage="url('"+imgsrc+"')";	
    	} else {
    		//No logo: the title text goes top-left, where the web client puts it.
    		document.getElementById("guiPlayer_Info_Details").style.backgroundImage="";
    		document.getElementById("guiPlayer_Info_Details").innerHTML = fileInfo;
		}
    	
        //Add the TV series DVD cover art to the GUI display.
        var diskImgsrc = Server.getImageURL(this.PlayerData.SeriesId,"Primary",200,280,0,false,0);
    	document.getElementById("guiPlayer_DvdArt").style.backgroundImage="url('" + diskImgsrc + "')";
    	
    	//Get ratings info.
    	var toms = this.PlayerData.CriticRating;
    	var stars = this.PlayerData.CommunityRating;
    	var tomsImage = "";
    	var starsImage = "";
    	if (toms){
    		if (toms > 59){
    			tomsImage = "images/fresh-40x40.png";
    		} else {
    			tomsImage = "images/rotten-40x40.png";
    		}
    		document.getElementById("guiPlayer_Ratings").innerHTML += "<div class='videoItemRatingsTomatoIcon' style=background-image:url("+tomsImage+")></div>";
    		document.getElementById("guiPlayer_Ratings").innerHTML += "<div class='videoItemRatingsTomato'>"+toms+"%</div>";
    	}
    	if (stars){
        	if (stars <3.1){
        		starsImage = "images/star_empty-46x40.png"; 
        	} else if (stars >=3.1 && stars < 6.5) {
        		starsImage = "images/star_half-46x40.png";
        	} else {
        		starsImage = "images/star_full-46x40.png";
        	}
        	document.getElementById("guiPlayer_Ratings").innerHTML += "<div class='videoItemRatingsStarIcon' style=background-image:url("+starsImage+")></div>";
       		document.getElementById("guiPlayer_Ratings").innerHTML += "<div class='videoItemRatingsStar'>"+stars+"</div>";
    	}
    } else {
    	fileInfo = this.PlayerData.Name;
    	
    	//Add the movie logo at the top left.
    	if (this.PlayerData.ImageTags.Logo) {
    		document.getElementById("guiPlayer_Info_Details").innerHTML = "";
    		var imgsrc = Server.getImageURL(this.PlayerData.Id,"Logo",820,110,0,false,0);
    		document.getElementById("guiPlayer_Info_Details").style.backgroundImage="url('"+imgsrc+"')";	
    	} else {
    		//No logo: the title text goes top-left, where the web client puts it.
    		document.getElementById("guiPlayer_Info_Details").style.backgroundImage="";
    		document.getElementById("guiPlayer_Info_Details").innerHTML = fileInfo;
    	}
    	
        //Add the movie DVD cover art to the GUI display.
        var diskImgsrc = Server.getImageURL(this.PlayerData.Id,"Primary",200,280,0,false,0);
    	document.getElementById("guiPlayer_DvdArt").style.backgroundImage="url('" + diskImgsrc + "')";
    	
    	//Get ratings info.
    	var toms = this.PlayerData.CriticRating;
    	var stars = this.PlayerData.CommunityRating;
    	var tomsImage = "";
    	var starsImage = "";
    	if (toms){
    		if (toms > 59){
    			tomsImage = "images/fresh-40x40.png";
    		} else {
    			tomsImage = "images/rotten-40x40.png";
    		}
    		document.getElementById("guiPlayer_Ratings").innerHTML += "<div class='videoItemRatingsTomatoIcon' style=background-image:url("+tomsImage+")></div>";
    		document.getElementById("guiPlayer_Ratings").innerHTML += "<div class='videoItemRatingsTomato'>"+toms+"%</div>";
    	}
    	if (stars){
        	if (stars <3.1){
        		starsImage = "images/star_empty-46x40.png"; 
        	} else if (stars >=3.1 && stars < 6.5) {
        		starsImage = "images/star_half-46x40.png";
        	} else {
        		starsImage = "images/star_full-46x40.png";
        	}
        	document.getElementById("guiPlayer_Ratings").innerHTML += "<div class='videoItemRatingsStarIcon' style=background-image:url("+starsImage+")></div>";
       		document.getElementById("guiPlayer_Ratings").innerHTML += "<div class='videoItemRatingsStar'>"+stars+"</div>";
    	}
    }
    
   	var videoName = this.playingMediaSource.Name;
    document.getElementById("guiPlayer_ItemDetails_Title").innerHTML = fileInfo;
    //Title now shown at the top, not in a bar behind the controls.
    document.getElementById("guiPlayer_ItemDetails_SubData").innerHTML = videoName + " : " + this.playingTranscodeStatus; 
    document.getElementById("guiPlayer_ItemDetails_SubData2").innerHTML = videoName + " : " + this.playingTranscodeStatus; 
    
    if (this.PlayerData.Overview !== undefined) {
    	document.getElementById("guiPlayer_ItemDetails_Overview").innerHTML = this.PlayerData.Overview;
    }
};

GuiPlayer_Display.restorePreviousMenu = function() {
	//Hide Player GUI Elements
	if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
		$('#guiPlayer_Osd').css('opacity',1).animate({opacity:0}, 500);
	}
	if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
		$('#guiPlayer_Tools').css('opacity',1).animate({opacity:0}, 500);
	}
	document.getElementById("guiPlayer_ItemDetails").style.visibility="hidden";
	document.getElementById("guiPlayer_ItemDetails2").style.visibility="";
    document.getElementById("guiPlayer_Loading").style.visibility = "hidden";
    document.getElementById("guiPlayer_Tools_Slider").style.visibility = "hidden";
    document.getElementById("guiPlayer_Tools_SubOptions").style.visibility = "hidden";  
    
    document.getElementById("pageBackgroundFade").style.visibility="";
    document.getElementById("pageBackgroundHolder").style.visibility="";
    document.getElementById("pageBackground").style.visibility="";
    document.getElementById("itemBackgroundFade").style.visibility="";
    document.getElementById("page").style.visibility="";
    
    //Reset Volume & Mute Keys
	//Reset NAVI - Works
	var NNaviPlugin = document.getElementById("pluginObjectNNavi");
    NNaviPlugin.SetBannerState(PL_NNAVI_STATE_BANNER_NONE);
    pluginAPI.registKey(tvKey.KEY_VOL_UP);
    pluginAPI.registKey(tvKey.KEY_VOL_DOWN);
    pluginAPI.registKey(tvKey.KEY_MUTE);

    //Turn On Screensaver
    Support.screensaverOn();
	Support.screensaver();

	//Return to correct Page
	Support.processReturnURLHistory();
};

//-----------------------------------------------------------------------------------------------------------------------------------------
//GUIPLAYER TOOLS MENU FUNCTIONS
//-----------------------------------------------------------------------------------------------------------------------------------------

//Drawn transport icons, from CSS triangles and bars - a glyph font is not
//dependable here. Written once so the quoting lives in one place.
GuiPlayer_Display.icon = function(name) {
	switch (name) {
		case 'play':  return "<span class='playerIcon iconPlay'></span>";
		case 'pause': return "<span class='playerIcon iconPause'><span class='iconPauseBar'></span><span class='iconPauseBar'></span></span>";
		case 'rew':   return "<span class='playerIcon'><span class='iconTriLeft'></span><span class='iconTriLeft'></span></span>";
		case 'ff':    return "<span class='playerIcon'><span class='iconTriRight'></span><span class='iconTriRight'></span></span>";
		case 'prev':  return "<span class='playerIcon'><span class='iconBarThin'></span><span class='iconTriLeft'></span></span>";
		case 'next':  return "<span class='playerIcon'><span class='iconTriRight'></span><span class='iconBarThin'></span></span>";
	}
	return "";
};

GuiPlayer_Display.createToolsMenu = function() {
    //Create Tools Menu Subtitle
    //Must reset tools menu here on each playback!
    document.getElementById("guiPlayer_Tools").innerHTML = "";
    this.videoToolsOptions = [];
	for (var index = 0;index < this.playingMediaSource.MediaStreams.length;index++) {
		var Stream = this.playingMediaSource.MediaStreams[index];
		if (Stream.Type == "Audio") {
			if (Main.getModelYear() == "D" && File.getTVProperty("TranscodeDSeries") == false) {
				//Don't add it!
			} else {
				this.audioIndexes.push(index);
			}	
		} 
		
		if (Stream.IsTextSubtitleStream) {
			this.subtitleIndexes.push(index); //
		} 
	}
	
	//Play and pause first, so the bar leads with the control people look for.
	//There was no way to see or change playback state on screen at all.
	//The transport group, in the web client's order.
	this.videoToolsOptions.push("videoOptionPrev");
	document.getElementById("guiPlayer_Tools").innerHTML += '<div id="videoOptionPrev" class="videoToolsItem videoToolsItemIcon">' + this.icon("prev") + '</div>';
	this.videoToolsOptions.push("videoOptionRewind");
	document.getElementById("guiPlayer_Tools").innerHTML += '<div id="videoOptionRewind" class="videoToolsItem videoToolsItemIcon">' + this.icon("rew") + '</div>';
	this.videoToolsOptions.push("videoOptionPlayPause");
	document.getElementById("guiPlayer_Tools").innerHTML += '<div id="videoOptionPlayPause" class="videoToolsItem videoToolsItemIcon">' + this.icon("pause") + '</div>';
	this.videoToolsOptions.push("videoOptionForward");
	document.getElementById("guiPlayer_Tools").innerHTML += '<div id="videoOptionForward" class="videoToolsItem videoToolsItemIcon">' + this.icon("ff") + '</div>';
	this.videoToolsOptions.push("videoOptionNext");
	document.getElementById("guiPlayer_Tools").innerHTML += '<div id="videoOptionNext" class="videoToolsItem videoToolsItemIcon">' + this.icon("next") + '</div>';

	if (this.PlayerData.Chapters !== undefined) {
		for (var index = 0; index < this.PlayerData.Chapters.length; index++) {
			this.chapterIndexes.push(index);
		}
		if (this.chapterIndexes.length > 0) {
			this.videoToolsOptions.push("videoOptionChapters");
		    document.getElementById("guiPlayer_Tools").innerHTML += '<div id="videoOptionChapters" class="videoToolsItem";">Chapters</div>';
		}
	}
	    
	if (this.subtitleIndexes.length > 0) {
		this.subtitleIndexes.unshift(-1);
	    this.videoToolsOptions.push("videoOptionSubtitles");
	    document.getElementById("guiPlayer_Tools").innerHTML += '<div id="videoOptionSubtitles" class="videoToolsItem";">Subtitles</div>';
		}
	    
	//Hide if only 1 audio stream given thats the one playing!
	if (this.audioIndexes.length > 1) {
	    this.videoToolsOptions.push("videoOptionAudio");
	   	document.getElementById("guiPlayer_Tools").innerHTML += '<div id="videoOptionAudio" class="videoToolsItem";">Audio</div>';
	}
	
	//The OSD already shows a seek bar, so no separate Position control.
};


GuiPlayer_Display.keyDownTools = function() {
	var keyCode = event.keyCode;
	//Any interaction keeps the bar up; it was hiding mid-navigation.
	GuiPlayer_Display.scheduleBarHide();
	this.videoToolsSelectedItemSub = 0;
	document.getElementById("guiPlayer_Tools_SubOptions").innerHTML = "";

	switch(keyCode) {
		case tvKey.KEY_RETURN:
		case tvKey.KEY_TOOLS:
			widgetAPI.blockNavigation(event);
			this.videoToolsSelectedItem = 0;
			if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
    			$('#guiPlayer_Tools').css('opacity',1).animate({opacity:0}, 500);
    		}
			setTimeout(function(){
				document.getElementById("guiPlayer_Subtitles").style.top="none";
				document.getElementById("guiPlayer_Subtitles").style.bottom="60px";
			}, 500);
			document.getElementById("GuiPlayer").focus();
			break;	
		case tvKey.KEY_UP:
			widgetAPI.blockNavigation(event);
			this.videoToolsSelectedItem = 0;
			if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
    			$('#guiPlayer_Tools').css('opacity',1).animate({opacity:0}, 500);
    		}
			setTimeout(function(){
				document.getElementById("guiPlayer_Subtitles").style.top="none";
				document.getElementById("guiPlayer_Subtitles").style.bottom="60px";
			}, 500);
			GuiPlayer.handlePlayKey();
			document.getElementById("GuiPlayer").focus();
			break;	
		case tvKey.KEY_LEFT:
			if (this.videoToolsSelectedItem > 0) {
				this.videoToolsSelectedItem--;
				this.updateSelectedItems();
			}
			break;
		case tvKey.KEY_RIGHT:
			if (this.videoToolsSelectedItem < this.videoToolsOptions.length-1) {
				this.videoToolsSelectedItem++;
				this.updateSelectedItems();
			}
			break;	
		case tvKey.KEY_ENTER:
		case tvKey.KEY_PANEL_ENTER:
			this.topLeftItem = 0;
			switch (this.videoToolsOptions[this.videoToolsSelectedItem]) {
			case "videoOptionPrev":
				GuiPlayer.handleLeftKey(); break;
			case "videoOptionRewind":
				GuiPlayer.handleRWKey(); break;
			case "videoOptionPlayPause":
				if (GuiPlayer.Status == "PLAYING") { GuiPlayer.handlePauseKey(); }
				else { GuiPlayer.handlePlayKey(); }
				GuiPlayer_Display.updatePlayPauseLabel();
				break;
			case "videoOptionForward":
				GuiPlayer.handleFFKey(); break;
			case "videoOptionNext":
				GuiPlayer.handleRightKey(); break;
			case "videoOptionChapters":
				this.videoToolsSubOptions = this.chapterIndexes;
				this.updateDisplayedItemsSub();
				this.updateSelectedItemsSub();
				document.getElementById("GuiPlayer_ToolsSub").focus();
				break;
			case "videoOptionSubtitles":
				this.videoToolsSubOptions = this.subtitleIndexes;
				this.updateDisplayedItemsSub();
				this.updateSelectedItemsSub();
				document.getElementById("GuiPlayer_ToolsSub").focus();
				break;
			case "videoOptionAudio":
				this.videoToolsSubOptions = this.audioIndexes;
				this.updateDisplayedItemsSub();
				this.updateSelectedItemsSub();
				document.getElementById("GuiPlayer_ToolsSub").focus();
				break;	
			case "videoOptionSlider":
				this.sliderCurrentTime = GuiPlayer.currentTime + this.offsetSeconds;
				var leftPos = (1800 *  this.sliderCurrentTime/ (this.PlayerData.RunTimeTicks / 10000))-20+60;
				document.getElementById("guiPlayer_Tools_SliderBarCurrent").style.left = leftPos+"px";	
				document.getElementById("guiPlayer_Tools_SliderBarCurrentTime").innerHTML = Support.convertTicksToTimeSingle(this.sliderCurrentTime);
				document.getElementById("guiPlayer_Tools_SliderBarCurrentTime").style.left = leftPos-40+"px";
				document.getElementById("guiPlayer_Tools_Slider").style.visibility = "";
				document.getElementById("GuiPlayer_ToolsSlider").focus();	
				break;
			}
			break;		
		case tvKey.KEY_PLAY:
			if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
    			$('#guiPlayer_Tools').css('opacity',1).animate({opacity:0}, 500);
    		}
			setTimeout(function(){
				document.getElementById("guiPlayer_Subtitles").style.top="none";
				document.getElementById("guiPlayer_Subtitles").style.bottom="60px";
			}, 500);
			document.getElementById("GuiPlayer").focus();
			GuiPlayer.handlePlayKey();
			break;
		case tvKey.KEY_STOP:
			GuiPlayer.handleStopKey();
            break;
		case tvKey.KEY_PAUSE:
			if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
    			$('#guiPlayer_Tools').css('opacity',1).animate({opacity:0}, 500);
    		}
			document.getElementById("GuiPlayer").focus();
			GuiPlayer.handlePauseKey();
			break;
        case tvKey.KEY_FF:
			if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
    			$('#guiPlayer_Tools').css('opacity',1).animate({opacity:0}, 500);
    		}
			document.getElementById("GuiPlayer").focus();
        	GuiPlayer.handleFFKey();      
            break;       
        case tvKey.KEY_RW:
			if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
    			$('#guiPlayer_Tools').css('opacity',1).animate({opacity:0}, 500);
    		}
			document.getElementById("GuiPlayer").focus();
        	GuiPlayer.handleRWKey();
            break;
        case tvKey.KEY_INFO:	
			if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
    			$('#guiPlayer_Tools').css('opacity',1).animate({opacity:0}, 500);
    		}
			document.getElementById("GuiPlayer").focus();
			GuiPlayer.handleInfoKey();
			break;
        case tvKey.KEY_EXIT:
            widgetAPI.blockNavigation(event);
            GuiPlayer.stopPlayback();
            GuiPlayer_Display.restorePreviousMenu();
            break;	
	}
};


GuiPlayer_Display.keyDownToolsSlider = function() {
	var keyCode = event.keyCode;

	switch(keyCode) {
		case tvKey.KEY_RETURN:
			widgetAPI.blockNavigation(event);
			document.getElementById("guiPlayer_Tools_Slider").style.visibility = "hidden";
			document.getElementById("GuiPlayer_Tools").focus();
			break;	
		case tvKey.KEY_LEFT:
			this.sliderCurrentTime = this.sliderCurrentTime - 30000; //30 seconds
			this.sliderCurrentTime = (this.sliderCurrentTime < 0) ? 0 : this.sliderCurrentTime;
			var leftPos = (1800 * this.sliderCurrentTime / (this.PlayerData.RunTimeTicks / 10000))-20+60; //-20 half width of selector, +60 as left as progress bar is 30 from left
			document.getElementById("guiPlayer_Tools_SliderBarCurrentTime").innerHTML = Support.convertTicksToTimeSingle(this.sliderCurrentTime);
			document.getElementById("guiPlayer_Tools_SliderBarCurrentTime").style.left = leftPos-40+"px";
			document.getElementById("guiPlayer_Tools_SliderBarCurrent").style.left = leftPos+"px";	
			break;
		case tvKey.KEY_RIGHT:
			this.sliderCurrentTime = this.sliderCurrentTime + 30000; //30 seconds
			this.sliderCurrentTime = (this.sliderCurrentTime > this.PlayerData.RunTimeTicks / 10000) ? this.PlayerData.RunTimeTicks / 10000 : this.sliderCurrentTime;
			var leftPos = (1800 * this.sliderCurrentTime / (this.PlayerData.RunTimeTicks / 10000))-20+60;
			document.getElementById("guiPlayer_Tools_SliderBarCurrentTime").innerHTML = Support.convertTicksToTimeSingle(this.sliderCurrentTime);
			document.getElementById("guiPlayer_Tools_SliderBarCurrentTime").style.left = leftPos-40+"px";
			document.getElementById("guiPlayer_Tools_SliderBarCurrent").style.left = leftPos+"px";	
			break;
		case tvKey.KEY_ENTER:
		case tvKey.KEY_PANEL_ENTER:
			document.getElementById("guiPlayer_Tools_Slider").style.visibility = "hidden";
			if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
    			$('#guiPlayer_Tools').css('opacity',1).animate({opacity:0}, 500);
    		}
			setTimeout(function(){
				document.getElementById("guiPlayer_Subtitles").style.top="none";
				document.getElementById("guiPlayer_Subtitles").style.bottom="60px";
			}, 500);
			GuiPlayer.newPlaybackPosition(this.sliderCurrentTime * 10000);
			break;
		case tvKey.KEY_PLAY:
			document.getElementById("guiPlayer_Tools_Slider").style.visibility = "hidden";
			if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
    			$('#guiPlayer_Tools').css('opacity',1).animate({opacity:0}, 500);
    		}
			document.getElementById("GuiPlayer").focus();
			GuiPlayer.handlePlayKey();
			break;
		case tvKey.KEY_STOP:
			GuiPlayer.handleStopKey();
            break;
		case tvKey.KEY_PAUSE:
			document.getElementById("guiPlayer_Tools_Slider").style.visibility = "hidden";
			if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
    			$('#guiPlayer_Tools').css('opacity',1).animate({opacity:0}, 500);
    		}
			document.getElementById("GuiPlayer").focus();
			GuiPlayer.handlePauseKey();
			break;
        case tvKey.KEY_FF:
			document.getElementById("guiPlayer_Tools_Slider").style.visibility = "hidden";
			if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
    			$('#guiPlayer_Tools').css('opacity',1).animate({opacity:0}, 500);
    		}
			document.getElementById("GuiPlayer").focus();
        	GuiPlayer.handleFFKey();      
            break;       
        case tvKey.KEY_RW:
			document.getElementById("guiPlayer_Tools_Slider").style.visibility = "hidden";
			if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
    			$('#guiPlayer_Tools').css('opacity',1).animate({opacity:0}, 500);
    		}
			document.getElementById("GuiPlayer").focus();
        	GuiPlayer.handleRWKey();
            break;
        case tvKey.KEY_INFO:	
			document.getElementById("guiPlayer_Tools_Slider").style.visibility = "hidden";
			if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
    			$('#guiPlayer_Tools').css('opacity',1).animate({opacity:0}, 500);
    		}
			document.getElementById("GuiPlayer").focus();
			GuiPlayer.handleInfoKey();
			break;
        case tvKey.KEY_EXIT:
            widgetAPI.blockNavigation(event);
            GuiPlayer.stopPlayback();
            GuiPlayer_Display.restorePreviousMenu();
            break;	
	}
};

GuiPlayer_Display.updateSelectedItems = function() {
	for (var index = 0; index < this.videoToolsOptions.length; index++){	
		if (index == this.videoToolsSelectedItem) {
			document.getElementById(this.videoToolsOptions[index]).className = "videoToolsItem videoToolsItemSelected";	
		} else {	
			document.getElementById(this.videoToolsOptions[index]).className = "videoToolsItem";		
		}		
	} 
};

GuiPlayer_Display.keyDownToolsSub = function() {
	var keyCode = event.keyCode;

	switch(keyCode) {
		case tvKey.KEY_RETURN:
			widgetAPI.blockNavigation(event);
			document.getElementById("guiPlayer_Tools_SubOptions").style.visibility = "hidden";
			this.updateSelectedItems();
			document.getElementById("GuiPlayer_Tools").focus();
			break;	
		case tvKey.KEY_UP:
			this.videoToolsSelectedItemSub--;
			if (this.videoToolsSelectedItemSub < 0) {
				this.videoToolsSelectedItemSub++;
			}
			if (this.videoToolsSelectedItemSub < this.topLeftItem) {
				this.topLeftItem--;
				this.updateDisplayedItemsSub();
			}
			this.updateSelectedItemsSub();
		break;
		case tvKey.KEY_DOWN:
			this.videoToolsSelectedItemSub++;
			if (this.videoToolsSelectedItemSub > this.videoToolsSubOptions.length-1) {
				this.videoToolsSelectedItemSub--;
			}
			if (this.videoToolsSelectedItemSub >= this.topLeftItem + this.maxDisplay) {
				this.topLeftItem++;
				this.updateDisplayedItemsSub();
			}
			this.updateSelectedItemsSub();
			break;	
		case tvKey.KEY_ENTER:
		case tvKey.KEY_PANEL_ENTER:
			document.getElementById("guiPlayer_Tools_SubOptions").style.visibility = "hidden";
			if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
    			$('#guiPlayer_Tools').css('opacity',1).animate({opacity:0}, 500);
    		}
			setTimeout(function(){
				document.getElementById("guiPlayer_Subtitles").style.top="none";
				document.getElementById("guiPlayer_Subtitles").style.bottom="60px";
			}, 500);
			switch (this.videoToolsOptions[this.videoToolsSelectedItem]) {
			case "videoOptionChapters":
				GuiPlayer.newPlaybackPosition(this.PlayerData.Chapters[this.videoToolsSelectedItemSub].StartPositionTicks);
				break;	
			case "videoOptionSubtitles":
				GuiPlayer.newSubtitleIndex(this.videoToolsSubOptions[this.videoToolsSelectedItemSub]);
				break;
			case "videoOptionAudio":
				if (this.videoToolsSubOptions[this.videoToolsSelectedItemSub] != this.playingAudioIndex) {
					GuiPlayer.stopPlayback();
					document.getElementById("GuiPlayer").focus();
					
					//Check if first index - If it is need to stream copy audio track
					var isFirstAudioIndex = (this.videoToolsSubOptions[this.videoToolsSelectedItemSub] == this.audioIndexes[0]) ? true : false;
					var transcodeResult = GuiPlayer_Transcoding.start(this.PlayerData.Id,this.playingMediaSource,this.playingMediaSourceIndex,this.playingVideoIndex,this.videoToolsSubOptions[this.videoToolsSelectedItemSub],isFirstAudioIndex,this.playingSubtitleIndex);
					GuiPlayer.startPlayback(transcodeResult, GuiPlayer.currentTime);
				} else {
					//Do Nothing!
					document.getElementById("GuiPlayer").focus();
				}
				break;	
			}	
			break;	
		case tvKey.KEY_PLAY:
			document.getElementById("guiPlayer_Tools_SubOptions").style.visibility = "hidden";
			if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
    			$('#guiPlayer_Tools').css('opacity',1).animate({opacity:0}, 500);
    		}
			document.getElementById("GuiPlayer").focus();
			GuiPlayer.handlePlayKey();
			break;
		case tvKey.KEY_STOP:
			GuiPlayer.handleStopKey();
            break;
		case tvKey.KEY_PAUSE:
			document.getElementById("guiPlayer_Tools_SubOptions").style.visibility = "hidden";
			if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
    			$('#guiPlayer_Tools').css('opacity',1).animate({opacity:0}, 500);
    		}
			document.getElementById("GuiPlayer").focus();
			GuiPlayer.handlePauseKey();
			break;
        case tvKey.KEY_FF:
			document.getElementById("guiPlayer_Tools_SubOptions").style.visibility = "hidden";
			if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
    			$('#guiPlayer_Tools').css('opacity',1).animate({opacity:0}, 500);
    		}
			document.getElementById("GuiPlayer").focus();
        	GuiPlayer.handleFFKey();      
            break;       
        case tvKey.KEY_RW:
			document.getElementById("guiPlayer_Tools_SubOptions").style.visibility = "hidden";
			if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
    			$('#guiPlayer_Tools').css('opacity',1).animate({opacity:0}, 500);
    		}
			document.getElementById("GuiPlayer").focus();
        	GuiPlayer.handleRWKey();
            break;
        case tvKey.KEY_INFO:	
			document.getElementById("guiPlayer_Tools_SubOptions").style.visibility = "hidden";
			if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
    			$('#guiPlayer_Tools').css('opacity',1).animate({opacity:0}, 500);
    		}
			document.getElementById("GuiPlayer").focus();
			GuiPlayer.handleInfoKey();
			break;
        case tvKey.KEY_EXIT:
            widgetAPI.blockNavigation(event);
            GuiPlayer.stopPlayback();
            GuiPlayer_Display.restorePreviousMenu();
            break;	
	}
};

GuiPlayer_Display.updateSelectedItemsSub = function() {	
	document.getElementById(this.videoToolsOptions[this.videoToolsSelectedItem]).className = "videoToolsItem";
	for (var index = this.topLeftItem; index < Math.min(this.videoToolsSubOptions.length,this.topLeftItem + this.maxDisplay);index++){
		var classes = "videoToolsOption";
		if (index == this.videoToolsSelectedItemSub) {
			classes += " videoToolsOptionSelected";	
		}
		if (index == this.topLeftItem && this.topLeftItem != 0){
			classes += " arrowUp";
		}
		if (index == this.topLeftItem + this.maxDisplay -1 && this.topLeftItem + this.maxDisplay -1 != this.videoToolsSubOptions.length -1){
			classes += " arrowDown";
		}
		document.getElementById("videoToolsSubOptions"+index).className = classes;
	} 
};

GuiPlayer_Display.updateDisplayedItemsSub = function() {
	document.getElementById("guiPlayer_Tools_SubOptions").innerHTML = "";
	for (var index = this.topLeftItem; index < Math.min(this.videoToolsSubOptions.length,this.topLeftItem + this.maxDisplay);index++) {
		switch (this.videoToolsOptions[this.videoToolsSelectedItem]) {
		case "videoOptionSubtitles":
			if (this.videoToolsSubOptions[index] == -1) {
				document.getElementById("guiPlayer_Tools_SubOptions").innerHTML += "<div id=videoToolsSubOptions"+index+" class=videoToolsOption>None</div>";	
			} else {
				var Name = "";
				if (this.playingMediaSource.MediaStreams[this.videoToolsSubOptions[index]].Language !== undefined) {
					Name = getLanguageName(this.playingMediaSource.MediaStreams[this.videoToolsSubOptions[index]].Language);
					if (Name === undefined) {
						Name = this.playingMediaSource.MediaStreams[this.videoToolsSubOptions[index]].Language;
					}
				} else {
					Name = "Unknown Language";
				}
				if (this.playingSubtitleIndex == this.videoToolsSubOptions[index]) {
					Name += " - Showing";
				}
				document.getElementById("guiPlayer_Tools_SubOptions").innerHTML += "<div id=videoToolsSubOptions"+index+" class=videoToolsOption>"+Name+"</div>";	
			}	
			break;
		case "videoOptionAudio":
			//Run option through transcoding algorithm - see if it plays natively
			var transcodeResult = GuiPlayer_Transcoding.start(this.PlayerData.Id, this.playingMediaSource,this.playingMediaSourceIndex, this.playingVideoIndex, this.videoToolsSubOptions[index]);
					
			var Name = this.playingMediaSource.MediaStreams[this.videoToolsSubOptions[index]].Codec + " - ";
			if (this.playingMediaSource.MediaStreams[this.videoToolsSubOptions[index]].Language !== undefined) {
				Name += this.playingMediaSource.MediaStreams[this.videoToolsSubOptions[index]].Language;
			} else {
				Name += "Unknown Language";
			}
			
			var requireTranscode = (transcodeResult[2] == "Direct Stream") ? "Direct Play" : "Transcode";
			Name += "<br>" + requireTranscode;
			if (this.playingAudioIndex == this.videoToolsSubOptions[index]) {
				Name += " - Currently Playing";
			}
			
			document.getElementById("guiPlayer_Tools_SubOptions").innerHTML += "<div id=videoToolsSubOptions"+index+" class=videoToolsOption>"+Name+"</div>";
			break;	
		case "videoOptionChapters":
			document.getElementById("guiPlayer_Tools_SubOptions").innerHTML += "<div id=videoToolsSubOptions"+index+" class=videoToolsOption>"+this.PlayerData.Chapters[index].Name+"</div>";
			break;	
		}	
	}
	document.getElementById("guiPlayer_Tools_SubOptions").style.visibility = "";
};
//The label has to follow the real state, not what was last pressed - the
//remote's own play and pause keys change it too.
GuiPlayer_Display.updatePlayPauseLabel = function() {
	var el = document.getElementById("videoOptionPlayPause");
	if (el == null) { return; }
	//Playing shows the pause icon; paused shows the play icon.
	el.innerHTML = (GuiPlayer.Status == "PLAYING") ? GuiPlayer_Display.icon("pause") : GuiPlayer_Display.icon("play");
};

//Is the bottom bar on screen?
GuiPlayer_Display.isToolsVisible = function() {
	var el = document.getElementById("guiPlayer_Tools");
	return el != null && el.style.opacity != 0;
};

//Bring up the bar together with the time and progress above it. Previously
//opening one hid the other, so the scrubber and the controls could never be
//seen at the same time.
GuiPlayer_Display.showBar = function() {
	this.updatePlayPauseLabel();
	this.updateSelectedItems();

	if (document.getElementById("guiPlayer_Osd").style.opacity == 0) {
		$('#guiPlayer_Osd').css('opacity',0).animate({opacity:1}, 500);
	}
	if (document.getElementById("guiPlayer_Tools").style.opacity != 1) {
		$('#guiPlayer_Tools').css('opacity',0).animate({opacity:1}, 500);
	}
	document.getElementById("guiPlayer_Subtitles").style.top = "auto";
	document.getElementById("guiPlayer_Subtitles").style.bottom = "100px";

	this.scheduleBarHide();
};

//While playing the bar gets out of the way on its own. While paused it stays,
//because a paused picture with no controls tells the user nothing.
GuiPlayer_Display.scheduleBarHide = function() {
	if (this.barTimer != null) {
		clearTimeout(this.barTimer);
		this.barTimer = null;
	}
	if (GuiPlayer.Status != "PLAYING") { return; }

	this.barTimer = setTimeout(function() {
		//Never pull it out from under a submenu the user has open.
		if (document.getElementById("guiPlayer_Tools_SubOptions").style.visibility == "") { return; }
		GuiPlayer_Display.hideBar();
	}, 5000);
};

GuiPlayer_Display.hideBar = function() {
	if (this.barTimer != null) {
		clearTimeout(this.barTimer);
		this.barTimer = null;
	}
	//Return focus to the video, or the next DOWN goes to the hidden bar.
	document.getElementById("GuiPlayer").focus();
	if (document.getElementById("guiPlayer_Tools").style.opacity != 0) {
		$('#guiPlayer_Tools').css('opacity',1).animate({opacity:0}, 500);
	}
	if (document.getElementById("guiPlayer_Osd").style.opacity != 0) {
		$('#guiPlayer_Osd').css('opacity',1).animate({opacity:0}, 500);
	}
	setTimeout(function(){
		document.getElementById("guiPlayer_Subtitles").style.top = "auto";
		document.getElementById("guiPlayer_Subtitles").style.bottom = "60px";
	}, 500);
};

//////////////////////////////////////////////////////////////////////////////
//  Playback statistics.
//
//  Answers "why does this look like that" without a PC: whether the file is
//  playing untouched or being re-encoded and for what reason, what the decoder
//  actually received as opposed to what the server described, and what the set
//  itself is. Toggled with the yellow button during playback.
//////////////////////////////////////////////////////////////////////////////

GuiPlayer_Display.statsVisible = false;

GuiPlayer_Display.toggleStats = function() {
	this.statsVisible = !this.statsVisible;
	document.getElementById("guiPlayer_Stats").style.visibility = this.statsVisible ? "" : "hidden";
	if (this.statsVisible) { this.updateStats(); }
};

GuiPlayer_Display.statRow = function(label, value) {
	if (value === undefined || value === null || value === "") { return ""; }
	return "<span class='videoStatsKey'>" + label + "</span> " + value + "<br>";
};

//Reasons come back from the server as e.g. VideoCodecNotSupported; space the
//words out rather than showing it verbatim.
GuiPlayer_Display.readableReasons = function(reasons) {
	if (!reasons) { return null; }
	return reasons.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/,/g, ", ");
};

GuiPlayer_Display.updateStats = function() {
	if (!this.statsVisible) { return; }
	var el = document.getElementById("guiPlayer_Stats");
	if (el == null) { return; }

	var source = GuiPlayer.playingMediaSource;
	var video = (source && source.MediaStreams) ? source.MediaStreams[GuiPlayer.playingVideoIndex] : null;
	var audio = (source && source.MediaStreams) ? source.MediaStreams[GuiPlayer.playingAudioIndex] : null;

	var html = "";

	//--- how it is being delivered -----------------------------------------
	html += "<div class='videoStatsHeading'>PLAYBACK</div>";
	html += this.statRow("method", GuiPlayer.PlayMethod == "DirectPlay" ? "Direct play (no server work)" : "Transcoding");

	//The server states why it would not send the file untouched.
	if (GuiPlayer.PlayMethod != "DirectPlay" && GuiPlayer.playingURL) {
		var match = GuiPlayer.playingURL.match(/TranscodeReasons=([^&|]*)/);
		if (match) { html += this.statRow("reason", this.readableReasons(match[1])); }
	}
	html += this.statRow("negotiated by", GuiPlayer_Versions.serverNegotiated ? "server" : "app (fallback)");
	html += this.statRow("container", source ? source.Container : null);

	//--- video --------------------------------------------------------------
	html += "<div class='videoStatsHeading'>VIDEO</div>";
	if (video) {
		var codec = video.Codec ? video.Codec.toUpperCase() : "?";
		if (video.Profile) { codec += " " + video.Profile; }
		//h264 reports level as the number times ten, HEVC times thirty - so the
		//same 120 means 12.0 in one and 4.0 in the other.
		if (video.Level) {
			var isHevc = (video.Codec == "hevc" || video.Codec == "h265");
			codec += " @L" + (video.Level / (isHevc ? 30 : 10));
		}
		html += this.statRow("codec", codec);
		html += this.statRow("source", video.Width + "x" + video.Height);
	}
	//What the decoder actually got, which differs whenever the server rescaled.
	if (GuiPlayer.decodedWidth > 0) {
		html += this.statRow("decoded", GuiPlayer.decodedWidth + "x" + GuiPlayer.decodedHeight);
	}
	if (video) {
		html += this.statRow("frame rate", video.AverageFrameRate ? Math.round(video.AverageFrameRate) + " fps" : null);
		html += this.statRow("bitrate", video.BitRate ? Math.round(video.BitRate / 1000) + " kbps" : null);
		html += this.statRow("bit depth", video.BitDepth ? video.BitDepth + "-bit" : null);
		html += this.statRow("aspect", video.AspectRatio);
		html += this.statRow("range", video.VideoRange);
		html += this.statRow("interlaced", video.IsInterlaced === true ? "yes" : null);
	}

	//Only meaningful on an adaptive stream, so shown when the player answers.
	try {
		var live = GuiPlayer.plugin.GetCurrentBitrates();
		if (live > 0) { html += this.statRow("current", Math.round(live / 1000) + " kbps"); }
	} catch (e) {}

	//--- audio --------------------------------------------------------------
	html += "<div class='videoStatsHeading'>AUDIO</div>";
	if (audio) {
		html += this.statRow("codec", (audio.Codec ? audio.Codec.toUpperCase() : "?") +
			(audio.Channels ? " " + audio.Channels + "ch" : ""));
		html += this.statRow("language", audio.Language);
		html += this.statRow("bitrate", audio.BitRate ? Math.round(audio.BitRate / 1000) + " kbps" : null);
		html += this.statRow("sample rate", audio.SampleRate ? audio.SampleRate + " Hz" : null);
		html += this.statRow("profile", audio.Profile);
	}
	var outNames = ["PCM", "Dolby Digital", "DTS"];
	html += this.statRow("output", outNames[GuiPlayer_Display.lastAudioOutMode] || "PCM");
	html += this.statRow("receiver", Main.hasReceiver() ? "yes (HDMI/SPDIF)" : "no (TV speakers)");

	//--- position -----------------------------------------------------------
	html += "<div class='videoStatsHeading'>POSITION</div>";
	html += this.statRow("time", Math.round(GuiPlayer.currentTime / 1000) + "s of " +
		Math.round(GuiPlayer.getDurationMs() / 1000) + "s");
	html += this.statRow("duration from", GuiPlayer.playerDuration > 0 ? "player" : "server metadata");
	if (GuiPlayer.playbackSpeed != 1) { html += this.statRow("speed", GuiPlayer.playbackSpeed + "x"); }
	if (GuiPlayer_Display.lastBufferPercent != null) {
		html += this.statRow("buffer", GuiPlayer_Display.lastBufferPercent + "%");
	}

	//--- the set itself -----------------------------------------------------
	html += "<div class='videoStatsHeading'>DEVICE</div>";
	html += this.statRow("model", Main.productCode + " (series " + Main.getModelYear() + ")");
	html += this.statRow("firmware", Main.firmware);
	html += this.statRow("player", Main.playerVersion);
	html += this.statRow("network", Main.interfaceType == 1 ? "wired" : (Main.interfaceType == 0 ? "wireless" : "unknown"));

	//--- what the server is doing with it ----------------------------------
	html += "<div class='videoStatsHeading'>SERVER</div>";
	html += this.statRow("address", Server.getServerAddr());
	html += this.statRow("version", ServerVersion.ServerInfo ? ServerVersion.ServerInfo.Version : null);
	html += this.statRow("session", GuiPlayer.PlaySessionId ? GuiPlayer.PlaySessionId.substring(0,12) + "\u2026" : "none");
	if (GuiPlayer.LiveStreamId) { html += this.statRow("live stream", "open (tuner held)"); }
	html += this.statRow("profile", "Orsay " + Main.getModelYear() + ", max " +
		Math.round(GuiPlayer_DeviceProfile.getMaxBitrate() / 1000000) + " Mbps");

	//--- the file as the library has it -------------------------------------
	html += "<div class='videoStatsHeading'>FILE</div>";
	if (source) {
		html += this.statRow("size", source.Size ? (source.Size / 1048576).toFixed(1) + " MB" : null);
		html += this.statRow("total bitrate", source.Bitrate ? Math.round(source.Bitrate / 1000) + " kbps" : null);
		html += this.statRow("protocol", source.Protocol);
		//Where the file physically is, trimmed to the end that identifies it.
		if (source.Path) {
			var path = source.Path;
			html += this.statRow("path", path.length > 52 ? "\u2026" + path.substring(path.length - 52) : path);
		}
		html += this.statRow("streams", source.MediaStreams ? source.MediaStreams.length : null);
	}

	//--- subtitles ----------------------------------------------------------
	var subs = (source && source.MediaStreams && GuiPlayer.playingSubtitleIndex > -1)
		? source.MediaStreams[GuiPlayer.playingSubtitleIndex] : null;
	html += "<div class='videoStatsHeading'>SUBTITLES</div>";
	if (subs) {
		html += this.statRow("showing", (subs.Codec ? subs.Codec.toUpperCase() : "?") +
			(subs.Language ? " (" + subs.Language + ")" : ""));
		html += this.statRow("drawn by", "the app, from SRT");
		html += this.statRow("cues", GuiPlayer.PlayerDataSubtitle ? GuiPlayer.PlayerDataSubtitle.length : null);
	} else {
		html += this.statRow("showing", "off");
	}

	//--- connection ---------------------------------------------------------
	html += "<div class='videoStatsHeading'>CONNECTION</div>";
	html += this.statRow("network", Main.interfaceType == 1 ? "wired (100 Mbit port)" :
		(Main.interfaceType == 0 ? "wireless" : "unknown"));
	//A rough read on whether the link is keeping up: how much of real time the
	//position has advanced by since playback started.
	if (GuiPlayer.videoStartTime != null && GuiPlayer.playStartedAt != null) {
		var wall = (new Date().getTime() - GuiPlayer.playStartedAt) / 1000;
		var moved = (GuiPlayer.currentTime - GuiPlayer.videoStartTime) / 1000;
		if (wall > 3) {
			html += this.statRow("keeping up", Math.round((moved / wall) * 100) + "% of real time");
		}
	}
	html += this.statRow("device id", Server.getDeviceID() ? Server.getDeviceID().substring(0,12) + "\u2026" : null);

	html += "<div class='videoStatsHeading'>YELLOW to close</div>";
	el.innerHTML = html;
};
