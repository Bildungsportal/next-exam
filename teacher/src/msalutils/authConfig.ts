import { LogLevel, PublicClientApplication } from '@azure/msal-browser';
import { graphConfig, loginRequest, msalConfig } from './authConfigShared';

export const msalInstance = new PublicClientApplication({
  ...msalConfig,
  system: {
    loggerOptions: {
      loggerCallback: (level: LogLevel, message: string, containsPii: boolean) => {
        if (containsPii) {
          return;
        }
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            return;
          case LogLevel.Info:
            console.info(message);
            return;
          case LogLevel.Verbose:
            console.debug(message);
            return;
          case LogLevel.Warning:
            console.warn(message);
            return;
          default:
            return;
        }
      },
      logLevel: LogLevel.Verbose,
    },
  },
});

export { msalConfig, loginRequest, graphConfig };
