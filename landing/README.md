# Acetate product site

This is the existing simple landing page, packaged for static hosting separately from Frontend 0.2. Deploy this directory as the product site at acetate.me; redirect www.acetate.me to it. Its compact sign-in panel opens https://app.acetate.me/login, where the application starts and completes authentication.

Public legal pages are `/privacy-policy` and `/terms-of-service`. They identify Gabriel Welzel and gabriel@gabrr.app and must remain accessible without signing in. The application links here rather than owning separate policy copies.

From the repository root, use `npm run dev:landing` for a local preview with the login destination rewritten to the local app. The application must also run on port 3000.
