export const msalConfig = {
    auth: {
        clientId: 'c952edde-d7c2-4281-a846-034fb039e1f5',
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: 'https://localhost:22422/server/control/msauth',
        postLogoutRedirectUri: 'https://localhost:22422/server/control/msauth',
    },
    cache: {
        cacheLocation: 'localStorage',
    },
}

export const loginRequest = {
    scopes: [
        'User.Read',
        'openid',
        'profile',
        'offline_access',
        'Files.Read',
        'Files.ReadWrite',
        'Files.ReadWrite.AppFolder',
    ],
}

export const graphConfig = {
    graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
}
