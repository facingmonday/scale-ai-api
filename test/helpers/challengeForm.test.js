const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");
const { JSDOM } = require("jsdom");
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: "https://example.test", pretendToBeVisual: true });
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "Element", "Node", "MutationObserver", "sessionStorage", "localStorage", "getComputedStyle"]) global[key] = dom.window[key];
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true });
global.requestAnimationFrame = (fn) => setTimeout(fn, 0);
global.cancelAnimationFrame = clearTimeout;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require("react");
const { render, fireEvent, screen, waitFor, cleanup, act } = require("@testing-library/react");
const { useForm, FormProvider } = require("react-hook-form");
require("esbuild-register/dist/node").register({ jsx: "automatic" });
const { withRequestDeadline } = require("../../apps/web/src/utils/requestDeadline.ts");
const h = React.createElement;
const root = path.resolve(__dirname, "../../apps/web/src");
let challenge, definitions, saved, submitImpl, refetchImpl, definitionPayload;
const classroom = { _id: "classroom" };
const auth = { user: { id: "student" }, activeClassroom: classroom, refetchMe: (...args) => refetchImpl(...args) };
const clerk = { signOut: async () => {} };
const key = "challenge-draft:student:classroom:challenge";
const challengeService = { getById: async () => ({ data: structuredClone(challenge) }) };
const variablesService = {
  getAll: async () => ({ data: structuredClone(definitions) }),
  create: async (payload) => { definitionPayload = payload; },
  update: async (_key, _classroom, payload) => { definitionPayload = payload; },
};
const decisionService = {
  submit: (...args) => submitImpl(...args),
  update: (_id, ...args) => submitImpl(...args),
  getStudentSubmissions: async () => ({ data: [] }),
};
const noop = () => null;
const load = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === "@clerk/clerk-react") return { useClerk: () => clerk };
  if (request === "react-router-dom") return { useParams: () => ({ id: "challenge" }), useNavigate: () => noop };
  if (request === "primereact/dialog") return { Dialog: ({ visible, children, footer }) => visible ? h("div", { role: "dialog" }, children, footer) : null };
  if (request === "primereact/tooltip") return { Tooltip: noop };
  const resolved = request.startsWith("@/") ? path.join(root, request.slice(2)) : request.startsWith(".") && parent ? path.resolve(path.dirname(parent.filename), request) : request;
  const name = resolved.replace(/\.(tsx?|jsx?)$/, "");
  if (name === path.join(root, "utils/requestDeadline")) {
    const actual = load.call(this, resolved, parent, isMain);
    return { ...actual, withRequestDeadline: (fn, signal) => withRequestDeadline(fn, signal, 80) };
  }
  if (name === path.join(root, "context/AuthContext")) return { useAuth: () => auth };
  if (name === path.join(root, "context/GlobalContext")) return { useGlobalContext: () => ({ showToast: noop }) };
  if (name === path.join(root, "services/challenge")) return { __esModule: true, default: challengeService };
  if (name === path.join(root, "services/decision")) return { __esModule: true, default: decisionService };
  if (name === path.join(root, "services/variableDefinition")) return { __esModule: true, default: variablesService };
  if (name === path.join(root, "services/profile")) return { __esModule: true, default: { getStudentStore: async () => ({ data: { _id: "profile" } }) } };
  if (name === path.join(root, "components/Layouts/BasicLayout")) return { __esModule: true, default: ({ children }) => children };
  if (["Outcome", "LedgerVisualization", "PreviousChallengeResults", "ProfileSummary", "SubmissionDeadlineCard", "LoadingOverlay", "VariableDefinitionDeleteButton"].some((component) => name === path.join(root, "components", component))) return { __esModule: true, default: noop };
  return load.call(this, resolved, parent, isMain);
};
const Challenge = require("../../apps/web/src/pages/Student/Challenge/Challenge.tsx").default;
const VariableDefinitionsForm = require("../../apps/web/src/components/VariableDefinitionsForm.tsx").default;
const AddVariable = require("../../apps/web/src/components/VariableDefinitionsAddButton.tsx").default;
const variable = (key, inputType, value, extra = {}) => ({
  _id: key, key, label: key, dataType: "number", inputType, defaultValue: value, value,
  appliesTo: "challenge", required: true, isActive: true, min: 0, max: 100, options: [], ...extra,
});
test.beforeEach(() => {
  sessionStorage.clear();
  saved = []; definitionPayload = undefined;
  challenge = { _id: "challenge", title: "Selling Out", isPublished: true, isClosed: false, variables: { coverage: 4, local: 50, orders: 100 } };
  definitions = [variable("coverage", "number", 4), variable("local", "slider", 50), variable("orders", "number", 100)];
  submitImpl = async (payload) => { saved.push(payload); return { data: { _id: "decision", ...payload } }; };
  refetchImpl = async () => ({ activeClassroom: classroom });
});
test.afterEach(() => cleanup());
test.after(() => { Module._load = load; dom.window.close(); });
async function mountChallenge() {
  render(h(Challenge));
  const button = await screen.findByRole("button", { name: "Submit Challenge" });
  await waitFor(() => assert.equal(button.disabled, false));
  return button;
}

