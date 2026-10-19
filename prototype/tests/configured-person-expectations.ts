/** Test expectations only: configured names are not authenticated actors. */
import sourceDemo from "../../seed/demo-data.json" with { type: "json" };
import retainedDemo from "../src/compat/operational-data.json" with { type: "json" };

// The same source-over-compatibility spread as production config.ts. The
// owner's complete demo_users array replaces any compatibility-era captions.
const configuredDemo = { ...retainedDemo, ...sourceDemo };
export function configuredPersonExpectation(username: string) {
  const matches = configuredDemo.demo_users.filter(
    (person) => person.username === username,
  );
  const person = matches[0];
  if (
    matches.length !== 1 ||
    !person?.id.trim() ||
    !person.username.trim() ||
    !person.name_en.trim()
  )
    throw new Error(
      `Configured demo person is missing or ambiguous: ${username}`,
    );
  // Metadata only. No password, role, fixture flag, assignments or session is
  // returned, and this helper never writes or grants access to business data.
  return Object.freeze({
    id: person.id,
    username: person.username,
    name_en: person.name_en,
    name_fa: person.name_fa,
  });
}
