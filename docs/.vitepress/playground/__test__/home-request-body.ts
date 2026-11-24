/**
 * The JMAP Request the home page example makes, with the playground's seeded
 * call ids named after the variables they are bound to
 */
export const homeRequestBody = {
  using: ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
  methodCalls: [
    [
      "Email/query",
      { filter: { notKeyword: "$seen" }, limit: 5, accountId: "<account-id>" },
      "unread",
    ],
    [
      "Email/get",
      {
        "#ids": { name: "Email/query", resultOf: "unread", path: "/ids" },
        properties: ["subject", "from"],
        accountId: "<account-id>",
      },
      "emails",
    ],
  ],
};
