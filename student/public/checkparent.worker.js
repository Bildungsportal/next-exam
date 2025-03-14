import { parentPort } from 'worker_threads';
import find from 'find-process';
import log from 'electron-log';

async function findParentProcess(pid, maxDepth, visitedPids) {
    // Expanded browser keywords to catch more variants
    const browserKeywords = [
        'chrom', 'chrome.exe',
        'edge', 'msedge.exe',
        'fire', 'firefox.exe',
        'brave', 'brave.exe',
        'opera', 'opera.exe',
        'browser', // Generic browser process
        'iexplore', // Internet Explorer
        'safari' // For macOS
    ];

    if (pid === 1 || pid === 0) { // Also check for PID 0 on Windows
        log.info('main @ findParentProcess: Root PID reached. No web browser found.');
        return false; 
    }

    if (maxDepth <= 0) {
        log.warn('checkparent @ findParentProcess: Maximum recursion depth reached.');
        return false;
    }

    if (visitedPids.has(pid)) {
        log.warn(`checkparent @ findParentProcess: Circular reference detected for PID ${pid}.`);
        return false;
    }

    visitedPids.add(pid);

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            log.error(`checkparent @ findParentProcess: Timeout for PID ${pid}.`);
            resolve(false);
        }, 8000); // Increased timeout to 8 seconds

        find('pid', pid)
            .then(list => {
                clearTimeout(timeout);
                
                if (!list.length) {
                    log.warn(`checkparent @ findParentProcess: No results found for process with PID ${pid}.`);
                    resolve(false);
                    return;
                }

                const process = list[0];
                const processCommand = (process.name || process.cmd || '').toLowerCase();
                const ppid = process.ppid;

                // Log the process info for debugging
                log.info(`checkparent @ findParentProcess: Checking process: ${processCommand} (PID: ${pid}, PPID: ${ppid})`);

                // More thorough browser detection
                if (browserKeywords.some(browser => processCommand.includes(browser))) {
                    log.info(`checkparent @ findParentProcess: Browser found: ${processCommand}`);
                    resolve(true);
                } else if (processCommand.includes('explorer') || ppid <= 1) {
                    log.info(`checkparent @ findParentProcess: Reached system process or explorer`);
                    resolve(false);
                } else {
                    resolve(findParentProcess(ppid, maxDepth - 1, visitedPids));
                }
            })
            .catch(err => {
                clearTimeout(timeout);
                log.error(`checkparent @ findParentProcess: Error querying process ${pid}: ${err.message}`);
                resolve(false);
            });
    });
}

if (parentPort) {
    // Increase initial depth to 6 to check more parent processes
    findParentProcess(process.ppid, 6, new Set())
        .then(foundBrowser => {
            log.info(`checkparent @ worker: Browser detection result: ${foundBrowser}`);
            parentPort.postMessage({ success: true, foundBrowser });
        })
        .catch(error => {
            log.error(`checkparent @ worker: Error in browser detection: ${error.message}`);
            parentPort.postMessage({ success: false, error: error.message });
        });
}