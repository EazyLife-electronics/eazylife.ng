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

### Previous and next lesson previews

- Added a consistent previous/next navigation area to the two available Electronics Fundamentals module pages.
- Each destination includes its module number or directory role, title and a short description of what the learner will explore.
- Module 01 links back to the directory and forward to Module 02. Module 02 links back to Module 01 and previews Module 03 as coming soon without presenting an unavailable page as a working link.
- Navigation remains optional; learners can still enter modules directly from the directory. Responsive styling stacks the cards on narrow screens.

### Learning page architecture update: one module per page

- Converted `stem-electronics-fundamentals.html` into a concise learning-domain directory rather than a long page containing the full first lesson.
- Extracted the original Potentiometer-to-LED lesson, including its explanations, interactive ADC/PWM model, wiring, sketch, troubleshooting and quiz, into `stem-potentiometer-led.html`.
- The directory now links independently to Potentiometer-to-LED and Component Identification and Polarity; Voltage, Current and Resistance remains clearly marked as in development.
- Added module navigation from the Potentiometer-to-LED lesson back to the directory and across to the component-identification lesson.
- Added the standalone lesson to the sitemap. Shared theme, guidance styling and existing client-side lesson logic are retained. No Firebase or production changes were made.

This establishes the page architecture for future work: each learning module is a standalone URL; domain pages are directories, not containers for multiple full lessons.

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


## Module 03: Voltage, Current and Resistance

- Added standalone page `stem-voltage-current-resistance.html` with its own stylesheet and script.
- Lesson covers voltage, current and resistance definitions/units; Ohm's law with an interactive two-known-values calculator; ideal series and parallel resistor-network calculations; correct multimeter connections for voltage, current and resistance; battery series/parallel concepts and safety; a low-voltage practical build; troubleshooting prompts and a three-question knowledge check.
- Calculator and network outputs are labelled as ideal calculations/models. The lesson explains real-world deviations caused by component tolerance, temperature, source behaviour, wiring and meter effects.
- Measurement safety explicitly states that current is measured in series, resistance only on an unpowered circuit, and a meter in current mode must never be placed directly across a source.
- Battery guidance warns against casually paralleling unmatched cells and notes that lithium packs require suitable protection and charging management.
- Added the lesson to the Electronics Fundamentals directory and XML sitemap. Previous/next navigation links back to Module 02 and previews a future Module 04 topic without linking to a nonexistent page.
- Source-level validation is required before considering the milestone complete. No browser or hardware QA is implied by source checks alone.
- Source-level checks completed: no duplicate IDs; every direct JavaScript element lookup has a matching HTML ID; expected local stylesheet/script references are present; module directory and previous/next links are present; sitemap entry and URL element balance are valid; mobile CSS rules are present; Ohm's law and series/parallel calculation paths are present; current-mode short-circuit and live resistance-measurement warnings are included.
- These checks do not replace browser testing on desktop/mobile or practical verification with a physical multimeter and circuit.



## Lesson navigation presentation refinement

- Replaced the large descriptive previous/next lesson cards on Modules 01, 02 and 03 with compact, high-contrast button-style navigation controls.
- Each button uses a clear arrow, a small PREVIOUS LESSON / NEXT LESSON label and a short destination title. This makes navigation easier to notice and tap, especially on mobile.
- Upcoming Module 04 is shown as a visually subdued, non-clickable button until its page is available.
- Module 02 now links forward to the published Module 03 page.


## Ohm's law calculator flexibility update

- Updated Module 03's Ohm's law workbench to calculate any one of voltage, current or resistance from the other two values.
- The example/reset state is now 2 V, blank current and 1,000 Ω, so current is the initially missing quantity.
- The calculator requires exactly two entered values. If all three are filled, it asks the learner to clear the quantity they want calculated; if fewer than two are entered, it explains that two known values are required.
- The calculated answer is written into the previously blank input field as well as shown in the result panel.
- Validation allows zero voltage, but requires supplied current and resistance to be positive. Invalid inputs receive specific guidance.
- Source-level validation should confirm all three calculation paths, default/reset values, and feedback states. This is not a substitute for interactive browser testing.



## Module 04: Resistors in Practical Circuits

- Added standalone lesson page `stem-resistors-practical-circuits.html`, with separate CSS and JavaScript assets. The page follows the one-module-per-page structure and reuses the shared EazyLife navigation, theme, guidance section and compact previous/next lesson buttons.
- Covers resistor roles in current limiting, voltage division, pull-up/pull-down logic bias and transistor operating-point bias; resistor power dissipation, thermal conditions and derating; series/parallel combinations; standard E-series selection; and potentiometer use, with a link back to Module 01 and the resistor colour-code tool.
- Added an interactive LED series-resistor calculator. It estimates resistance, resistor dissipation, a conservative suggested common wattage rating, nearest E12 value and the resulting current when that standard value is used. Inputs are validated, and results are explicitly presented as ideal estimates requiring datasheet and derating checks.
- Added an interactive voltage-divider calculator that compares unloaded and loaded output, calculates the effective lower resistance when a load is connected, and shows divider current. This demonstrates why dividers are sensitive to loading and are not substitutes for regulated supplies.
- Added a low-voltage LED practical build, measurement guidance, common mistakes and a three-question knowledge check. No mains build or high-energy activity is included.
- Linked Module 04 from the Electronics Fundamentals directory, updated Module 03's next-lesson button, and added the new page to the XML sitemap.
- Source-level checks should verify unique IDs, all JavaScript element references, valid JS syntax, expected local assets, correct module navigation, sitemap structure and calculator edge cases. Browser/mobile testing and physical build verification remain separate tasks.


### Module 04 visual clarification: voltage-divider wiring

- Added a labelled SVG circuit diagram directly above the voltage-divider calculator.
- The diagram shows the DC input supply, upper resistor R1, output junction, lower resistor R2, ground reference and load resistor RL.
- It explicitly depicts RL across the same two nodes as R2, making the parallel connection clear, and labels Vout as the voltage from the output junction to ground.
- Added a caption explaining each connection and responsive styling for narrow screens and the existing light/dark theme.
- This is a conceptual circuit diagram, not a physical breadboard layout. Browser rendering and mobile legibility still require manual QA.


## Module 05: Diodes and LED Circuits

