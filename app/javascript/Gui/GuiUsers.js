var GuiUsers = {
	UserData : null,
	
	isManualEntry : false,
	
	rememberPassword : true,
	
	selectedUser : 0,
	selectedRow : 0,
	optionRows : ["QuickConnect", "ManualLogin", "ChangeServer"],
	topLeftItem : 0, 
	MAXCOLUMNCOUNT : 3,
	MAXROWCOUNT : 1
}

GuiUsers.getMaxDisplay = function() {
	return this.MAXCOLUMNCOUNT * this.MAXROWCOUNT;
}

GuiUsers.start = function(runAutoLogin) {
	FileLog.write("Page : GuiUsers");
	//The coloured keys did real work here but were unlabelled, so nobody knew.
	GuiHelper.setControlButtons(null,"Delete Users","Delete Passwords","Change Server","Exit  ");
	Support.removeSplashScreen();
	
	//Reset Properties
	File.setUserEntry(null);
	this.selectedUser = 0;
	this.selectedRow = 0;
	this.topLeftItem = 0; 
	this.isManualEntry = false;
	this.rememberPassword = true;
	
	Support.destroyURLHistory();
	Support.fadeImage("images/bg1.jpg");
	document.getElementById("NotificationText").innerHTML = "";
	document.getElementById("Notifications").style.visibility = "hidden";
	
	//Load Data
	var url = Server.getServerAddr() + "/Users/Public?format=json";
	this.UserData = Server.getContent(url);
	if (this.UserData == null) { return; }
	
	//Check for Default User
	var autoLogin = false;
	
	//Load File Data
	if (runAutoLogin == true) {
		var fileJson = File.readSettings(); 
		//Look at each user in the local users file.
		for (var index = 0; index < fileJson.Servers[File.getServerEntry()].Users.length; index++) {
			//If they are the default users log them in automatically.
			if (fileJson.Servers[File.getServerEntry()].Users[index].Default == true) {
				var savedUser = fileJson.Servers[File.getServerEntry()].Users[index];
				var userId = savedUser.UserId;
				var User = savedUser.UserName;
				var Password = savedUser.Password;

				//Prefer the saved access token: it survives without keeping the
				//password on disk, and it is what lets the app stay signed in.
				var authenticateSuccess = Server.authenticateWithToken(savedUser.AccessToken, userId, User);

				//Only fall back to the password if one was actually kept.
				if (!authenticateSuccess && Password) {
					authenticateSuccess = Server.Authenticate(userId, User, Password);
				}

				if (authenticateSuccess) {
					autoLogin = true;
					//Set File User Entry
					File.setUserEntry(index);
					//Change Focus and call function in GuiMain to initiate the page!
					GuiMainMenu.start();
				} else {
					//Show the login screen rather than deleting the account. The
					//old behaviour threw the saved user away on any failure,
					//including a server that was merely unreachable.
					FileLog.write("Auth : could not sign in automatically - asking for the password");
				}
				break;
			}
		}
	}

	if (autoLogin == false) {
		//Change Display
		document.getElementById("pageContent").className = "";
		document.getElementById("pageContent").innerHTML = "<div style='padding-top:100px;text-align:center'>" +
			"<div id=guiUsers_allusers></div>" +
			"<div id='pwdOptions' class='loginOptions'>" +
				"<div id='guiUsers_pwd' style='visibility:hidden'>" +
				"<br>Password:    <input id='guiUsers_Password' type='password' size='20'/>" +
				"<br><span id='guiUsers_rempwd'>Remember Password </span> : <span id='guiUsers_rempwdvalue'>" + this.rememberPassword + "</span>" + 
				"</div><br>" +
			"</div>" +
	    	"<div id='loginOptions' class='loginOptions'>" +
	    		"<div id='QuickConnect'>Quick Connect</div>" +
	    		"<div id='ManualLogin'>Manual Login</div>" +
	    		"<div id='ChangeServer'>Change Server</div> " +
	    		"<div><br>Available options for each page are shown at the bottom.<br>Once logged in, move left on any page to access the main menu.</div>" +
	    	"</div></div>";
		
		if (this.UserData.length != 0) {
			GuiUsers.updateDisplayedUsers();
			GuiUsers.updateSelectedUser();
			document.getElementById("GuiUsers").focus();
		} else {
			//Probably need some padding here to make it look nice!
			document.getElementById("GuiUsers").focus();
		}	
	}
}

