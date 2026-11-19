# AmarMess

AmarMess is a shared meal and expense ledger for one mess. Members can check their meals, deposits, expenses, and balances from a phone or computer.

## Features

- Invite-only member accounts, a manager role, and delegated permissions for recording meals, deposits, and expenses
- Daily breakfast, lunch, and dinner counts, including fractional meals, with manual requests and recurring defaults
- Signed deposits, grocery expenses with optional shopper credits, and shared and individual charges
- Bazar dates and a feed of meal and expense activity
- Active and closed accounting periods, adjustable opening balances through carry-forward, and downloadable PDF reports

## How the ledger works

The meal rate is grocery expenses divided by the total number of meals. Each member's grocery share follows their recorded meal counts. Shared expenses split equally among the selected members. Individual expenses use the amounts entered for each member. Allocations reconcile to the paisa.

A new accounting period locks the previous ledger. The manager can carry positive and negative member balances forward. Meal requests use a configurable cutoff in Asia/Dhaka.

The app uses semantic HTML, CSS, Tailwind CSS, React, Next.js, TypeScript, Node.js, Express, Better Auth, MongoDB, and Mongoose. Git and GitHub track development.
