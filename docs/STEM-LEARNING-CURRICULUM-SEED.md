# EazyLife STEM Lab: Curriculum and Engineering Portfolio Seed

Date: 2026-11-20
Status: Reference input for product architecture and future content planning

## Purpose

This document records the proposed 20-session STEM, electronics, embedded systems and robotics syllabus, together with EazyLife's engineering project portfolio, as source material for the open-access STEM Lab.

These materials guide topic selection, examples, practical activities and advanced case studies. They are not a mandatory course sequence and do not limit the platform to the exact sessions or projects listed here.

The product remains an open-access learning platform for independent learners and hobbyists. Learners can enter through individual topics, experiments, tools, builds or challenges. Prerequisites may be recommended where useful, but modules remain independently discoverable.

## Product principles

- Teach underlying principles before and alongside project assembly.
- Connect theory to observable behaviour, calculations, circuit construction, code and real applications.
- Distinguish a conceptual explanation, a simplified behavioural model, a hardware-specific simulation and a physical experiment.
- Do not imply that a browser model is an exact simulation of a real component or circuit unless that fidelity has been validated.
- Offer practical alternatives for learners with basic tools. A module should identify what can be done with a breadboard, ordinary soldering iron and multimeter, and what requires specialist equipment.
- Treat the syllabus as a content source, not a compulsory timetable.
- Use EazyLife's project portfolio as evidence of possible engineering applications, not as a claim that every project is suitable for beginners or should be replicated by learners.

## Learning domains and content map

### 1. Electrical foundations and component literacy

Seed topics:
- Electricity, voltage, current, resistance, conductors and insulators.
- AC and DC concepts and safe low-voltage sources.
- Circuit symbols and elementary circuit interpretation.
- Resistor identification and colour codes.
- LED polarity and component orientation.
- Capacitors, inductors, diodes, transistors, switches and potentiometers.
- Series and parallel circuits.
- Breadboard layout and electrical connections.
- Digital multimeter functions: DC voltage, resistance, continuity and carefully supervised low-voltage current measurement.
- Battery configurations, polarity and basic troubleshooting.

Practical activities:
- Identify and classify real components.
- Read resistor colour bands and compare with a multimeter.
- Identify capacitor polarity and diode orientation.
- Build LED circuits and investigate resistor changes.
- Construct series/parallel arrangements.
- Measure battery voltage, resistance and continuity.

### 2. Workshop practice and circuit fabrication

Seed topics:
- Electronic tools and workshop practice.
- Soldering iron/station handling, temperature, flux and solder.
- Through-hole placement, joint quality and inspection.
- Desoldering with a pump and braid.
- Breadboard, perfboard, stripboard and PCB distinctions.
- Component positioning, polarity, continuity and fault correction.
- Transferring a tested breadboard circuit to a permanent assembly.

Practical activities:
- Solder practice joints and inspect them.
- Correct poor joints and practise desoldering.
- Build a permanent LED indicator or low-voltage transistor switch.
- Compare breadboard and perfboard implementations.

Safety:
- Soldering requires ventilation, heat-safe work surfaces, eye protection where appropriate and safe handling of hot tools.
- Learner-facing guides must describe supervision and safe tool handling at the appropriate level.

### 3. Analog electronics and semiconductor circuits

Seed topics:
- Voltage dividers and potentiometers.
- Capacitor types, charging/discharging and RC time constants.
- Inductors and magnetic fields.
- Diode forward/reverse bias and rectification.
- NPN/PNP transistors as switches.
- 555 timer circuits and timing.
- LDRs, thermistors and other resistive sensors.
- Transistor-based automatic switching and relay fundamentals.

Practical activities:
- Build voltage dividers and compare measured values.
- Investigate capacitor charge/discharge behaviour.
- Test diodes with a multimeter.
- Build a transistor-controlled LED and automatic night light.
- Explore low-voltage relay switching with suitable driver and protection.
- Build a 555-based LED flasher.

### 4. Electrical power and power electronics

Seed topics:
- Batteries and DC sources.
- Transformer operating principles using isolated, low-voltage educational equipment.
- Half-wave, full-wave and bridge rectification.
- Smoothing, ripple and capacitor filtering.
- LC filtering principles.
- Linear regulation and regulated DC supplies.
- SMPS block-level operation and switching concepts.
- Buck and boost converter principles.
- Rechargeable batteries, charging, protection, capacity, power and energy.
- Low-voltage energy measurement.

Practical activities:
- Compare rectifier output concepts and waveforms using appropriate isolated low-voltage sources.
- Compare filtered and unfiltered low-voltage rectified output.
- Demonstrate regulation with suitable modules.
- Measure voltage/current/energy on low-voltage DC loads.
- Compare battery ratings and discuss protection.

Advanced case-study topics:
- UC3845-based SMPS and boost converter architecture.
- DC-to-AC inverter architecture.
- Laptop power bank design considerations.
- Three-phase priority changeover and IoT-assisted changeover at a block-diagram and control-logic level.
- Energy meter architecture and measurement principles.