test("complete initial answers submit without touching any controls", async () => {
  fireEvent.click(await mountChallenge());
  await waitFor(() => assert.equal(saved.length, 1));
  assert.deepEqual(saved[0].challengeVariableAnswers, { coverage: 4, local: 50, orders: 100 });
});

test("restored answers including zero and false submit, and the draft stays cleared", async () => {
  definitions.push(variable("promote", "checkbox", false, { dataType: "boolean" }));
  sessionStorage.setItem(key, JSON.stringify({ variables: {}, challengeVariableAnswers: { coverage: "4", local: 0, orders: 100, promote: false } }));
  fireEvent.click(await mountChallenge());
  await waitFor(() => assert.equal(saved.length, 1));
  assert.deepEqual(saved[0].challengeVariableAnswers, { coverage: 4, local: 0, orders: 100, promote: false });
  await waitFor(() => assert.equal(sessionStorage.getItem(key), null));
});

test("an empty restored slider shows an unanswered state and an actionable error", async () => {
  sessionStorage.setItem(key, JSON.stringify({ variables: {}, challengeVariableAnswers: { local: null } }));
  const button = await mountChallenge();
  assert.ok(screen.getByText("Choose a value"));
  fireEvent.click(button);
  const errorLink = await screen.findByRole("button", { name: "local: This field is required" });
  assert.equal(saved.length, 0);
  fireEvent.click(errorLink);
  assert.equal(document.activeElement.getAttribute("role"), "slider");
  fireEvent.keyDown(document.activeElement, { key: "ArrowRight", code: "ArrowRight" });
  fireEvent.click(button);
  await waitFor(() => assert.equal(saved.length, 1));
});

test("missing text remains submittable with guidance, and correcting it allows saving", async () => {
  definitions.push(variable("reason", "text", "", { dataType: "string", appliesTo: "decision" }));
  const button = await mountChallenge();
  fireEvent.click(button);
  await screen.findByRole("button", { name: "reason: This field is required" });
  assert.equal(button.disabled, false);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "My decision" } });
  fireEvent.click(button);
  await waitFor(() => assert.equal(saved.length, 1));
  assert.equal(saved[0].variables.reason, "My decision");
});

test("duplicate clicks send one write and timed-out writes keep drafts and ignore late results", async () => {
  let finish;
  submitImpl = async (payload) => { saved.push(payload); return new Promise((resolve) => { finish = resolve; }); };
  const button = await mountChallenge();
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => assert.equal(saved.length, 1));
  await screen.findByText(/Your changes have not been confirmed/);
  assert.equal(button.disabled, false);
  assert.ok(sessionStorage.getItem(key));
  await act(async () => finish({ data: { _id: "late" } }));
  assert.equal(screen.queryByRole("dialog") === null, true);
  assert.ok(sessionStorage.getItem(key));
  fireEvent.click(button);
  await screen.findByText(/Your submission status was refreshed/);
  assert.equal(saved.length, 1);
});

