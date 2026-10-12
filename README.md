This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


## Landing-owned login

This branch starts from the original production app (`e4e1961`). Dashboard, processing pages, data services, and existing request-access delivery are unchanged. `/login` opens the sign-in card at `https://www.acetate.me/#sign-in`.

Google and passkey authentication run on the landing page using the existing Acetate Supabase project, not the classifier project. The origin-checked `/auth/receive` frame submits the session to `/api/auth/session`, which verifies the existing invitation policy and writes the original Supabase SSR cookies. The landing then opens the existing dashboard through the app root. Tokens never appear in URLs.

Keep the original NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_ALLOWED_USER_EMAIL, NEXT_PUBLIC_API_BASE_URL, and Resend variables. Optional AUTH_LANDING_ORIGIN, AUTH_APP_ORIGIN, and AUTH_CALLBACK_URL support isolated local testing. Production defaults are the existing domains. AUTH_PASSKEYS_ENABLED=false disables passkey enrollment/sign-in. Preserve the existing RP ID www.acetate.me and allow https://www.acetate.me/?auth=callback in Supabase.

Validation: `npm run build`, targeted ESLint on auth changes, and `node --test test/auth-receive.test.mjs`. Before promotion, verify original-dashboard identity, Google callback, passkey enrollment/sign-in with the account holder, cookie persistence on reload, and origin/token rejection.
