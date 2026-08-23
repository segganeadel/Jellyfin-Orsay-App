var File = {
		ServerEntry : null,
		UserEntry : null
};

File.getServerEntry = function() {
	return this.ServerEntry;
};

File.setServerEntry = function(serverEntry) {
	this.ServerEntry = serverEntry;
};

File.getUserEntry = function() {
	return this.UserEntry;
};

File.setUserEntry = function(userEntry) {
	this.UserEntry = userEntry;
};

File.deleteOldSettingsFile = function() {
	var fileSystemObj = new FileSystem();
	fileSystemObj.deleteCommonFile(curWidget.id + '/MB3_Settings.xml');
};

File.deleteSettingsFile = function() {
	var fileSystemObj = new FileSystem();
	fileSystemObj.deleteCommonFile(curWidget.id + '/MB3_Settings.json');
};

File.loadFile = function() {
	var fileSystemObj = new FileSystem();
	
	var bValid = fileSystemObj.isValidCommonPath(curWidget.id); 
	if (!bValid) {  
		fileSystemObj.createCommonDir(curWidget.id); 
		var fileObj = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'w');
		var contentToWrite = '{"Version":"'+Main.getVersion()+'","Servers":[],"TV":{}}';
		fileObj.writeLine(contentToWrite); 
		fileSystemObj.closeCommonFile(fileObj); 
	}
	
	var openRead = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'r');
	if (!openRead) {
		fileSystemObj.createCommonDir(curWidget.id); 
		var fileObj = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'w');
		var contentToWrite = '{"Version":"'+Main.getVersion()+'","Servers":[],"TV":{}}';
		fileObj.writeLine(contentToWrite); 
		fileSystemObj.closeCommonFile(fileObj); 
		return contentToWrite;
	} else {
		var fileContents = openRead.readAll();
		fileSystemObj.closeCommonFile(openRead);		
		return fileContents;
	}
};

// Every read of the settings file goes through here, so a truncated or
// half-written file is dealt with once instead of throwing out of whichever
// screen happened to touch it first - which used to leave the app dead until
// the file was deleted by hand.
File.parseSettings = function(text) {
	try {
		var parsed = JSON.parse(text);
		if (parsed != null && typeof parsed == "object") {
			return parsed;
		}
		FileLog.write("Settings : file did not contain an object");
	} catch (e) {
		FileLog.write("Settings : file is unreadable - " + e);
	}

	// Hand back a usable structure so the caller can carry on. Deliberately not
	// written to disk: a file that is only temporarily unreadable should not be
	// destroyed on the strength of one failed read.
	return {"Version" : Main.getVersion(), "Servers" : [], "TV" : {}};
};

// Read and parse in one guarded step.
File.readSettings = function() {
	return File.parseSettings(File.loadFile());
};

File.checkVersion = function(fileContent) {
	if (fileContent.Version === undefined) {
		return "Undefined"
	} else {
		return fileContent.Version;
	}
};

File.saveServerToFile = function(Id,Name,ServerIP) {
	var fileSystemObj = new FileSystem();
	var openRead = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'r');
	if (openRead) {
		var fileJson = File.parseSettings(openRead.readLine()); //Read line as only 1 and skips line break!
		fileSystemObj.closeCommonFile(openRead);	
		
		var serverExists = false;
		for (var index = 0; index < fileJson.Servers.length; index++) {
			if (Id == fileJson.Servers[index].Id) {
				this.ServerEntry = index;
				serverExists = true;
				alert ("Server already exists in file - not adding - Server Entry: " + this.ServerEntry);
			}
		}
		
		if (serverExists == false) {
			this.ServerEntry = fileJson.Servers.length
			fileJson.Servers[fileJson.Servers.length] = {"Id":Id,"Name":Name,"Path":ServerIP,"Default":false,"Users":[]};
			var openWrite = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'w');
			if (openWrite) {
				openWrite.writeLine(JSON.stringify(fileJson)); 
				fileSystemObj.closeCommonFile(openWrite); 
				alert ("Server added to file - Server Entry: " + this.ServerEntry);
			}
		}	
	}
};