test("a hung session check releases the button and preserves answers", async () => {
  await mountChallenge();
  refetchImpl = async () => new Promise(() => {});
  fireEvent(window, new window.Event("focus"));
  await screen.findByRole("button", { name: "Checking session..." });
  await screen.findByText(/We could not refresh this challenge/);
  assert.equal(screen.getByRole("button", { name: "Submit Challenge" }).disabled, false);
});

test("fields removed on refresh no longer block submission", async () => {
  definitions.push(variable("reason", "text", "", { dataType: "string" }));
  const button = await mountChallenge();
  fireEvent.click(button);
  await screen.findByRole("button", { name: "reason: This field is required" });
  definitions = definitions.filter((item) => item.key !== "reason");
  fireEvent(window, new window.Event("focus"));
  await waitFor(() => assert.equal(screen.queryByRole("textbox") === null, true));
  fireEvent.click(screen.getByRole("button", { name: "Submit Challenge" }));
  await waitFor(() => assert.equal(saved.length, 1));
});

function DefinitionHarness({ inputType = "checkbox", defaultValueText = "" }) {
  const form = useForm({ defaultValues: { label: "Promote", appliesTo: "challenge", dataType: "boolean", inputType, defaultValueText, required: false, isActive: true } });
  return h(FormProvider, { ...form }, h(VariableDefinitionsForm));
}

test("boolean defaults use a checkbox, initialize false and update the preview", async () => {
  render(h(DefinitionHarness));
  const control = screen.getByLabelText("Default value");
  assert.equal(control.type, "checkbox");
  assert.equal(control.checked, false);
  assert.ok(screen.getByText("False (No)"));
  fireEvent.click(control);
  await screen.findByText("True (Yes)");
  assert.equal(screen.getAllByRole("checkbox").filter((input) => input.checked).length, 3); // default, active, preview
});

test("boolean defaults use a switch when selected and preserve existing true", async () => {
  render(h(DefinitionHarness, { inputType: "switch", defaultValueText: "true" }));
  const control = screen.getByLabelText("Default value");
  assert.equal(control.getAttribute("role"), "switch");
  assert.equal(control.checked, true);
  fireEvent.click(control);
  await screen.findByText("False (No)");
});

test("creating a boolean variable saves a real false default without typing", async () => {
  render(h(AddVariable, { classroomId: "classroom", variant: "create", defaultAppliesTo: "challenge", challengeId: "challenge" }));
  fireEvent.click(screen.getByRole("button", { name: "+ Create" }));
  fireEvent.change(screen.getByLabelText("Label *"), { target: { value: "Promote" } });
  fireEvent.change(screen.getByLabelText("Data type *"), { target: { value: "boolean" } });
  const save = screen.getByRole("button", { name: "Save" });
  await waitFor(() => assert.equal(save.disabled, false));
  fireEvent.click(save);
  await waitFor(() => assert.equal(definitionPayload?.defaultValue, false));
  assert.equal(definitionPayload.inputType, "checkbox");
});

test("editing an existing true default and turning it off saves false", async () => {
  render(h(AddVariable, { classroomId: "classroom", variant: "edit", variableDefinition: variable("Promote", "switch", true, { dataType: "boolean", challengeId: "challenge" }) }));
  fireEvent.click(screen.getByRole("button", { name: "Edit Promote" }));
  const control = screen.getByLabelText("Default value");
  assert.equal(control.checked, true);
  fireEvent.click(control);
  const save = screen.getByRole("button", { name: "Save" });
  await waitFor(() => assert.equal(save.disabled, false));
  fireEvent.click(save);
  await waitFor(() => assert.equal(definitionPayload?.defaultValue, false));
});

