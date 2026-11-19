# AmarMess

AmarMess is a private account-based meal and expense ledger for one mess. It uses Next.js, React, TypeScript, Tailwind CSS, Express, Better Auth, MongoDB and Mongoose.

## Run locally

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local`. Set `MONGODB_URI` and `MONGODB_DB` for a local MongoDB or Atlas database. Keep the database separate from production.
3. Set `BETTER_AUTH_URL` to `http://localhost:3000`. Generate two different values for `BETTER_AUTH_SECRET` and `MESS_SETUP_CODE`, for example by running `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` twice. Set `MESS_SETUP_EMAIL` to the first manager's email.
4. Run `npm run dev`. Select **I have an invitation code** and use the setup email and code. Create the mess and its first accounting period.
5. In **Members**, invite each person by email and share their invitation code privately. Each member chooses their own password.

## Ledger rules

- Deposits are signed amounts in Bangladeshi taka. Negative entries record withdrawals or adjustments.
- The meal rate is food costs divided by the total meal count. Shared costs split equally among selected members. Individual costs follow the amounts entered for each member. Monetary allocations reconcile to the paisa.
- A member who paid for groceries can receive a matching deposit credit. The app splits that credit equally across the selected shoppers.
- A new accounting period closes the active one. The manager can carry positive and negative balances forward as opening balances.
- Members can submit meal requests before the daily cutoff in Asia/Dhaka. Automatic defaults appear for review on the same day. Approved requests become ledger entries.

## Deploy to Vercel

Import the GitHub repository as one Next.js project. Express handles the ledger at `/api/ledger` and Better Auth serves `/api/auth/*` on the same origin.

Set the six variables in `.env.example` as Vercel production environment variables. Use a production MongoDB database and set `BETTER_AUTH_URL` to the exact production origin. Use different environment variables for preview deployments if you enable their authentication. Keep database credentials and setup codes out of Git.

Run `npm run typecheck` and `npm run build` before deploying.
