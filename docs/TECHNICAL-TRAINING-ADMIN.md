# EazyLife Technical Training Admin

The Technical Training module is a private section of the existing `/admin/` dashboard. It reuses the existing Firebase Authentication session and Firestore instance. It is separate from the School STEM module and from the public shop catalogue.

## Programme catalogue

The admin contains the 14 independently enrolable specialisations in the EazyLife Out-of-School Technical Training framework, grouped into:
- Practical STEM and Electronics
- Embedded Systems and Intelligent Devices
- Robotics and Automation

Each enquiry can specify Beginner, Mid-level or Master placement, a five- or ten-month plan, physical / hybrid / institutional placement delivery, and one or more selected specialisations. The framework's placement and prerequisite rules still apply; the admin selection is a commercial planning aid, not an automatic admission decision.

## Pricing model

The private price catalogue stores a fee per learner for each combination of:
- Specialisation
- Competency level
- Five- or ten-month duration

Additional configurable charges are available for registration/onboarding, learning materials per course, assessment per course, certification/portfolio per course, and delivery-mode add-ons per learner.

All new prices start at zero. Zero means not configured, not a free course. Configure the applicable prices before sharing a quote. The quote summary contains customer-facing programme details and fees only; internal notes and the private rate catalogue are not included.

## Firestore collections

- `technicalTrainingLeads`: private learner and institutional enquiry / training records with a snapshot of selected course fees.
- `technicalTrainingPricing`: private course price matrix and additional fee settings.

Both collections are restricted by `firestore.rules` to owner-approved Firebase UIDs in `adminAccess/{uid}`. The module tab is hidden for other signed-in accounts, and in-memory records are cleared on logout.

## Deployment and testing

1. Review the changes on `feature/technical-training-admin`; do not merge or deploy to `main` until tested and approved.
2. Deploy the additive Firestore rules before using the module with production Firestore.
3. Test as the authorised admin and verify a non-admin account cannot read or write either collection.
4. Configure actual EazyLife fees for the courses and combinations that are ready to offer.
5. Test one private learner and one institutional enquiry, including multiple specialisations, different levels, both duration options and each delivery mode.
6. Confirm that changing the price catalogue does not alter previously saved fee snapshots.
7. Inspect copied quotes to ensure they contain no internal notes or private configuration.

## Important limitations

- This first version records enquiries and training status, calculates fees and prepares a copyable quote. It is not yet a full learner attendance, assessment, payment, certificate or learning-management system.
- The course catalogue follows the technical training repository. Changes to that curriculum should be reviewed and reflected in this admin catalogue separately.
- Confirm prerequisites, trainer capacity, available equipment, cohort size, project scope and institutional requirements before confirming admission or issuing a binding offer.
