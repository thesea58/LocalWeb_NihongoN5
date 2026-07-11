import { webcrypto } from "node:crypto";

const ITERATIONS = 100000;
const username = String(process.env.NIHONGO_USERNAME || "").trim();
const password = String(process.env.NIHONGO_PASSWORD || "");
const displayName = String(process.env.NIHONGO_DISPLAY_NAME || username).trim();

if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username)) {
  console.error("NIHONGO_USERNAME phải dài 3–64 ký tự và chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.");
  process.exit(1);
}

if (password.length < 10 || password.length > 256) {
  console.error("NIHONGO_PASSWORD phải dài từ 10 đến 256 ký tự.");
  process.exit(1);
}

const salt = webcrypto.getRandomValues(new Uint8Array(16));
const key = await webcrypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(password),
  "PBKDF2",
  false,
  ["deriveBits"],
);
const hash = await webcrypto.subtle.deriveBits(
  { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
  key,
  256,
);

const base64 = (bytes) => Buffer.from(bytes).toString("base64");
const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;

console.log(`INSERT INTO users (username, password_hash, password_salt, display_name)
VALUES (${sqlString(username)}, ${sqlString(base64(hash))}, ${sqlString(base64(salt))}, ${sqlString(displayName)})
ON CONFLICT(username) DO UPDATE SET
  password_hash = excluded.password_hash,
  password_salt = excluded.password_salt,
  display_name = excluded.display_name,
  is_active = 1;`);
