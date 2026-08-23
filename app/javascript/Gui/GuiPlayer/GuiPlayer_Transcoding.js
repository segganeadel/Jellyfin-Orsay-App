/*
Render Error 1 :  Unsupported container
Render Error 2 :  Unsupported video codec
Render Error 3 :  Unsupported audio codec
Render Error 4 :  Unsupported video resolution
Render Error 6 :  Corrupt Stream
*/

var GuiPlayer_Transcoding = {		
		//File Information
		MediaSource : null,
		videoIndex : 0,
		audioIndex : 0,
	
		//Bitrate check
		bitRateToUse : null,
		
		//Boolean that conclude if all Video or All Audio elements will play without transcode
		isVideo : true,
		isAudio : true,
		
		//All Video Elements
		isCodec : null,
		isResolution : null,
		isContainer : null,
		isBitRate : null,
		isLevel : null,	
		isFrameRate : null,
		isProfile : null,
		maxFrameRate : null,
		
		//All Audio elements
		isAudioCodec : null,
		isAudioContainer : null,
		isAudioChannel : null
}

//--------------------------------------------------------------------------------------
GuiPlayer_Transcoding.start = function(showId, MediaSource,MediaSourceIndex, videoIndex, audioIndex, isFirstAudioIndex, subtitleIndex) {	
	//Set Class Vars
	this.MediaSource = MediaSource;
	this.videoIndex = videoIndex;
	this.audioIndex = audioIndex;
	
	//Get the Streams actual index
	var videoStreamIndex = this.MediaSource.MediaStreams[this.videoIndex].Index;
	var audioStreamIndex = this.MediaSource.MediaStreams[this.audioIndex].Index;

	//Check Video & Audio Compatibility
	this.checkCodec(videoIndex);
	this.checkAudioCodec(audioIndex);

	var streamparams = "";
	var transcodeStatus = "";

	//If audiocheck failed convert to AAC OR AC3 depending on setting
	//If audiocheck ok convert to AAC or dont convert & leave as original codec

	var fileAudioCodec = this.MediaSource.MediaStreams[this.audioIndex].Codec.toLowerCase();
	var streamAudioCodec = "aac"; //Default, supported by all tv's (?)
	var convertAACtoDolby = false;
	if (File.getTVProperty("Dolby") && File.getTVProperty("AACtoDolby") && fileAudioCodec == "aac") {
		convertAACtoDolby = true;
	}
	if (this.isAudio == false) {
	   streamAudioCodec = (File.getTVProperty("Dolby") && File.getTVProperty("AACtoDolby")) ? "ac3" : "aac";
	} else {
	   streamAudioCodec = (File.getTVProperty("Dolby") && File.getTVProperty("AACtoDolby") && fileAudioCodec == "aac") ? "ac3" : "aac";
	}
	if (this.isVideo && this.isAudio && convertAACtoDolby == false) {
		if (isFirstAudioIndex == true) {
			transcodeStatus = "Direct Play";
			//Use the single container name that matched, not Jellyfin's full
			//format list, or the URL becomes Stream.mov,mp4,m4a,3gp,3g2,mj2
			var container = this.videoContainer || this.MediaSource.Container;
			streamparams = '/Stream.'+container+'?static=true&MediaSourceId='+this.MediaSource.Id + '&api_key=' + Server.getAuthToken();
		} else {			
			transcodeStatus = "Stream Copy - Audio Not First Track";
			streamparams = '/master.m3u8?VideoStreamIndex='+videoStreamIndex+'&AudioStreamIndex='+audioStreamIndex+'&VideoCodec=copy&AudioCodec='+ streamAudioCodec + '&SegmentContainer=ts&MinSegments=2&BreakOnNonKeyFrames=True' + '&MediaSourceId='+this.MediaSource.Id + '&api_key=' + Server.getAuthToken();
		}	
	} else if (this.isVideo == false) {
		transcodeStatus = "Transcoding Audio & Video";	
		streamparams = '/master.m3u8?VideoStreamIndex='+videoStreamIndex+'&AudioStreamIndex='+audioStreamIndex+'&VideoCodec=h264&Profile=high&Level=41&MaxVideoBitDepth=8&MaxWidth=1920&VideoBitrate='+this.bitRateToUse+'&MaxFramerate='+this.maxFrameRate+'&AudioCodec=' + streamAudioCodec +'&AudioBitrate=360000&TranscodingMaxAudioChannels=6'+'&SegmentContainer=ts&MinSegments=2&BreakOnNonKeyFrames=True'+'&MediaSourceId='+this.MediaSource.Id + '&api_key=' + Server.getAuthToken();	
	} else if (this.isVideo == true && (this.isAudio == false || convertAACtoDolby == true)) {
		transcodeStatus = "Transcoding Audio";	
		streamparams = '/master.m3u8?VideoStreamIndex='+videoStreamIndex+'&AudioStreamIndex='+audioStreamIndex+'&VideoCodec=copy&AudioCodec='+ streamAudioCodec +'&audioBitrate=360000&TranscodingMaxAudioChannels=6'+'&SegmentContainer=ts&MinSegments=2&BreakOnNonKeyFrames=True'+'&MediaSourceId='+this.MediaSource.Id + '&api_key=' + Server.getAuthToken();
	}
	var url = Server.getServerAddr() + '/Videos/' + showId + streamparams + '&DeviceId='+Server.getDeviceID();
	FileLog.write("Video : Transcode Status : " + transcodeStatus);
	FileLog.write("Video : URL : " + url);

	//Return results to Versions
	//MediaSourceId,Url,transcodeStatus,videoIndex,audioIndex
	return [MediaSourceIndex,url,transcodeStatus,videoIndex,audioIndex,subtitleIndex];	
}

