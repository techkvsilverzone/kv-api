# Auth — httpOnly cookie session

The client no longer stores or sends a JWT. Auth is carried by an httpOnly cookie set by the
server. Every request is sent with `credentials: 'include'`.

## Requirements

- **All requests** include the cookie (`fetch(..., { credentials: 'include' })`). The server must
  accept cookie auth on protected routes and return **401** when the cookie is missing/expired
  (the client clears the session on 401 via the `kv-auth-unauthorized` event).
- **CORS:** because the client sends credentials cross-origin, `Access-Control-Allow-Origin` must
  be an explicit origin (not `*`) and `Access-Control-Allow-Credentials: true`.

## Endpoints

### `POST /auth/login`  ·  `POST /auth/signup`
- Server sets the httpOnly auth cookie in the response.
- Response body: `{ user: User, token: string }`. The client **reads `user` and ignores `token`**
  (kept for non-browser API clients).

### `POST /auth/logout`  *(used on logout)*
- Request body: `{}`.
- Server **clears the auth cookie**. JS cannot delete an httpOnly cookie, so this call is required.
- Response: any 2xx. The client drops local state regardless of the result.

### `GET /users/me`  *(session restore)*
- Called on app load when a previously-stored user exists, authenticated by the cookie.
- Returns the `User`. A 401 silently clears the session.

## Deploy config (cross-origin)

- `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true` (HTTPS required)
- `CORS_ORIGINS` = explicit storefront origin(s)

## Confirm these fields
- Login/signup still return `user` in the body (token optional/ignored).
- `POST /auth/logout` exists and clears the cookie.
