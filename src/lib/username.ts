// Username-based auth is simulated on top of Supabase email/password.
// A synthetic email is derived from the username for use with Supabase Auth.
export const USERNAME_DOMAIN = "sipasti.local";

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USERNAME_DOMAIN}`;
}

export function emailToUsername(email: string): string {
  return email.replace(`@${USERNAME_DOMAIN}`, "");
}