GuiPlayer_Transcoding.checkCodec = function() {
	var codec = this.MediaSource.MediaStreams[this.videoIndex].Codec.toLowerCase();
	var codecParams = GuiPlayer_TranscodeParams.getParameters(codec,this.MediaSource.MediaStreams[this.videoIndex].Width);
	
	this.isCodec = codecParams[0];
	this.isContainer = this.checkContainer(codecParams[1]);
	//Keep the video pass's match; checkAudioCodec calls checkContainer again.
	this.videoContainer = this.matchedContainer;
	this.isResolution = this.checkResolution(codecParams[2]);
	this.isBitRate = this.checkBitRate(codecParams[3]);
	this.isFrameRate = this.checkFrameRate(codecParams[4]);
	this.isLevel = this.checkLevel(codecParams[5]);
	this.isProfile = this.checkProfile(codecParams[6]);
	this.maxFrameRate = codecParams[4] || 30;
	
	//Results
	FileLog.write("Video : Video File Analysis Results");
	FileLog.write("Video : Codec Compatibility: " + this.isCodec + " : " + this.MediaSource.MediaStreams[this.videoIndex].Codec);
	FileLog.write("Video : Container Compatibility: " + this.isContainer + " : " + this.MediaSource.Container);
	FileLog.write("Video : Resolution Compatibility: " + this.isResolution + " : " +this.MediaSource.MediaStreams[this.videoIndex].Width + "x" + this.MediaSource.MediaStreams[this.videoIndex].Height);
	FileLog.write("Video : BitRate Compatibility: " + this.isBitRate + " : " + this.MediaSource.MediaStreams[this.videoIndex].BitRate + " : " + this.bitRateToUse);
	FileLog.write("Video : FrameRate Compatibility: " + this.isFrameRate + " : " + this.MediaSource.MediaStreams[this.videoIndex].AverageFrameRate);
	FileLog.write("Video : Level Compatibility: " + this.isLevel + " : " + this.MediaSource.MediaStreams[this.videoIndex].Level);
	FileLog.write("Video : Profile Compatibility: " + this.isProfile + " : " + this.MediaSource.MediaStreams[this.videoIndex].Profile);
	
	//Put it all together
	if (this.isCodec && this.isContainer && this.isResolution && this.isBitRate && this.isFrameRate && this.isLevel && this.isProfile) { // 
		this.isVideo = true;
	} else {
		this.isVideo = false;
	}
}

GuiPlayer_Transcoding.checkAudioCodec = function() {
	var audiocodec = this.MediaSource.MediaStreams[this.audioIndex].Codec.toLowerCase();
	var audiocodecParams = GuiPlayer_TranscodeParams.getAudioParameters(audiocodec);
	
	this.isAudioCodec = audiocodecParams[0];
	this.isAudioContainer = this.checkContainer(audiocodecParams[1]);
	this.isAudioChannel = this.checkAudioChannels(audiocodecParams[2]);		
	
	//Results
	FileLog.write("Video : Audio File Analysis Results");
	FileLog.write("Video : Codec Compatibility: " + this.isAudioCodec + " : " + this.MediaSource.MediaStreams[this.audioIndex].Codec);
	FileLog.write("Video : Container Compatibility: " + this.isAudioContainer + " : " + this.MediaSource.Container);
	FileLog.write("Video : Channel Compatibility: " + this.isAudioChannel + " : " + this.MediaSource.MediaStreams[this.audioIndex].Channels);
	
	//Put it all together
	if (this.isAudioCodec && this.isAudioChannel) {
		this.isAudio = true;
	} else {
		this.isAudio = false;
	}		
}

GuiPlayer_Transcoding.checkAudioChannels = function(maxChannels) {
	if (maxChannels == null) {
		return false;
	} else {
		if (this.MediaSource.MediaStreams[this.audioIndex].Channels <= maxChannels) {
			return true;
		} else {
			return false;
		}
	}
}

GuiPlayer_Transcoding.checkResolution = function(maxResolution) {
	if (maxResolution == null) {
		return false;
	} else if (this.MediaSource.MediaStreams[this.videoIndex].Width <= maxResolution[0] && this.MediaSource.MediaStreams[this.videoIndex].Height <= maxResolution[1]) {
		return true;
	} else {
		return false;
	}
}

