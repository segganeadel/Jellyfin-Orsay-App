//////////////////////////////////////////////////////////////////////////////
//  Device profile.
//
//  Describes what this panel can decode in the form Jellyfin understands, so
//  the server decides how to deliver a file instead of the client guessing.
//  The limits below are the same ones GuiPlayer_TranscodeParams encodes, with
//  the defects found while auditing that table corrected.
//
//  Sent with POST /Items/{id}/PlaybackInfo; the reply says whether a source can
//  be played as-is and, if not, supplies the transcode URL to use.
//////////////////////////////////////////////////////////////////////////////

var GuiPlayer_DeviceProfile = {};

//Containers the 2012 and later sets accept. The 2011 D-series list is much
//narrower, so it is spelled out separately.
GuiPlayer_DeviceProfile.CONTAINERS_MODERN =
	"mp4,m4v,mkv,ts,mpegts,mpg,mpeg,avi,asf,wmv,mov,3gp,3gpp,m2ts,mts,flv,vob,vro,tp,trp,divx,svi";
GuiPlayer_DeviceProfile.CONTAINERS_D =
	"mp4,m4v,mkv,ts,mpg,mpeg,avi,asf,3gp,3gpp,vob,vro";

GuiPlayer_DeviceProfile.AUDIO_CODECS =
	"aac,mp3,mp2,ac3,eac3,dts,dca,wmav2,wmapro,wmavoice,pcm_s16le,pcm_s24le,pcm_s32le";

//Per model year: what the panel can actually decode.
//  level    - h264 level x10, so 41 is 4.1
//  hevc     - null when the hardware cannot decode it at all
GuiPlayer_DeviceProfile.LIMITS = {
	"D" : {
		width : 1920, height : 1080, level : 41, framerate : 30,
		bitrate : 37500000, hevc : null,
		containers : GuiPlayer_DeviceProfile.CONTAINERS_D,
		videoCodecs : "h264,mpeg4,msmpeg4v3,mpeg2video,vc1,wmv2,wmv3"
	},
	"E" : {
		width : 1920, height : 1080, level : 41, framerate : 30,
		bitrate : 30720000, hevc : null,
		containers : GuiPlayer_DeviceProfile.CONTAINERS_MODERN,
		videoCodecs : "h264,mpeg4,msmpeg4v3,mpeg2video,vc1,wmv2,wmv3"
	},
	//F-series accepts h264 padded to 1088 - h264 codes in 16 pixel rows, so
	//1080 becomes 1088 - while the older codecs stop at 1080.
	"F" : {
		width : 1920, height : 1080, h264Height : 1088, level : 41, framerate : 30,
		bitrate : 30720000, hevc : null,
		containers : GuiPlayer_DeviceProfile.CONTAINERS_MODERN,
		videoCodecs : "h264,mpeg4,msmpeg4v3,mpeg2video,vc1,wmv2,wmv3"
	},
	//H-series decodes HEVC, but only to level 4.0. The old table said 153,
	//which is 5.1 - general_level_idc is level x30, so 4.0 is 120. Claiming 5.1
	//let files through that the panel then failed to render.
	"H" : {
		width : 1920, height : 1080, level : 41, framerate : 30,
		bitrate : 50720000, hevc : 120,
		containers : GuiPlayer_DeviceProfile.CONTAINERS_MODERN,
		videoCodecs : "h264,hevc,h265,mpeg4,msmpeg4v3,mpeg2video,vc1,wmv2,wmv3"
	},
	"HU" : {
		width : 3840, height : 2160, level : 41, framerate : 30,
		bitrate : 50720000, hevc : 153,
		containers : GuiPlayer_DeviceProfile.CONTAINERS_MODERN,
		videoCodecs : "h264,hevc,h265,mpeg4,msmpeg4v3,mpeg2video,vc1,wmv2,wmv3"
	}
};

GuiPlayer_DeviceProfile.getLimits = function() {
	var limits = this.LIMITS[Main.getModelYear()];
	//An unrecognised model falls back to the most cautious profile, as the
	//original capability table did.
	return limits ? limits : this.LIMITS["D"];
};

