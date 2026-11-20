# AmarMess

AmarMess is a mobile-friendly meal and expense ledger for a shared household or student mess. It gives everyone one place to check their daily meals, deposits, share of expenses, and running balance. A manager can keep the books, hand over the role, and close the month without rebuilding the ledger in a spreadsheet.

The app was built for an existing mess moving from another meal manager. That made preserving the previous ledger and keeping familiar day-to-day workflows part of the project from the start.

[Open AmarMess](https://amar-mess.vercel.app/)

## What AmarMess solves

| Problem | How AmarMess handles it |
| --- | --- |
| Meals and deposits are recorded in different places | A dated ledger keeps breakfast, lunch, dinner, deposits, and expenses together. Members can review the same records from their phones. |
| Groceries, shared bills, and personal charges need different rules | Meal costs follow consumption, shared costs split among selected members, and individual costs use the amount entered for each person. |
| Members cannot see what they will pay before an expense is saved | The shared-cost form shows each selected member's exact share while the amount is being entered. |
| A manager change or new month makes old balances hard to trace | Closed months stay available as history. The manager can carry each member's closing balance into the next period. |
| Moving to a new app can mean losing previous balances | A manager can import a prepared ledger into an empty workspace. AmarMess checks the entries and reconciles every member's balance before saving. |
| Some members cannot receive email recovery messages | The Owner can issue a short-lived reset code that a member redeems directly in the app. |

## Features

### Daily bookkeeping

- **Meals** records breakfast, lunch, and dinner by date for one member or everyone. Fractional meal counts are supported, and the meal form loads previously recorded counts for the selected date.
- **Deposits** records money received and negative adjustments, with an optional note.
- **Meal Cost** records grocery expenses, their shoppers, and an optional shopping note. When shoppers paid out of pocket, the manager can add matching deposit credits split among those shoppers.
- **Shared Other Cost** covers bills such as utilities or cleaning. The form updates the total, selected member count, and each person's exact share as the amount or selection changes.
- **Individual Other Cost** lists members one per row with everyone selected initially. Uncheck anyone who should be excluded and enter a separate amount for each included member.
- **Bazar dates** let members track their own shopping days. The manager can also manage dates for other members.

### Dashboard, reports, and history

- Home shows the active period, total deposits, meal counts, meal rate, expenses, and cash balance. Personal summary cards and individual member balances show who owes money and who has a credit.
- Active Month Details includes a daily meal table with member-by-member breakdowns and separate tabs for deposits, meal costs, shared costs, and individual costs.
- All Month Details opens previous accounting periods. Starting a new month closes the active ledger, with an option to carry positive and negative member balances forward.
- Downloadable PDF reports contain period totals, member balances, and ledger entries.
- Notifications present meal, deposit, and expense activity in separate cards, with the amount or meal count, recorded date, and who entered it. Older items are available through **Load more**.
- Phones get a compact dashboard, a left-side slide-out menu, and bottom shortcuts. Wide report tables scroll within their own container.

### Membership and access

| Role | Responsibilities |
| --- | --- |
| Member | Sign in through an invitation, view the shared ledger and balances, manage personal bazar dates, and update profile details or an existing password. |
| Manager | Manage the mess, invitations and member permissions, record or remove active-period entries, import an existing ledger, close months, and transfer the manager role. |
| Owner | Issue member password reset codes independently of who currently holds the manager role. |

The manager can delegate meal, deposit, and expense entry permissions individually. The app checks these permissions on the server. The Owner's reset code is valid for 15 minutes and can be used once. A successful reset ends the member's previous sessions. Login and recovery work without email OTP.

## How the numbers work

| Value | Calculation |
| --- | --- |
| Meal rate | Total grocery expenses divided by total recorded meals for the period. The rate stays pending until meals have been recorded. |
| Member meal cost | The member's share of grocery expenses, proportional to their recorded meal count. |
| Shared charge | The expense split equally among the selected members. Any leftover paisa are allocated so the shares add up to the exact original amount. |
| Individual charge | The amount entered for that member. |
| Member balance | Opening balance plus net deposits, minus meal, shared, and individual costs. |

For example, a ৳822 shared expense across seven members gives six shares of ৳117.43 and one share of ৳117.42. The form uses the same allocation method as the server. Money is handled in integer paisa, and ledger dates follow Asia/Dhaka.

## Tools and technologies

| Layer | Tools | What they do |
| --- | --- | --- |
| Languages and styling | TypeScript, HTML, CSS, Tailwind CSS | Typed application code, accessible forms, and responsive layouts. React components use TSX to render the interface. |
| Frontend | React, Next.js | Dashboard, forms, client state, navigation, and report views. |
| Backend | Node.js, Express, Zod | Runs the ledger API, validates requests, enforces permissions, and applies bookkeeping rules. |
| Authentication | Better Auth | Invitation-based email and password sign-in, session management, password changes, and reset-code redemption. |
| Database | MongoDB Atlas, MongoDB Node.js Driver, Mongoose | Stores accounts and sessions, along with the mess document and its accounting periods. |
| Reports and icons | jsPDF, Lucide React | Generates PDF reports and supplies navigation and activity icons. |
| Build and delivery | npm, Webpack, Git, GitHub, Vercel | Manages dependencies and builds, tracks changes, and hosts the running app. |
| Migration and verification | Python, pdfplumber, TypeScript checks, browser testing | Extracted the previous ledger from a PDF, reconciled totals, and checked responsive layouts and live form behavior. |

## How the project fits together

- [app/page.tsx](app/page.tsx) contains the user-facing workflows. [app/style.css](app/style.css) defines the responsive layout, theme, and components.
- [pages/api/ledger.ts](pages/api/ledger.ts) handles ledger operations and permission checks.
- [lib/domain.ts](lib/domain.ts) contains the accounting model, split rules, and balance calculations. [lib/ledger-import.ts](lib/ledger-import.ts) validates migration data and checks the resulting member balances.
- [lib/store.ts](lib/store.ts) connects authentication and persistence to MongoDB. Ledger writes check the document revision so concurrent edits do not silently overwrite each other.

## Development milestones

1. **Accounting foundation.** Defined accounting periods, fractional meal counts, signed deposits, expense types, and allocations that reconcile to the paisa.
2. **Accounts and ledger API.** Added invitation-based sign-in, Manager and Member workflows, delegated permissions, and MongoDB persistence.
3. **First usable app.** Built the dashboard, entry forms, month history, bazar scheduling, PDF reports, and the first live release.
4. **Migration.** Extracted 95 ledger records from the previous application's PDF and reconciled the opening migration against the source report for all seven members.
5. **Mobile redesign.** Added the summary-first mobile dashboard, a left-side menu, and bottom navigation. Simplified meal entry and removed the unused meal-request workflow.
6. **Recovery and form refinements.** Added Owner-issued password reset codes and clearer Notifications, then refined shared-cost previews and individual member selection.

## Planned improvements

- Bengali and English language toggle
- Owner-managed corrections to member login email addresses
- Profile photos
- In-place editing for deposit and expense entries