GuiPlayer_Transcoding.checkContainer = function(supportedContainers) {
	this.matchedContainer = null;

	if (supportedContainers == null || this.MediaSource.Container == null) {
		return false;
	}

	var candidates = [];

	// The player treats the extension on the URL as a demuxer hint, so try the
	// file's real extension first where the server exposes the path.
	var preferred = this.getSourceExtension();
	if (preferred != null) { candidates.push(preferred); }

	// Jellyfin reports Container as ffprobe's whole format list: an ordinary
	// .mp4 arrives as "mov,mp4,m4a,3gp,3g2,mj2" and an .mkv as "matroska,webm".
	// Comparing that string to a single name never matched, so every MP4 and
	// MKV was needlessly transcoded. Split it, and translate the demuxer names
	// that differ from the extension the tables are written in.
	var reported = this.MediaSource.Container.toLowerCase().split(",");
	for (var i = 0; i < reported.length; i++) {
		var name = reported[i].replace(/^\s+|\s+$/g, "");
		candidates.push(name);
		var alias = GuiPlayer_Transcoding.CONTAINER_ALIASES[name];
		if (alias != null) { candidates.push(alias); }
	}

	for (var r = 0; r < candidates.length; r++) {
		for (var index = 0; index < supportedContainers.length; index++) {
			if (candidates[r] == supportedContainers[index]) {
				//Remember which name matched - the direct play URL needs one
				//extension, not the whole list.
				this.matchedContainer = candidates[r];
				return true;
			}
		}
	}
	return false;
}

//ffprobe demuxer name -> the extension the capability tables use.
GuiPlayer_Transcoding.CONTAINER_ALIASES = {
	"matroska" : "mkv",
	"mpegts"   : "ts",
	"mpeg"     : "mpg",
	"mpegvideo": "mpg",
	"asf"      : "wmv",
	"quicktime": "mov",
	"3gp"      : "3gpp",
	"m4a"      : "mp4",
	"mj2"      : "mp4"
};

//Extension of the underlying file, lower case and without the dot, when the
//server exposes the path. Returns null when it does not.
GuiPlayer_Transcoding.getSourceExtension = function() {
	var path = this.MediaSource.Path;
	if (path == null) { return null; }

	var dot = path.lastIndexOf(".");
	if (dot < 0 || dot == path.length - 1) { return null; }
	return path.substring(dot + 1).toLowerCase();
}

GuiPlayer_Transcoding.checkBitRate = function(maxBitRate) {
	//Get Bitrate from Settings File
	var maxBitRateSetting = File.getTVProperty("Bitrate")*1024*1024;
	if (!(maxBitRateSetting > 0)) {
		//Missing or non-numeric setting produced NaN, which then travelled into
		//the transcode URL as VideoBitrate=NaN.
		maxBitRateSetting = 20 * 1024 * 1024;
	}

	//Never ask for more than the panel can decode, and never ask for more than
	//the source actually is - the default 60Mbit setting had the server
	//re-encoding a 3Mbit file at 62Mbit, which no Orsay TV can stream over WiFi.
	this.bitRateToUse = maxBitRateSetting;
	if (maxBitRate > 0 && maxBitRate < this.bitRateToUse) {
		this.bitRateToUse = maxBitRate;
	}
	var sourceBitRate = this.MediaSource.MediaStreams[this.videoIndex].BitRate;
	if (sourceBitRate > 0 && sourceBitRate < this.bitRateToUse) {
		this.bitRateToUse = sourceBitRate;
	}

	if (this.MediaSource.MediaStreams[this.videoIndex].BitRate > maxBitRateSetting) {
		return false;
	} else {
		return true;
	}
}

GuiPlayer_Transcoding.checkFrameRate = function(maxFrameRate) {
	if (maxFrameRate == null) {
		return false;
	} else if (this.MediaSource.MediaStreams[this.videoIndex].AverageFrameRate <= maxFrameRate) {
		return true;
	} else {
		return false;
	}
}

GuiPlayer_Transcoding.checkLevel = function(maxLevel) {
	var level = this.MediaSource.MediaStreams[this.videoIndex].Level;
	if (maxLevel == null) {
		return false;
	} if (maxLevel == true) {
		return true;
	} else {
		var level = this.MediaSource.MediaStreams[this.videoIndex].Level;
		level = (level < 10) ? level * 10 : level; //If only 1 long, multiply by 10 to make it correct!
		if (level <= maxLevel && level >= 0) {
			return true;
		} else {
			return false;
		}
	}
}

GuiPlayer_Transcoding.checkProfile = function(supportedProfiles) {
	if (supportedProfiles == null) {
		return false;
	} if (supportedProfiles == true) {
		return true;
	} else {
		var profile = false;
		for (var index = 0; index < supportedProfiles.length; index++) {
			if (this.MediaSource.MediaStreams[this.videoIndex].Profile == supportedProfiles[index]) {
				profile = true;
				break;
			}
		}
		return profile;
	}
}