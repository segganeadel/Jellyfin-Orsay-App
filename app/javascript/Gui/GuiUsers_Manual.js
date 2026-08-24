var GuiUsers_Manual = {
	UserData : null,
	selectedItem : 0, //0 = User, 1 = Password
	rememberPassword : false
}

GuiUsers_Manual.start = function() {
	FileLog.write("Page : GuiUsers_Manual");
	GuiHelper.setControlButtons(null,null,null,null,"Return");
	
	//Reset Properties
	this.selectedItem = 0;
	this.rememberPassword = false;
	
	document.getElementById("NotificationText").innerHTML = "";
	document.getElementById("Notifications").style.visibility = "hidden";
	
	//Load Data
	var url = Server.getServerAddr() + "/Users/Public?format=json";
	this.UserData = Server.getContent(url);
	if (this.UserData == null) { return; }
	
	//Change Display
	document.getElementById("pageContent").innerHTML = "<div class='GuiPage_NewServer12key'> \
		<p style='padding-bottom:5px'>Username</p> \
		<form><input id='user' style='z-index:10;' type='text' size='40' value=''/></form> \
		<p style='padding-bottom:5px'>Password</p> \
		<form><input id='pass' style='z-index:10;' type='password' size='40' value=''/></form> \
		<br><span id='guiUsers_rempwd'>Remember Password </span> : <span id='guiUsers_rempwdvalue'>" + this.rememberPassword + "</span> \
		</div>";
	
	new GuiUsers_Manual_Input("user");	
}

GuiUsers_Manual.IMEAuthenticate = function(user, password) {
    var authenticateSuccess = Server.Authenticate(null, user, password);		
    if (authenticateSuccess) {   	
    	document.getElementById("NoKeyInput").focus();
    	
    	//Note where this user sits in the file, if they are already known.
    	var fileJson = File.readSettings();
		for (var index = 0; index < fileJson.Servers[File.getServerEntry()].Users.length; index++) {
			if (fileJson.Servers[File.getServerEntry()].Users[index].UserName == user) {
				File.setUserEntry(index);
			}
		}

		//Save on every sign-in, not only the first. addUser updates an existing
		//entry, and the freshly issued access token needs storing each time or
		//the next launch has nothing to sign in with. The password is only kept
		//when the user asked for it.
		File.addUser(Server.UserID, user, this.rememberPassword ? password : "", this.rememberPassword);


    	//Change Focus and call function in GuiMain to initiate the page!
    	GuiMainMenu.start();
    } else {
    			
    	document.getElementById("user").focus();
    	GuiNotifications.setNotification("Wrong username, bad password or network error.","Logon Error",true);
    }     		
}

//////////////////////////////////////////////////////////////////
//  Input method for entering user password.                    //
//////////////////////////////////////////////////////////////////
var GuiUsers_Manual_Input  = function(id) {   
    var imeReady = function(imeObject) {    	
    	installFocusKeyCallbacks(); 
    	document.getElementById(id).focus();
    }
    
    var ime = new IMEShell(id, imeReady,'en');
    ime.setKeypadPos(1300,90);
  
    var installFocusKeyCallbacks = function () {
        ime.setKeyFunc(tvKey.KEY_ENTER, function (keyCode) {
            if (GuiUsers_Manual.selectedItem == 0) {
            	//Set IME to Password field
            	GuiUsers_Manual.selectedItem++;
            	new GuiUsers_Manual_Input("pass");
            	document.getElementById("pass").focus();
            } else {
            	//Process Login Here
            	var usr = Support.trimInput(document.getElementById("user").value);
            	var pwd = document.getElementById("pass").value;
            	GuiUsers_Manual.IMEAuthenticate(usr,pwd);
            }        
        });
        
        ime.setKeyFunc(tvKey.KEY_DOWN, function (keyCode) {
            if (GuiUsers_Manual.selectedItem == 0) {
            	//Set IME to Password field
            	GuiUsers_Manual.selectedItem++;
            	new GuiUsers_Manual_Input("pass");
            	document.getElementById("pass").focus();
            } else {
            	document.getElementById("guiUsers_rempwd").style.color = "red";
            	document.getElementById("GuiUsers_Manual_Pwd").focus();
            }        
        });
        
        ime.setKeyFunc(tvKey.KEY_UP, function (keyCode) {
            if (GuiUsers_Manual.selectedItem == 1) {
            	//Set IME to Username field
            	GuiUsers_Manual.selectedItem--;
            	new GuiUsers_Manual_Input("user");
            	document.getElementById("user").focus();
            }        
        });
        
        //Keycode to abort login from password screen      
        ime.setKeyFunc(tvKey.KEY_RETURN, function (keyCode) {
        	widgetAPI.blockNavigation(event);
        	var fileJson = File.readSettings();    
    	    if (fileJson.Servers.length > 0) {
    	    	document.getElementById("pageContent").focus();
    	    	GuiUsers.start();
    	    }
        });
        
        ime.setKeyFunc(tvKey.KEY_EXIT, function (keyCode) {
        	document.getElementById("NoKeyInput").focus();
        	widgetAPI.sendExitEvent();
        });   
    }
};

GuiUsers_Manual.keyDownPassword = function() {
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
				document.getElementById("pass").focus();  
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