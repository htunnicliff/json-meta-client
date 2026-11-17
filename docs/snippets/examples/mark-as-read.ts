// Mark the first unread message as seen.
const unread = await client.api.Email.query({
  filter: { notKeyword: "$seen" },
  limit: 1,
});
const id = unread.ids[0];
if (id) {
  await client.api.Email.set({
    update: { [id]: { "keywords/$seen": true } },
  });
}
