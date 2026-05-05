import { onBeforeUnmount } from 'vue';

export function autoCleanup() {
    const cleanupFunctions: (() => void)[] = [];
    const timers: NodeJS.Timeout[] = [];
    const eventListeners: Array<{
        target: any;
        event: string;
        handler: any
    }> = [];

    // Track function to cleanup later
    const onCleanup = (fn: () => void) => {
        cleanupFunctions.push(fn);
    };

    // Track timer automatically
    const setAutoInterval = (callback: () => void, delay: number) => {
        const timer = setInterval(callback, delay);
        timers.push(timer);
        return timer;
    };

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

        // Clear all timers
        timers.forEach(timer => {
            clearInterval(timer);
        });
        timers.length = 0;

        // Remove all event listeners
        eventListeners.forEach(({ target, event, handler }) => {
            target.removeEventListener(event, handler);
        });
        eventListeners.length = 0;

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
        setAutoInterval,
        addAutoEventListener,
        autoFetch,
        cleanup
    };
}