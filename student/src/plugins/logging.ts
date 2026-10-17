import { registerPlugin } from '@capacitor/core';

export interface LoggingHandlerPlugin {
    debug(options: { message: string }): Promise<void>;
    info(options: { message: string }): Promise<void>;
    warn(options: { message: string }): Promise<void>;
    error(options: { message: string }): Promise<void>;
}

export const LoggingHandler = registerPlugin<LoggingHandlerPlugin>('LoggingHandler');
