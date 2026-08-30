/**
 * SportsSync Elite - Server-Side Admin Access Configuration
 * 
 * To add more authorized administrator accounts:
 * Add their Google email address (in lowercase) to the ADMIN_EMAILS array below.
 */

export const ADMIN_EMAILS: string[] = [
  'zigman.tal@gmail.com',
  'nirhoffman@gmail.com',
  // You can add more admin accounts here:
  // 'example.admin@gmail.com',
];

// Default admin security passcode / password. Can be customized via ADMIN_PASSWORD environment variable
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'SportsAdmin2026!';

/**
 * Checks if a given email is registered as an administrator.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();
  return ADMIN_EMAILS.some((admin) => admin.toLowerCase().trim() === cleanEmail);
}

/**
 * Validates admin credentials securely.
 */
export function verifyAdminCredentials(email: string | null | undefined, password: string | null | undefined): boolean {
  if (!email || !password) return false;
  if (!isAdminEmail(email)) return false;
  return password.trim() === ADMIN_PASSWORD;
}
