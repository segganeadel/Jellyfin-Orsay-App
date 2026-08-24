var GuiPage_NewServer = {
	elementIds : [ "1","2","3","4","port","host"],
	//One slot per field. These were five long against six ids, and the
	//next/previous arithmetic divided by this length, so the hostname box was
	//left out of the cycle entirely.
	inputs : [ null,null,null,null,null,null ],
	//Named apart from the ready() function below. It used to be called "ready"
	//as well, so the function replaced the array on load: every read of
	//ready[i] returned undefined, undefined == false is false, and focus was
	//therefore granted as soon as the first field initialised instead of the
	//last - leaving the others still being set up.
	inputReady : [ false,false,false,false,false,false ]
}


GuiPage_NewServer.start = function() {
	FileLog.write("Page : GuiPage_NewServer");
	GuiHelper.setControlButtons(null,null,null,null,"Return");
	
	//Insert html into page
	document.getElementById("pageContent").innerHTML = "<div class='GuiPage_NewServer12key'> \
		<p style='padding-bottom:5px;'>Enter the IP address & port number of your Jellyfin server. <br>(You can leave the port blank for 8096)</p> \
		<form><input id='1' type='text' size='5'  maxlength='3' value=''/>. \
		<input id='2' type='text' size='5'  maxlength='3' value=''/>. \
		<input id='3' type='text' size='5'  maxlength='3' value=''/>. \
		<input id='4' type='text' size='5'  maxlength='3' value=''/>: \
		<input id='port' type='text' size='8'  maxlength='5'/></form> \ \
		<p style='padding-top:10px;padding-bottom:5px'>OR</p> \
		<p style='padding-bottom:5px'>Enter your server hostname here without http:// and <br>including : and port number.</p> \
		<form><input id='host' style='z-index:10;' type='text' size='45' maxlength='40' value=''/></form> \
		</div>";
	
	//Set Backdrop
	Support.fadeImage("images/bg1.jpg");
	Support.removeSplashScreen();

	//Coming back to this page must start the readiness flags afresh.
	for (var r = 0; r < GuiPage_NewServer.inputReady.length; r++) { GuiPage_NewServer.inputReady[r] = false; }

	//Prepare all input elements for IME
	GuiPage_NewServer.createInputObjects();
	//IME keys are registered once for the whole app in Main.initKeys.
}

//Prepare all input elements for IME on Load!
GuiPage_NewServer.createInputObjects = function() {
	//Straightforward ring over every field, so right from the port reaches the
	//hostname and round to the first octet. The old arithmetic divided by a
	//five-long array while there are six fields, which left the hostname out.
	var count = this.elementIds.length;
	for (var index = 0; index < count; index++) {
		var previousIndex = (index - 1 + count) % count;
		var nextIndex = (index + 1) % count;
		GuiPage_NewServer.inputs[index] = new GuiPage_NewServer_Input(
			this.elementIds[index], this.elementIds[previousIndex], this.elementIds[nextIndex]);
	}
}

//Called as each field's keypad finishes initialising. Focus is only taken once
//every field is ready, otherwise the user lands in a box whose keypad has not
//finished binding its keys.
GuiPage_NewServer.ready = function(id) {
	for (var i = 0; i < GuiPage_NewServer.elementIds.length; i++) {
		if (GuiPage_NewServer.elementIds[i] == id) {
			GuiPage_NewServer.inputReady[i] = true;
		}
	}

	for (var j = 0; j < GuiPage_NewServer.inputReady.length; j++) {
		if (GuiPage_NewServer.inputReady[j] !== true) { return; }
	}

	document.getElementById(GuiPage_NewServer.elementIds[0]).focus();
}

//Function to delete all the contents of the boxes
GuiPage_NewServer.deleteAllBoxes = function(currentId) {
	for (var index = 0;index < GuiPage_NewServer.elementIds.length;index++) {
		document.getElementById(GuiPage_NewServer.elementIds[index]).value=""; 
	}
}

//IME Key Handler
var GuiPage_NewServer_Input  = function(id,previousId, nextId) {   
    var imeReady = function(imeObject) {
    	installFocusKeyCallbacks();   
        GuiPage_NewServer.ready(id);
    }
    
    var ime = new IMEShell(id, imeReady,'en');
    ime.setKeypadPos(1300,90);

    if (id == 'host') {
    	ime.setMode('_latin_small');
    } else {
    	ime.setMode('_num');
    }
    
    var previousElement = document.getElementById(previousId);
    var nextElement = document.getElementById(nextId);
    
    var installFocusKeyCallbacks = function () {
        ime.setKeyFunc(tvKey.KEY_ENTER, function (keyCode) {
            
            GuiNotifications.setNotification("Please Wait","Checking Details",true);
                                  
            //Get content from 4 boxes
            var IP1 = document.getElementById('1').value;
            var IP2 = document.getElementById('2').value;
            var IP3 = document.getElementById('3').value;
            var IP4 = document.getElementById('4').value;
            
            var host = Support.trimInput(document.getElementById('host').value);
            
            if (IP1 == "" || IP2 == "" || IP3 == "" || IP4 == "" ) {
            	//Check if host is empty
            	if (host == "") {
            		//not valid
                	GuiNotifications.setNotification("Please re-enter your server details.","Incorrect Details",true);
            	} else {
                	var Port = document.getElementById('port').value;
            		if (host.indexOf(":") === -1) {
            			host = host + ":" + (Port == "" ? "8096" : Port);
            		}
            		
            		document.getElementById("pageContent").focus();                                   
                    //Timeout required to allow notification command above to be displayed
                    setTimeout(function(){Server.testConnectionSettings(host,false);}, 1000);
            	}
            } else {	
            	var Port = document.getElementById('port').value;
                if (Port == "") {
                	Port = "8096";
                }
                
                var ip = IP1 + '.' +  IP2 + '.' +  IP3 + '.' +  IP4 + ':' + Port;
                document.getElementById("pageContent").focus();                                   
                //Timeout required to allow notification command above to be displayed    
                setTimeout(function(){Server.testConnectionSettings(ip,false);}, 1000);
                
            }       
        });
        ime.setKeyFunc(tvKey.KEY_LEFT, function (keyCode) {
            previousElement.focus();
            return false;
        });
        ime.setKeyFunc(tvKey.KEY_RIGHT, function (keyCode) {
            nextElement.focus();
            return false;
        });
        ime.setKeyFunc(tvKey.KEY_UP, function (keyCode) {
        	document.getElementById("1").focus();
            return false;
        });
        ime.setKeyFunc(tvKey.KEY_DOWN, function (keyCode) {
        	document.getElementById("host").focus();
            return false;
        });
        ime.setKeyFunc(tvKey.KEY_BLUE, function (keyCode) {
        	ime.setString(""); //Clears the currently focused Input - REQUIRED
        	GuiPage_NewServer.deleteAllBoxes();
            return false;
        });
        ime.setKeyFunc(tvKey.KEY_RETURN, function (keyCode) {
        	widgetAPI.blockNavigation(event);
        	var fileJson = File.readSettings();    
    	    if (fileJson.Servers.length > 0) {
    	    	document.getElementById("pageContent").focus();  
    	    	GuiPage_Servers.start();
    	   	} else {
    			widgetAPI.sendReturnEvent();
    		}
    	    return false;
        });
        ime.setKeyFunc(tvKey.KEY_EXIT, function (keyCode) {
        	widgetAPI.sendExitEvent(); 	
        	return false;
        }); 
    }   
}