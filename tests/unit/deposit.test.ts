import { describe, expect, it } from "vitest";
import { computeDeposit, prepaymentBreakdown } from "@/lib/domain/deposit";

describe("computeDeposit", () => {
  const perPerson = { type: "per_person", amount: 500, minParty: 1 };
  it("charges nothing without a rule or with 'none'", () => {
    expect(computeDeposit(null, 4)).toBe(0);
    expect(computeDeposit({ type: "none", amount: 500, minParty: 1 }, 4)).toBe(0);
  });
  it("charges per guest, flat, or not below the minimum party", () => {
    expect(computeDeposit(perPerson, 3)).toBe(1500);
    expect(computeDeposit({ type: "flat", amount: 1000, minParty: 1 }, 6)).toBe(1000);
    expect(computeDeposit({ ...perPerson, minParty: 6 }, 5)).toBe(0);
  });
  it("uses a course deposit per guest before the policy", () => {
    expect(computeDeposit(perPerson, 2, 800)).toBe(1600);
    expect(computeDeposit(null, 2, 0)).toBe(0);
  });
  it("prepays the course price per guest, or the policy amount without a price", () => {
    const prepay = { type: "full_prepayment", amount: 3000, minParty: 1 };
    expect(computeDeposit(prepay, 2, null, 2590)).toBe(5180);
    expect(computeDeposit(prepay, 2, null, null)).toBe(3000);
  });
  it("adds service charge then VAT to a prepaid course", () => {
    const prepay = { type: "full_prepayment", amount: 0, minParty: 1, serviceChargePct: 10, vatPct: 7 };
    expect(prepaymentBreakdown(prepay, 2, null, 2500)).toEqual({ subtotal: 5000, serviceCharge: 500, vat: 385, total: 5885 });
    expect(computeDeposit(prepay, 2, null, 2500)).toBe(5885);
    expect(prepaymentBreakdown({ ...prepay, type: "per_person" }, 2, null, 2500)).toBeNull();
  });
});