- Added standalone lesson page `stem-diodes-led-circuits.html` with dedicated responsive CSS and client-side JavaScript. It follows the one-module-per-page structure and shared EazyLife theme, navigation, guidance and previous/next lesson controls.
- Covers PN-junction diode terminals and symbol, forward and reverse bias, approximate silicon forward voltage, LED polarity and series current limiting, half-wave and bridge rectification concepts, flyback protection for DC coils, Zener diode basics, Schottky/fast diode selection and key datasheet ratings.
- Added an interactive behavioural model that estimates current through a forward-biased diode and series resistor using an explicitly stated constant-forward-drop approximation. Reverse bias and open circuit are represented as ideal blocking states; limitations are disclosed.
- Includes circuit illustrations, diode-test procedure using a multimeter, low-voltage measurement cautions and a three-question knowledge check.
- Safety boundary: no mains rectifier or non-isolated power-supply construction instructions. Rectification is taught conceptually; any practical AC investigation is limited to isolated, current-limited extra-low-voltage equipment under suitable supervision.
- Linked Module 05 from the Electronics Fundamentals directory, connected Module 04's next-lesson button to the new page and added the new URL to the XML sitemap.
- Source-level checks completed: page has unique IDs; JavaScript ID lookups match page IDs; CSS and JS paths exist; interactive model controls and quiz targets exist; Module 04 next navigation, directory card and sitemap entry are present; sitemap URL elements are balanced. These checks do not replace browser rendering/accessibility QA or physical diode testing.

### Module 05 diagram refinement: bridge rectifier

- Replaced the earlier diagonal four-diode illustration with a straight-line, orthogonal bridge layout based on the supplied visual reference.
- The diagram now has two AC inputs at the left and right midpoints, a positive DC rail at the top and a negative DC rail at the bottom. Each AC midpoint connects to one upper and one lower diode branch.
- All four diode symbols are drawn with the cathode bar toward the positive DC rail and the anode toward the negative DC rail, making the intended bridge orientation easier to read.
- The caption continues to identify this as a functional concept drawing, not a construction or breadboard layout.
- Source markup was updated on the learning branch only. Browser rendering and mobile legibility still need manual QA.

## Module 06: Capacitors and Energy Storage

- Added standalone lesson page `stem-capacitors-energy-storage.html` with dedicated responsive styles and client-side interactions. It follows the one-module-per-page architecture and reuses the shared EazyLife navigation, theme, guidance section and compact previous/next lesson buttons.
- Covers capacitor construction and electric-field energy storage; capacitance, charge and units; ceramic, film, aluminium electrolytic and tantalum capacitor families; polarised and non-polarised symbols; polarity identification; RC timing; series and parallel capacitance; filtering, smoothing, decoupling, bypassing and AC coupling; and capacitor selection criteria including voltage rating, tolerance, ESR, ripple current, temperature and lifetime.
- Added an interactive ideal RC charge/discharge behavioural model. Learners can change supply voltage, series resistance, capacitance, operating mode and elapsed time. It displays the time constant, capacitor voltage, charge, stored energy, progress and an exponential response chart. The model explicitly discloses its ideal assumptions, including zero leakage and no ESR.
- Added a two-capacitor equivalent-capacitance calculator for series and parallel combinations.
- Includes conceptual circuit illustrations, safe low-voltage inspection and measurement steps, resistor-based discharge guidance, a multimeter verification step, common mistakes and a three-question knowledge check.
- Safety boundary: no mains, inverter DC-link, microwave, camera-flash or other high-energy capacitor work. The lesson warns against shorting capacitor terminals with tools, handling unknown charged capacitors, guessing polarity or using damaged components.
- Added Module 06 to the Electronics Fundamentals directory, connected Module 05's next-lesson button, linked Module 06 back to Module 05, and added the page to the XML sitemap.
- Source-level checks completed: no duplicate HTML IDs; all direct JavaScript element references match page IDs; CSS and JS assets are referenced; directory and previous/next navigation links are present; sitemap entry exists and URL tags are balanced; three quiz questions are present; RC exponential expressions and series/parallel capacitance calculation paths are included.
- These are source-level checks only. Browser rendering, keyboard/accessibility behaviour, real-device mobile layout and practical capacitor measurements still require separate verification.

## Batch 02: Modules 07–09

### Module 07: Inductors and Magnetic Fields
- Added standalone lesson `stem-inductors-magnetic-fields.html`.
- Covers magnetic fields, inductance, Lenz's law, energy storage, RL time constant, inductor families, filtering/conversion/actuation applications, component selection, safe low-voltage observation and common errors.
- Includes an interactive ideal series-RL current-rise model with editable supply voltage, resistance, inductance and elapsed time. It calculates time constant, steady-state current and transient current, with an exponential chart.
- Explicitly discusses current interruption transients and the need for a designed current path.

### Module 08: Transistors and Electronic Switching
- Added standalone lesson `stem-transistors-electronic-switching.html`.
- Covers BJT terminals and operation, MOSFET gate control, low-side switching, amplifier biasing, relay/motor interfaces, flyback protection, datasheet selection and common pinout/drive errors.
- Includes a simplified BJT base-resistor estimator using a forced-beta design assumption. It warns that controller pin current limits and transistor datasheets must be checked.
- Practical guidance starts with a current-limited LED or small rated extra-low-voltage load; it does not encourage powering motors or relay coils directly from microcontroller pins.

### Module 09: Operational Amplifiers and Basic Analog Circuits
- Added standalone lesson `stem-op-amps-analog-circuits.html`.
- Covers op-amp terminals, ideal-model assumptions and limitations, negative feedback, inverting/non-inverting gain, comparator concepts, signal conditioning and device selection.
- Includes an ideal inverting/non-inverting gain calculator with a simplified output-limit warning. Real output swing, input common-mode range, bandwidth, slew rate and supply requirements are called out as device-dependent.
- Practical guidance requires checking the selected IC datasheet and keeping signals within its specified supply/input/output limits.

### Batch integration and validation
- Added shared responsive styling `assets/css/stem-advanced.css` and shared interaction logic `js/stem-advanced.js`.
- Connected Module 06 to Module 07; Module 07 to Module 08; Module 08 to Module 09; Module 09 points to the upcoming Power Supplies and Regulation lesson.
- Added all three pages to the Electronics Fundamentals directory and XML sitemap.
- Updated this audit.
- The interactive models are idealised teaching models, not exact device emulators. No mains/high-energy practical build instructions are included.
- Source-level checks are required before review. Browser rendering, device-specific verification and physical experiments have not been performed as part of this source update.


## Module 07: Inductors and Magnetic Fields — practical rebuild