Safety boundary:
- Mains-connected circuits, transformerless/non-isolated supplies, high-voltage multipliers, inverters and exposed high-energy storage are not ordinary learner breadboard activities. Teach relevant principles through diagrams, calculations, isolated low-voltage equivalents, enclosed commercial equipment and instructor-led demonstrations where suitable.
- The non-isolated capacitive-dropper example is explicitly a hazard-awareness case study, not a recommended build. Its output must never be presented as safe or isolated.
- Do not provide step-by-step construction instructions for shock devices or weapons. A voltage-multiplier discussion may be framed around benign, low-energy educational demonstrations and electrical safety.
- Any physical power-electronics activity needs explicit voltage, current, isolation, stored-energy and supervision requirements.

### 5. Programming and embedded systems

Seed topics:
- Algorithms, instructions, variables and data types.
- Digital and analog inputs/outputs.
- Conditions, loops, functions, timing and debugging.
- Arduino programming and the relationship between code and hardware.
- Microcontroller architecture and pin behaviour.
- Serial Monitor and sensor data acquisition.
- Sensor-triggered control.
- LCD and other displays.
- Bluetooth, Wi-Fi, ESP32 and introductory GSM/SMS concepts.
- Basic IoT monitoring and control.

Practical activities:
- LED control and potentiometer reading.
- Conditional output control.
- Traffic light and pedestrian button sequence.
- Read LDR, PIR and ultrasonic sensors.
- Build a simple alarm or automatic response.
- Display temperature/humidity data on an LCD.
- Demonstrate Bluetooth control and ESP32 Wi-Fi monitoring.
- Treat SIM800L as a guided demonstration unless power and network requirements are properly supported.

### 6. Sensors, automation and control

Seed topics:
- Sensor principles and signal conditioning.
- IR/proximity, PIR, ultrasonic, LDR, thermistor, temperature/humidity and gas/smoke sensing.
- Thresholds, setpoints, input/processing/output.
- Open-loop and closed-loop systems.
- Feedback and basic control logic.
- Relays, transistor/MOSFET drivers and inductive-load protection.
- Pumps, fans, valves and other actuators.
- Power budgeting and separate actuator supplies.

Practical activities:
- Automatic night light.
- Touchless pump/dispensing prototype using safe low-voltage water arrangements.
- Temperature/humidity display and warning.
- Gas/smoke sensor response demonstration with clear limitations; do not present hobby modules as certified life-safety detectors.
- Automatic fan or pump control.
- Compare open-loop and sensor-feedback behaviour.
- PID and advanced mathematical control are outside the stated beginner programme; later optional modules can introduce control more deeply.

### 7. Motors, robotics and mechatronics

Seed topics:
- DC geared motors, servo motors and stepper motors.
- Motor drivers, direction control and PWM speed control.
- Current requirements and motor power sources.
- Mechanical linkages, gears, chassis and mounting.
- Robot subsystems: controller, sensors, actuators and structure.
- Ultrasonic obstacle detection and basic navigation.
- Robotics integration, testing and troubleshooting.

Practical activities:
- Control motor direction and speed.
- Position a servo and demonstrate stepper movement.
- Assemble a two-wheel robot.
- Add ultrasonic obstacle detection.
- Build or investigate simple conveyor, drawing and pick-and-place mechanisms as more advanced examples.

### 8. Wireless systems and connected devices

Seed topics:
- Wired and wireless communication.
- HC-05 Bluetooth pairing and commands.
- ESP32 Wi-Fi and Bluetooth.
- Basic web-control and sensor monitoring.
- GSM/SMS alert architecture.
- Combining communication with sensors and actuators.
- Power supply, reliability, network and security considerations.

Practical activities:
- Bluetooth LED or motor control.
- ESP32 local web-control or monitoring.
- Wireless sensor readings.
- Instructor-led GSM/SMS alert demonstration.
- Integrated wireless automation challenge.

### 9. Engineering design and innovation

Seed topics:
- Problem identification and requirements.
- System block diagrams and component selection.
- Circuit design, mechanical design and programming.
- Prototyping, testing, troubleshooting and iteration.
- Technical documentation, teamwork and presentation.
- Safe, responsible and honest engineering claims.

Capstone possibilities drawn from the syllabus:
- Automatic hand-washing/water dispensing prototype.
- Automatic night light.
- Environmental monitoring station.
- Proximity warning system.
- Low-voltage energy monitoring.
- Sensor-controlled robot.
- Automatic pump control.
- Programmable alarm.
- Bluetooth-controlled device.
- ESP32 monitoring/control.
- Regulated low-voltage DC supply demonstration.

## Engineering project portfolio as case-study material

The following projects are drawn from EazyLife's supplied project portfolio. They are reference examples and potential case studies. Their inclusion does not imply that every design is complete, certified, commercially deployed or suitable for replication by beginners.

