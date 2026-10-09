# FashionCAD Studio (Phase 1)
Static site: login, signup, password reset, email verification, protected dashboard.

1. Firebase Console: create a project, add a Web app, enable Authentication > Email/Password, create Firestore (production mode).
2. Paste the web config into `firebase/firebase-config.js`.
3. Paste `firebase/firestore-rules.txt` into Firestore > Rules and publish.
4. Upload everything to a GitHub repo (Add file > Upload files), then Settings > Pages > deploy from `main` / root.
5. Add `yourname.github.io` to Authentication > Settings > Authorized domains.

Opening the pages directly from disk (file://) will not work, because browsers block module imports there. Test on the GitHub Pages URL.