- Rebuilt `stem-inductors-magnetic-fields.html` as a practical lesson rather than a concept summary with only an abstract graph.
- Added labelled SVG illustrations of the magnetic field around a straight conductor and a coil/solenoid.
- Added Practical 1: a low-voltage electromagnet activity using insulated wire, an optional iron core, a current-limiting resistor, a switch and a compass/paper clips. Includes a connection schematic, materials, numbered build steps, observation prompts and heat/current safety guidance.
- Added Practical 2: a protected series RL investigation using a 5 V supply, series resistor, inductor, switch and flyback diode. The circuit schematic identifies the diode polarity and recirculation path; the learner measures voltage across the series resistor and calculates current using I = V_R/R. Includes build/measurement steps and expected observations.
- Expanded the explanation of Lenz's law, the inductor voltage relationship, magnetic energy, the RL time constant, real inductor ratings and common wiring errors.
- Retained the ideal RL current-rise model and improved its feedback so the selected time constant is translated into a percentage of ideal steady-state current. Invalid input now produces a visible prompt rather than leaving unexplained stale output.
- Added responsive styling for numbered practical steps, circuit captions and diagrams in `assets/css/stem-advanced.css`.
- Safety boundary: both practicals use extra-low-voltage DC only. The RL circuit includes a flyback diode; learners are explicitly warned not to remove it for an uncontrolled switching demonstration. No mains, automotive ignition or high-energy coil work is included.
- Source-level validation and browser rendering should be completed before treating the module as fully QA-approved. No physical build or measurement has been performed by EazyLife as part of this source update.


## Module 08: Transistors and Electronic Switching — practical rebuild

- Rebuilt `stem-transistors-electronic-switching.html` around two low-voltage switching builds rather than a mostly descriptive overview.
- Added labelled NPN BJT and N-channel MOSFET terminal illustrations, plus a low-side switching concept diagram.
- Practical 1: Arduino-controlled NPN LED switch using a 1 kΩ base resistor and 330 Ω LED current-limiting resistor. Includes an explicit connection schematic, component list, wiring sequence, Arduino sketch and a measurement task across the LED resistor.
- Practical 2: Arduino-controlled logic-level N-channel MOSFET motor switch. Includes a circuit schematic, 100 Ω gate resistor, 10 kΩ gate pull-down, flyback diode polarity, common-ground arrangement, Arduino PWM sketch and motor current/supply precautions.
- Expanded BJT cutoff, active and saturation regions; MOSFET gate drive and RDS(on); low-side switching; amplifier biasing; datasheet selection; troubleshooting and inductive-load protection.
- Retained the forced-beta BJT base-resistor estimator. Its displayed assumptions and controller output-current warnings remain important; the calculator is not a substitute for checking the actual GPIO output characteristics and transistor datasheet.
- Safety boundary: the BJT activity is limited to a small LED load. The MOSFET activity uses a small extra-low-voltage brushed motor, separate suitably rated supply, current limiting, correctly oriented flyback diode and a verified logic-level MOSFET. Learners are warned about motor stall current and moving parts. No mains or high-energy switching is included.
- Source-level checks and browser rendering should be completed before considering the lesson fully QA-approved. No physical build, motor-current measurement or hardware verification has been performed as part of this source update.


## Module 09: Operational Amplifiers and Basic Analog Circuits — practical rebuild

- Rebuilt `stem-op-amps-analog-circuits.html` as a standalone practical lesson with labelled SVG illustrations for the op-amp symbol, LM358 8-pin top-view pinout, negative-feedback concept, comparator circuit and non-inverting amplifier feedback circuit.
- Added Practical 1: an LM358 threshold indicator using two 10 kΩ potentiometers, feed resistors that constrain both wiper voltages to approximately 0–2.5 V, a 2.2 kΩ LED current-limiting resistor and an active-low LED output. Includes a component list, pin-specific wiring sequence, measurement/observation tasks and explicit warning that LM358 is not a dedicated comparator.
- Added Practical 2: a single-supply LM358 non-inverting DC amplifier using Rf = Rg = 10 kΩ for ideal gain 2. Includes a labelled feedback schematic, component list, pin-specific wiring steps and multimeter input/output observation task. The initial input is kept conservative to avoid driving the output into its upper swing limit.
- Covers differential operation, negative feedback and virtual-short limitations, inverting/non-inverting gain, comparator and voltage-follower concepts, LM358 pin assignment, supply bypassing, common-mode range, output swing, gain-bandwidth, slew rate, device selection and troubleshooting.
- Retained an interactive ideal gain calculator with a clearly labelled illustrative output limit; it is not a device-level emulator.
- Device-specific statements use the original TI LM358 datasheet and distinguish it from LM358B/BA variants. The standard LM358 is not rail-to-rail; its input common-mode range does not extend to the positive rail and its output high level remains below that rail.
- Safety boundary: extra-low-voltage 5 V only, current-limited supply recommended, no mains or safety-critical applications. The comparator activity is educational only; use a dedicated comparator and designed hysteresis for robust switching.
- Source-level checks are required for SVG count, unique IDs, JavaScript references, asset links, directory/sitemap integration and calculator behaviour. Browser rendering, hardware build and measurement verification have not been performed.


## Module 10: The 555 Timer, Timing, Oscillators and Control

- Added `stem-555-timer-timing-oscillators.html` as a standalone lesson following Module 09. The new module replaces the previously planned immediate transition to Power Supplies and Regulation; power supplies remain a later topic.
- Explains the simplified internal architecture: reference divider, trigger and threshold comparators, SR latch, output driver and discharge transistor; includes DIP-8 pinout and the nominal 1/3 VCC and 2/3 VCC thresholds.
- Practical 1: NE555 astable LED flasher with RA = 10 kΩ, RB = 47 kΩ and C = 10 µF; includes timing equations, component list, connection instructions, expected capacitor/output behaviour and an interactive ideal timing calculator.
- Practical 2: NE555 monostable one-shot using R = 100 kΩ and C = 10 µF for an approximately 1.1 s pulse; includes trigger pull-up and momentary active-low trigger arrangement.
- Adds conceptual coverage of bistable latch, Schmitt-trigger hysteresis, control-voltage operation, PWM, VCO, missing-pulse detection, delay, debounce and tone generation.
- Device caveats distinguish bipolar NE555 from CMOS 555 variants. The lesson warns that output drive and operating limits are device-dependent; inductive or motor loads require a suitable external driver and protection.
- Source-level checks should confirm SVG integrity, IDs, calculator references, navigation, directory and sitemap. No browser QA or physical circuit build/measurement has been performed.


## Module 11: Power Supplies and Voltage Regulation

- Added `stem-power-supplies-regulation.html` as a standalone lesson after Module 10, with its own calculator script `js/stem-power.js`.
- Covers the power-supply chain, full-wave bridge rectification, reservoir-capacitor smoothing, ripple frequency, linear regulation, 7805 pinout and bypassing, regulator thermal dissipation, buck-converter operation, line/load regulation, ripple/noise, supply selection and protection considerations.
- Practical 1: regulated 5 V using a 7805 supplied from a current-limited extra-low-voltage DC bench source, with input/output bypass capacitors, load measurement and thermal observation.
- Practical 2: configure and test a commercial adjustable buck module using a current-limited extra-low-voltage DC source; verify output before connecting a load.
- Practical 3: compare regulated supply output under no-load and known resistive load; measure output change and observe temperature.
- Interactive calculators estimate full-wave reservoir capacitance for a target ripple and illustrative 7805 power dissipation/junction temperature. Both disclose simplifying assumptions and the need to check exact component datasheets.
- Safety boundary: no exposed mains construction or direct household-mains experiments. Use certified isolated extra-low-voltage AC sources or current-limited DC bench supplies only; no short-circuit testing by deliberate output shorting.
- Module 10 next navigation, learning directory and sitemap updated. Source-level checks required for SVG integrity, IDs, JS references, page links, and XML structure. No browser rendering or physical hardware testing has been performed.


