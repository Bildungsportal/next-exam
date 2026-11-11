/** Set or clear focus-lock metadata on clientinfo (renderer reads via getinfoasync / focusLock IPC). */
export function setClientFocusLock(clientinfo, reason, message = '') {
    if (!clientinfo) return;
    clientinfo.focus = false;
    if (reason) clientinfo.focusLockReason = String(reason);
    else delete clientinfo.focusLockReason;
    if (message) clientinfo.focusLockMessage = String(message);
    else delete clientinfo.focusLockMessage;
}

/** Clear focus-lock metadata when focus is restored. */
export function clearClientFocusLock(clientinfo) {
    if (!clientinfo) return;
    delete clientinfo.focusLockReason;
    delete clientinfo.focusLockMessage;
}
