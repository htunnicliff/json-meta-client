// PROTOTYPE (#201): cases from the issue. Lines are 1-based; each case lists
// the source as an array so the line numbers are explicit.
export const cases = [
  {
    name: "multi-line call with a result reference in its arguments",
    source: [
      /* 1 */ `const q = client.api.Email.query({`,
      /* 2 */ `  filter: { inMailbox: "<id>" },`,
      /* 3 */ `});`,
      /* 4 */ `const g = client.api.Email.get({`,
      /* 5 */ `  ids: q.resultRef("/ids"),`,
      /* 6 */ `  properties: ["id"],`,
      /* 7 */ `});`,
      /* 8 */ `const emails = await g;`,
      /* 9 */ `console.log(emails);`,
    ],
    expect: { calls: { "Email/query": [1], "Email/get": [4] }, pending: { 8: 1 }, notReached: [9] },
  },
  {
    name: "helper function, map callback and loop",
    source: [
      /* 1 */ `function findIn(id: string) {`,
      /* 2 */ `  return client.api.Email.query({ filter: { inMailbox: id } });`,
      /* 3 */ `}`,
      /* 4 */ `const ids = ["a", "b"];`,
      /* 5 */ `const queries = ids.map((id) => findIn(id));`,
      /* 6 */ `for (const id of ["c", "d"]) {`,
      /* 7 */ `  void findIn(id);`,
      /* 8 */ `}`,
      /* 9 */ `const [x] = await Promise.all(queries);`,
      /* 10 */ `console.log(x);`,
    ],
    expect: { calls: { "Email/query": [2, 2, 2, 2] }, pending: { 9: 1 }, notReached: [10] },
  },
  {
    name: "await in a function called from several places",
    source: [
      /* 1 */ `async function load(id: string) {`,
      /* 2 */ `  const r = await client.api.Email.get({ ids: [id] });`,
      /* 3 */ `  return r.list;`,
      /* 4 */ `}`,
      /* 5 */ `const a = load("a");`,
      /* 6 */ `const b = load("b");`,
      /* 7 */ `const c = load("c");`,
      /* 8 */ `await Promise.all([a, b, c]);`,
      /* 9 */ `console.log("done");`,
    ],
    expect: { calls: { "Email/get": [2, 2, 2] }, pending: { 2: 3, 8: 1 }, notReached: [3, 9] },
  },
  {
    name: "several calls pending at once (Promise.all)",
    source: [
      /* 1 */ `const [q1, q2] = await Promise.all([`,
      /* 2 */ `  client.api.Email.query({ limit: 1 }),`,
      /* 3 */ `  client.api.Mailbox.query({}),`,
      /* 4 */ `]);`,
      /* 5 */ `console.log(q1, q2);`,
    ],
    expect: {
      calls: { "Email/query": [2], "Mailbox/query": [3] },
      pending: { 1: 1 },
      notReached: [5],
    },
  },
  {
    name: "await inside call arguments; settled await clears its badge",
    source: [
      /* 1 */ `const session = await client.session;`,
      /* 2 */ `console.log(await client.api.Email.get({ ids: ["x"] }));`,
      /* 3 */ `console.log("after");`,
    ],
    expect: { calls: { "Email/get": [2] }, pending: { 2: 1 }, notReached: [3] },
  },
  {
    name: "not reached: skipped branch, later code, never-entered function",
    source: [
      /* 1 */ `const handlers = {`,
      /* 2 */ `  onDone() {`,
      /* 3 */ `    console.log("never called");`,
      /* 4 */ `  },`,
      /* 5 */ `};`,
      /* 6 */ `if (Math.random() > 2) {`,
      /* 7 */ `  console.log("skipped branch");`,
      /* 8 */ `}`,
      /* 9 */ `const r = await client.api.Email.get({ ids: ["x"] });`,
      /* 10 */ `handlers.onDone();`,
    ],
    // Line 3 is in a function that was never entered, so it is NOT greyed.
    expect: { calls: { "Email/get": [9] }, pending: { 9: 1 }, notReached: [7, 10] },
  },
];