## Module 12: Power Supply Protection and Battery Systems

- Added standalone lesson page `stem-power-protection-battery-systems.html` and calculator script `js/stem-battery-protection.js`.
- Covers overcurrent and short-circuit protection concepts, fuse coordination, reverse-polarity protection, overvoltage/undervoltage and thermal protection, battery chemistry and ratings, BMS roles and limitations, and series/parallel pack arithmetic.
- Includes labelled functional SVG diagrams for a protected DC power path, series fuse placement, conceptual series-diode polarity protection, and series/parallel battery configurations.
- Added an interactive ideal battery pack calculator for nominal voltage, capacity, energy and cell count, plus an estimated runtime calculator that exposes usable-energy and conversion-efficiency assumptions.
- Practical activities: measure a matching AA-cell series holder, investigate a fused resistive load using a current-limited bench source without deliberate shorting, and inspect a commercial USB power bank with an external USB meter without opening it.
- Safety boundary: no loose lithium-cell parallel experiments, no learner-built lithium pack, no charging/repair/modification of lithium packs, no battery short-circuit tests. Use intact protected commercial packs with their specified chargers, or matched AA cells in a holder for the simple series demonstration.
- Connected Module 11's next-lesson button, added Module 12 to the Electronics Fundamentals directory, corrected malformed nested anchor markup in the Module 10/11 directory sequence, and added the page to the XML sitemap.
- Source-level checks should verify unique IDs, all calculator references, SVG integrity, navigation, directory structure and sitemap XML. No browser rendering, battery-pack validation or physical testing has been performed.


## Module 13: Workshop Practice, Soldering and PCB Fundamentals

- Added standalone lesson page `stem-workshop-soldering-pcb.html` using shared lesson styles and the shared advanced knowledge-check interactions.
- Covers workshop tool selection and setup, bench safety, solderless breadboard versus perfboard/stripboard versus custom PCB, through-hole soldering process, solder-joint quality and defects, unpowered continuity/resistance testing, PCB vocabulary and schematic-to-layout workflow.
- Includes labelled SVG diagrams for workbench setup, breadboard/perfboard/PCB construction, through-hole solder joint cross-section, good/poor/bridged joints, continuity testing and schematic-to-PCB representation.
- Practical activities: solder a low-voltage LED/resistor test board, diagnose a prepared unpowered practice-board fault, and lay out a simple LED/resistor PCB in design software.
- Safety boundaries: effective local fume extraction, eye protection, hot-iron stand and supervision; no live-circuit continuity testing; no mains/high-voltage/high-energy battery/safety-critical PCB design in this beginner lesson. No deliberate shorting of powered circuits.
- Connected Module 12's next-lesson button, added Module 13 to the Electronics Fundamentals directory and XML sitemap.
- Source-level validation should check unique IDs, SVG integrity, balanced section/anchor tags, navigation, directory links and sitemap XML. No browser rendering, soldering process test or PCB fabrication has been performed.


## Module 14: Workshop Measurement and Instrumentation

- Added standalone lesson page `stem-workshop-measurement-instrumentation.html` with separate responsive stylesheet `assets/css/stem-instrumentation.css` and calculator script `js/stem-instrumentation.js`.
- Covers digital multimeter sockets and functions; voltage measurement in parallel; current measurement in series; resistance and continuity only on de-energised circuits; diode-test limitations; resolution, accuracy, precision and uncertainty.
- Explains oscilloscope volts/div, time/div, peak-to-peak voltage, period, frequency, triggering, probe attenuation and earth-referenced probe-ground hazards.
- Introduces signal-generator setup, amplitude/load conventions and controlled low-voltage circuit testing.
- Includes labelled SVG diagrams for generic DMM front panel/sockets, voltmeter and ammeter connections, resistance and continuity tests, oscilloscope display/probe connection, and signal-generator test setup.
- Includes interactive teaching calculators for approximate DMM display resolution and converting oscilloscope divisions into voltage, period and frequency.
- Practical activities: verify a low-voltage resistor network with a DMM; observe a low-voltage function-generator waveform using an oscilloscope; locate a prepared open connection on an unpowered practice board.
- Safety boundaries explicitly prohibit mains/high-energy beginner activities, current-mode measurement directly across a source, resistance/continuity tests on powered circuits, and unsafe use of grounded oscilloscope probe clips. Activities require isolated extra-low-voltage sources and equipment-specific manuals.
- Connected Module 13's next-lesson navigation to Module 14, added Module 14 to the Electronics Fundamentals directory and XML sitemap.
- Corrected malformed nested anchor markup around the Module 12 and Module 13 directory cards so each card is a separate link.
- Source-level checks should verify unique IDs, JavaScript element references, SVG/section/anchor balance, navigation, directory and sitemap entries. These checks do not constitute browser QA or physical instrument testing.
- No browser rendering, oscilloscope operation, DMM calibration, or physical workshop testing has been performed.


## Module 15: Analog Sensors and Signal Conditioning

- Added standalone lesson `stem-analog-sensors-signal-conditioning.html`, stylesheet `assets/css/stem-sensors.css` and interactive script `js/stem-sensors.js`.
- Covers sensor families and output types; LDR and NTC thermistor behaviour; resistive sensor voltage dividers; divider orientation and output polarity; ADC conversion, resolution and input constraints; RC low-pass filtering; buffering, amplification, protection, calibration and linearisation.
- Includes labelled SVG diagrams for the sensing/control chain, LDR and NTC symbols, resistive divider, ADC quantisation, RC low-pass filter, Arduino LDR input and Arduino-controlled indicator LED.
- Interactive tools calculate divider output/current/power for either sensor orientation, ideal ADC code estimates and first-order RC time constant/cutoff frequency.
- Practical activities: measure an LDR divider and compare illumination readings; build an Arduino automatic night light with software hysteresis; measure an NTC thermistor response; compare filtered and unfiltered sensor signals.
- Includes Arduino sketches, component lists, connection instructions, expected observations, troubleshooting and a knowledge check.
- Safety boundaries: use extra-low-voltage circuits; check sensor dissipation and board ADC limits; use current-limited LED indicators; no use of hobby LDR/thermistor sensors as sole life-safety detectors; no hazardous heat/flame or mains activities.
- Connected Module 14's next-lesson navigation, added Module 15 to the Electronics Fundamentals directory and XML sitemap.
- Source-level validation should check unique IDs, JS references, SVG/section/anchor balance, directory and sitemap links. No browser rendering, sensor calibration or physical Arduino test has been performed.


