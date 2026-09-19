export const R2_SETTING = "r2_storage";

export type R2Creds = {
  accountId: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  apiToken: string;
  bucket: string;
  publicUrl: string;
};

export function emptyR2(): R2Creds {
  return {
    accountId: "",
    endpoint: "",
    accessKeyId: "",
    secretAccessKey: "",
    apiToken: "",
    bucket: "nexautos",
    publicUrl: "",
  };
}

export function r2Ready(c: R2Creds) {
  return Boolean(c.accessKeyId && c.secretAccessKey && c.endpoint && c.bucket);
}

export function maskSecret(value: string) {
  if (!value) return "";
  if (value.length < 8) return "••••";
  return `••••${value.slice(-4)}`;
}

export function isMaskedSecret(value: string) {
  return !value || (/^[•*xX.]+[A-Za-z0-9_-]{0,8}$/.test(value) && value.includes("•"));
}
