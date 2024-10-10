/* eslint-disable-next-line no-unused-vars */
/* globals defaultParams, appOnline:writable, startDelay:writable */
defaultParams.laf = "bundle";
startDelay = 500;
appOnline = false;

/* eslint-disable-next-line no-unused-vars */
function ggbExamMode(exam) {
    return
}

/* eslint-disable-next-line no-unused-vars */
function setUnsavedMessage(message, save, noSave, cancel){
   return
}



const defaultOpen = window.open;

window.open = function(url, features) {
    return
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
    return
}