## Module 16: Digital Sensors and Communication Interfaces

- Added standalone lesson `stem-digital-sensors-communication-interfaces.html`, responsive stylesheet `assets/css/stem-digital.css` and interactive UART estimator `js/stem-digital.js`.
- Covers digital switching, pulse/timing and serial data outputs; logic voltage thresholds; push-pull and open-drain outputs; pull-up/pull-down concepts; and voltage-level compatibility.
- Explains I²C START/address/ACK/data/STOP concepts, shared SDA/SCL topology, addressing, pull-up selection and bus capacitance; SPI SCLK/MOSI/MISO/chip-select; and asynchronous UART framing, crossed TX/RX wiring and baud agreement.
- Includes labelled SVG diagrams for digital waveforms, pull-up button input, shared I²C bus, SPI topology, UART wiring and Arduino Uno-to-I²C-breakout example.
- Practical activities include an Arduino I²C scanner, an example BME280 I²C sensor read sketch with explicit breakout/address caveats, UART serial communication examples, and a datasheet-led sensor interface inspection.
- Interactive UART frame-time estimator calculates ideal wire time and throughput from baud rate, frame bits and byte count.
- Troubleshooting covers missing I²C acknowledgements, address conflicts, bus capacitance, UART framing, SPI mode/chip-select and floating inputs.
- Safety boundaries: verify exact module pinout, supply and logic voltage; use level shifting where required; never apply unchecked 5 V to 3.3 V-only pins; do not connect RS-232 directly to logic UART; keep practicals extra-low voltage and use ESD precautions.
- Connected Module 15's next-lesson navigation, added Module 16 to the Electronics Fundamentals directory and XML sitemap.
- Source-level validation should check unique IDs, JavaScript references, SVG/section/anchor balance, links and sitemap XML. No browser rendering, sensor hardware test, I²C bus measurement or physical Arduino test has been performed.


## Module 17: Microcontrollers and Embedded Programming

- Added standalone lesson `stem-microcontrollers-embedded-programming.html`, responsive stylesheet `assets/css/stem-microcontrollers.css` and page script `js/stem-microcontrollers.js`.
- Covers microcontroller architecture and embedded systems; CPU, Flash, RAM, GPIO and peripheral roles; reset and firmware execution; Arduino setup/loop structure; digital inputs and outputs; ADC, PWM and hardware timers; cooperative non-blocking timing with `millis()`; interrupts and ISR constraints; memory types, data widths and overflow; reliability and firmware debugging.
- Includes labelled SVG diagrams for MCU architecture, program execution, GPIO connections, ADC/PWM behaviour, interrupt flow and a potentiometer/button/PWM-LED practical.
- Practical build combines an analogue potentiometer input, active-low button with internal pull-up, software debounce, PWM LED output and serial observations. The sketch is explicitly scoped to a classic 5 V Uno-compatible board; other boards may differ in ADC resolution, PWM API, voltage and pin capabilities.
- Includes example code for GPIO input, non-blocking LED timing and an external interrupt event counter, with limitations and platform-specific pin/API caveats.
- Safety boundaries: keep activities extra-low voltage; observe MCU pin voltage/current and absolute maximum ratings; do not drive motors, relays or other external loads directly from GPIO; use appropriate drivers and protection; check exact board/device datasheets.
- Connected Module 16's next-lesson navigation, added Module 17 to the Electronics Fundamentals directory and XML sitemap.
- Source-level validation should check unique IDs, script references, SVG/section/anchor balance, previous/next navigation, directory links and sitemap XML. No browser rendering, board upload or physical hardware test has been performed.


## Module 18: Embedded Systems Design and Real-Time Control

- Added standalone lesson `stem-embedded-systems-real-time-control.html`, responsive stylesheet `assets/css/stem-embedded-design.css` and interactive task timing estimator `js/stem-embedded-design.js`.
- Covers requirements engineering, embedded-system architecture, layered firmware responsibilities, finite-state machines, real-time correctness, hard/soft real-time concepts, latency, jitter, timing budgets, cooperative superloops, RTOS trade-offs, watchdogs, fault detection, safe-state design, feedback control and verification.
- Includes labelled SVG diagrams for system architecture, firmware layers, an operating-state machine, timing budget, fault/recovery path, closed-loop control and the practical pedestrian-crossing controller.
- Practical project: extra-low-voltage Arduino tabletop pedestrian-crossing sequence using three indicator LEDs and a request button. Uses an explicit FSM and non-blocking millis()-based timing. Clearly labelled as educational only, not suitable for real road traffic or safety-critical control.
- Interactive task estimator calculates single-task utilisation, remaining period slack and whether a task's execution time exceeds its period. It explicitly excludes other tasks, interrupts, blocking and scheduling overhead.
- Includes requirements checklist, task scheduling comparison, watchdog limitations, hardware-independent protection guidance, testing methods, troubleshooting concepts and knowledge check.
- Safety: practical is LED-only and extra-low-voltage; never use the sketch for actual traffic signals, machinery or life-safety control. Define safe states for the physical hazard and use independent hardware protection where required.
- Connected Module 17's next-lesson navigation, added Module 18 to the Electronics Fundamentals directory and XML sitemap.
- Source-level validation should check unique IDs, script references, SVG/section/article/anchor balance, previous/next navigation, directory link and sitemap XML. No browser rendering, Arduino upload, timing measurement or physical hardware test has been performed.


## Module 19: Digital Control, Motor Control and Feedback Systems

- Added standalone lesson `stem-digital-control-motor-feedback.html`, responsive stylesheet `assets/css/stem-motor-control.css` and client-side teaching calculators `js/stem-motor-control.js`.
- Covers PWM duty cycle and its limits as a motor-speed proxy; H-bridge current paths, direction, coast/braking concepts and shoot-through; encoder pulse measurement and quadrature direction; open-loop versus closed-loop control; proportional, integral and derivative actions; PI/PID tuning considerations, saturation and integral windup; driver and motor selection.
- Includes labelled SVG diagrams for the overall motor-control architecture, PWM waveform, conceptual H-bridge, quadrature encoder signals, open-loop and closed-loop control, and the Arduino/motor-driver/encoder practical wiring overview.
- Interactive tools calculate ideal PWM duty-cycle average voltage and illustrate how feedback correction can reduce a static disturbance. Both are explicitly labelled as teaching models, not motor or dynamic PID simulations.
- Practical project: extra-low-voltage encoder-equipped DC gearmotor controlled through a TB6612FNG-based H-bridge breakout. Includes a component list, pin map, separate motor and logic supplies, common-ground guidance, current/thermal selection cautions, an Arduino single-channel encoder speed measurement and basic fixed-period PI example, observation tasks and troubleshooting.
- The sketch requires the learner to set the actual encoder pulses per output-shaft revolution and verify encoder voltage, interrupt edge and motor/driver compatibility. It is an educational starting point, not production or safety-critical firmware.
- Safety boundaries: no direct motor connection to GPIO; use current-limited extra-low-voltage supplies; check motor stall current and driver continuous/peak/thermal ratings; secure the motor and keep clear of moving parts; no deliberate stall or short-circuit testing; no use in safety-critical machinery or vehicles.
- Connected Module 18's next-lesson button, added Module 19 to the Electronics Fundamentals directory and XML sitemap.
- Source-level checks are required for unique IDs, JavaScript references, SVG/section/anchor balance, page navigation, directory and sitemap integrity, and calculator edge cases. No browser rendering, Arduino upload, motor/encoder measurement or physical hardware verification has been performed.


