// Admin bootstrap.
// Keep admin-app as a normal static ES-module dependency so GitHack serves it
// exactly like the other admin modules (dynamic import can fail on some CDN caches).
import './admin-app.mjs';
