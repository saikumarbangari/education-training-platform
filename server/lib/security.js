import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password, storedValue) {
  if (!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(String(storedValue)))
    return false;
  const [, saltHex, keyHex] = storedValue.split("$");

  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(
    password,
    Buffer.from(saltHex, "hex"),
    expected.length,
  );
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken() {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}