## Module 20: Robotics and Mechatronic Systems

- Added standalone lesson `stem-robotics-mechatronic-systems.html`, responsive stylesheet `assets/css/stem-robotics.css` and client-side differential-drive calculator `js/stem-robotics.js`.
- Covers mechatronic system architecture; mechanical, electrical, sensing, control and integration responsibilities; differential-drive, car-like, tracked and articulated robot configurations; wheel kinematics; encoders and odometry; IMU and proximity/reflectance sensing; layered robot software and state-machine behaviour.
- Includes labelled SVG diagrams for robot system architecture, differential-drive geometry, layered robot software, rover sensor/chassis layout and practical subsystem wiring.
- Interactive kinematics calculator estimates centre-line speed, yaw rate, turning radius and motion direction from wheel diameter, track width and signed left/right wheel RPM. It explicitly assumes ideal no-slip rolling and warns that real systems differ.
- Practical project: extra-low-voltage three-sensor line-following differential-drive rover. Includes component list, wiring map for an Arduino Uno-compatible board and TB6612FNG-style driver, sensor polarity assumptions, example firmware, staged testing/calibration and extension challenges for encoder odometry, obstacle-aware behaviour and wheel-speed balancing.
- Firmware stops when the line is lost or sensor pattern is ambiguous rather than driving blindly. Learners are instructed to verify sensor polarity, motor direction, driver compatibility and current/thermal ratings on their actual hardware.
- Safety boundaries: protected extra-low-voltage supplies, no direct motor-to-GPIO connection, secure chassis and lifted-wheel initial tests, moving-part precautions, no deliberate stall/short-circuit testing and no safety-critical use.
- Connected Module 19's next-lesson button, added Module 20 to the Electronics Fundamentals directory and XML sitemap.
- Source-level validation passed: JavaScript syntax valid; no duplicate IDs or missing JavaScript element references; four SVG diagrams, ten sections, 26 articles and 14 anchors are balanced; native HTML contains no DIL-only components; equation markup is corrected; Module 19/20 navigation, single directory entry and single sitemap entry are present; sitemap URL elements are balanced. Calculator defaults produce the expected straight-line example (65 mm wheels, 150 mm track, 100 RPM each side). No browser rendering, robot assembly, line-sensor calibration or physical hardware testing has been performed.


## Module 21: Robotics Sensors, Navigation and Autonomy

- Added standalone lesson `stem-robotics-sensors-navigation-autonomy.html`, responsive stylesheet `assets/css/stem-autonomy.css` and client-side teaching calculators `js/stem-autonomy.js`.
- Covers autonomous sense–estimate–plan–act loops; reactive, deliberative and hybrid behaviour; ultrasonic, IR, time-of-flight, encoder, IMU, camera, lidar and GNSS sensing; sensor selection and limitations; sensor fusion, uncertainty, timestamps and confidence; localisation, coordinate frames, odometry, occupancy grids and SLAM; route planning and obstacle avoidance including wall following, breadth-first search, Dijkstra and A*.
- Includes labelled SVG diagrams for the autonomy loop, robot pose and coordinate frame, conceptual grid route with obstacle, and practical obstacle-aware rover system layout.
- Interactive teaching calculators demonstrate a two-reading weighted range estimate and idealised stopping distance including latency and margin. Both clearly state their assumptions and limitations; neither is a certified estimator or safety calculation.
- Practical project extends the Module 20 differential-drive rover with an ultrasonic distance sensor and reactive stop/turn behaviour. Includes parts and compatibility checks, example connection map, Arduino control-logic sketch with hardware-specific motor-driver placeholders, staged test plan and extension challenges for scanning, encoder turns, state machines, sensor fusion and grid planning.
- Safety boundaries: use extra-low-voltage supplies, verify sensor logic levels and echo voltage, keep motor current out of GPIO, test with wheels lifted before slow bounded-area trials, retain a reachable stop switch and spotter, and never use hobby robotics code/sensors for road vehicles or safety-critical collision prevention.
- Connected Module 20's next-lesson navigation, added Module 21 to the Electronics Fundamentals directory and XML sitemap.
- Source-level validation: verify unique IDs, JavaScript references, SVG/section/anchor balance, script/style links, navigation, directory and sitemap XML. No browser rendering, sensor calibration, Arduino upload or physical rover testing has been performed.

- Module 21 source-level validation completed: no duplicate HTML IDs, all calculator element references exist, four SVGs and ten sections are balanced, lesson anchors are balanced, CSS/JS assets are linked, Module 20 next navigation is connected, and the directory and sitemap each contain exactly one Module 21 entry. Sitemap URL elements are balanced. This is source inspection only; no browser rendering, Arduino compile/upload, sensor calibration or physical rover test was performed.


## Module 22: Wireless Communication and IoT Systems

- Added standalone lesson stem-wireless-communication-iot.html, responsive stylesheet assets/css/stem-iot.css and client-side telemetry teaching model js/stem-iot.js.
- Covers IoT architecture and device roles; Wi-Fi, Bluetooth Classic/BLE, Zigbee, Thread, LoRa/LoRaWAN and cellular trade-offs; access points, IP addressing, DHCP, DNS, routing and local-versus-internet connectivity; HTTP, MQTT publish/subscribe, WebSocket and telemetry payloads.
- Includes labelled SVG diagrams for the IoT data path, local Wi-Fi network and ESP32 potentiometer wiring; interactive telemetry payload/data-rate estimator; and a practical ESP32 local HTTP sensor dashboard with Arduino sketch, staged test plan, troubleshooting and extension challenges.
- Practical uses a 10 kΩ potentiometer between 3.3 V and GND, wiper to an ADC-capable ESP32 input (GPIO34 on common original ESP32 boards). ADC scaling is explicitly approximate and board-specific.
- Security guidance covers credential handling, authentication, encryption, permissions, network isolation, stale telemetry, offline behaviour and safe command validation. The unauthenticated example is restricted to a trusted isolated learning network and must not be exposed publicly.
- Connected Module 21 previous/next lesson navigation, added Module 22 to the Electronics Fundamentals directory and XML sitemap.
- Source-level checks required: unique IDs, local CSS/JS links, JavaScript DOM references, SVG/section/anchor balance, quiz markup, navigation, directory entry and sitemap XML. No browser rendering, Arduino compilation/upload, Wi-Fi network test or physical ESP32 test has been performed.

