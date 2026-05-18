export class SchedulerService extends EventTarget {
    constructor(interval) {
        super();
        this.interval = interval;
        this.handle = null;
    }
    start() {
        if (!this.handle) {
            this.handle = setInterval(() => {
                // Dispatch a custom event named 'action'
                this.dispatchEvent(new CustomEvent('action'));
            }, this.interval);
        }
    }
    stop() {
        if (this.handle) {
            clearInterval(this.handle);
            this.handle = null;
        }
    }
}