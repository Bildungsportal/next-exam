/* eslint-disable-next-line no-unused-vars */
/* globals defaultParams, appOnline:writable, startDelay:writable */
defaultParams.laf = "bundle";
startDelay = 500;
appOnline = false;

/* eslint-disable-next-line no-unused-vars */
function ggbExamMode(exam) {
    // window.ipc.send("exam", exam);
}

/* eslint-disable-next-line no-unused-vars */
function setUnsavedMessage(message, save, noSave, cancel){
   // no geogebra autosave
}


const defaultOpen = window.open;

window.open = function(url, features) {
    // if (url.match('accounts.geogebra.org/.+') || url.startsWith("app:")) {
    //     return defaultOpen(url, features);
    // } else {
    //     window.ipc.send('openUrl', url);
    //     console.log("Opening URL " + url + " in external OS browser");
    // }
}

const blobToBase64 = blob => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    return new Promise(resolve => {
        reader.onloadend = () => {
            resolve(reader.result.split('base64,')[1]);
        };
    });
};

window.showSaveFilePicker = function(options) {
    // const fileHandle = {};
    // const stream = {};
    // stream.close = () => {};
    // stream.write = blob => blobToBase64(blob).then(base64 => {
    //     window.ipc.send('fileWrite', JSON.stringify({
    //         name: fileHandle.name,
    //         content: base64
    //     }));
    // });
    // fileHandle.createWritable = () => {
    //     return new Promise(resolve => {
    //         resolve(stream);
    //     });
    // };
    // fileHandle.getFile = () => {
    //     return new Promise(resolve => {
    //         resolve({name: fileHandle.name});
    //     });
    // }

    // return new Promise(resolve => {
    //     window.ipc.send('showSaveFilePicker', JSON.stringify(options));
    //     window.filePicked = (encodedName) => {
    //         fileHandle.name = new TextDecoder().decode(base64ToBytes(encodedName));
    //         if (fileHandle.name) {
    //             resolve(fileHandle);
    //         }
    //     }
    //     function base64ToBytes(base64) {
    //         const binString = atob(base64);
    //         return Uint8Array.from(binString, (m) => m.codePointAt(0));
    //     }
    // });
}
