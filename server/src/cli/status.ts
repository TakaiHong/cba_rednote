import { getSystemStatus } from "../status.js";

console.log(JSON.stringify(await getSystemStatus(), null, 2));
