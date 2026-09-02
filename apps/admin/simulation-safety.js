const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const MAX_SIMULATED_STUDENTS = 100;

function parseStudentCount(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > MAX_SIMULATED_STUDENTS) {
    throw new Error(
      `studentCount must be an integer between 1 and ${MAX_SIMULATED_STUDENTS}`,
    );
  }
  return count;
}

function getMongoHostname(env = process.env) {
  const uri = env.MONGO_URL || env.MONGO_URI;
  if (uri) {
    try {
      return new URL(uri).hostname;
    } catch (_) {
      throw new Error("Simulation Runner could not parse the configured MongoDB URL");
    }
  }
  return env.MONGO_HOSTNAME || "localhost";
}

function assertSafeSimulationEnvironment(env = process.env) {
  if (env.NODE_ENV === "production") {
    throw new Error("Simulation Runner is disabled when NODE_ENV=production");
  }

  const hostname = getMongoHostname(env);
  if (
    !LOCAL_HOSTS.has(hostname) &&
    env.SIMULATION_RUNNER_ALLOW_REMOTE_DATABASE !== "true"
  ) {
    throw new Error(
      `Simulation Runner refuses remote MongoDB host ${hostname}. ` +
        "Set SIMULATION_RUNNER_ALLOW_REMOTE_DATABASE=true only for an isolated non-production test database.",
    );
  }

  return { hostname };
}

function isLocalWebOrigin(value) {
  if (!value) return true;
  try {
    return LOCAL_HOSTS.has(new URL(value).hostname);
  } catch (_) {
    return false;
  }
}

function assertLocalRequest(req) {
  const requestHost = String(req.hostname || "").toLowerCase();
  if (!LOCAL_HOSTS.has(requestHost)) {
    throw new Error("Simulation Runner only accepts requests addressed to localhost");
  }
  if (!isLocalWebOrigin(req.get?.("origin"))) {
    throw new Error("Simulation Runner rejected a non-local browser origin");
  }
}

function isSyntheticSimulationUser(member) {
  return Boolean(
    member?.isSimulationUser ||
      String(member?.clerkUserId || "").startsWith("sim_"),
  );
}

function assertSimulationRoster(students, requestedCount) {
  const roster = Array.isArray(students) ? students : [];
  if (roster.some((student) => !isSyntheticSimulationUser(student))) {
    throw new Error(
      "Safety check failed: the selected simulation classroom contains non-simulation students",
    );
  }
  if (roster.length !== requestedCount) {
    throw new Error(
      `Selected simulation classroom has ${roster.length} students, but ${requestedCount} were requested`,
    );
  }
  return roster;
}

module.exports = {
  MAX_SIMULATED_STUDENTS,
  assertLocalRequest,
  assertSafeSimulationEnvironment,
  assertSimulationRoster,
  getMongoHostname,
  isLocalWebOrigin,
  isSyntheticSimulationUser,
  parseStudentCount,
};