GuiUsers.updateDisplayedUsers = function() {
	var htmltoadd = "";
	for (var index = this.topLeftItem; index < (Math.min(this.topLeftItem + this.getMaxDisplay(),this.UserData.length)); index++) {
		if (this.UserData[index].PrimaryImageTag) {			
			var imgsrc = Server.getImageURL(this.UserData[index].Id,"UsersPrimary",400,400,0,false,0);
			htmltoadd += "<div id=" + this.UserData[index].Id + " style=background-image:url(" +imgsrc+ ")><div class=menuItem>"+ this.UserData[index].Name + "</div></div>";
		} else {
			htmltoadd += "<div id=" + this.UserData[index].Id + " style=background-image:url(images/loginusernoimage.png)><div class=menuItem>"+ this.UserData[index].Name + "</div></div>";
		}	
    }
		
	//Set Content to Server Data
	document.getElementById("guiUsers_allusers").innerHTML = htmltoadd;
}


//Highlights whichever row is selected. Row 0 is the user strip; anything
//below indexes optionRows.
GuiUsers.updateSelectedRow = function () {
	for (var i = 0; i < this.optionRows.length; i++) {
		var el = document.getElementById(this.optionRows[i]);
		if (el != null) {
			el.className = (this.selectedRow === i + 1) ? "highlight1Text" : "offWhite";
		}
	}

	if (this.selectedRow === 0) {
		GuiUsers.updateSelectedUser();
	} else if (this.UserData.length > 0 && this.UserData[this.selectedUser]) {
		//Take the ring off the user while a row below is selected.
		var user = document.getElementById(this.UserData[this.selectedUser].Id);
		if (user != null) { user.className = "User"; }
	}

	this.isManualEntry = (this.optionRows[this.selectedRow - 1] === "ManualLogin");
};

//Function sets CSS Properties so show which user is selected
GuiUsers.updateSelectedUser = function () {	
	Support.updateSelectedNEW(this.UserData,this.selectedUser,this.topLeftItem,
			Math.min(this.topLeftItem + GuiUsers.getMaxDisplay(),this.UserData.length),"User Selected highlight1Boarder","User","");
}

//Function executes on the selection of a user - should log user in or generate error message on screen
GuiUsers.processSelectedUser = function () {
	var selectedUserId = this.UserData[this.selectedUser].Id;

	//Remove Focus & Display Loading
	
	document.getElementById("NoItems").focus();
	document.getElementById("guiLoading").style.visibility = "";

	//Load JSON File
	var userInFile = false;
	var fileJson = File.readSettings(); 
    if (fileJson.Servers[File.getServerEntry()].Users.length > 0) {	
    	for (var index = 0; index < fileJson.Servers[File.getServerEntry()].Users.length; index++) {
    		var UserId = fileJson.Servers[File.getServerEntry()].Users[index].UserId;
    		if (UserId == selectedUserId){
    			userInFile = true;
    			var User = fileJson.Servers[File.getServerEntry()].Users[index].UserName;
    			var Password = fileJson.Servers[File.getServerEntry()].Users[index].Password;
    			
    			if (fileJson.Servers[File.getServerEntry()].Users[index].RememberPassword !== undefined) {
    				this.rememberPassword = fileJson.Servers[File.getServerEntry()].Users[index].RememberPassword;
    				document.getElementById("guiUsers_rempwdvalue").innerHTML = this.rememberPassword;
    			}
    			
    			//Authenticate with MB3 - if fail somehow bail?					
				var authenticateSuccess = Server.Authenticate(UserId, User, Password);		
				if (authenticateSuccess) {
					//Hide loading
					document.getElementById("guiLoading").style.visibility = "hidden";
					//document.getElementById("GuiUsers").focus();
					//Set File User Entry
					File.setUserEntry(index);
					//Change Focus and call function in GuiMain to initiate the page!
					GuiMainMenu.start();
				} else {
					//Doesn't delete, allows user to correct password for the user.
					//Hide loading
					document.getElementById("guiLoading").style.visibility = "hidden";
					document.getElementById("GuiUsers").focus();
					
					//Saved password failed - likely due to a user changing their password or user forgetting passwords!
					new GuiUsers_Input("guiUsers_Password");				
				}
				break;
    		}  		
    	}		
    }
	if (userInFile == false){
		if (this.UserData[this.selectedUser].HasPassword) {
			//Has password - Load IME	
			//Hide loading
			document.getElementById("guiLoading").style.visibility = "hidden";
			document.getElementById("GuiUsers").focus();
			new GuiUsers_Input("guiUsers_Password");
		} else {
			var password = "";
			var authenticateSuccess = Server.Authenticate(this.UserData[this.selectedUser].Id, this.UserData[this.selectedUser].Name, password);		
			if (authenticateSuccess) {
				//Reset GUI to as new - Not Required as it already is!!
				//Hide loading
				document.getElementById("guiLoading").style.visibility = "hidden";
				//Add Username & Password to DB
				File.addUser(this.UserData[this.selectedUser].Id,this.UserData[this.selectedUser].Name,password,this.rememberPassword);
				//Change Focus and call function in GuiMain to initiate the page!
				GuiMainMenu.start();
			} else {
				//Hide loading
				document.getElementById("guiLoading").style.visibility = "hidden";
				document.getElementById("GuiUsers").focus();
				//Div to display Network Failure - No password therefore no password error
				//This event should be impossible under normal circumstances
				GuiNotifications.setNotification("Network Error");
			}
		}
	}
	

}

