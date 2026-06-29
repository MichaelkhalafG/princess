import { describe, expect, it } from "vitest";

import { buildLoginSchema, buildRegisterSchema, rawKey, REGISTER_ROLES } from "@/features/auth/schema";

const login = buildLoginSchema(rawKey);
const register = buildRegisterSchema(rawKey);

describe("login schema", () => {
  it("accepts valid credentials", () => {
    expect(login.safeParse({ email: "sara@example.com", password: "secret" }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(login.safeParse({ email: "not-an-email", password: "secret" }).success).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(login.safeParse({ email: "sara@example.com", password: "" }).success).toBe(false);
  });
});

describe("register schema", () => {
  const valid = {
    full_name: "Sara",
    email: "sara@example.com",
    password: "supersecret",
    role: "customer" as const,
  };

  it("accepts a valid customer registration", () => {
    expect(register.safeParse(valid).success).toBe(true);
  });

  it("accepts seller and provider roles", () => {
    for (const role of ["seller", "provider"] as const) {
      expect(register.safeParse({ ...valid, role }).success).toBe(true);
    }
  });

  it("rejects admin (not self-registerable)", () => {
    expect(register.safeParse({ ...valid, role: "admin" }).success).toBe(false);
  });

  it("rejects an unknown role", () => {
    expect(register.safeParse({ ...valid, role: "superuser" }).success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(register.safeParse({ ...valid, password: "short" }).success).toBe(false);
  });

  it("rejects a missing name", () => {
    expect(register.safeParse({ ...valid, full_name: "" }).success).toBe(false);
  });

  it("exposes exactly the three self-registerable roles", () => {
    expect([...REGISTER_ROLES]).toEqual(["customer", "seller", "provider"]);
  });
});