File.setDefaultServer = function (defaultIndex) {
	var fileJson = File.readSettings(); 
	for (var index = 0; index < fileJson.Servers.length; index++) {
		if (fileJson.Servers[defaultIndex].Id == fileJson.Servers[index].Id ) {
			fileJson.Servers[index].Default = true;
		} else {
			fileJson.Servers[index].Default = false;
		}
	}
	
	var fileSystemObj = new FileSystem();
	var openWrite = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'w');
	if (openWrite) {
		openWrite.writeLine(JSON.stringify(fileJson)); 
		fileSystemObj.closeCommonFile(openWrite); 
	}
	GuiNotifications.setNotification(fileJson.Servers[defaultIndex].Name + " is now your default Server and will be logged in autiomatically from now on.","Default Server Changed",true);
};

File.deleteServer = function (index) {
	var fileSystemObj = new FileSystem();
	var openRead = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'r');
	if (openRead) {
		var fileJson = File.parseSettings(openRead.readLine()); //Read line as only 1 and skips line break!
		fileSystemObj.closeCommonFile(openRead);	

		fileJson.Servers.splice(index, 1); //Without the count, splice drops every later server too.

		var openWrite = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'w');
		if (openWrite) {
			openWrite.writeLine(JSON.stringify(fileJson)); 
			fileSystemObj.closeCommonFile(openWrite); 
		}
		
		if (fileJson.Servers.length == 0) {
			GuiPage_NewServer.start();
		} else {
			GuiPage_Servers.start();
		}
	}	
};

File.addUser = function (UserId, Name, Password, rememberPassword) {
	var fileSystemObj = new FileSystem();
	var openRead = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'r');
	if (openRead) {
		var fileJson = File.parseSettings(openRead.readLine()); //Read line as only 1 and skips line break!
		fileSystemObj.closeCommonFile(openRead);	

		//The access token the server just issued. Storing it means the next
		//launch can sign in without the password - which is the only way to
		//stay signed in without keeping the password on disk.
		var accessToken = Server.getAuthToken();

		//Check if user doesn't already exist - if does, alter password and save!
		var userFound = false;
		for (var index = 0; index < fileJson.Servers[this.ServerEntry].Users.length; index++) {
			if (fileJson.Servers[this.ServerEntry].Users[index].UserId == UserId) {
				userFound = true;
				this.UserEntry = index;
				fileJson.Servers[this.ServerEntry].Users[index].Password = Password;
				fileJson.Servers[this.ServerEntry].Users[index].RememberPassword = rememberPassword;
				fileJson.Servers[this.ServerEntry].Users[index].AccessToken = accessToken;
				break;
			}
		}
		if (userFound == false) {
			this.UserEntry = fileJson.Servers[this.ServerEntry].Users.length;
			//The first account to sign in becomes the default, so the app signs
			//straight back in next time instead of asking again. Previously
			//nothing ever set this and the login screen appeared on every launch.
			var isFirstUser = (fileJson.Servers[this.ServerEntry].Users.length == 0);
			fileJson.Servers[this.ServerEntry].Users[this.UserEntry] = {"UserId":UserId,"UserName":Name.toLowerCase(),"Password":Password,"RememberPassword":rememberPassword,"AccessToken":accessToken,"Default":isFirstUser,"HighlightColour":1,"ContinueWatching":true,"View1":"TVNextUp","View1Name":"Next Up","View2":"LatestMovies","View2Name":"Latest Movies"};

		}

		//Auto sign-in only looks at the default account. Accounts saved before
		//this existed have no default set, so adopt this one when none is.
		var haveDefault = false;
		for (var d = 0; d < fileJson.Servers[this.ServerEntry].Users.length; d++) {
			if (fileJson.Servers[this.ServerEntry].Users[d].Default == true) { haveDefault = true; break; }
		}
		if (!haveDefault) {
			fileJson.Servers[this.ServerEntry].Users[this.UserEntry].Default = true;
		}

		var openWrite = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'w');
		if (openWrite) {
			openWrite.writeLine(JSON.stringify(fileJson));
			fileSystemObj.closeCommonFile(openWrite);
		}
	}
};

