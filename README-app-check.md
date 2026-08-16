# Enabling App Check (stops tracking-code brute-forcing)

Code side is already done in `js/firebase.mjs`. Three steps left, all in the Firebase console:

1. **Get a reCAPTCHA v3 site key**
   Firebase Console → Build → App Check → Apps tab → find your web app → Register → choose **reCAPTCHA v3** → follow the prompt to create a key at google.com/recaptcha/admin (register `eazylife.ng` as the domain). Copy the **site key**.

2. **Add the site key to the code**
   In `js/firebase.mjs`, replace:
   ```js
   const RECAPTCHA_V3_SITE_KEY = 'REPLACE_WITH_RECAPTCHA_V3_SITE_KEY';
   ```
   with your real site key, then deploy (push to the branch GitHub Pages serves).

3. **Turn on enforcement — but wait first**
   After deploying, go back to App Check → Apps → your web app → **Cloud Firestore** metrics. Give it a few hours to a day so real visitor traffic shows up as "Verified" before flipping enforcement on. If you enforce immediately, anyone still on a cached/old version of the site (before this deploy) gets blocked.
   Once verified traffic looks right: App Check → APIs tab → Cloud Firestore → **Enforce**.

That's it — after enforcement is on, only requests carrying a valid App Check token (i.e. real visitors loading your actual site) can read/write Firestore, so scripted tracking-code guessing gets rejected before it reaches the `orders` collection.

**Note:** reCAPTCHA v3 is free under normal traffic; Google recommends reCAPTCHA Enterprise for new integrations if you want more configurability, but v3 is simpler and enough for this use case.
