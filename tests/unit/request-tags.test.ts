import { describe, expect, it } from "vitest";
import { splitCustomerType, withCustomerType } from "@/lib/domain/request-tags";

describe("customer type tag", () => {
  it("round-trips", () => {
    expect(withCustomerType("kol", " window ")).toBe("[KOL] window");
    expect(splitCustomerType("[KOL] window")).toEqual({ type: "kol", notes: "window" });
    expect(splitCustomerType(withCustomerType("internal", ""))).toEqual({ type: "internal", notes: "" });
    expect(splitCustomerType("plain")).toEqual({ type: null, notes: "plain" });
  });
});

describe("media tag", () => {
  it("parses", () => {
    expect(splitCustomerType("[Media] SCMP")).toEqual({ type: "media", notes: "SCMP" });
  });
});
