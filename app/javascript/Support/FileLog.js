var FileLog = {
	clockOffset : null,
};

// getTimeStamp runs on every log line, including during playback. Reading the
// setting each time re-opens and re-parses the whole settings file, so cache it.
FileLog.getClockOffset = function () {
	if (this.clockOffset === null) {
		var offset = File.getTVProperty("ClockOffset");
		this.clockOffset = (typeof offset === "number") ? offset : 0;
	}
	return this.clockOffset;
};

// Call after the user changes the offset in Settings.
FileLog.resetClockOffset = function () {
	this.clockOffset = null;
};

// POST the log to a diagnostics collector (the /report endpoint of
// orsay-serve.py). An Orsay TV has no console and no way to export files,
// so this is the only practical way to retrieve a log from the device.
FileLog.upload = function (host) {
	if (!host) { return false; }
	var lines = FileLog.loadFile(true);
	if (lines == null) { return false; }

	var xmlHttp = new XMLHttpRequest();
	if (!xmlHttp) { return false; }
	try {
		xmlHttp.open("POST", "http://" + host + "/report?name=applog", false);
		xmlHttp.setRequestHeader("Content-Type", "text/plain");
		xmlHttp.send(lines.join("\n"));
	} catch (e) {
		return false;
	}
	return xmlHttp.status == 200;
};

// Host to send diagnostics to: an explicitly configured one if present,
// otherwise the Jellyfin server's host, which is where a self-hoster is
// most likely to be running the collector.
FileLog.getDiagnosticsHost = function () {
	var configured = File.getTVProperty("DiagnosticsHost");
	if (configured) { return configured; }

	var addr = Server.getServerAddr();
	if (!addr) { return null; }
	return addr.replace(/^https?:\/\//i, "").split("/")[0].split(":")[0];
};

FileLog.deleteFile = function() {
	var fileSystemObj = new FileSystem();
	fileSystemObj.deleteCommonFile(curWidget.id + '/MB3_Log.txt');
}

FileLog.loadFile = function(returnContents) {
	var fileSystemObj = new FileSystem();
	
	var bValid = fileSystemObj.isValidCommonPath(curWidget.id); 
	if (!bValid) {  
		fileSystemObj.createCommonDir(curWidget.id); 
		var fileObj = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Log.txt', 'a+');
		fileSystemObj.closeCommonFile(fileObj); 
	}
	
	var openRead = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Log.txt', 'r');
	if (!openRead) {
		fileSystemObj.createCommonDir(curWidget.id); 
		var fileObj = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Log.txt', 'a+');
		fileSystemObj.closeCommonFile(fileObj); 
		return null;
	} else {
		var strLine = "";
		var arrayFile = new Array();
		while ((strLine=openRead.readLine())) {
			arrayFile.push(strLine);
		}
		fileSystemObj.closeCommonFile(openRead);	
		if (returnContents) {
			return arrayFile;
		} else {
			return null;
		}		
	}
};

FileLog.write = function (toWrite,noDate) {
	
	var writeDate = (noDate == undefined) ? true : false;
	toWrite = (writeDate == true) ? FileLog.getTimeStamp() + " " + toWrite : toWrite;
	alert(toWrite);
	var fileSystemObj = new FileSystem();
	var openWrite = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Log.txt', 'a+');
	if (openWrite) {
		openWrite.writeLine(toWrite); 
		fileSystemObj.closeCommonFile(openWrite); 
	}
}

FileLog.empty = function () {
	var fileSystemObj = new FileSystem();
	var openWrite = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Log.txt', 'w');
	if (openWrite) {
		fileSystemObj.closeCommonFile(openWrite); 
	}
}

FileLog.getTimeStamp = function () {
	var date = new Date();
	var day = (date.getDate() < 10) ? "0" + date.getDate() : date.getDate();
	var month = (date.getMonth() + 1 < 10) ? "0" + (date.getMonth() + 1) : date.getMonth() + 1;
	var year = date.getFullYear();

	var h=date.getHours();
	var offset = FileLog.getClockOffset();
	h = h+offset;
	if (h<0) {h = h + 24;};
	if (h>23){h = h - 24;};
	if (h<10) {h = "0" + h;};
	var m=date.getMinutes(); 
	if (m<10) {m = "0" + m;};
	return day + "/" + month + "/" + year + " " + h+':'+m;
}