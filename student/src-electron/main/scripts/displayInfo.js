import { app, screen } from 'electron';

/** Sync displayCount and multiMonitor on clientinfo from Electron screen API. */
export function syncClientDisplayInfo(clientinfo) {
    if (!app.isReady()) {
        return {
            displayCount: clientinfo.displayCount ?? 1,
            multiMonitor: clientinfo.multiMonitor ?? false,
        };
    }
    const displayCount = screen.getAllDisplays().length;
    clientinfo.displayCount = displayCount;
    clientinfo.multiMonitor = displayCount > 1;
    return { displayCount, multiMonitor: displayCount > 1 };
}
