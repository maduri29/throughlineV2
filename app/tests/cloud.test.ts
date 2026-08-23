// The sync config guard (ADR-0005).
//
// These are the tests that matter most in the sync tier: everything else fails
// loudly, but storing a secret key succeeds silently and hands every row of
// every account to anything running on the page. The dashboard shows the secret
// key a few lines below the publishable one, so a wrong paste is likely enough
// to be worth testing rather than trusting.
import { expect, test } from "bun:test";
import { validateConfig } from "../src/data/cloud";

const URL_OK = "https://abcdefghijkl.supabase.co";
const PUB = "sb_publishable_AbCdEf123456";

/** Build a key shaped like a legacy Supabase JWT carrying `role`. */
function jwt(role: string): string {
  const b64 = (o: unknown): string =>
    btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role, iss: "supabase" })}.sig`;
}

test("accepts a publishable key over https", () => {
  expect(validateConfig(URL_OK, PUB)).toBeNull();
});

test("accepts a legacy anon JWT", () => {
  expect(validateConfig(URL_OK, jwt("anon"))).toBeNull();
});

test("refuses the sb_secret_ key", () => {
  const problem = validateConfig(URL_OK, "sb_secret_AbCdEf123456");
  expect(problem).toContain("SECRET");
});

test("refuses a service_role JWT even though it is not prefixed", () => {
  const problem = validateConfig(URL_OK, jwt("service_role"));
  expect(problem).toContain("service_role");
});

test("refuses a key that is neither publishable nor anon", () => {
  expect(validateConfig(URL_OK, "hunter2")).toContain("publishable");
});

test("requires both fields", () => {
  expect(validateConfig("", PUB)).toContain("URL");
  expect(validateConfig(URL_OK, "  ")).toContain("key");
});

test("rejects a malformed URL", () => {
  expect(validateConfig("not a url", PUB)).toContain("valid URL");
});

test("rejects plaintext http for a hosted project", () => {
  expect(validateConfig("http://abcdefghijkl.supabase.co", PUB)).toContain("https");
});

test("allows http for a self-hosted instance on localhost", () => {
  expect(validateConfig("http://localhost:54321", PUB)).toBeNull();
});
