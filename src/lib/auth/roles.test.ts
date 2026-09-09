import { describe, it, expect } from "vitest";
import { assignRoleForEmail } from "./roles";

describe("assignRoleForEmail", () => {
  it("assigns super_admin to the exact hardcoded super admin email", () => {
    expect(assignRoleForEmail("sapunshrestha1234@gmail.com")).toBe("super_admin");
  });

  it("assigns admin to the exact hardcoded staff email", () => {
    expect(assignRoleForEmail("sapunkayastha9988@gmail.com")).toBe("admin");
  });

  it("is case-insensitive on the hardcoded emails", () => {
    expect(assignRoleForEmail("SapunShrestha1234@Gmail.com")).toBe("super_admin");
  });

  it("defaults every other email to customer", () => {
    expect(assignRoleForEmail("random.person@gmail.com")).toBe("customer");
  });

  it("does NOT grant an elevated role to a +alias of the super admin's email", () => {
    // Critical security property: Gmail "+alias" addresses must never
    // be treated as equal to the real hardcoded admin emails, or
    // anyone could self-register a super_admin account by using an
    // alias of a known email.
    expect(assignRoleForEmail("sapunshrestha1234+test@gmail.com")).toBe("customer");
  });

  it("does NOT grant an elevated role to a +alias of the staff email", () => {
    expect(assignRoleForEmail("sapunkayastha9988+vendor1@gmail.com")).toBe("customer");
  });

  it("does NOT match on a substring or partial email", () => {
    expect(assignRoleForEmail("sapunshrestha1234@gmail.com.evil.com")).toBe("customer");
    expect(assignRoleForEmail("notsapunshrestha1234@gmail.com")).toBe("customer");
  });
});
