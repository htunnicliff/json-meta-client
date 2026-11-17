// Kitchen sink: query a baseline and inspect subsequent changes.
// A production sync loop should persist the state and handle hasMoreChanges.
const initial = await client.api.Email.get({ ids: [] });
const changes = await client.api.Email.changes({ sinceState: initial.state });
console.log("Created", changes.created);
console.log("Updated", changes.updated);
console.log("Destroyed", changes.destroyed);
console.log("More changes", changes.hasMoreChanges);