test("an existing decision uses update and server failures keep the draft", async () => {
  challenge.decision = { _id: "existing", variables: { price: 1 }, challengeVariableAnswers: challenge.variables };
  const update = decisionService.update;
  const ids = [];
  decisionService.update = async (id, payload) => { ids.push(id); saved.push(payload); throw new Error("Please try again"); };
  try {
    render(h(Challenge));
    const button = await screen.findByRole("button", { name: "Update Decision" });
    await waitFor(() => assert.equal(button.disabled, false));
    fireEvent.click(button);
    await screen.findByText(/Your changes have not been confirmed/);
    assert.deepEqual(ids, ["existing"]);
    assert.ok(sessionStorage.getItem(key));
    assert.equal(button.disabled, false);
  } finally { decisionService.update = update; }
});

test("malformed draft data does not prevent submission", async () => {
  sessionStorage.setItem(key, "not-json");
  fireEvent.click(await mountChallenge());
  await waitFor(() => assert.equal(saved.length, 1));
});

test("numeric edits survive unmount and remount with their exact value", async () => {
  await mountChallenge();
  const input = screen.getAllByRole("spinbutton").at(-1);
  fireEvent.input(input, { target: { value: "80" } });
  fireEvent.blur(input);
  await waitFor(() => assert.equal(JSON.parse(sessionStorage.getItem(key)).challengeVariableAnswers.orders, 80));
  cleanup();
  await mountChallenge();
  assert.equal(screen.getAllByRole("spinbutton").at(-1).value, "80");
  fireEvent(window, new window.Event("pageshow"));
  await waitFor(() => assert.equal(screen.getByRole("button", { name: "Submit Challenge" }).disabled, false));
  assert.equal(screen.getAllByRole("spinbutton").at(-1).value, "80");
});

test("a pageshow refresh during draft hydration cannot overwrite pending answers", async (t) => {
  sessionStorage.setItem(key, JSON.stringify({ variables: {}, challengeVariableAnswers: { coverage: 4, local: 50, orders: 70 } }));
  const getItem = dom.window.Storage.prototype.getItem;
  let refreshed = false;
  t.mock.method(dom.window.Storage.prototype, "getItem", function (name) {
    const value = getItem.call(this, name);
    if (name === key && !refreshed) {
      refreshed = true;
      window.dispatchEvent(new window.Event("pageshow"));
    }
    return value;
  });
  const button = await mountChallenge();
  assert.equal(refreshed, true);
  assert.equal(screen.getAllByRole("spinbutton").at(-1).value, "70");
  fireEvent.click(button);
  await waitFor(() => assert.equal(saved.length, 1));
  assert.equal(saved[0].challengeVariableAnswers.orders, 70);
});

test("pageshow during initial loading does not start a competing refresh", async (t) => {
  let release;
  t.mock.method(challengeService, "getById", () => new Promise((resolve) => { release = resolve; }));
  let refreshes = 0;
  refetchImpl = async () => { refreshes++; return { activeClassroom: classroom }; };
  render(h(Challenge));
  fireEvent(window, new window.Event("pageshow"));
  assert.equal(refreshes, 0);
  await act(async () => release({ data: challenge }));
  const button = await screen.findByRole("button", { name: "Submit Challenge" });
  assert.equal(button.disabled, false);
  fireEvent.click(button);
  await waitFor(() => assert.equal(saved.length, 1));
});

test("expired authentication preserves answers before signing out", async (t) => {
  const { AuthenticationRequiredError } = require("../../apps/web/src/services/authenticatedRequest.ts");
  let signedOut = false;
  t.mock.method(clerk, "signOut", async () => { signedOut = true; });
  submitImpl = async () => { throw new AuthenticationRequiredError(); };
  fireEvent.click(await mountChallenge());
  await waitFor(() => assert.equal(signedOut, true));
  assert.ok(sessionStorage.getItem(key));
  assert.equal(screen.getByRole("button", { name: "Submit Challenge" }).disabled, false);
});
