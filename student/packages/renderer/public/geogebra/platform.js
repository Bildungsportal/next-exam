defaultParams.laf = "bundle";
analyticsVersion = 'V'+latestVersion.replace(/^5/,"6")+"-offline";
startDelay = 500;
appOnline = false;



//https://gist.github.com/paulcbetts/2d2de55d137a1cf9d1ac
// function installAnalytics(gaID){
// 	// grab a uuid to identify the session
// 	// set the uuid to local storage
// 	if (!localStorage["gaClientId"]){
// 	    localStorage.setItem("gaClientId","R"+Math.round(Math.random()*1E12)*1000+new Date().getMilliseconds());
// 	}
// 	// set the cookie storage for google analytics to none, and provide your own client id
// 	var clientId = localStorage["gaClientId"];
// 	ga('create', gaID,{
// 	    'storage': 'none',
// 	    'clientId': clientId
// 	});
// 	// finally, disable the protocol check to allow file://
// 	ga('set', 'checkProtocolTask', function(){}); // Disable file protocol checking.
// }

function ggbExamMode(exam) {
	//window.ipc.send("exam", exam);
}

function setUnsavedMessage(message, save, noSave, cancel){
	//window.ipc.send('unsaved', JSON.stringify([message,save,noSave,cancel]));
}

console.log = function(message) {
      //  window.ipc.sendSync('log', message);
}

function copyGraphicsToClipboardExternal(data) {
	//return window.ipc.sendSync('clipboard', data);
}

const defaultOpen = window.open;

window.open = function(url, features) {
	if (url.match('geogebra.org')) {
		return defaultOpen(url, features);
		console.log("Opening URL " + url + " inside electron app");
	} else {
		//window.ipc.send('openUrl', url);
		console.log("Opening URL " + url + " in external OS browser");
	}
}
