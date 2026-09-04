export function jwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!secret || /change-me/i.test(secret)) {
      throw new Error("Production üçün JWT_SECRET uzun təsadüfi dəyər olmalıdır.");
    }
    return secret;
  }
  return secret || "change-me-to-a-long-random-secret";
}
