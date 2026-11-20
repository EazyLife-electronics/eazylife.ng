# EazyLife STEM Lab: Initial Repository Audit

Date: 2026-11-19
Target branch: `feature/stem-learning-platform`
Base: `main`

## Scope

This is a read-only audit of the current public STEM Lab pages and the older `feature/stem-lab` development branch. No production files, Firebase data, Firestore rules, or existing site routes were changed as part of the audit.

## Implementation update on `feature/stem-learning-platform`

The following additive milestone has now been implemented after the initial audit:

- Added `stem-electronics-fundamentals.html` as the first public learning module.
- Added a three-module Electronics Fundamentals domain overview. Only the first module is presented as available; the other two are clearly marked as in development.
- Completed the Potentiometer-to-LED module with concept explanations, a behavioural ADC/PWM experiment, physical components, Uno wiring, an Arduino sketch, expected observations, troubleshooting, safety guidance and a knowledge check.
- Added module navigation from both existing STEM pages and listed the module in `sitemap.xml`.
- Added responsive page styles and client-side interactions. The new page uses the existing shared site theme and does not introduce Firebase dependencies.
- Corrected the virtual PWM calculation to match Arduino integer `map()` behaviour for the supplied sketch.
- Added dark-theme contrast overrides for the learning hero.

Source-level checks on the new module found no duplicate HTML IDs, no JavaScript element lookups missing from the page, and confirmed the local stylesheet/script references, navigation links and sitemap entry. These checks do not replace browser testing on real mobile and desktop devices.

### Additional milestone: open learning and guidance model

- Documented the Open Learning and Paid Guidance Model in the curriculum seed: free public learning remains valuable and ungated; paid services cover personalised guidance, masterclasses, mentorship and practical support; free/sponsored referrals are only described as opportunities when genuinely available.
- Added optional guidance enquiry sections to the STEM Lab, learning module and project playground. These direct enquiries to EazyLife's existing WhatsApp contact; no checkout, pricing claims, account requirement or payment gate was introduced.

### Additional milestone: resistor colour-code calculator

- Added `stem-resistor-colour-code.html`, a standalone public 4-band/5-band calculator with colour selectors, a resistor preview, nominal resistance, tolerance range, band explanations, quick reference table and reverse lookup.
- Added separate CSS and JavaScript assets. The tool is client-side only and introduces no Firebase dependency.
- Added navigation links from the existing STEM pages and included the calculator in the sitemap.

Source-level checks completed for this milestone:

- The calculator page has 20 unique HTML IDs; no duplicate IDs were found.
- All 13 distinct JavaScript ID lookups used by the calculator are present in its HTML.
- All five local CSS/JavaScript asset references on the calculator page are present in its markup.
- The calculator JavaScript passes a JavaScript syntax parse.
- The existing STEM Lab, project playground and Electronics Fundamentals pages all link to the calculator and load the shared guidance styles; each contains the optional guidance enquiry section.
- The sitemap has balanced URL opening/closing tags, includes the calculator and no longer contains the previously malformed escaped-newline learning entry.
- The calculator is client-side only; no Firebase, Firestore or network fetch dependency was introduced.

These are source-level checks, not browser rendering or real-device testing. The calculator and guidance sections still need manual testing in mobile and desktop browsers, including dark mode, keyboard operation and actual WhatsApp link behaviour.

## Current implementation on `main`

### Public pages and assets

- `stem-lab.html`, `assets/css/stem-lab.css`, and `js/stem-lab.js`
- `stem-projects.html`, `assets/css/stem-projects.css`, and `js/stem-projects.js`
- Both pages load the shared `site-theme.css` and `site-theme.js`.
- The STEM pages are static HTML/CSS/JavaScript and the two inspected experiment scripts do not introduce Firebase reads or writes.
- Both pages are linked in `sitemap.xml`.

### Existing learning experiences

The STEM Lab landing page currently offers three interactive quick experiments:
1. LED series circuit, supply voltage and resistor controls.
2. DC motor PWM model, duty cycle and supply voltage controls.
3. HC-SR04 distance/echo-time model.

