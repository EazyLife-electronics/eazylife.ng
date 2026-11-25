# EazyLife admin auth fix — how to apply

Copy these files into your repo root (they match the existing paths):

```
admin/js/admin-auth.mjs          ← NEW (single source of truth for admin emails)
admin/js/admin-app.mjs           ← updated
admin/js/circuit-painter.mjs     ← updated (uses shared Firebase + App Check)
admin/js/circuit-components-admin.mjs  ← updated
admin/circuit-component-painter.html   ← cache-bust only
js/firebase.mjs                  ← cleaned App Check comments
firestore.rules                  ← comment only (email unchanged)
```

## What changed

1. **`admin/js/admin-auth.mjs`**
   - `ADMIN_EMAILS` list (currently just `damzyeazy@gmail.com`)
   - `isAdminUser(user)`
   - `redirectToAdminLogin(...)` for the painter
   - `consumeAdminReturnTo(user)` for post-login redirect back to the painter

2. **Component Painter**
   - No longer embeds its own Firebase config
   - Uses `initFirebase()` so **App Check runs** on painter requests too
   - Auth gate uses `isAdminUser` / `redirectToAdminLogin`
   - Same login → returnTo → painter flow, slightly safer path allow-list

3. **Admin dashboard**
   - Non-admin Firebase accounts are signed out with a clear error message
   - School STEM / Technical Training still only for admin users
   - returnTo works for painter (and a couple of other admin tools)

4. **Firestore rules**
   - Still use the same email in `isAdmin()` (rules cannot import JS)
   - Comment reminds you to keep rules + `ADMIN_EMAILS` in sync

## After you push

1. Open `https://eazylife.ng/admin/` and sign in.
2. Open `https://eazylife.ng/admin/circuit-component-painter.html` while logged out → should bounce to login, then return after sign-in.
3. Confirm components load from Firestore and Save still works.

## Adding another admin later

1. Add their email to `ADMIN_EMAILS` in `admin/js/admin-auth.mjs`
2. Add the same email to `isAdmin()` in `firestore.rules` (OR move to custom claims)
3. Deploy rules in Firebase Console
4. Push the JS change

Longer term: set a Firebase custom claim `admin: true` and check `request.auth.token.admin` in rules — then you never hard-code emails again.
