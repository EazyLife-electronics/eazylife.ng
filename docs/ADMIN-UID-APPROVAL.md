# EazyLife admin account approval (UID-based)

Admin access is controlled by Firebase Authentication plus the Firestore document
`adminAccess/{Firebase UID}`. A successful Google or email/password sign-in alone
does not grant admin access.

## Owner bootstrap / approving an account

1. In Firebase Console, open **Authentication → Users** for project `eazylife-ng`.
2. Select the account to approve and copy its **UID**. For email/password accounts,
   confirm the email is verified. Google accounts should use a verified Google email.
3. Open **Firestore Database → Data** and create the collection `adminAccess`
   if it does not exist.
4. Create a document whose document ID is exactly the copied UID. Add:
   - `role`: string, `admin`
   - `status`: string, `approved`
   - `email`: string, the account email (for owner reference)
   - `approvedAt`: timestamp (optional audit field)
5. To revoke access, change `status` to `revoked` or remove the document.

Users cannot create, edit, or delete approval records from the website. This is
deliberately owner-managed through Firebase Console.

## Deployment order (not performed by this branch)

- First verify the owner's Firebase Auth email is verified and create the owner's
  `adminAccess/{UID}` document in the live Firestore console.
- Then deploy the updated `firestore.rules` to `eazylife-ng`.
- Then publish/merge the frontend changes so the admin portal uses the new lookup.
- Enable **Email/Password** and **Google** providers in Firebase Authentication.
  Add the production and any preview hostnames under Authorized domains.
- Test sign-in, approved admin reads/writes, an unapproved account, and public
  storefront reads before considering the rollout complete.

Do not deploy the rules before the owner approval document exists: the current
hardcoded-email rule will be replaced by UID approval, and missing approval means
admin requests will be denied.
