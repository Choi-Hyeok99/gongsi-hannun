const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// IDs are provisioned by the operator on the server. Emails and user_metadata
// are deliberately not authorization inputs: users can edit their own profile.
export function isAdminUser(userId: string | null | undefined, configuredIds: string | undefined): boolean {
  if (!userId || !UUID.test(userId)) return false;
  return (configuredIds ?? "").split(",").map(value => value.trim().toLowerCase())
    .filter(value => UUID.test(value)).includes(userId.toLowerCase());
}