//Lowest of the user's setting and what the panel can take.
GuiPlayer_DeviceProfile.getMaxBitrate = function() {
	var limits = this.getLimits();
	var setting = File.getTVProperty("Bitrate") * 1024 * 1024;
	if (!(setting > 0)) { setting = 20 * 1024 * 1024; }
	return Math.min(setting, limits.bitrate);
};

//Remove codecs from a comma separated list.
GuiPlayer_DeviceProfile.without = function(list, remove) {
	var parts = list.split(",");
	var kept = [];
	for (var i = 0; i < parts.length; i++) {
		var drop = false;
		for (var j = 0; j < remove.length; j++) {
			if (parts[i] == remove[j]) { drop = true; break; }
		}
		if (!drop) { kept.push(parts[i]); }
	}
	return kept.join(",");
};

//Built fresh each time rather than cloned, so the settings below can never
//leak into the next call.
GuiPlayer_DeviceProfile.build = function() {
	var limits = this.getLimits();

	var directAudio = this.AUDIO_CODECS;
	var transcodeAudio = "aac";

	//The Dolby and DTS settings describe what the attached receiver can decode.
	//Expressing them in the profile lets the server strip the audio it knows we
	//cannot play, instead of the client rewriting the URL afterwards.
	if (!File.getTVProperty("DTS")) {
		directAudio = this.without(directAudio, ["dts", "dca"]);
	}
	if (!File.getTVProperty("Dolby")) {
		directAudio = this.without(directAudio, ["ac3", "eac3"]);
	} else {
		transcodeAudio = "aac,ac3";
		if (File.getTVProperty("AACtoDolby")) {
			//User has a receiver that takes Dolby but not AAC.
			directAudio = this.without(directAudio, ["aac"]);
			transcodeAudio = "ac3";
		}
	}

	var h264Height = limits.h264Height ? limits.h264Height : limits.height;

	var codecProfiles = [
		{
			"Type" : "Video",
			"Codec" : "h264",
			"Conditions" : [
				{ "Condition":"EqualsAny",     "Property":"VideoProfile",   "Value":"baseline|constrained baseline|main|high", "IsRequired":false },
				{ "Condition":"LessThanEqual", "Property":"VideoLevel",     "Value":"" + limits.level, "IsRequired":false },
				{ "Condition":"LessThanEqual", "Property":"Width",          "Value":"" + limits.width, "IsRequired":true },
				{ "Condition":"LessThanEqual", "Property":"Height",         "Value":"" + h264Height, "IsRequired":true },
				{ "Condition":"LessThanEqual", "Property":"VideoBitDepth",  "Value":"8", "IsRequired":false },
				{ "Condition":"LessThanEqual", "Property":"VideoFramerate", "Value":"" + limits.framerate, "IsRequired":false },
				{ "Condition":"LessThanEqual", "Property":"VideoBitrate",   "Value":"" + limits.bitrate, "IsRequired":false }
			]
		},
		{
			"Type" : "Video",
			"Codec" : "mpeg4,msmpeg4v3,mpeg2video,vc1,wmv2,wmv3",
			"Conditions" : [
				{ "Condition":"LessThanEqual", "Property":"Width",          "Value":"" + limits.width, "IsRequired":true },
				{ "Condition":"LessThanEqual", "Property":"Height",         "Value":"" + limits.height, "IsRequired":true },
				{ "Condition":"LessThanEqual", "Property":"VideoBitDepth",  "Value":"8", "IsRequired":false },
				{ "Condition":"LessThanEqual", "Property":"VideoFramerate", "Value":"" + limits.framerate, "IsRequired":false },
				{ "Condition":"LessThanEqual", "Property":"VideoBitrate",   "Value":"" + limits.bitrate, "IsRequired":false }
			]
		},
		{
			"Type" : "VideoAudio",
			"Codec" : "aac,mp3,mp2,ac3,eac3,wmav2,wmapro,wmavoice",
			"Conditions" : [
				{ "Condition":"LessThanEqual", "Property":"AudioChannels", "Value":"6", "IsRequired":false }
			]
		},
		{
			"Type" : "VideoAudio",
			"Codec" : "dts,dca",
			"Conditions" : [
				{ "Condition":"LessThanEqual", "Property":"AudioChannels", "Value":"8", "IsRequired":false }
			]
		},
		{
			//These panels only carry two channel PCM.
			"Type" : "VideoAudio",
			"Codec" : "pcm_s16le,pcm_s24le,pcm_s32le",
			"Conditions" : [
				{ "Condition":"LessThanEqual", "Property":"AudioChannels", "Value":"2", "IsRequired":false }
			]
		}
	];

	if (limits.hevc != null) {
		codecProfiles.push({
			"Type" : "Video",
			"Codec" : "hevc,h265",
			"Conditions" : [
				{ "Condition":"LessThanEqual", "Property":"VideoLevel",    "Value":"" + limits.hevc, "IsRequired":false },
				{ "Condition":"LessThanEqual", "Property":"Width",         "Value":"" + limits.width, "IsRequired":true },
				{ "Condition":"LessThanEqual", "Property":"Height",        "Value":"" + limits.height, "IsRequired":true },
				{ "Condition":"LessThanEqual", "Property":"VideoBitDepth", "Value":"8", "IsRequired":false }
			]
		});
	} else {
		//An impossible condition is how a profile says "never send me this".
		codecProfiles.push({
			"Type" : "Video",
			"Codec" : "hevc,h265,vp8,vp9,av1",
			"Conditions" : [
				{ "Condition":"Equals", "Property":"Width", "Value":"0", "IsRequired":true }
			]
		});
	}

	return {
		"Name" : "Samsung Orsay " + Main.getModelYear(),
		"MaxStreamingBitrate" : this.getMaxBitrate(),
		"MaxStaticBitrate" : limits.bitrate,
		"MusicStreamingTranscodingBitrate" : 192000,

		"DirectPlayProfiles" : [
			{
				"Type" : "Video",
				"Container" : limits.containers,
				"VideoCodec" : limits.videoCodecs,
				"AudioCodec" : directAudio
			},
			{ "Type" : "Audio", "Container" : "mp3", "AudioCodec" : "mp3" }
		],

		"TranscodingProfiles" : [
			{
				//Matches the parameters the player is known to accept: an HLS
				//playlist of MPEG-TS segments starting on a keyframe.
				"Type" : "Video",
				"Container" : "ts",
				"Protocol" : "hls",
				"Context" : "Streaming",
				"VideoCodec" : "h264",
				"AudioCodec" : transcodeAudio,
				"MaxAudioChannels" : "6",
				"MinSegments" : 2,
				"BreakOnNonKeyFrames" : true,
				"EnableSubtitlesInManifest" : false
			},
			{
				"Type" : "Audio",
				"Container" : "mp3",
				"Protocol" : "http",
				"Context" : "Streaming",
				"AudioCodec" : "mp3",
				"MaxAudioChannels" : "2"
			}
		],

		"ContainerProfiles" : [],
		"CodecProfiles" : codecProfiles,

		//External keeps the server serving .srt for the app to draw itself.
		//Everything else has to be burned in, which is the only way this
		//hardware can show PGS or ASS at all.
		"SubtitleProfiles" : [
			{ "Format":"srt",    "Method":"External" },
			{ "Format":"subrip", "Method":"External" },
			{ "Format":"ass",    "Method":"Encode" },
			{ "Format":"ssa",    "Method":"Encode" },
			{ "Format":"pgs",    "Method":"Encode" },
			{ "Format":"pgssub", "Method":"Encode" },
			{ "Format":"sub",    "Method":"Encode" },
			{ "Format":"idx",    "Method":"Encode" },
			{ "Format":"dvdsub", "Method":"Encode" },
			{ "Format":"vtt",    "Method":"Encode" }
		]
	};
};