//Signing out has to drop the saved token as well, or the next launch would
//simply sign back in with it.
File.clearSavedLogin = function () {
	var fileJson = File.readSettings();
	if (fileJson.Servers == null || fileJson.Servers[this.ServerEntry] == null) { return; }

	var users = fileJson.Servers[this.ServerEntry].Users;
	if (users == null || users[this.UserEntry] == null) { return; }

	users[this.UserEntry].AccessToken = null;
	users[this.UserEntry].Default = false;
	File.writeAll(fileJson);
};

File.deleteUser = function (index) {
	var fileSystemObj = new FileSystem();
	var openRead = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'r');
	if (openRead) {
		var fileJson = File.parseSettings(openRead.readLine()); //Read line as only 1 and skips line break!
		fileSystemObj.closeCommonFile(openRead);	

		fileJson.Servers[this.ServerEntry].Users.splice(index, 1); //Without the count, splice drops every later user too.

		var openWrite = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'w');
		if (openWrite) {
			openWrite.writeLine(JSON.stringify(fileJson)); 
			fileSystemObj.closeCommonFile(openWrite); 
		}
	}
};

File.deleteAllUsers = function (index) {
	var fileSystemObj = new FileSystem();
	var openRead = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'r');
	if (openRead) {
		var fileJson = File.parseSettings(openRead.readLine()); //Read line as only 1 and skips line break!
		fileSystemObj.closeCommonFile(openRead);	

		fileJson.Servers[this.ServerEntry].Users = [];
		
		var openWrite = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'w');
		if (openWrite) {
			openWrite.writeLine(JSON.stringify(fileJson)); 
			fileSystemObj.closeCommonFile(openWrite); 
		}
	}
};

File.deleteUserPasswords = function () {
	var fileSystemObj = new FileSystem();
	var openRead = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'r');
	if (openRead) {
		var fileJson = File.parseSettings(openRead.readLine()); //Read line as only 1 and skips line break!
		fileSystemObj.closeCommonFile(openRead);	

		for (var index = 0; index < fileJson.Servers[this.ServerEntry].Users.length; index++) {
			fileJson.Servers[this.ServerEntry].Users[index].Password = Sha1.hash("",true); // Do this so that users with no password are unaffected! 
		}
		
		var openWrite = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'w');
		if (openWrite) {
			openWrite.writeLine(JSON.stringify(fileJson)); 
			fileSystemObj.closeCommonFile(openWrite); 
		}
	}
};

File.updateUserSettings = function (altered) {
	var fileSystemObj = new FileSystem();
	var openRead = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'r');
	if (openRead) {
		var fileJson = File.parseSettings(openRead.readLine()); //Read line as only 1 and skips line break!
		fileSystemObj.closeCommonFile(openRead);	

		fileJson.Servers[this.ServerEntry].Users[this.UserEntry] = altered;
		
		var openWrite = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'w');
		if (openWrite) {
			openWrite.writeLine(JSON.stringify(fileJson)); 
			fileSystemObj.closeCommonFile(openWrite); 
		}
	}
};


File.updateServerSettings = function (altered) {
	var fileSystemObj = new FileSystem();
	var openRead = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'r');
	if (openRead) {
		var fileJson = File.parseSettings(openRead.readLine()); //Read line as only 1 and skips line break!
		fileSystemObj.closeCommonFile(openRead);	

		fileJson.Servers[this.ServerEntry] = altered;
		
		var openWrite = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'w');
		if (openWrite) {
			openWrite.writeLine(JSON.stringify(fileJson)); 
			fileSystemObj.closeCommonFile(openWrite); 
		}
	}
};

