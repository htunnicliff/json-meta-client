import { describe, expect, it } from "vitest";

import { InvalidUriTemplateError } from "../../errors/invalid-uri-template-error.ts";
import { expandURITemplate } from "../expand-uri-template.ts";

describe(expandURITemplate, () => {
  it("encodes supplied parameters", () => {
    expect(
      expandURITemplate("https://example.test/{id}?name={name}", {
        id: "a/b",
        name: "file & name",
      }),
    ).toBe("https://example.test/a%2Fb?name=file%20%26%20name");
  });

  it("reports the original template and parameters even after an earlier substitution", () => {
    const template = "https://example.test/{accountId}/{blobId}?name={name}";
    const params = { accountId: "account", unknown: "value" };
    const expand = () => expandURITemplate(template, params);
    expect(expand).toThrow(InvalidUriTemplateError);
    expect(expand).toThrow(
      expect.objectContaining({
        message: 'Template does not contain "unknown"',
        uriTemplate: template,
        givenParameters: params,
        availableParameters: ["accountId", "blobId", "name"],
      }),
    );
  });

  it("reports no available parameters for a template without placeholders", () => {
    const template = "https://example.test";
    const params = { id: "id" };
    const expand = () => expandURITemplate(template, params);

    expect(expand).toThrow(InvalidUriTemplateError);
    expect(expand).toThrow(
      expect.objectContaining({
        givenParameters: params,
        availableParameters: [],
      }),
    );
  });
});
