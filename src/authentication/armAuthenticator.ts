import * as Msal from "msal";
import { Utils } from "../utils";
import { IAuthenticator, AccessToken } from ".";


const aadClientId = "73a510c3-9946-46dd-b5ae-a8f0ae68fd04"; // test app
const scopes = ["https://management.azure.com/user_impersonation"];

export class ArmAuthenticator implements IAuthenticator {
    private accessToken: AccessToken;
    private msalInstance: Msal.UserAgentApplication;

    constructor() {
        const msalConfig: Msal.Configuration = {
            auth: {
                clientId: aadClientId,
                authority: "https://login.microsoftonline.com/common",
                redirectUri: "https://apimanagement-cors-proxy-df.azure-api.net/portal/signin-aad",
            }
        };

        this.msalInstance = new Msal.UserAgentApplication(msalConfig);
    }

    private async tryAcquireToken(): Promise<AccessToken> {
        let response: Msal.AuthResponse;
        const loginRequest: Msal.AuthenticationParameters = { scopes: scopes };

        console.log("1");

        if (this.msalInstance.getAccount()) {
            response = await this.msalInstance.acquireTokenSilent(loginRequest);
        }
        else {
            response = await this.msalInstance.loginPopup(loginRequest);
        }


        console.log("2");
        // await Utils.delay(1);

        if (!response.accessToken) {
            throw new Error(`Unable to acquire ARM token.`);
        }

        const accessToken = AccessToken.parse(`Bearer ${response.accessToken}`);
        this.setAccessToken(accessToken);

        setTimeout(this.tryAcquireToken.bind(this), 30 * 60 * 1000);  // scheduling token refresh in 30 min

        return accessToken;
    }

    public async getAccessToken(): Promise<AccessToken> {
        if (this.accessToken && !this.accessToken.isExpired()) {
            return this.accessToken;
        }

        const storedAccessToken = sessionStorage.getItem("armAccessToken");

        if (storedAccessToken) {
            const parsedToken = AccessToken.parse(storedAccessToken);

            if (!parsedToken.isExpired()) {
                return parsedToken;
            }
        }

        const accessToken = await this.tryAcquireToken();
        return accessToken;
    }

    public async getAccessTokenAsString(): Promise<string> {
        const accessToken = await this.getAccessToken();
        return accessToken.toString();
    }

    public async setAccessToken(accessToken: AccessToken): Promise<void> {
        if (accessToken.isExpired()) {
            console.warn(`Cannot set expired access token.`);
            return;
        }

        this.accessToken = accessToken;
        sessionStorage.setItem("armAccessToken", accessToken.toString());
    }

    public clearAccessToken(): void {
        sessionStorage.removeItem("accessToken");
    }

    public async isAuthenticated(): Promise<boolean> {
        const accessToken = await this.getAccessToken();

        if (!accessToken) {
            return false;
        }

        return !accessToken.isExpired();
    }
}