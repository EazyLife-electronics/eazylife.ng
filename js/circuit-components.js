// EazyLife Circuit Studio: starter component library.
// Artwork and pin definitions are deliberately separate so artwork can be
// refined without changing electrical connection geometry.
const line=(d)=>`<path d="${d}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
const defs=[
["resistor","Resistor","Passive","R",[-50,0],[50,0],`<path d="M-70 0H-48L-35 -14L-17 14L0 -14L17 14L35 -14L48 0H70" ${'fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"'}/>`],
["resistor-iec","Resistor (IEC)","Passive","R",[-50,0],[50,0],line("M-70 0H-50V-14H50V0H70")],
["potentiometer","Potentiometer","Passive","RV",[[-55,0],[55,0],[0,-40]],null,line("M-65 0H-45L-32 -14L-16 14L0 -14L16 14L32 -14L45 0H65 M0 -42L0 -20 M-8 -29L0 -20L8 -29")],
["capacitor","Capacitor","Passive","C",[-45,0],[45,0],line("M-65 0H-8 M-8 -24V24 M8 -24V24 M8 0H65")],
["capacitor-polar","Polarized capacitor","Passive","C",[-45,0],[45,0],line("M-65 0H-8 M-8 -24V24 M8 -24Q30 0 8 24 M8 0H65")+`<text x="-1" y="-30" font-size="13" fill="currentColor">+</text>`],
["inductor","Inductor","Passive","L",[-65,0],[65,0],line("M-75 0H-55 C-55 -28 -25 -28 -25 0 C-25 -28 5 -28 5 0 C5 -28 35 -28 35 0 C35 -28 55 -28 55 0 H75")],
["diode","Diode","Semiconductors","D",[-65,0],[65,0],line("M-70 0H-25 M-25 -24L18 0L-25 24Z M18 -25V25 M18 0H70")],
["led","LED","Semiconductors","LED",[-65,0],[65,0],line("M-70 0H-25 M-25 -24L18 0L-25 24Z M18 -25V25 M18 0H70 M5 -35L23 -53 M18 -53H23V-48 M28 -25L46 -43 M41 -43H46V-38")],
["zener","Zener diode","Semiconductors","D",[-65,0],[65,0],line("M-70 0H-25 M-25 -24L18 0L-25 24Z M18 -25L10 -18 M18 -25L26 -32 M18 25L10 18 M18 25L26 32 M18 0H70")],
["npn","NPN transistor","Semiconductors","Q",[[-65,0],[0,-55],[0,55]],null,line("M-65 0H-20 M-20 -38V38 M-20 -25L35 -55 M-20 25L35 55 M35 -55H65 M35 55H65 M15 40L35 55L12 58")],
["pnp","PNP transistor","Semiconductors","Q",[[-65,0],[0,-55],[0,55]],null,line("M-65 0H-20 M-20 -38V38 M-20 -25L35 -55 M-20 25L35 55 M35 -55H65 M35 55H65 M35 55L15 40L12 58")],
["mosfet","N-channel MOSFET","Semiconductors","Q",[[-65,0],[0,-55],[0,55]],null,line("M-65 0H-30 M-18 -42V42 M-8 -42V42 M-8 -28L35 -55 M-8 28L35 55 M35 -55H65 M35 55H65")],
["opamp","Operational amplifier","Integrated circuits","U",[[-65,-22],[-65,22],[55,0]],null,line("M-45 -48L45 0L-45 48Z M-65 -22H-45 M-65 22H-45 M45 0H65 M-38 -22H-28 M-33 -27V-17 M-38 22H-28")],
["timer555","555 timer IC","Integrated circuits","U",[[-65,-35],[-65,-12],[-65,12],[-65,35],[65,-35],[65,-12],[65,12],[65,35]],null,`<rect x="-48" y="-58" width="96" height="116" rx="3" fill="none" stroke="currentColor" stroke-width="3"/><text x="0" y="6" text-anchor="middle" font-size="25" fill="currentColor" font-weight="700">555</text>`],
["ground","Ground","Power","GND",[[0,-35]],null,line("M0 -35V-10 M-28 -10H28 M-19 0H19 M-9 10H9")],
["battery","Battery","Power","BT",[-65,0],[65,0],line("M-70 0H-12 M-12 -28V28 M8 -15V15 M8 0H70")],
["dc-source","DC voltage source","Power","V",[-65,0],[65,0],line("M-70 0H-28 M-28 0A28 28 0 1 0 28 0A28 28 0 1 0 -28 0 M28 0H70")+`<text x="0" y="-5" text-anchor="middle" font-size="16" fill="currentColor">+</text><text x="0" y="17" text-anchor="middle" font-size="17" fill="currentColor">−</text>`],
["switch","SPST switch","Switches","S",[-65,0],[65,0],line("M-70 0H-30 M30 0H70 M-30 0L25 -28")],
["pushbutton","Push button","Switches","S",[-65,0],[65,0],line("M-70 0H-25 M25 0H70 M-25 0V-10H25V-35 M-35 -40H35")],
["lamp","Lamp","Output","LAMP",[-65,0],[65,0],line("M-70 0H-28 M28 0H70 M-28 0A28 28 0 1 0 28 0A28 28 0 1 0 -28 0 M-16 -16L16 16 M16 -16L-16 16")],
["fuse","Fuse","Protection","F",[-65,0],[65,0],line("M-70 0H-30 M-30 -14H30V14H-30Z M30 0H70")],
["motor","DC motor","Output","M",[-65,0],[65,0],line("M-70 0H-28 M28 0H70 M-28 0A28 28 0 1 0 28 0A28 28 0 1 0 -28 0")+`<text x="0" y="8" text-anchor="middle" font-size="21" fill="currentColor">M</text>`],
["connector-2","2-pin connector","Connectors","J",[[-35,-12],[-35,12]],null,`<rect x="-25" y="-32" width="50" height="64" rx="4" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="-35" cy="-12" r="5" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="-35" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="3"/>`],
["and-gate","AND gate","Logic","U",[[-65,-22],[-65,22],[55,0]],null,`<path d="M-40 -40H0A40 40 0 0 1 0 40H-40Z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M-65 -22H-40M-65 22H-40M40 0H65" fill="none" stroke="currentColor" stroke-width="3"/>`],
["buzzer","Buzzer","Output","BZ",[-65,0],[65,0],line("M-70 0H-30L15 -28V28L-30 0 M15 -18Q42 0 15 18 M28 -28Q68 0 28 28")],
["relay","Relay","Output","K",[[-65,0],[65,-25],[65,25]],null,line("M-70 0H-40 M-40 -18V18 M-40 0L15 -28 M15 -28H35 M35 -28H65 M35 28H65 M35 28V-8 M35 -8H65")],
["transformer","Transformer","Passive","T",[[-70,-20],[-70,20],[70,-20],[70,20]],null,line("M-75 0H-45 M-45 -28C-20 -28 -20 28 -45 28 M-45 -28C-20 -28 -20 28 -45 28 M-10 -32V32 M10 -32V32 M45 -28C20 -28 20 28 45 28 M45 -28C20 -28 20 28 45 28 M45 0H75")]
];
export const COMPONENTS=defs.map((d,i)=>{const [id,name,category,designator,pinsA,pinsB,art]=d;let pins=Array.isArray(pinsA?.[0])?pinsA:(pinsB?[pinsA,pinsB]:[pinsA]);return {id,name,category,designator,pins:pins.map((p,n)=>({id:`p${n+1}`,name:pins.length===2?(n===0?"A":"B"):`Pin ${n+1}`,x:p[0],y:p[1]})),artwork:art,version:1,style:"engineering"};});
export function getComponent(id){return COMPONENTS.find(c=>c.id===id);}
