import {useInfoStore} from "../../stores/infoStore.js";
import { buildLocalSubmissionSigningSecret, deriveSigningIdentity, SUBMISSION_SIGN_MODE_BIP, SUBMISSION_SIGN_MODE_LOCAL } from "../../../../shared/submissionPdfSign.js";

/**
 * Manages the signing material (BiP / local secret) and signs handed-in PDFs on iOS.
 * Reuses one signing identity for all PDF submissions in the exam.
 */
class IosSubmissionSigningService {
    bipSiteInfo: any = null;
    cachedSubmissionSigningIdentity: any = null;

    get infoStore() {
        return useInfoStore();
    }

    /** Stores BiP signing material for signed PDF submissions. */
    setBipSiteInfo(info: any): void {
        this.bipSiteInfo = info;
        this.cachedSubmissionSigningIdentity = null;
        this.infoStore.bipUserId = info.userid;
    }

    /** Clears BiP signing material after logout. */
    clearBipSiteInfo(): void {
        this.bipSiteInfo = null;
        this.cachedSubmissionSigningIdentity = null;
        this.infoStore.bipUserId = "";
    }

    /** Reuses one signing identity for all PDF submissions in the exam. */
    async ensureSubmissionSigningIdentity() {
        if (this.cachedSubmissionSigningIdentity) return this.cachedSubmissionSigningIdentity;

        const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
        const bip = this.bipSiteInfo?.userprivateaccesskey;
        if (bip) {
            this.cachedSubmissionSigningIdentity = await deriveSigningIdentity(bip, salt, this.bipSiteInfo.fullname || this.infoStore.clientname, {
                mode: SUBMISSION_SIGN_MODE_BIP,
                bipUserId: this.bipSiteInfo.userid,
            });
        } else {
            const secret = buildLocalSubmissionSigningSecret(this.infoStore.pincode, this.infoStore.token, Date.now());
            this.cachedSubmissionSigningIdentity = await deriveSigningIdentity(secret, salt, this.infoStore.clientname, {
                mode: SUBMISSION_SIGN_MODE_LOCAL,
            });
        }
        return this.cachedSubmissionSigningIdentity;
    }
}

export default new IosSubmissionSigningService();