- Final Module 22 cross-check: Module 21 next-lesson button now links to Module 22. Module 22 JavaScript parses successfully; no duplicate IDs or missing JavaScript element references; three SVGs, ten sections and anchors are balanced; four shared-format quiz cards with twelve answer buttons are present; directory and sitemap each contain one entry; sitemap URL tags are balanced. These are source-level checks only.


## Electronics Fundamentals directory: search and category filters

- Updated stem-electronics-fundamentals.html with a live search field, category selector, clear-filters action, live result count and accessible no-results message.
- Categorised all 22 module cards into Circuit foundations (Modules 01–10), Power and workshop (11–14), Sensors and embedded systems (15–18), Control and robotics (19–21), and Wireless and IoT (22).
- Added responsive styling in assets/css/stem-directory.css and client-side filtering in js/stem-directory.js. Search matches module card text, including module number, title and lesson description; category and text filters combine.
- Source validation: 22 module cards categorised, expected category counts 10/4/4/3/1, no invalid categories or duplicate IDs, JavaScript parses, stylesheet braces balance, CSS and JS assets are linked. Browser/device rendering has not been independently tested.


## Module 23: Integrated Circuits and Logic Gates

- Added standalone lesson `stem-integrated-circuits-logic-gates.html`, responsive stylesheet `assets/css/stem-logic.css` and client-side truth-table teaching model `js/stem-logic.js`.
- Covers IC construction and package orientation; DIP pin numbering; logic HIGH/LOW voltage ranges; floating CMOS inputs and bypass capacitors; AND, OR, NOT, NAND, NOR, XOR and XNOR; Boolean expressions; truth tables; common 74HC logic ICs; combining conditions; troubleshooting and safe low-voltage practice.
- Includes labelled SVG diagrams for an IC package, DIP-14 pin numbering, conceptual logic-level bands, pull-down input wiring, six logic-gate symbols, a 74HC08 pin map, a practical two-button AND-gate circuit and a combined logic example.
- Practical build uses a 74HC08 at regulated 5 V, two normally-open pushbuttons, 10 kΩ pull-down resistors, 1 kΩ LED resistor and 100 nF supply bypass capacitor. The first AND gate uses pins 1 and 2 as inputs and pin 3 as output; pin 14 is VCC and pin 7 is GND. Exact device datasheet verification is required.
- Interactive model lets learners select AND, OR, NOT, NAND, NOR, XOR or XNOR, toggle input states and inspect the corresponding truth table. It is explicitly a Boolean teaching model, not an electrical IC emulator.
- Safety boundaries: use regulated, current-limited extra-low-voltage supply; disconnect power before rewiring; define all CMOS inputs; do not drive external loads directly from logic outputs or use hobby logic for safety-critical systems.
- Connected Module 22 next-lesson navigation, added Module 23 to the Electronics Fundamentals directory and XML sitemap. Directory counts now reflect 23 lessons, with Module 23 in Circuit foundations.
- Source-level checks required: unique IDs, JavaScript DOM references and syntax, SVG/section/anchor balance, quiz structure, local asset links, previous/next navigation, directory filters/count and sitemap XML. No browser rendering, IC bench test or hardware validation has been performed.



## Module 24: Combinational Logic Design

- Added standalone lesson `stem-combinational-logic-design.html`, responsive stylesheet `assets/css/stem-combinational.css` and interactive truth-table teaching model `js/stem-combinational.js`.
- Covers combinational versus sequential logic, design workflow, Boolean identities, De Morgan's theorems, expression simplification, two-variable Karnaugh-map introduction, NAND/NOR universal-gate constructions, multiplexers, decoders, encoders and half/full-adder concepts.
- Interactive design bench allows learners to select AND, OR, XOR, NAND, NOR, XNOR or a defined 2:1 multiplexer example, toggle inputs and inspect a generated truth table. It is labelled as a logic teaching model, not an electrical IC emulator.
- Practical build implements a one-bit half adder using a 74HC86 XOR gate for SUM and a 74HC08 AND gate for CARRY. Both ICs use their first gate (pins 1 and 2 inputs, pin 3 output), pins 14/7 for supply/ground, local 100 nF bypass capacitors, two button inputs with 10 kΩ pull-down resistors and two LED indicators with 1 kΩ series resistors.
- Includes labelled SVGs for design workflow, De Morgan equivalences, a Boolean gate combination, universal-gate examples, MUX/decoder/encoder/half-adder blocks, half-adder logic and DIP-14 pin connections; includes wiring instructions, expected observations, test procedure, troubleshooting and four knowledge-check questions.
- Safety: use regulated current-limited extra-low-voltage supply, verify exact manufacturer pinouts and voltage limits, define all CMOS inputs, disconnect power before rewiring and do not drive motors/relays directly from logic outputs.
- Connected Module 23 next-lesson navigation, added Module 24 to the Circuit foundations directory category and XML sitemap.
- Source-level checks: verify unique IDs, all JS DOM references, JS syntax, SVG/section/anchor balance, quiz structure, responsive CSS, navigation, directory category/search and sitemap XML. No browser rendering, breadboard assembly, IC bench test or physical hardware validation has been performed.


## Module 25: Sequential Logic, Flip-Flops and Digital Memory

- Added standalone lesson `stem-sequential-logic-flip-flops-memory.html`, responsive stylesheet `assets/css/stem-sequential.css` and interactive teaching models in `js/stem-sequential.js`.
- Covers combinational versus sequential systems, state, active-HIGH NOR SR latch behaviour and forbidden input combination, D/JK/T/SR flip-flops, positive-edge triggering, asynchronous preset/clear concepts, setup/hold time, propagation delay, clock skew, metastability, debouncing, ripple/synchronous counters, clock division, shift registers and registers.
- Interactive flip-flop bench supports D, JK, T and active-HIGH SR teaching models with selectable inputs, manual rising-edge action, reset and generated next-state tables. It explicitly does not model analogue timing, metastability or a specific IC.
- Interactive modulo-4 counter visualises two-bit binary state, clock steps, reset and LED indicators.
- Practical build: synchronous two-bit counter using a 74HC74 dual positive-edge D flip-flop and 74HC86 XOR gate. Next-state logic is D0 = Qbar0 and D1 = Q1 XOR Q0, with both flip-flops sharing a clock. Includes DIP-14 pin-level wiring, active-LOW asynchronous clear/preset handling, 100 nF local bypass capacitors, LED outputs, optional slow 555 clock, expected 00→01→10→11→00 sequence, test procedure and troubleshooting.
- Safety/implementation notes: use regulated current-limited extra-low-voltage supply; verify exact device pinout, voltage and timing ratings; never float CMOS inputs; keep active-LOW asynchronous control pins at valid inactive HIGH; do not assert preset and clear simultaneously; do not use a raw bouncing button as a clock without debouncing.
- Connected Module 24 next-lesson navigation, added Module 25 to the Circuit foundations directory category and XML sitemap.
- Source-level checks: duplicate IDs, JavaScript DOM references and syntax, SVG/section/anchor balance, quiz structure, CSS braces, directory count/category, sitemap XML, previous/next navigation. No browser rendering, breadboard assembly, IC bench test or physical timing verification has been performed.


