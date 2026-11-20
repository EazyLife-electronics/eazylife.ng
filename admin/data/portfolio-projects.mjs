// Source: EazyLife Engineering Projects and Innovation Portfolio.pdf
// Text is expanded for the website while keeping claims within the source document.
// Process notes and exact component lists are intentionally left blank when undocumented.
export const portfolioProjects = [
  {
    title: "Three-Phase Automatic Changeover System",
    category: "Electrical Systems and Power Electronics",
    summary: "A microcontroller-free automatic phase selector that monitors three power phases and switches a single-phase load to an available supply according to a preset priority.",
    description: "This project is an automatic changeover system designed to monitor three separate electrical phases and select an available phase according to a predetermined priority. Voltage is sensed through transformer-based sensing, while relays perform the switching. The control arrangement operates without a microcontroller.\n\nThe system is intended to help maintain supply to connected single-phase loads when the preferred phase becomes unavailable. It is relevant to installations where phase availability is inconsistent and automatic phase selection is useful.",
    materials: ["Voltage-sensing transformers", "Relays"],
    process: "",
    outcome: "Demonstrates automatic selection among three monitored phases, using transformer-based voltage sensing and relay switching without a microcontroller."
  },
  {
    title: "Automatic Changeover with IoT Control Override",
    category: "Electrical Systems and Power Electronics",
    summary: "An automatic power changeover system with connected monitoring and remote control override for power-source selection.",
    description: "This project combines automatic power changeover with IoT connectivity. The system is intended to carry out its normal automatic switching function while also making remote monitoring and control override available to an authorised user.\n\nThe additional connectivity provides a way to observe the power-source selection and intervene remotely when required. Potential settings include homes, offices and installations that use generators or backup power.",
    materials: [],
    process: "",
    outcome: "Explores the integration of automatic power switching with IoT-based remote monitoring and intervention."
  },
  {
    title: "Socket and Lighting Timer with IoT Control",
    category: "Electrical Systems and Power Electronics",
    summary: "An ESP32-based timer and switching system for scheduled socket and lighting operation with remote access.",
    description: "This electronic timer and switching project is designed to control electrical sockets and lighting according to scheduled operating times. An ESP32 provides the embedded platform for IoT-based remote operation.\n\nCombining scheduling with remote access makes the concept relevant to home and office automation, appliance management and situations where lighting or connected equipment should operate at selected times.",
    materials: ["ESP32"],
    process: "",
    outcome: "Demonstrates scheduled switching of sockets and lighting alongside IoT-based remote operation."
  },
  {
    title: "12V DC to 220V AC Power Inverter Using ATmega328P",
    category: "Electrical Systems and Power Electronics",
    summary: "A battery-input inverter project designed to convert 12V DC into a 220V AC output, with an ATmega328P in the control system.",
    description: "This power-conversion project is designed to convert a 12V DC supply into a 220V AC output. An ATmega328P microcontroller is used in the control system. The project explores the electronic control involved in converting battery-supplied DC power into an AC supply for compatible equipment.\n\nThe concept is relevant to portable power, battery backup and small-scale off-grid applications. Output capability and compatibility depend on the actual build specifications and should be confirmed before connecting equipment.",
    materials: ["ATmega328P"],
    process: "",
    outcome: "Demonstrates a controlled 12V DC-to-220V AC inverter arrangement."
  },
  {
    title: "SMPS Power Supply Using UC3845",
    category: "Electrical Systems and Power Electronics",
    summary: "A switch-mode power supply built around the UC3845 PWM controller for high-frequency power conversion and regulated DC output.",
    description: "This project explores a switch-mode power supply (SMPS) built around the UC3845 pulse-width-modulation controller. The controller is used as part of a high-frequency power-conversion arrangement intended to provide a regulated DC output.\n\nThe work is relevant to the design and study of electronic equipment power supplies, battery-charging systems and other DC power applications. Specific input range, output voltage, current rating and regulation performance are not stated in the source portfolio.",
    materials: ["UC3845 PWM controller"],
    process: "",
    outcome: "Demonstrates the use of a UC3845-based switching controller in a power-supply design."
  },
  {
    title: "Deathtrap Power Supply: Non-Isolated Capacitive Power Supply",
    category: "Electrical Systems and Power Electronics",
    summary: "An experimental transformerless capacitive-dropper supply used to explain capacitive reactance and the serious hazards of non-isolated mains circuits.",
    description: "This experimental power-supply arrangement uses capacitive reactance to limit current from an AC source, rather than using an isolating transformer. The deliberately cautionary name, “Deathtrap”, highlights the danger of its non-isolated output.\n\nThe project is useful as a safety-focused educational example for understanding capacitive-dropper principles, galvanic isolation and the risks associated with mains-connected electronics. It is hazardous and is not recommended as a general-purpose power supply. It must not be presented as a safe user-facing power product.",
    materials: ["Capacitive dropper components"],
    process: "",
    outcome: "Illustrates capacitive current limiting and why non-isolated mains power supplies present a serious electric-shock hazard."
  },
  {
    title: "Boost Converter Using UC3845",
    category: "Electrical Systems and Power Electronics",
    summary: "A DC-to-DC boost converter using the UC3845 PWM controller to raise a lower DC input to a higher output voltage.",
    description: "This DC-to-DC power-conversion project uses the UC3845 PWM controller in a boost-converter arrangement. Its purpose is to increase an input DC voltage to a higher DC output voltage.\n\nBoost conversion is relevant to battery-powered equipment, renewable-energy systems and electronic designs that require a DC voltage higher than the available source. The actual input range, output range, current capability and efficiency are not specified in the source portfolio.",
    materials: ["UC3845 PWM controller"],
    process: "",
    outcome: "Demonstrates step-up DC-to-DC conversion using a UC3845-based control arrangement."
  },
  {
    title: "BLDC Motor Controller for Electric Bike",
    category: "Electrical Systems and Power Electronics",
    summary: "A brushless DC motor control project developed for an electric bicycle application under ThinkBikes Ltd.",
    description: "This project involved electronic control of a brushless DC (BLDC) motor for an electric bicycle application. It was developed under ThinkBikes Ltd as part of an electric-mobility initiative.\n\nThe project relates to the control electronics required for battery-powered bicycle propulsion and the wider field of light electric vehicles. The source portfolio does not specify the controller's voltage, current rating, commutation method or final performance figures.",
    materials: [],
    process: "",
    outcome: "A BLDC motor-control project developed for an electric bicycle application. Organisation attribution: ThinkBikes Ltd."
  },
  {
    title: "Energy Meter",
    category: "Electrical Systems and Power Electronics",
    summary: "An electronic measurement project designed to monitor the electrical energy consumed by a connected load.",
    description: "This project focuses on electronic measurement of the energy consumed by a connected electrical load. It is intended to make energy use measurable and easier to monitor.\n\nThe concept is applicable to household energy monitoring, appliance-consumption analysis and commercial energy-management studies. The measurement method, metering accuracy, display arrangement and electrical ratings are not specified in the source portfolio.",
    materials: [],
    process: "",
    outcome: "Explores electronic measurement and monitoring of electrical energy consumption."
  },
  {
    title: "Taser/Zapper Using Voltage Multiplier Circuit",
    category: "Electrical Systems and Power Electronics",
    summary: "A high-voltage zapper project based on voltage-doubler or multiplier principles, documented as an electrical-shock hazard.",
    description: "This project explores voltage multiplication using a voltage doubler or multiplier circuit to generate a higher voltage. The source portfolio describes it as a high-voltage zapper project and notes the possibility of electric shock.\n\nThe educational value is in examining voltage-multiplier principles and the hazards of high-voltage electronics. Any public presentation should emphasise electrical safety and should not imply that the project is a validated or safe personal-protection device.",
    materials: ["Voltage doubler/multiplier circuit"],
    process: "",
    outcome: "Demonstrates voltage multiplication at project level. The build involves high voltage and electric-shock risk."
  },
  {
    title: "Laptop Power Bank",
    category: "Electrical Systems and Power Electronics",
    summary: "A rechargeable portable power system designed to provide backup power for a laptop away from a conventional wall outlet.",
    description: "This project is a rechargeable portable power system intended to supply power to a laptop without depending on a conventional wall outlet. It addresses the practical need for mobile computing and backup power when mains electricity is unavailable.\n\nPotential settings include remote work, travel and field operations. Battery chemistry, capacity, output voltage, charging method and supported laptop models are not specified in the source portfolio and should be added only after verification.",
    materials: [],
    process: "",
    outcome: "Explores a portable rechargeable power source for laptop use and backup during power interruptions."
  },
  {
    title: "Electronics Keyboard Piano",
    category: "Embedded Systems and Internet of Things",
    summary: "An electronic keyboard that generates musical tones through circuitry when the user presses its keys.",
    description: "This electronic musical keyboard uses a user-operated set of keys to trigger the generation of musical tones through electronic circuitry. It brings together input controls and electronic sound generation in an interactive device.\n\nThe project is relevant to introductory electronics, sound-generation experiments and the fundamentals of electronic musical instruments. The source portfolio does not specify the sound-generation circuit, number of keys or available tones.",
    materials: [],
    process: "",
    outcome: "Demonstrates electronic tone generation controlled by keyboard input."
  },
  {
    title: "Voice-Controlled Switch Using Google Voice Commands",
    category: "Embedded Systems and Internet of Things",
    summary: "An IoT switching system that allows connected electrical devices to be controlled through Google voice commands.",
    description: "This IoT-based switching project connects electrical switching with the Google voice-command ecosystem. It is designed to let a user operate connected devices through spoken commands, reducing the need to interact with a physical switch.\n\nThe concept is relevant to smart-home automation, voice-controlled lighting and appliance operation, as well as accessibility-focused control interfaces. The exact integration service and supported devices are not specified in the source portfolio.",
    materials: [],
    process: "",
    outcome: "Explores hands-free switching of connected electrical devices through voice commands."
  },
  {
    title: "Desktop Digital Clock Using RTC and Customised LED Seven-Segment Display",
    category: "Embedded Systems and Internet of Things",
    summary: "A desktop digital clock combining a real-time clock module with a customised LED seven-segment display.",
    description: "This desktop clock uses a real-time clock (RTC) for timekeeping and a customised LED seven-segment display to present the time. The project combines timekeeping electronics with a purpose-built visual display.\n\nIt is relevant to embedded-systems learning, digital display design and electronic information devices. The source portfolio does not state the RTC model, display dimensions or additional functions such as alarms.",
    materials: ["Real-time clock (RTC)", "Customised LED seven-segment display"],
    process: "",
    outcome: "Demonstrates digital timekeeping with an RTC and a customised LED seven-segment display."
  },
  {
    title: "Rechargeable Bluetooth Scrolling Text Display Using P10 LED Matrix",
    category: "Embedded Systems and Internet of Things",
    summary: "A portable rechargeable P10 LED matrix display that receives message updates over Bluetooth and presents them as scrolling text.",
    description: "This portable display combines a P10 LED matrix with Bluetooth connectivity and rechargeable power. Messages can be updated wirelessly, then presented as scrolling text on the LED matrix.\n\nThe format is suited to portable signboards, business advertising, event announcements and public information displays. The source portfolio does not specify the wireless application, battery capacity or display dimensions.",
    materials: ["P10 LED matrix", "Bluetooth connectivity", "Rechargeable power source"],
    process: "",
    outcome: "Demonstrates wireless updating and scrolling presentation of text on a rechargeable LED matrix display."
  },
  {
    title: "Smart Home Using IoT",
    category: "Embedded Systems and Internet of Things",
    summary: "An IoT smart-home project integrating connected electronic systems for remote monitoring and control of selected home functions.",
    description: "Developed under Buliamix Contech Ltd, this project explores the integration of connected electronic systems for selected household functions. IoT connectivity provides a way to monitor and control supported functions remotely.\n\nThe project concept includes smart lighting, remote appliance control and residential monitoring. The exact devices, communication protocol and automation features should be confirmed against the build before publication.",
    materials: [],
    process: "",
    outcome: "Explores connected home functions and remote monitoring or control. Organisation attribution: Buliamix Contech Ltd."
  },
  {
    title: "Automatic Pumping Machine",
    category: "Embedded Systems and Internet of Things",
    summary: "An automatic water-pumping system that operates according to predefined conditions to reduce continuous manual control.",
    description: "This project automates the operation of a water pump according to predetermined operating conditions. Its purpose is to reduce the need for someone to continuously start and stop the pumping process manually.\n\nPotential applications include filling water tanks, domestic water management, irrigation and transferring water between storage points. The sensing method and control thresholds are not stated in the source portfolio.",
    materials: [],
    process: "",
    outcome: "Demonstrates automatic control of a water-pumping operation according to predefined conditions."
  },
  {
    title: "Conveyor Mechanism",
    category: "Robotics and Industrial Automation",
    summary: "A mechanical conveyor system demonstrating controlled movement and handling of materials between locations.",
    description: "This mechanical conveyor project demonstrates how materials can be moved from one location to another in a controlled manner. It provides a practical introduction to material-handling mechanisms and the mechanical principles used in production environments.\n\nConveyor systems are commonly relevant to manufacturing, packaging, sorting and industrial automation. The source portfolio does not specify the conveyor dimensions, drive arrangement, speed or load capacity.",
    materials: [],
    process: "",
    outcome: "Demonstrates a mechanism for controlled material movement and handling."
  },
  {
    title: "Gas Sensor Mobile Patrol Bot",
    category: "Robotics and Industrial Automation",
    summary: "A mobile robot equipped with a gas sensor to support moving gas detection and environmental monitoring.",
    description: "This mobile robotics project combines a moving robot platform with a gas sensor. The robot is intended to travel through an area while sensing gas-related conditions, bringing mobility to an environmental-monitoring task.\n\nPotential applications include gas-leak inspection, industrial monitoring research and robotics education. The source portfolio does not identify the gas sensor model, detectable gases, alarm thresholds or any safety certification. It should not be represented as a certified life-safety detector.",
    materials: ["Gas sensor", "Mobile robot platform"],
    process: "",
    outcome: "Demonstrates the integration of gas sensing with a mobile robotic platform for exploratory monitoring."
  },
  {
    title: "Five-Bar Drawing Robot Arm with Python Application",
    category: "Robotics and Industrial Automation",
    summary: "A five-bar linkage drawing mechanism paired with a Python application for programmed movement and plotting.",
    description: "This project uses a five-bar linkage as the mechanical basis of a robotic drawing mechanism. A Python application supports the control side, allowing programmed drawings and movements to be reproduced through coordinated motion.\n\nThe project brings together linkage geometry, mechanical design and computer-based control. It is relevant to educational robotics, plotting and computer-aided fabrication. The source portfolio does not specify the actuator type, drawing area or positional accuracy.",
    materials: ["Five-bar linkage mechanism", "Python application"],
    process: "",
    outcome: "Demonstrates computer-supported drawing and plotting through coordinated movement of a five-bar mechanism."
  },
  {
    title: "Delta Robot Arm: Pick-and-Place Mechanism",
    category: "Robotics and Industrial Automation",
    summary: "A parallel-link delta-style robot arm designed to move objects between designated positions in pick-and-place tasks.",
    description: "This project explores a delta-style robotic arm using a parallel-link mechanical arrangement. The mechanism is designed for pick-and-place movement, transferring objects between designated positions.\n\nDelta robot arrangements are relevant to sorting, packaging, light assembly and automated material handling. The source portfolio does not specify the number of actuators, payload, reach, cycle time or control platform.",
    materials: ["Parallel-link delta mechanism"],
    process: "",
    outcome: "Demonstrates a delta-style mechanism for object transfer and pick-and-place movement."
  },
  {
    title: "PID Robot: Two-Wheel Drive",
    category: "Robotics and Industrial Automation",
    summary: "A two-wheel-drive robot exploring PID feedback control for improved motion response and, where configured, balancing stability.",
    description: "This two-wheel-drive robot project explores the use of proportional-integral-derivative (PID) control in a robotic system. PID is a feedback-control method that uses the difference between a desired condition and a measured condition to adjust system response.\n\nThe source portfolio describes the project in relation to controlled robotic movement or balancing, depending on the final configuration. The exact robot configuration, sensors, control loop and demonstrated operating mode should be confirmed before those details are added to the public project story.",
    materials: [],
    process: "",
    outcome: "Provides a practical platform for exploring PID feedback control in a two-wheel-drive robotic system."
  },
  {
    title: "Automatic Sliding Door Using PIR and Stepper Motors",
    category: "Robotics and Industrial Automation",
    summary: "An automatic door mechanism using a PIR motion sensor and stepper motors to automate opening and closing.",
    description: "This project combines a passive infrared (PIR) motion sensor with stepper motors to automate a sliding-door mechanism. Motion detection provides the trigger for the door's opening and closing operation.\n\nThe concept is relevant to automated entrances, offices, public buildings and accessibility-focused installations. The source portfolio does not specify the door dimensions, motor rating, safety interlocks or obstruction-detection method.",
    materials: ["PIR motion sensor", "Stepper motors"],
    process: "",
    outcome: "Demonstrates sensor-triggered movement of an automated sliding-door mechanism."
  },
  {
    title: "Robot Facial Expression Display Using MAX7219",
    category: "Robotics and Industrial Automation",
    summary: "An LED matrix facial-expression display using the MAX7219 driver to give a robot a simple visual communication interface.",
    description: "This project uses the MAX7219 LED matrix driver to create an electronic display for robot facial expressions. The display provides a visual way for a robot or interactive device to communicate simple states or expressions.\n\nPotential uses include educational and social robots, interactive devices and human-machine interfaces. The source portfolio does not specify the matrix size, expression set or animation behaviour.",
    materials: ["MAX7219 LED matrix driver"],
    process: "",
    outcome: "Demonstrates a MAX7219-based visual facial-expression interface for robotic or interactive systems."
  },
  {
    title: "Smart Waste Bin",
    category: "Smart Devices and Practical Innovations",
    summary: "An electronically enhanced waste bin concept introducing smart features into everyday waste collection and disposal.",
    description: "This project applies electronic features to a conventional waste bin with the aim of improving aspects of waste disposal and handling. It explores how sensing or automation can be used to make a familiar everyday object more functional.\n\nPotential settings include schools, offices and public facilities, including touchless waste-disposal applications. The source portfolio does not specify the sensor arrangement or exact smart functions, so these should be added after checking the prototype.",
    materials: [],
    process: "",
    outcome: "Explores the use of electronic automation in waste collection and disposal."
  },
  {
    title: "Smart Washing Machine with Bin-Full Alert via SMS",
    category: "Smart Devices and Practical Innovations",
    summary: "A monitoring and notification concept that sends an SMS alert when a designated collection bin reaches its full condition.",
    description: "This project is described as a washing-machine-related system that monitors a designated bin or collection compartment and sends an SMS notification when it reaches a full condition. The central feature is the use of a remote text alert to communicate a change in the monitored state.\n\nThe concept is relevant to monitored collection compartments, connected household equipment and SMS-based notification systems. The source portfolio does not explain the exact relationship between the washing machine and the monitored bin, so the final physical arrangement should be clarified with project photographs.",
    materials: [],
    process: "",
    outcome: "Demonstrates an SMS alert triggered by a bin-full condition."
  },
  {
    title: "Height Measuring System",
    category: "Smart Devices and Practical Innovations",
    summary: "An electronic measurement system designed to measure and display the height of a person or object.",
    description: "This project automates the measurement of a person's or object's height and provides an electronic way to present the result. It explores the use of electronic measurement in place of relying entirely on a manual measuring process.\n\nPotential applications include schools, personal measurement stations and object-dimension estimation. The source portfolio does not specify the sensor type, measurement range, resolution or calibration method.",
    materials: [],
    process: "",
    outcome: "Demonstrates an electronic approach to measuring and displaying height."
  },
  {
    title: "Automatic Handwashing System with Water and Soap Dispenser and Hand Dryer",
    category: "Smart Devices and Practical Innovations",
    summary: "An automated hygiene station integrating water dispensing, soap dispensing and hand drying, developed during the COVID-19 period.",
    description: "Developed during the COVID-19 period, this automated hygiene project integrates three functions: water dispensing, soap dispensing and hand drying. Automating these functions is intended to reduce the need to touch dispensing controls during handwashing.\n\nThe concept is relevant to shared washrooms and facilities in schools, hospitals, clinics and offices. The source portfolio does not specify the sensor arrangement, water capacity, drying method or hygiene validation.",
    materials: ["Water dispenser", "Soap dispenser", "Hand dryer"],
    process: "",
    outcome: "Demonstrates an integrated automated handwashing arrangement with water, soap and hand-drying functions."
  },
  {
    title: "Mechanical Ventilator",
    category: "Smart Devices and Practical Innovations",
    summary: "A COVID-19-period engineering development project exploring the mechanical and electronic control of a ventilation system.",
    description: "This project was undertaken during the COVID-19 period as an engineering response to the demand for respiratory-support equipment. It explored the mechanical and electronic control aspects of a ventilation system.\n\nThe project is relevant as a biomedical-engineering and mechatronics development exercise. It must be described as a prototype or development project, not as a clinically approved medical device. Clinical effectiveness, patient suitability, safety and regulatory compliance would require appropriate independent validation.",
    materials: [],
    process: "",
    outcome: "Explored mechanical and electronic control concepts for a ventilation system. Clinical effectiveness and patient suitability were not established by the source portfolio."
  },
  {
    title: "Fake Bomb Timer: Movie Prop",
    category: "Smart Devices and Practical Innovations",
    summary: "An inert electronic countdown display created as a simulated bomb prop for film, theatre and stage productions.",
    description: "This project is an electronic countdown timer designed as a simulated bomb prop for movie and film production. It provides a visual countdown effect for a scene or performance.\n\nThe project is intended for creative production contexts such as film, theatre and stage performances. It is an inert movie prop, not an explosive device.",
    materials: [],
    process: "",
    outcome: "Demonstrates a visual electronic countdown prop for cinematic and stage use. The project is inert and non-explosive."
  },
  {
    title: "Salocool Evaporative Cooling System",
    category: "Smart Devices and Practical Innovations",
    summary: "A charcoal-surface evaporative cooling system developed under the Salocool name to cool farm produce in storage.",
    description: "Salocool is an evaporative cooling system developed with Farmatago Ltd. The described approach uses water evaporation from a charcoal surface to cool farm produce in storage. It explores an alternative cooling method that does not rely on a conventional compressor-based air-conditioning arrangement.\n\nThe concept is relevant to agricultural storage, low-energy cooling and settings where conventional air-conditioning may be expensive or impractical. The source portfolio does not provide measured temperature reduction, storage capacity, humidity performance or preservation results.",
    materials: ["Charcoal surface", "Water"],
    process: "",
    outcome: "Demonstrates an evaporative cooling approach for stored farm produce. Project attribution: Salocool Innovation, Farmatago Ltd."
  }
];
