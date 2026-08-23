//////////////////////////////////////////////////////////////////////////////
//  Keyboard test page.
//
//  Orsay has no documented way to raise the TV's own keyboard, and the advice
//  found online contradicts itself, so this page tries each candidate on the
//  real hardware and posts the outcome back to the diagnostics collector.
//
//  Reached with the yellow button on the log screen.
//////////////////////////////////////////////////////////////////////////////

var GuiPage_KeyboardTest = {
	selectedItem : 0,
	ime : null,
	imeCommon : null,
	lastMethod : "none",
	notes : [],

	//Each row is one way of asking for a keyboard.
	methods : [
		["plainFocus",  "Plain input + focus() only",        "kbtest_a"],
		["imeShell",    "IMEShell (what the app uses now)",  "kbtest_b"],
		["imeCommon",   "IMEShell_Common + onShow()",        "kbtest_c"]
	]
}

GuiPage_KeyboardTest.onFocus = function() {
	GuiHelper.setControlButtons("Run Selected","Send Result",null,null,"Return");
}

GuiPage_KeyboardTest.getAvailableGlobals = function() {
	//Which keyboard objects this firmware actually ships.
	var names = ["IMEShell","IMEShell_Common","IMEShell_XT9","IMEShell_Number",
	             "IME","IMEManager","IMEShellCommon","imeShell"];
	var found = [];
	for (var i = 0; i < names.length; i++) {
		var present = false;
		try { present = (typeof window[names[i]] !== "undefined"); } catch (e) { present = false; }
		found.push((present ? "[YES] " : "[no ] ") + names[i]);
	}
	return found;
}

GuiPage_KeyboardTest.start = function() {
	FileLog.write("Keyboard test page opened");
	this.selectedItem = 0;
	this.lastMethod = "none";
	this.notes = [];

	var html = "<div class='GuiPage_NewServer12key'>" +
		"<div class='guiPage_Settings_Title'>Keyboard Test</div>" +
		"<p>Pick a row, press the red button to try it, then type with the remote. " +
		"Green posts the result back to the PC.</p>";

	for (var i = 0; i < this.methods.length; i++) {
		html += "<p id='kbrow_" + i + "'>" + this.methods[i][1] + "</p>" +
		        "<form onsubmit='return false;'><input id='" + this.methods[i][2] +
		        "' type='text' size='40' value=''/></form>";
	}

	html += "<p id='kbtest_status'>Ready.</p>" +
	        "<pre id='kbtest_globals' style='font-size:16px'></pre></div>";

	document.getElementById("pageContent").className = "";
	document.getElementById("pageContent").innerHTML = html;
	document.getElementById("kbtest_globals").innerHTML = this.getAvailableGlobals().join("<br>");

	this.updateSelectedItem();
	document.getElementById("GuiPage_KeyboardTest").focus();
}

GuiPage_KeyboardTest.updateSelectedItem = function() {
	for (var i = 0; i < this.methods.length; i++) {
		document.getElementById("kbrow_" + i).className =
			(i == this.selectedItem) ? "highlight" + Main.highlightColour + "Background" : "";
	}
}

GuiPage_KeyboardTest.setStatus = function(text) {
	document.getElementById("kbtest_status").innerHTML = text;
	this.notes.push(text);
	FileLog.write("Keyboard test : " + text);
}

//Try whichever method the highlighted row represents.
GuiPage_KeyboardTest.runSelected = function() {
	var method = this.methods[this.selectedItem][0];
	var inputId = this.methods[this.selectedItem][2];
	this.lastMethod = method;

	if (method == "plainFocus") {
		//If focus alone raises a keyboard, no IME object is needed at all.
		try {
			document.getElementById(inputId).focus();
			this.setStatus("plainFocus: focus() called - does a keyboard appear?");
		} catch (e) {
			this.setStatus("plainFocus: threw " + e);
		}
		return;
	}

	if (method == "imeShell") {
		try {
			var self = this;
			this.ime = new IMEShell(inputId, function() {
				document.getElementById(inputId).focus();
				self.setStatus("imeShell: ready callback fired, input focused");
			}, 'en');
			this.setStatus("imeShell: constructed, waiting for ready callback");
		} catch (e) {
			this.setStatus("imeShell: threw " + e);
		}
		return;
	}

	if (method == "imeCommon") {
		//The variant reported to show the large QWERTY keypad.
		try {
			if (typeof IMEShell_Common === "undefined") {
				this.setStatus("imeCommon: IMEShell_Common is not defined on this firmware");
				return;
			}
			this.imeCommon = new IMEShell_Common();
			document.getElementById(inputId).focus();
			if (this.imeCommon.onShow) {
				this.imeCommon.onShow();
				this.setStatus("imeCommon: constructed and onShow() called");
			} else {
				this.setStatus("imeCommon: constructed but it has no onShow()");
			}
		} catch (e) {
			this.setStatus("imeCommon: threw " + e);
		}
		return;
	}
}

//Post what happened, plus whatever text actually made it into the boxes.
GuiPage_KeyboardTest.sendResult = function() {
	var host = FileLog.getDiagnosticsHost();
	if (!host) {
		GuiNotifications.setNotification("Connect to a server first, or set DiagnosticsHost.","Cannot Send");
		return;
	}

	var lines = [];
	lines.push("KEYBOARD TEST");
	lines.push("model    : " + Server.getDevice());
	lines.push("modelYear: " + Main.getModelYear());
	lines.push("lastRun  : " + this.lastMethod);
	lines.push("");
	lines.push("available globals:");
	lines.push(this.getAvailableGlobals().join("\n"));
	lines.push("");
	lines.push("typed text per method:");
	for (var i = 0; i < this.methods.length; i++) {
		var value = "";
		try { value = document.getElementById(this.methods[i][2]).value; } catch (e) { value = "(read failed)"; }
		lines.push("  " + this.methods[i][0] + " = [" + value + "]");
	}
	lines.push("");
	lines.push("status trail:");
	lines.push(this.notes.join("\n"));

	var xmlHttp = new XMLHttpRequest();
	if (!xmlHttp) { return; }
	try {
		xmlHttp.open("POST", "http://" + host + "/report?name=keyboard", false);
		xmlHttp.setRequestHeader("Content-Type", "text/plain");
		xmlHttp.send(lines.join("\n"));
	} catch (e) {
		GuiNotifications.setNotification("Could not reach " + host + " on port 80.","Send Failed");
		return;
	}

	if (xmlHttp.status == 200) {
		GuiNotifications.setNotification("Result sent to " + host + ".","Sent");
	} else {
		GuiNotifications.setNotification("Collector answered " + xmlHttp.status + ".","Send Failed");
	}
}

GuiPage_KeyboardTest.keyDown = function() {
	var keyCode = event.keyCode;

	switch (keyCode) {
		case tvKey.KEY_UP:
			if (this.selectedItem > 0) { this.selectedItem--; this.updateSelectedItem(); }
			break;
		case tvKey.KEY_DOWN:
			if (this.selectedItem < this.methods.length - 1) { this.selectedItem++; this.updateSelectedItem(); }
			break;
		case tvKey.KEY_RED:
			this.runSelected();
			break;
		case tvKey.KEY_GREEN:
			this.sendResult();
			break;
		case tvKey.KEY_RETURN:
		case tvKey.KEY_PANEL_RETURN:
			widgetAPI.blockNavigation(event);
			GuiPage_SettingsLog.start();
			break;
		case tvKey.KEY_EXIT:
			widgetAPI.sendExitEvent();
			break;
	}
}