//----------------------------------------------------------------------------
//  Local capability lookups.
//
//  The fallback path in GuiPlayer_Transcoding, used when the server cannot
//  negotiate, needs the same limits in the shape its checks expect. Deriving
//  them here keeps one description of the hardware rather than two that drift
//  apart - the previous second copy had HEVC on H-series at level 5.1 when the
//  panel stops at 4.0.
//----------------------------------------------------------------------------

GuiPlayer_DeviceProfile.listContains = function(list, value) {
	var parts = list.split(",");
	for (var i = 0; i < parts.length; i++) {
		if (parts[i] == value) { return true; }
	}
	return false;
};

//Mirrors the old getParameters:
//[supported, containers[], [w,h], bitrate, framerate, level, profiles]
GuiPlayer_DeviceProfile.getVideoLimits = function(codec) {
	var limits = this.getLimits();
	var containers = limits.containers.split(",");

	if (codec == "hevc" || codec == "h265") {
		if (limits.hevc == null) { return [null, null, null, limits.bitrate, null, null, null]; }
		return [true, containers, [limits.width, limits.height], limits.bitrate,
		        limits.framerate, limits.hevc, true];
	}

	if (!this.listContains(limits.videoCodecs, codec)) {
		//Unknown to this panel: every check fails and the file is transcoded.
		return [null, null, null, limits.bitrate, null, null, null];
	}

	if (codec == "h264") {
		var h264Height = limits.h264Height ? limits.h264Height : limits.height;
		return [true, containers, [limits.width, h264Height], limits.bitrate,
		        limits.framerate, limits.level,
		        ["Base","Constrained Baseline","Baseline","Main","High"]];
	}

	//The older codecs carry no level or profile constraint worth checking.
	return [true, containers, [limits.width, limits.height], limits.bitrate,
	        limits.framerate, true, true];
};

