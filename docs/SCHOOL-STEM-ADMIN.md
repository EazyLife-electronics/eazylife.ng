# EazyLife School STEM Admin Module

The School STEM module is an internal section of `/admin/`. It reuses the existing Firebase Authentication session and Firestore instance.

## Current scope

- Capture school contacts, goals, learner groups, facilities, budget position and meeting notes.
- Recommend a starting engagement model using transparent rules.
- Configure a private internal rate card.
- Estimate delivery cost, preferred selling price and minimum acceptable price.
- Assess a school's offer against the configured price thresholds.
- Generate a school-facing summary that excludes internal cost and margin figures.
- Save school meeting records to Firestore.

## Firestore collections

- `schoolStemMeetings`: internal meeting records and internal estimate snapshots.
- `schoolStemPricing`: private rate card and margin settings.

Both collections are restricted in `firestore.rules` to owner-approved Firebase UIDs in `adminAccess/{uid}`. The module tab is also hidden for other signed-in accounts, and its in-memory data is cleared on logout.

## Deployment and testing

1. Review this branch before merging: `feature/school-stem-admin`.
2. Deploy the updated Firestore rules before using the module with production Firestore. Until the rules are deployed, Firestore will reject access to the new collections.
3. Test with the authorised admin account. Confirm a non-admin account cannot read or write either collection.
4. Configure actual EazyLife delivery rates before relying on any estimate. Zero values are treated as unconfigured, not as free services.
5. Check calculations with a known sample programme, including multiple groups, sessions, instructors, learner kits, travel and contingency.
6. Generate and inspect a school-facing summary. It must not contain internal costs, preferred price, minimum price or margin.
7. Only merge/deploy after review and explicit approval.

## Important limitations

- The engagement recommendation is a rules-based starting point, not an AI assessment.
- Cost estimates depend on the rate card and assumptions entered by the administrator. Validate staffing, transport, consumables, equipment purchase/rental, maintenance, tax treatment and scope before issuing a binding quotation.
- The current module is a first working version. It does not yet provide full edit/delete workflows, proposal PDF branding, multi-user roles, or automated follow-up reminders.
- Do not publish this module as a public-facing price calculator. The internal data is protected by Firestore rules, but all deployment changes must be reviewed together.
