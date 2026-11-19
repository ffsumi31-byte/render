import { randomBytes } from "node:crypto";
console.log("Set this as ADMIN_ACCESS_KEY in the Render Web Service environment settings.");
console.log("Keep it private. It grants administrative access. Shown only in this local terminal:");
console.log(`sk-admin-${randomBytes(32).toString("hex")}`);