### Electrical systems and power electronics
- Three-phase automatic changeover using transformer-based sensing and priority relay selection, without a microcontroller.
- Automatic changeover with IoT monitoring/control override.
- Socket and lighting timer with ESP32 control.
- 12 V DC to 220 V AC inverter using ATmega328P.
- SMPS using UC3845.
- Non-isolated capacitive-dropper power supply, explicitly a dangerous hazard-awareness example.
- UC3845 boost converter.
- BLDC motor controller for an electric bike, developed in the ThinkBikes Ltd context.
- Energy meter.
- Voltage-multiplier zapper concept, high-voltage/shock hazard; not a learner construction project.
- Laptop power bank.

### Embedded systems and connected devices
- Electronics keyboard piano.
- Voice-controlled switch using Google voice commands.
- RTC desktop digital clock with custom seven-segment display.
- Rechargeable Bluetooth scrolling text display using P10 LED matrix.
- IoT smart-home system, Buliamix Contech Ltd context.
- Automatic pumping machine.

### Robotics and industrial automation
- Conveyor mechanism.
- Gas-sensor mobile patrol robot.
- Five-bar drawing robot arm with Python application.
- Delta robot pick-and-place arm.
- Two-wheel PID robot.
- PIR/stepper automatic sliding door.
- MAX7219 robot facial-expression display.

### Smart devices and practical innovations
- Smart waste bin.
- Washing-machine-related system with SMS bin-full alert.
- Height measuring system.
- Automatic handwashing system with water/soap dispensing and hand dryer.
- Mechanical ventilator development project, a biomedical engineering case study only; no clinical use or patient-safety claim without appropriate regulatory and clinical validation.
- Inert fake bomb countdown timer movie prop.
- Salocool evaporative cooling system using water evaporation from a charcoal surface for produce cooling.

### How to use portfolio examples
- Link each advanced case study to the foundational concepts it depends on.
- Explain the system using block diagrams, signal flow, component roles and engineering trade-offs.
- Where practical, provide a safe low-voltage subassembly or simplified behavioural experiment.
- Clearly label project context and maturity. Do not imply ownership by EazyLife where the supplied description attributes the work to another named organisation.
- Avoid presenting complex builds as one-click beginner projects. Break them into prerequisite concepts and smaller validated subassemblies.

## Proposed interactive reference tool: resistor colour-code calculator

A resistor colour-code calculator is a high-value standalone utility and a natural companion to the first Electronics Fundamentals modules.

Initial feature requirements:
- Select 4-band or 5-band resistor.
- Band selectors with colour names and visual band previews.
- Calculate nominal resistance.
- Show tolerance and the resulting minimum/maximum resistance range.
- Explain each band's role, including the different significant-digit count for 4-band and 5-band resistors.
- Display a readable formatted result in ohms, kΩ or MΩ.
- Include reverse lookup: enter a resistance and tolerance, then show a suitable standard colour-band representation where supported.
- Include a clear reset action and mobile-friendly controls.
- Add a short how-to-read explanation and a few worked examples.
- Validate combinations and avoid silently accepting impossible/ambiguous selections.
- Consider 6-band support later, including temperature coefficient, but do not let it delay the 4-band/5-band release.

Technical correctness requirements:
- 4-band: first two bands are significant digits, third is multiplier, fourth is tolerance.
- 5-band: first three bands are significant digits, fourth is multiplier, fifth is tolerance.
- Tolerance options and multiplier values must follow recognised resistor colour-code conventions.
- The UI must distinguish nominal value from tolerance range and account for rounding in displayed units.
- Include an explicit note that actual components can be damaged, faded or use non-standard markings; verify with a multimeter where accuracy matters.

## Suggested content format for future modules

Each module should have a consistent structure where applicable:
1. What the learner will understand or be able to do.
2. Prerequisite knowledge, marked as optional/recommended.
3. Core explanation with diagrams, equations and worked examples.
4. Component and tool identification.
5. Experiment or interactive model, with fidelity clearly labelled.
6. Physical build guide, wiring/circuit diagram and component list.
7. Expected observations and measurements.
8. Troubleshooting and common mistakes.
9. Safety notes and scope limitations.
10. Knowledge check or practical challenge.
11. Further applications and related modules.

Not every topic needs a simulator. A calculator, annotated diagram, waveform visualiser, decision challenge, measurement exercise or physical build guide may teach it better.

## Suggested development order

1. Finish and test the current potentiometer-to-LED reference module.
2. Add the resistor colour-code calculator as a reusable Electronics Fundamentals tool.
3. Add supporting foundation modules: component identification/polarity, series/parallel circuits, multimeter use, and Ohm's law.
4. Develop analog electronics and semiconductor modules.
5. Add low-voltage rectification, filtering and regulation learning experiences.
6. Expand embedded programming and sensor modules.
7. Connect existing project playground experiments to relevant learning modules.
8. Add robotics, automation and engineering application case studies.
9. Review the full portfolio and syllabus for content gaps, practical feasibility and safety before expanding further.

This order is a proposed build sequence, not a learner-imposed curriculum.
