import { describe, expect, it } from "vitest";
import { extractSupplierContactText } from "./invoice-reading-supplier-contacts";

describe("supplier contacts embedded in a printed address", () => {
  it("separates labelled contacts while retaining the complete street address", () => {
    expect(
      extractSupplierContactText(
        "48 Fictional Avenue, Suite 6\nImaginary Town ON A1A 1A1\nTel: +1 (416) 555-0102 | Email: accounts@cedar.example | Website: https://cedar.example/contact",
      ),
    ).toEqual({
      address: "48 Fictional Avenue, Suite 6\nImaginary Town ON A1A 1A1",
      phone: "+1 (416) 555-0102",
      email: "accounts@cedar.example",
      website: "https://cedar.example/contact",
    });
  });

  it("recognizes unlabelled formatted phones and www websites", () => {
    expect(
      extractSupplierContactText(
        "82 Invented Road · (647)555-0103 · www.orchard.example",
      ),
    ).toEqual({
      address: "82 Invented Road",
      phone: "(647)555-0103",
      email: "",
      website: "www.orchard.example",
    });
  });

  it("does not mistake an email domain for a website", () => {
    expect(
      extractSupplierContactText("Email: billing@www.cedar.example"),
    ).toEqual({
      address: "",
      phone: "",
      email: "billing@www.cedar.example",
      website: "",
    });
  });

  it("does not leave sentence punctuation as a fake address", () => {
    expect(
      extractSupplierContactText(
        "Email: hello@meadow.example.\nPhone: 4165550110.",
      ),
    ).toEqual({
      address: "",
      phone: "4165550110",
      email: "hello@meadow.example",
      website: "",
    });
  });

  it("extracts a labelled bare host and preserves URL paths and query strings", () => {
    expect(
      extractSupplierContactText(
        "Web: meadow.example/docs?edition=2,\n48 Invented St.",
      ),
    ).toMatchObject({
      address: "48 Invented St.",
      website: "meadow.example/docs?edition=2",
    });
  });

  it("accepts a labelled international phone and extension without reformatting it", () => {
    expect(
      extractSupplierContactText(
        "Phone: +44 20 7946 0958 ext. 12\n48 Fictional Lane",
      ),
    ).toMatchObject({
      address: "48 Fictional Lane",
      phone: "+44 20 7946 0958 ext. 12",
    });
  });

  it("removes the phone label when the printed number starts with parentheses", () => {
    expect(
      extractSupplierContactText("48 Fictional Lane | Phone: (416) 555-0109"),
    ).toEqual({
      address: "48 Fictional Lane",
      phone: "(416) 555-0109",
      email: "",
      website: "",
    });
  });

  it("preserves unextracted fax, invoice references, tax IDs and street abbreviations", () => {
    const address =
      "48 St. Clair Ave.\nGST 123456789RT0001\nInvoice 2026-10-15\nFax: 416-555-0105";
    expect(extractSupplierContactText(address)).toEqual({
      address,
      phone: "",
      email: "",
      website: "",
    });
  });

  it("retains additional contacts instead of dropping them into a singular field", () => {
    expect(
      extractSupplierContactText(
        "Email: first@cedar.example | Email: second@cedar.example\nPhone: 4165550106 | Phone: 4165550107",
      ),
    ).toEqual({
      address: "Email: second@cedar.example\nPhone: 4165550107",
      phone: "4165550106",
      email: "first@cedar.example",
      website: "",
    });
  });

  it("leaves invalid contact labels available for correction", () => {
    const address = "Website: not-a-host\nEmail: not-an-email\nTel: 123";
    expect(extractSupplierContactText(address)).toEqual({
      address,
      phone: "",
      email: "",
      website: "",
    });
  });

  it("extracts Persian-labelled contacts without changing the street text", () => {
    expect(
      extractSupplierContactText(
        "خیابان خیالی، پلاک ۴۸\nتلفن: +1 416 555 0108\nایمیل: sales@meadow.example\nوب‌سایت: https://meadow.example",
      ),
    ).toEqual({
      address: "خیابان خیالی، پلاک ۴۸",
      phone: "+1 416 555 0108",
      email: "sales@meadow.example",
      website: "https://meadow.example",
    });
  });
});
