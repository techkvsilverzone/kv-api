import { IAddress } from '../domain/user';

/**
 * The single place a user document is turned into a client-facing payload.
 *
 * Every endpoint that returns a user MUST go through `toUserResponse` — the
 * sanitize step used to be copy-pasted at each call site, and the handlers that
 * forgot it (PUT /users/me, GET /admin/users) shipped raw bcrypt hashes to
 * clients while also omitting the computed `role`.
 */

export function computeRole(user: { isAdmin?: boolean; role?: string }): 'admin' | 'staff' | 'customer' {
  if (user.role === 'staff') return 'staff';
  if (user.role === 'admin' || user.isAdmin) return 'admin';
  return 'customer';
}

/**
 * Addresses go out keyed by `id`, never the raw sub-document `_id`, so the copy
 * embedded in a user payload matches what /users/me/addresses returns for the
 * very same address.
 */
export function toAddressResponse(a: IAddress | Record<string, any>) {
  const raw = a as Record<string, any>;
  return {
    id: raw._id ? String(raw._id) : (raw.id ?? ''),
    label: raw.label,
    firstName: raw.firstName,
    lastName: raw.lastName,
    address: raw.address,
    city: raw.city,
    state: raw.state,
    pincode: raw.pincode,
    phone: raw.phone,
    isDefault: raw.isDefault,
  };
}

/** Strips passwordHash, adds the computed role, and normalizes embedded addresses. */
export function toUserResponse(user: any) {
  const plain = user?.toObject ? user.toObject() : user;
  if (!plain || typeof plain !== 'object') return plain;

  const { passwordHash, addresses, ...safeUser } = plain as Record<string, any>;

  return {
    ...safeUser,
    role: computeRole(safeUser),
    ...(Array.isArray(addresses) ? { addresses: addresses.map(toAddressResponse) } : {}),
  };
}