//Mirrors the old getAudioParameters: [supported, containers[], maxChannels]
GuiPlayer_DeviceProfile.getAudioLimits = function(audioCodec) {
	var limits = this.getLimits();
	var containers = limits.containers.split(",");

	if (!this.listContains(this.AUDIO_CODECS, audioCodec)) {
		return [false, null, null];
	}

	//PCM is two channel only. DTS carries eight, except on the 2011 sets which
	//stop at six. Everything else is six.
	if (audioCodec.indexOf("pcm") === 0) { return [true, containers, 2]; }
	if (audioCodec == "dts" || audioCodec == "dca") {
		return [true, containers, (Main.getModelYear() == "D") ? 6 : 8];
	}
	return [true, containers, 6];
};

//Turn one negotiated media source into the URL to hand the player.
//Returns [url, playMethod] or null when the source cannot be played.
GuiPlayer_DeviceProfile.resolveUrl = function(mediaSource, itemId, playSessionId) {
	var base = Server.getServerAddr();
	var key = "&api_key=" + Server.getAuthToken();
	var device = "&DeviceId=" + encodeURIComponent(Server.getDeviceID());
	var session = playSessionId ? ("&PlaySessionId=" + encodeURIComponent(playSessionId)) : "";

	if (mediaSource.SupportsDirectPlay === true || mediaSource.SupportsDirectStream === true) {
		//Container here is a single name chosen by the server, not the format
		//list that comes back on a MediaSource from a plain query.
		var container = mediaSource.Container ? mediaSource.Container.split(",")[0] : "mp4";
		var url = base + "/Videos/" + itemId + "/stream." + container +
		          "?static=true&mediaSourceId=" + encodeURIComponent(mediaSource.Id) +
		          key + device + session;
		FileLog.write("Video : server negotiated Direct Play");
		return [url, "Direct Play"];
	}

	if (mediaSource.TranscodingUrl) {
		//Already carries the codec constraints, the media source and usually the
		//key, so take it as given and only fill in what is genuinely missing.
		//Note the server spells the key "ApiKey", not "api_key", so these
		//checks are done case-insensitively to avoid appending a second one.
		var turl = base + mediaSource.TranscodingUrl;
		var lower = turl.toLowerCase();
		if (lower.indexOf("playsessionid=") === -1) { turl += session; }
		if (lower.indexOf("apikey=") === -1 && lower.indexOf("api_key=") === -1) { turl += key; }
		if (lower.indexOf("deviceid=") === -1) { turl += device; }
		FileLog.write("Video : server negotiated Transcode");
		return [turl, "Transcoding Audio & Video"];
	}

	FileLog.write("Video : server returned a source with no way to play it");
	return null;
};