GuiUsers.keyDown = function()
{
	var keyCode = event.keyCode;

	if (document.getElementById("Notifications").style.visibility == "") {
		document.getElementById("Notifications").style.visibility = "hidden";
		document.getElementById("NotificationText").innerHTML = "";
		widgetAPI.blockNavigation(event);
		//Change keycode so it does nothing!
		keyCode = "VOID";
	}
	
	switch(keyCode)
	{
		case tvKey.KEY_RETURN:
		case tvKey.KEY_PANEL_RETURN:
			widgetAPI.sendReturnEvent();
			break;
		case tvKey.KEY_UP:
			if (this.selectedRow > 0) {
				this.selectedRow--;
				this.updateSelectedRow();
			}
			break;
		case tvKey.KEY_DOWN:
			if (this.selectedRow < this.optionRows.length) {
				this.selectedRow++;
				this.updateSelectedRow();
			}
			break;
		case tvKey.KEY_LEFT:
			if (this.selectedRow == 0) {
				this.selectedUser--;
				if (this.selectedUser < 0) {
					this.selectedUser = this.UserData.length - 1;
					if(this.UserData.length > this.MAXCOLUMNCOUNT) {
						this.topLeftItem = (this.selectedUser-2);
						GuiUsers.updateDisplayedUsers();
					} else {
						this.topLeftItem = 0;
					}
				} else {
					if (this.selectedUser < this.topLeftItem) {
						this.topLeftItem--;
						if (this.topLeftItem < 0) {
							this.topLeftItem = 0;
						}
						GuiUsers.updateDisplayedUsers();
					}
				}
				GuiUsers.updateSelectedUser();
			}
			break;
		case tvKey.KEY_RIGHT:
			if (this.selectedRow == 0) {
				this.selectedUser++;
				if (this.selectedUser >= this.UserData.length) {
					this.selectedUser = 0;
					this.topLeftItem = 0;
					GuiUsers.updateDisplayedUsers();
				} else {
					if (this.selectedUser >= this.topLeftItem+this.getMaxDisplay() ) {
						this.topLeftItem++;
						GuiUsers.updateDisplayedUsers();
					}
				}
				GuiUsers.updateSelectedUser();
			}
			break;
		case tvKey.KEY_ENTER:
		case tvKey.KEY_PANEL_ENTER:
			if (this.selectedRow === 0) {
				GuiUsers.processSelectedUser();
				break;
			}
			switch (this.optionRows[this.selectedRow - 1]) {
				case "QuickConnect":  GuiPage_QuickConnect.start(); break;
				case "ManualLogin":   GuiUsers_Manual.start(); break;
				case "ChangeServer":  GuiPage_Servers.start(); break;
			}
			break;
		case tvKey.KEY_BLUE:
			Server.setServerAddr("");
			File.setServerEntry(null);
			GuiPage_Servers.start();
			break;
		case tvKey.KEY_YELLOW:
			GuiNotifications.setNotification("All Passwords Deleted","Deletion");
			File.deleteUserPasswords();
			break;			
		case tvKey.KEY_GREEN:
			GuiNotifications.setNotification("All Users Deleted","Deletion");
			File.deleteAllUsers();
			break;		
		case tvKey.RETURN:
			widgetAPI.blockNavigation(event);
        	GuiUsers.start();
			break;
		case tvKey.KEY_EXIT:
			widgetAPI.sendExitEvent();
			break;
		default:
			break;
	}
};


