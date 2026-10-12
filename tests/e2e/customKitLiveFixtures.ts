import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const wrap = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="0 0 768 768"><rect width="768" height="768" fill="white"/>${body}</svg>`;
const cat = `<g fill="#d19c62" stroke="#463c32" stroke-width="7"><path d="M200 340 215 200 290 258Q360 220 425 258L495 200 520 340Q535 450 455 490L474 625 310 625 306 496Q220 470 200 340Z"/><path d="M470 605Q665 680 645 475" fill="none" stroke-width="30"/></g><g fill="#29251f"><ellipse cx="293" cy="344" rx="13" ry="24"/><ellipse cx="435" cy="344" rx="13" ry="24"/><path d="m343 395 42 0-21 23Z"/></g><path d="m270 395-80-15m88 40-88 10m262-35 78-15m-86 40 90 10" stroke="#463c32" stroke-width="4"/>`;
const person = `<path d="M305 300Q255 328 237 508L293 525 303 425 308 620 356 620 384 460 414 620 462 620 466 425 475 525 530 508Q517 328 455 300Z" fill="#537396"/><ellipse cx="381" cy="216" rx="75" ry="89" fill="#e5bd9c"/><path d="M310 224Q270 100 380 105Q489 108 455 227L434 160 346 164Z" fill="#332c28"/><circle cx="354" cy="218" r="6"/><circle cx="408" cy="218" r="6"/><path d="M355 257Q381 277 407 257" fill="none" stroke="#895f4b" stroke-width="5"/><path d="m308 620 0 58 54 0 12-58m40 0 12 58 54 0-18-58" fill="#2d3847"/>`;
const robot = `<g stroke="#25333b" stroke-width="6" fill="#b1bdc5">
  <path d="m240 175-75-65-30 235 84 25Zm288 0 75-65 30 235-84 25Z"/>
  <rect x="327" y="107" width="114" height="99" rx="6"/><path d="m347 106-23-41m97 41 23-41" fill="none"/>
  <rect x="345" y="131" width="78" height="25" fill="#489cbb"/><path d="M360 174h49"/>
  <rect x="247" y="226" width="274" height="156" fill="#a84c45"/><path d="m260 240 80 75h88l80-75M350 323v46m70-46v46"/>
  <path d="M162 222h86l-10 90-106-6Zm358 0h86l30 84-106 6Z" fill="#a84c45"/>
  <circle cx="180" cy="330" r="23"/><circle cx="588" cy="330" r="23"/>
  <path d="m146 353 55 8-7 106-73-7Zm421 8 55-8 25 107-73 7Z"/>
  <rect x="113" y="470" width="86" height="43"/><rect x="568" y="470" width="86" height="43"/>
  <rect x="302" y="396" width="164" height="66"/><path d="M300 477h65v111h-83Zm103 0h65l18 111h-83Z" fill="#a84c45"/>
  <circle cx="322" cy="605" r="24"/><circle cx="446" cy="605" r="24"/>
  <path d="m284 632 76-1 6 60-99 0Zm122-1 76 1 17 59-99 0Z"/>
  <path d="m261 694 115 0-16 35-122 0Zm131 0 115 0 23 35-122 0Z" fill="#a84c45"/>
</g>`;
const quad = `<g stroke="#263843" stroke-width="7" fill="#a2b3c1"><path d="M248 285h287l61 109-74 68-238-12-58-68Z" fill="#806d9c"/><path d="m212 263-75 13-38 53 73 40 61-28Z"/><rect x="141" y="297" width="59" height="20" fill="#6aafc1"/><path d="m235 275-27-76 77 11 48 57"/><circle cx="294" cy="454" r="30"/><circle cx="470" cy="454" r="30"/><circle cx="361" cy="439" r="25"/><circle cx="528" cy="439" r="25"/><path d="m270 480-52 66 37 76h-58l-49-77 87-109Zm222-5 78 74-25 73h62l30-74-109-116ZM355 464l-32 71 48 47h45l-50-59 32-54Zm177-1 77 47-9 68h41l16-85-101-61Z"/><path d="m598 315 80-89 22 18-72 101Z"/><path d="M300 324h177m-157 50h186M296 409h187" fill="none"/></g>`;

/** Native vector fixtures provide reproducible original / non-mecha scan cases. */
export async function prepareCustomKitLiveFixtures() {
  const directory = "/tmp/neotypelab-custom-kit-live";
  await mkdir(directory, { recursive: true });
  for (const [name, body] of [["original", robot], ["quadruped", quad], ["animal", cat], ["person", person]]) {
    await sharp(Buffer.from(wrap(body))).png().toFile(`${directory}/${name}.png`);
  }
  const photo = "/tmp/neotypelab-style-seven-colors.png";
  const tiny = await sharp(photo).resize(12, 12).toBuffer();
  await sharp(tiny).resize(768, 768, { kernel: "nearest" }).blur(20).png().toFile(`${directory}/blurred.png`);
  const subject = await sharp(photo).resize(680, 680, { fit: "inside" }).toBuffer();
  const animal = await sharp(Buffer.from(wrap(cat))).resize(100, 100).toBuffer();
  await sharp({ create: { width: 768, height: 768, channels: 3, background: "white" } }).composite([{ input: subject, left: 50, top: 20 }, { input: animal, left: 5, top: 640 }]).png().toFile(`${directory}/background-animal.png`);
  const manifest = [
    { key: "photo", path: photo, expected: "supported" },
    { key: "backpack", path: "/tmp/custom-kit-Nu-Gundam.webp", expected: "supported" },
    { key: "original", path: `${directory}/original.png`, expected: "supported" },
    { key: "quadruped", path: `${directory}/quadruped.png`, expected: "supported" },
    { key: "animal", path: `${directory}/animal.png`, expected: "unsupported" },
    { key: "person", path: `${directory}/person.png`, expected: "unsupported" },
    { key: "blurred", path: `${directory}/blurred.png`, expected: "needs-better-reference" },
    { key: "background-animal", path: `${directory}/background-animal.png`, expected: "supported" },
  ];
  await writeFile(`${directory}/manifest.json`, JSON.stringify(manifest, null, 2));
  return manifest;
}
