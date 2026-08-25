//////////////////////////////////////////////////////////////////////////////
//  Quick Connect.
//
//  Signing in on a television means spelling out a password with a remote on
//  an on-screen keypad. Quick Connect avoids that entirely: the TV shows a
//  six digit code, the user approves it from a phone or computer already
//  signed in to Jellyfin, and the server hands the TV an access token.
//////////////////////////////////////////////////////////////////////////////

var GuiPage_QuickConnect = {
	secret : null,
	code : null,
	pollTimer : null,
	attempts : 0,
	cancelled : false,

	//The server expires a request after a few minutes; stop polling well
	//before that rather than waiting forever.
	POLL_INTERVAL : 3000,
	MAX_ATTEMPTS : 100
}

GuiPage_QuickConnect.onFocus = function() {
	GuiHelper.setControlButtons(null,null,null,null,"Back");
}

GuiPage_QuickConnect.start = function() {
	FileLog.write("QuickConnect : starting");
	this.secret = null;
	this.code = null;
	this.attempts = 0;
	this.cancelled = false;

	if (!Server.quickConnectEnabled()) {
		GuiNotifications.setNotification(
			"Quick Connect is switched off on this server. An administrator can enable it in Dashboard, under General.",
			"Not Available");
		GuiUsers.start(false);
		return;
	}

	var request = Server.quickConnectInitiate();
	if (request == null || !request.Code || !request.Secret) {
		GuiNotifications.setNotification("The server would not start a Quick Connect request.","Quick Connect Failed");
		GuiUsers.start(false);
		return;
	}

	this.secret = request.Secret;
	this.code = request.Code;
	FileLog.write("QuickConnect : code " + this.code);

	document.getElementById("pageContent").className = "";
	//pageContent carries no colour of its own, so without this the whole page
	//inherits a dim default and reads as though it is not in focus.
	document.getElementById("pageContent").style.color = "#ffffff";
	document.getElementById("pageContent").innerHTML =
		"<div style='padding-top:150px;text-align:center;color:#ffffff'>" +
			"<div style='font-size:49px;padding-bottom:36px'>Quick Connect</div>" +
			"<div style='font-size:27px;color:rgba(255,255,255,0.7);padding-bottom:8px'>" +
				"On your phone or computer, sign in to Jellyfin and enter this code" +
			"</div>" +
			"<div id='quickConnectCode' style='font-size:110px;letter-spacing:16px;" +
				"color:#00a4dc;padding:30px 0px'>" + this.code + "</div>" +
			"<div id='quickConnectStatus' style='font-size:27px;color:#ffffff'>" +
				"Waiting for you to approve it&hellip;" +
			"</div>" +
			"<div style='font-size:22px;color:rgba(255,255,255,0.7);padding-top:48px'>" +
				"Press RETURN to go back and sign in with a password instead." +
			"</div>" +
		"</div>";
	document.getElementById("GuiPage_QuickConnect").focus();
	this.scheduleNextPoll();
}

GuiPage_QuickConnect.scheduleNextPoll = function() {
	if (this.cancelled) { return; }
	this.pollTimer = setTimeout(function() { GuiPage_QuickConnect.poll(); }, this.POLL_INTERVAL);
}

GuiPage_QuickConnect.poll = function() {
	if (this.cancelled) { return; }

	this.attempts++;
	if (this.attempts > this.MAX_ATTEMPTS) {
		this.setStatus("This code has expired. Go back and try again.");
		FileLog.write("QuickConnect : gave up waiting for approval");
		return;
	}

	if (!Server.quickConnectApproved(this.secret)) {
		this.scheduleNextPoll();
		return;
	}

	//Approved: trade the secret for an access token.
	this.setStatus("Approved. Signing in&hellip;");
	FileLog.write("QuickConnect : approved, exchanging secret for a token");

	if (!Server.quickConnectAuthenticate(this.secret)) {
		this.setStatus("The server approved the code but would not sign us in.");
		FileLog.write("QuickConnect : exchange failed");
		return;
	}

	//Saves the account and the token it just issued, so the next launch signs
	//in on its own.
	File.addUser(Server.getUserID(), Server.getUserName(), "", false);
	this.cancelled = true;
	GuiMainMenu.start();
}

GuiPage_QuickConnect.setStatus = function(text) {
	var el = document.getElementById("quickConnectStatus");
	if (el != null) { el.innerHTML = text; }
}

GuiPage_QuickConnect.stop = function() {
	this.cancelled = true;
	if (this.pollTimer != null) {
		clearTimeout(this.pollTimer);
		this.pollTimer = null;
	}
}

GuiPage_QuickConnect.keyDown = function() {
	var keyCode = event.keyCode;

	switch (keyCode) {
		case tvKey.KEY_RETURN:
		case tvKey.KEY_PANEL_RETURN:
			widgetAPI.blockNavigation(event);
			this.stop();
			GuiUsers.start(false);
			break;
		case tvKey.KEY_EXIT:
			this.stop();
			widgetAPI.sendExitEvent();
			break;
	}
}
