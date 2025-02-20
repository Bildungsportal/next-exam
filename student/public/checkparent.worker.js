import { parentPort } from 'worker_threads';
import find from 'find-process';
import log from 'electron-log';

async function findParentProcess(pid, maxDepth, visitedPids) {
    const browserKeywords = ['chrom', 'edge', 'fire', 'brave', 'opera'];

    if (pid == 1) {
        log.info('main @ findParentProcess: PID 1 erreicht. Kein Webbrowser gefunden.');
        return false; 
    }

    if (maxDepth <= 0) {
        log.warn('checkparent @ findParentProcess: Maximale Rekursionstiefe erreicht.');
        return false;
    }

    if (visitedPids.has(pid)) {
        log.warn(`checkparent @ findParentProcess: Zirkuläre Referenz erkannt für PID ${pid}.`);
        return false;
    }

    visitedPids.add(pid);

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            log.error(`checkparent @ findParentProcess: Timeout bei PID ${pid}.`);
            resolve(false);
        }, 4000);

        find('pid', pid)
            .then(list => {
                clearTimeout(timeout);
                
                if (!list.length) {
                    log.warn(`checkparent @ findParentProcess: Keine Ergebnisse für Prozess mit PID ${pid} gefunden.`);
                    resolve(false);
                    return;
                }

                const process = list[0];
                const parentCommand = process.name.toLowerCase();
                const ppid = process.ppid;

                if (browserKeywords.some(browser => parentCommand.includes(browser)))    { resolve(true);  }    // Browser gefunden
                else if (parentCommand.includes('explorer') || ppid == 1)               { resolve(false); }    // Auf Windows ist Explorer quasi root
                else { resolve(findParentProcess(ppid, maxDepth - 1, visitedPids)); }                         // Weiter nach oben
            })
            .catch(err => {
                clearTimeout(timeout);
                log.error(`checkparent @ findParentProcess: Fehler bei der Prozessabfrage für PID ${pid}: ${err.message}`);
                resolve(false);
            });
    });
}

if (parentPort) {
    findParentProcess(process.ppid, 4, new Set())
        .then(foundBrowser => {
            parentPort.postMessage({ success: true, foundBrowser });
        })
        .catch(error => {
            parentPort.postMessage({ success: false, error: error.message });
        });
}