It also includes one Ohm's-law multiple-choice challenge. The project playground on `main` contains 20 project cards and corresponding JavaScript model sections, including digital/analog I/O, sensors, pump/valve automation, LCD weather station, traffic lights, servo door, ultrasonic radar/parking, fan control, line following, stepper positioning, IR remote, battery monitoring and encoder counting.

### Confirmed content inconsistency

- `stem-projects.html` metadata says **16** projects.
- Its visible project list contains **20** project cards.
- The STEM Lab landing page promotes **20** projects.
- The script initialises 20 project models.

The count should be made consistent at 20 on the current `main` baseline, unless a later reviewed release deliberately adds more.

### Gaps against the agreed STEM Lab direction

The current pages are a useful interactive playground, but are not yet the complete open-access learning platform described in the product plan.

Not yet represented as a structured public experience:
- Independent learning domains and modules.
- Standalone lessons with objectives, technical explanations and worked examples.
- A consistent lesson-to-experiment-to-practical-build connection.
- Practical construction guides, component lists, wiring guidance, troubleshooting and safety notes.
- A browsable challenge collection beyond the single Ohm's-law question.
- Optional prerequisite recommendations and learning pathways.

The current project playground should be retained as a core asset. It should not be replaced with a full circuit emulator or a mandatory-account LMS.

## Existing `feature/stem-lab` branch

The branch exists, but it is not a safe merge candidate as a whole:

- Compared with `main`, it is **5 commits ahead and 38 commits behind**.
- Its project playground contains 24 project entries, compared with 20 on `main`.
- The four additional projects are single-axis solar tracker, self-balancing robot basics, closed-loop DC motor speed control and H-bridge direction/braking.
- Its project HTML, JavaScript and CSS are modified relative to `main`, while the STEM Lab landing-page assets are effectively the same as `main`.

Because the branch has diverged substantially, merging it wholesale could reintroduce older site state. Any useful additions should be reviewed and ported selectively after the new learning-platform work is established.

## Initial static checks

- The inspected project page has no duplicate HTML IDs.
- Direct ID lookups in the corresponding project script have matching IDs in the page.
- Both pages reference their expected page-specific script and shared theme script.
- These are source-level checks only. No claim is made that full browser, mobile, accessibility, or hardware-behaviour QA has been completed.

## Safe implementation baseline

A new branch, `feature/stem-learning-platform`, has been created directly from the current `main` branch. Future work should remain isolated there until reviewed.

Recommended next sequence:

1. Keep the existing STEM Lab and project playground routes working.
2. Resolve the 16-versus-20 metadata inconsistency without changing project behaviour.
3. Introduce the public learning-domain/module structure as additive pages or sections.
4. Build one complete reference module, including a lesson, linked experiment, practical build guide and challenge.
5. Standardise experiment documentation and limitations before migrating or adding more models.
6. Review the four additional experiments on `feature/stem-lab` individually for technical accuracy and compatibility before selectively porting any of them.

## Additional curriculum input

A curriculum and engineering portfolio reference has been added at `docs/STEM-LEARNING-CURRICULUM-SEED.md`. It maps the supplied 20-session syllabus and project portfolio into independent learning domains, records safety and scope boundaries for hazardous/high-energy and biomedical examples, and specifies a proposed 4-band/5-band resistor colour-code calculator.

The syllabus is a content seed rather than a mandatory learner sequence. The next useful utility after testing the first physical/interactive module is the resistor colour-code calculator, followed by additional foundational modules. The project portfolio should be used for grounded engineering case studies and carefully scoped subassemblies, not as a promise that every advanced project will be simulated or reproduced in the browser.

## Non-goals for this first implementation

- No compulsory learner accounts, payment gate or subscription. Paid guidance is enquiry-based and optional.
- No new Firebase project or migration of existing Firestore data.
- No changes to existing Firestore collections or security rules.
- No full Wokwi-style breadboard or microcontroller emulator.
- No assumption that a simplified browser model exactly reproduces physical hardware.
