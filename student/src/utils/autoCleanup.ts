import { onBeforeUnmount } from 'vue';
import {SchedulerService} from "./schedulerservice.js";

export function autoCleanup() {
    const cleanupFunctions: (() => void)[] = [];
    const eventListeners: Array<{
        target: any;
        event: string;
        handler: any
    }> = [];
    const schedulerServices: SchedulerService[] = [];

    // Track function to cleanup later
    const onCleanup = (fn: () => void) => {
        cleanupFunctions.push(fn);
    };

    const setAutoSchedulerService = (action: () => void, interval: number) => {
        let schedulerService: SchedulerService = new SchedulerService(interval);

        addAutoEventListener(schedulerService, 'action', action)
        schedulerService.start()

        schedulerServices.push(schedulerService);
    }

    // Track event listener automatically
    const addAutoEventListener = (
        target: any,
        event: string,
        handler: any,
        options?: any
    ) => {
        target.addEventListener(event, handler, options);
        eventListeners.push({ target, event, handler });
    };

    // Track fetch automatically
    const autoFetch = (url: string, options?: RequestInit) => {
        const abortController = new AbortController();

        return fetch(url, {
            ...options,
            signal: abortController.signal
        }).catch(err => {
            if (err.name !== 'AbortError') throw err;
        }).finally(() => {
            onCleanup(() => abortController.abort());
        });
    };

    // Main cleanup function - runs automatically on unmount
    const cleanup = () => {
        console.log('Auto-cleanup running');

        // Remove all event listeners
        eventListeners.forEach(({ target, event, handler }) => {
            target.removeEventListener(event, handler);
        });
        eventListeners.length = 0;

        // Remove all scheduler services
        schedulerServices.forEach((schedulerService: SchedulerService) => {
           schedulerService.stop()
        });

        // Run cleanup functions
        cleanupFunctions.forEach(fn => fn());
        cleanupFunctions.length = 0;
        console.log('Auto-cleanup finished');
    };

    onBeforeUnmount(() => {
        cleanup();
    });

    return {
        onCleanup,
        setAutoSchedulerService,
        addAutoEventListener,
        autoFetch,
        cleanup
    };
}