## Module 26: Digital Displays, Keypads and Human Interfaces

- Added standalone lesson `stem-digital-displays-keypads-interfaces.html`, responsive stylesheet `assets/css/stem-interface.css` and interactive models in `js/stem-interface.js`.
- Covers human-machine interface roles; seven-segment LED anatomy and segment labels; common-anode/common-cathode operation; segment patterns; current limiting; multiplexing and ghosting; 4511, 74HC595 and integrated display-driver roles; matrix keypad scanning, pull-ups, debouncing and ghosting; character LCD and graphical OLED selection; usability and accessibility principles.
- Interactive seven-segment model selects digits 0–9 and displays the active segments and common-cathode hexadecimal pattern, with common-anode logic convention explained. Interactive keypad/LCD model accepts up to 16 key characters, supports backspace/clear/send and displays simulated feedback. Both are conceptual teaching models, not electrical hardware emulators.
- Practical build: Arduino Uno-compatible 5 V board, 4×4 matrix keypad and 16×2 I²C LCD. Includes row/column-to-pin mapping, I²C wiring, Keypad and LiquidCrystal_I2C library notes, editable example sketch, demo-code validation, test procedure, expected behaviour and troubleshooting.
- Security note: the hard-coded demonstration code is educational only, not secure access control. Real systems require secure credential handling and an appropriate security design. Board voltage, I²C pins/address, LCD backpack compatibility and library API must be verified for actual hardware.
- Connected Module 25 next-lesson navigation, added Module 26 to the Circuit foundations directory category and XML sitemap.
- Source-level checks: unique HTML IDs, JS element references and syntax, SVG/section/article/anchor balance, quiz structure, responsive CSS braces, directory count/category, sitemap XML and previous/next navigation. No browser rendering, Arduino compilation/upload, keypad scan test or LCD hardware test has been performed.


## Confirmed closing curriculum sequence (Modules 24–29)

The user reconfirmed the agreed finite ending sequence. This is the authoritative roadmap; do not replace Module 27 with a separate serial-communications module or extend the sequence without explicit user agreement.

- **24. Combinational Logic Design:** Design useful logic circuits.
- **25. Sequential Logic and Digital Memory:** Understand state, timing and memory.
- **26. Digital Displays and Human Interfaces:** Build practical input/output interfaces. The implemented lesson includes keypad scanning, seven-segment displays, LCDs and OLEDs.
- **27. DAC and Signal Generation:** Connect digital and analogue systems. This is the next module to implement.
- **28. Electronics Product Design:** Integrate circuits into usable products.
- **29. Continue Your Journey with EazyLife:** Transition from free learning to guided training, clearly presenting optional paid guidance, masterclasses and project-specific support without withholding useful free learning.

Module 26's upcoming navigation now points to Module 27: DAC and Signal Generation. Modules 27–29 are planned, not yet implemented.


## Module 27: DAC and Signal Generation

- Added standalone lesson \`stem-dac-signal-generation.html\`, responsive stylesheet \`assets/css/stem-dac.css\` and interactive teaching models in \`js/stem-dac.js\`.
- Covers DAC operation, digital codes and quantisation, ideal resolution, R-2R resistor ladders, PWM versus true DAC output, RC low-pass filtering, waveform properties, sampling, microcontroller DAC availability, oscilloscope measurement and troubleshooting.
- Interactive tools: configurable ideal DAC resolution/code-to-voltage explorer; four-bit R-2R code explorer; PWM/RC average, time-constant and cutoff estimator; sine, square, triangle and sawtooth waveform model with sample-rate and clipping feedback.
- Practical A: original ESP32 DAC1 sine-wave output on GPIO25 using a 64-sample lookup table and nominal 2 kHz sample rate. The page distinguishes original ESP32 and ESP32-S2 DAC support from ESP32-S3/C3/C6 variants without the same general-purpose DAC peripheral. Verify the exact SoC and board pinout.
- Practical B: Arduino Uno R3 PWM output through a passive RC low-pass filter, explicitly labelled as a smoothed PWM approximation rather than a true DAC.
- Includes labelled SVGs, component lists, wiring guidance, Arduino sketches, oscilloscope test procedure, expected observations, troubleshooting and four shared-format knowledge-check questions.
- Safety: extra-low-voltage only; scope ground clip only to verified circuit ground; no household mains, inverter output or unknown floating circuits; do not exceed GPIO ratings or drive low-impedance loads directly.
- Connected Module 26 next navigation to Module 27, added Module 27 to the Circuit foundations directory category and XML sitemap. Directory count now reflects 27 modules.
- Official Espressif Arduino-ESP32 documentation checked for DAC availability and pin mapping: original ESP32 uses GPIO25/26; ESP32-S2 uses GPIO17/18; availability differs across SoC variants. Sources: https://docs.espressif.com/projects/arduino-esp32/en/latest/api/dac.html and https://docs.espressif.com/projects/arduino-esp32/en/latest/libraries.html
- Source-level checks passed: JavaScript syntax; 38 unique HTML IDs with no duplicates; no missing JavaScript DOM references; 12/12 sections, 6/6 SVGs and 18/18 articles balanced; four quiz cards with twelve answer buttons; CSS braces balanced; local CSS/JS references present; Module 26 next and Module 27 previous/Module 28 preview navigation correct; 27 directory module cards with the displayed 27/27 count; Module 27 appears once in the directory and once in the sitemap; sitemap URL tags balanced. No browser rendering, Arduino compilation/upload, oscilloscope measurement or physical DAC/PWM hardware test has been performed.

## Confirmed finite ending and Module 29 presentation direction

The user reconfirmed that the learning series ends at Module 29, with no Module 30 or additional lessons. Module 29 should not read like an obvious advertisement. It should contain useful project-based training direction and practical next-step examples, then close the series naturally. Any optional EazyLife guidance/training invitation should be subtle and secondary to the learning content. The final lesson navigation and final paragraph should communicate that the published series is complete; no next lesson button or further lesson teaser should appear after Module 29.