//////////////////////////////////////////////////////////////////
//  Input method for entering user password                     //
//////////////////////////////////////////////////////////////////
var GuiUsers_Input  = function(id) {   
    var imeReady = function(imeObject) {    	
    	installFocusKeyCallbacks();   	
    	document.getElementById("guiUsers_pwd").style.visibility="";
    	document.getElementById("guiUsers_Password").focus();
    }
    
    var ime = new IMEShell(id, imeReady,'en');
    ime.setKeypadPos(1300,90);
        
    var installFocusKeyCallbacks = function () {
        ime.setKeyFunc(tvKey.KEY_ENTER, function (keyCode) {
           
            //Save pwd value first, then wipe for next use
            var pwd = document.getElementById("guiUsers_Password").value;
            ime.setString("");
            
            //Set focus back to GuiUsers to reset IME
            document.getElementById("GuiUsers").focus(); 
                             
            GuiUsers.IMEAuthenticate(pwd);           
        });
        
        //Keycode to abort login from password screen
        ime.setKeyFunc(tvKey.KEY_RED, function (keyCode) {
        	document.getElementById("guiUsers_pwd").style.visibility="hidden";
        	document.getElementById("GuiUsers").focus();   	
        }); 
        
        ime.setKeyFunc(tvKey.KEY_DOWN, function (keyCode) {
        	document.getElementById("guiUsers_rempwd").style.color = "red";
        	document.getElementById("GuiUsers_Pwd").focus();
        });
        
        ime.setKeyFunc(tvKey.KEY_RETURN, function (keyCode) {
        	widgetAPI.blockNavigation(event);
        	GuiUsers.start();
        });
        
        ime.setKeyFunc(tvKey.KEY_EXIT, function (keyCode) {
        	widgetAPI.sendExitEvent();
        });      
    }   
}

//Run from IME if user has password - Run in GuiUsers for ease of access to class variables
GuiUsers.IMEAuthenticate = function(password) {
	var authenticateSuccess = Server.Authenticate(this.UserData[this.selectedUser].Id, this.UserData[this.selectedUser].Name, password);		
	if (authenticateSuccess) {
		//Reset GUI to as new!
		document.getElementById("guiUsers_pwd").style.visibility="hidden";

		//Add Username & Password to DB - Save password only if rememberPassword = true
		if (this.rememberPassword == true) {
			File.addUser(this.UserData[this.selectedUser].Id,this.UserData[this.selectedUser].Name,password,this.rememberPassword);
		} else {
			File.addUser(this.UserData[this.selectedUser].Id,this.UserData[this.selectedUser].Name,"",this.rememberPassword);
		}
			
		//Change Focus and call function in GuiMain to initiate the page!
		GuiMainMenu.start();
	} else {
		//Wrong password - Reset IME focus and notifty user
		document.getElementById("guiUsers_Password").focus();
		GuiNotifications.setNotification("Bad password or network error.","Logon Error");
	}  
}

GuiUsers.keyDownPassword = function() {
		var keyCode = event.keyCode;

		if (document.getElementById("Notifications").style.visibility == "") {
			document.getElementById("Notifications").style.visibility = "hidden";
			document.getElementById("NotificationText").innerHTML = "";
			widgetAPI.blockNavigation(event);
			//Change keycode so it does nothing!
			keyCode = "VOID";
		}
		
		switch(keyCode)
		{
			case tvKey.KEY_RETURN:
			case tvKey.KEY_PANEL_RETURN:
				widgetAPI.sendReturnEvent();
				break;
			case tvKey.KEY_UP:
				if (document.getElementById("guiUsers_rempwd").style.color == "red") {
					document.getElementById("guiUsers_rempwd").style.color = "#f9f9f9";
					document.getElementById("guiUsers_Password").focus();  
				} else {
					this.rememberPassword = (this.rememberPassword == false) ? true : false;
					document.getElementById("guiUsers_rempwdvalue").innerHTML = this.rememberPassword;
				}
				break;	
			case tvKey.KEY_DOWN:
				if (document.getElementById("guiUsers_rempwdvalue").style.color == "red") {
					this.rememberPassword = (this.rememberPassword == false) ? true : false;
					document.getElementById("guiUsers_rempwdvalue").innerHTML = this.rememberPassword;
				}
				break;	
			case tvKey.KEY_RIGHT:
				if (document.getElementById("guiUsers_rempwd").style.color == "red") {
					document.getElementById("guiUsers_rempwd").style.color = "green";
					document.getElementById("guiUsers_rempwdvalue").style.color = "red";
				}
				break;
			case tvKey.KEY_LEFT:
				if (document.getElementById("guiUsers_rempwdvalue").style.color == "red") {
					document.getElementById("guiUsers_rempwd").style.color = "red";
					document.getElementById("guiUsers_rempwdvalue").style.color = "#f9f9f9";
				}
				break;
			case tvKey.KEY_ENTER:
			case tvKey.KEY_PANEL_ENTER:
				if (document.getElementById("guiUsers_rempwdvalue").style.color == "red") {
					document.getElementById("guiUsers_rempwd").style.color = "red";
					document.getElementById("guiUsers_rempwdvalue").style.color = "#f9f9f9";
				} else {
					document.getElementById("guiUsers_rempwd").style.color = "green";
					document.getElementById("guiUsers_rempwdvalue").style.color = "red";
				}
				break;	
			case tvKey.KEY_EXIT:
				widgetAPI.sendExitEvent();
				break;
			default:
				break;
		}
	};