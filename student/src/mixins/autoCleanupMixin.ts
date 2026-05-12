import {SchedulerService} from "../utils/schedulerservice.js";

interface Listener {
    target: any;
    event: string;
    handler: any;
}

export const autoCleanupMixin = {
    data() {
        return {
            cleanupFunctions: [] as (() => void)[],
            eventListeners: [] as Listener[],
            schedulerServices: [] as SchedulerService[]
        };
    },

    methods: {
        autoSchedulerService(action: () => void, interval: number): SchedulerService {
            const schedulerService: SchedulerService = new SchedulerService(interval);

            this.autoEventListener(schedulerService, 'action', action);
            schedulerService.start();

            this.schedulerServices.push(schedulerService);
            return schedulerService;
        },

        // Track event listener automatically
        autoEventListener(target: any, event: string, handler: any, options?: any) {
            target.addEventListener(event, handler, options);
            this.eventListeners.push({ target, event, handler });
        },

        // Track fetch automatically
        async autoFetch(url: string, options?: RequestInit) {
            const abortController = new AbortController();

            console.log("creating auto fetch", url);
            try {
                try {
                    return await fetch(url, {
                        ...options,
                        signal: abortController.signal
                    });
                } catch (err) {
                    if (err.name !== 'AbortError') throw err;
                }
            } finally {
                // this.onCleanup(() => {
                //     abortController.abort();
                //     console.log("cleaning up auto fetch", url)
                // });
            }
        },
    },

    onCleanup(cleanupFunction: () => void) {
        this.cleanupFunctions.push(cleanupFunction);
    },

    beforeUnmount() {
        console.log('Auto-cleanup running');

        // Remove all event listeners
        this.eventListeners.forEach(({ target, event, handler }) => {
            target.removeEventListener(event, handler);
        });
        this.eventListeners.length = 0;

        // Remove all scheduler services
        this.schedulerServices.forEach((schedulerService: SchedulerService) => {
            schedulerService.stop()
        });

        // Run cleanup functions
        this.cleanupFunctions.forEach(fn => fn());
        this.cleanupFunctions.length = 0;
        console.log('Auto-cleanup finished');
    }
}