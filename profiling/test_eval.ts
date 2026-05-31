import { candidates } from "./src/hashLine.js";
import { testLines } from "./data/dev.js";
console.log("Candidates:", candidates.length);
console.log("Test lines:", testLines.length);
for (const c of candidates) {
  const h = c.fn("hello", 1);
  console.log(c.name, c.variant, h);
}