File.writeAll = function (toWrite) {
	var fileSystemObj = new FileSystem();
	var openWrite = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'w');
	if (openWrite) {
		openWrite.writeLine(JSON.stringify(toWrite)); 
		fileSystemObj.closeCommonFile(openWrite); 
	}
};

//---------------------------------------------------------------------------------------------------------------------------------
//-  GET FUNCTIONS
//---------------------------------------------------------------------------------------------------------------------------------

File.getUserProperty = function(property) {
	var fileSystemObj = new FileSystem();
	var openRead = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'r');
	if (openRead) {
		var fileJson = File.parseSettings(openRead.readLine()); //Read line as only 1 and skips line break!
		fileSystemObj.closeCommonFile(openRead);	
		if (!fileJson.Servers[this.ServerEntry].Users[this.UserEntry]) { //In case we're not logged in yet.
			return null;
		}
		if (fileJson.Servers[this.ServerEntry].Users[this.UserEntry][property] === undefined) {
			//Get System Default
			for (var index = 0; index < GuiPage_Settings.Settings.length; index++) {
				if (GuiPage_Settings.Settings[index] == property) {
					//Write setting here?
					fileJson.Servers[this.ServerEntry].Users[this.UserEntry][property] = GuiPage_Settings.SettingsDefaults[index];
					File.writeAll(fileJson);
					break;
				}
			}
		} 
		return fileJson.Servers[this.ServerEntry].Users[this.UserEntry][property];	
	}
};

File.getTVProperty = function(property) {
	var fileSystemObj = new FileSystem();
	var openRead = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'r');
	if (openRead) {
		var fileJson = File.parseSettings(openRead.readLine()); //Read line as only 1 and skips line break!
		fileSystemObj.closeCommonFile(openRead);	

		if (fileJson.TV === undefined) {
			fileJson.TV = {};
			File.writeAll (fileJson);
		}
		
		if (fileJson.TV[property] === undefined) {
			//Get System Default
			for (var index = 0; index < GuiPage_Settings.TVSettings.length; index++) {
				if (GuiPage_Settings.TVSettings[index] == property) {
					//Write setting here?
					fileJson.TV[property] = GuiPage_Settings.TVSettingsDefaults[index];
					File.writeAll(fileJson);
					break;
				}
			}
		} 
		return fileJson.TV[property];			
	}
};

//---------------------------------------------------------------------------------------------------------------------------------
//-  SET FUNCTIONS
//---------------------------------------------------------------------------------------------------------------------------------

File.setTVProperty = function(property,value) {
	var fileSystemObj = new FileSystem();
	var openRead = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'r');
	if (openRead) {
		var fileJson = File.parseSettings(openRead.readLine()); //Read line as only 1 and skips line break!
		fileSystemObj.closeCommonFile(openRead);

		if (fileJson.TV === undefined) {
			fileJson.TV = {};
		}
		fileJson.TV[property] = value;
		File.writeAll(fileJson);
	}
};

File.setUserProperty = function(property,value) {
	var fileSystemObj = new FileSystem();
	var openRead = fileSystemObj.openCommonFile(curWidget.id + '/MB3_Settings.json', 'r');
	if (openRead) {
		var fileJson = File.parseSettings(openRead.readLine()); //Read line as only 1 and skips line break!
		fileSystemObj.closeCommonFile(openRead);	

		if (property == "Password") {
			value = Sha1.hash(value,true);
		}
		
		if (fileJson.Servers[this.ServerEntry].Users[this.UserEntry][property] !== undefined) {
			fileJson.Servers[this.ServerEntry].Users[this.UserEntry][property] = value;
			File.writeAll(fileJson);
		} 
		return 	
	}
};