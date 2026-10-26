declare module "./index.ts" {
  export interface SessionCapabilities {
    "urn:ietf:params:jmap:webpush-vapid": {
      applicationServerKey: string;
    };
  }
}
