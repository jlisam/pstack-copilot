import {
	existsSync,
	lstatSync,
	readFileSync,
	readdirSync,
	realpathSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
	REPOSITORY_ROOT,
	EXPLICIT_ONLY_SKILLS,
	buildExpectedReleaseFiles,
	buildInventory,
	generatedFileProblems,
	parsePluginManifest,
	parseUpstreamProvenance,
	releaseIdentityProblems,
	scanPublicFiles,
	stableJson,
} from "./generate-release-files.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const EXPECTED_AGENT_FILES = ["comment-sicko.agent.md", "poteto-agent.agent.md"];
const EXPECTED_AGENT_IDS = EXPECTED_AGENT_FILES.map((name) =>
	name.slice(0, -".agent.md".length),
);
const DECISION_POLICY_PATH =
	"pstack/skills/poteto-mode/references/task-contract.md";
const REQUIRED_DECISION_POLICY = [
	"If `ask_user` is available, use it for structured choices.",
	"Otherwise ask one concise plain-text question with numbered choices and end the turn.",
	"Never continue through an irreversible action, destructive step, publication, deployment, or unresolved product decision because the structured tool is unavailable.",
];
const FORBIDDEN_DECISION_POLICY = [
	["Always pause through `ask", "user`"].join("_"),
	["never ask in plain", "text"].join(" "),
	["Do not ask in plain", "text"].join(" "),
	["never a plain-text", "question"].join(" "),
];
const REQUIRED_PATHS = [
	".github/plugin/marketplace.json",
	".github/workflows/verify.yml",
	".gitignore",
	"CHANGELOG.md",
	"CONTRIBUTING.md",
	"LICENSE",
	"NOTICE.md",
	"README.md",
	"SECURITY.md",
	"inventory.json",
	"pstack/LICENSE",
	"pstack/NOTICE.md",
	"pstack/README.md",
	"pstack/plugin.json",
	"scripts/compare-upstream.sh",
	"scripts/generate-release-files.mjs",
	"scripts/smoke-install.sh",
	"scripts/validate.mjs",
	"upstream.json",
];
const FORBIDDEN_TEXT = [
	["", "Users", "jlisam"].join("/"),
	["pstack-copilot", "local"].join("-"),
	["~", ".cursor"].join("/"),
	[".cursor", "skills"].join("/"),
	["Ask", "Question"].join(""),
	["subagent", "type"].join("_"),
	["general", "Purpose"].join(""),
	["run", "in", "background"].join("_"),
	["cloud", "base", "branch"].join("_"),
	["cursor", "team", "kit"].join("-"),
	["/add", "plugin"].join("-"),
	["/", "loop"].join(""),
];
const compareStrings = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const failures = [];

function fail(message) {
	failures.push(message);
}

function arraysEqual(left, right) {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}

function listPublicEntries(root) {
	const entries = [];

	function walk(directory, relativeDirectory) {
		const children = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
			compareStrings(left.name, right.name),
		);
		for (const child of children) {
			const relativePath = relativeDirectory
				? `${relativeDirectory}/${child.name}`
				: child.name;
			if (relativePath === ".git" || relativePath.startsWith(".git/")) continue;
			const absolutePath = path.join(directory, child.name);
			const type = child.isDirectory()
				? "directory"
				: child.isFile()
					? "file"
					: child.isSymbolicLink()
						? "symlink"
						: "other";
			entries.push({ path: relativePath, type });
			if (type === "directory") walk(absolutePath, relativePath);
		}
	}

	walk(root, "");
	return entries;
}

function forbiddenPathReason(relativePath) {
	const segments = relativePath.split("/").map((segment) => segment.toLowerCase());
	for (const segment of segments) {
		if (
			[".cursor-plugin", "automations", "node_modules", ".audit", "logs"].includes(
				segment,
			)
		) {
			return `contains forbidden path segment ${segment}`;
		}
		if (segment.replace(/[._\s-]/g, "") === "sessionstate") {
			return "contains session state";
		}
	}
	if (/\.new-\d+-\d+$/.test(segments.at(-1) ?? "")) {
		return "is a stale generated temporary file";
	}
	if (segments.at(-1)?.endsWith(".log")) return "is a log file";
	return null;
}

function runGit(root, args, encoding = "utf8") {
	return spawnSync("git", ["-C", root, ...args], {
		encoding,
		maxBuffer: 64 * 1024 * 1024,
	});
}

function gitRepository(root) {
	const result = runGit(root, ["rev-parse", "--show-toplevel"]);
	if (result.status !== 0) return null;
	const reportedRoot = result.stdout.trim();
	let actualRoot;
	let expectedRoot;
	try {
		actualRoot = realpathSync(reportedRoot);
		expectedRoot = realpathSync(root);
	} catch {
		fail("Git reported an unreadable repository root");
		return null;
	}
	if (actualRoot !== expectedRoot) {
		fail(`repository is nested inside a different Git worktree at ${reportedRoot}`);
		return null;
	}
	return reportedRoot;
}

function gitTrackedModes(root) {
	const result = runGit(root, ["ls-files", "--stage", "-z"], "buffer");
	if (result.status !== 0) {
		fail("git ls-files --stage failed");
		return new Map();
	}
	const modes = new Map();
	for (const record of result.stdout.toString("utf8").split("\0")) {
		if (!record) continue;
		const tab = record.indexOf("\t");
		if (tab === -1) continue;
		const mode = record.slice(0, record.indexOf(" "));
		const relativePath = record.slice(tab + 1);
		modes.set(relativePath, mode);
	}
	return modes;
}

function gitCandidatePaths(root) {
	const result = runGit(
		root,
		["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
		"buffer",
	);
	if (result.status !== 0) {
		fail("git ls-files for current candidates failed");
		return [];
	}
	return result.stdout
		.toString("utf8")
		.split("\0")
		.filter(Boolean)
		.sort(compareStrings);
}

function stripYamlQuotes(value) {
	if (
		value.length >= 2 &&
		((value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'")))
	) {
		return value.slice(1, -1);
	}
	return value;
}

function skillFrontmatter(text, relativePath) {
	const lines = text.replace(/\r\n/g, "\n").split("\n");
	if (lines[0] !== "---") {
		fail(`${relativePath} has no opening frontmatter delimiter`);
		return null;
	}
	const end = lines.indexOf("---", 1);
	if (end === -1) {
		fail(`${relativePath} has no closing frontmatter delimiter`);
		return null;
	}
	const frontmatter = lines.slice(1, end);
	let name = "";
	let description = "";
	let disableModelInvocation = false;
	for (let index = 0; index < frontmatter.length; index++) {
		const line = frontmatter[index];
		const match = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
		if (!match) continue;
		const [, key, rawValue = ""] = match;
		if (key === "name") name = stripYamlQuotes(rawValue.trim());
		if (key === "disable-model-invocation") {
			disableModelInvocation = rawValue.trim() === "true";
		}
		if (key !== "description") continue;
		const trimmed = rawValue.trim();
		if (/^[>|][+-]?$/.test(trimmed)) {
			const parts = [];
			for (let next = index + 1; next < frontmatter.length; next++) {
				if (!/^\s+/.test(frontmatter[next])) break;
				parts.push(frontmatter[next].trim());
				index = next;
			}
			description = parts.join(" ").trim();
		} else {
			description = stripYamlQuotes(trimmed);
		}
	}
	return { name, description, disableModelInvocation };
}

function markdownSource(text) {
	const kept = [];
	let fence = null;
	for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
		const marker = line.match(/^\s*(```+|~~~+)/)?.[1] ?? null;
		if (marker) {
			if (fence === null) fence = marker;
			else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
			kept.push("");
			continue;
		}
		kept.push(fence === null ? line.replace(/`[^`]*`/g, "") : "");
	}
	return kept.join("\n");
}

function markdownLinks(text) {
	const source = markdownSource(text);
	const links = [];
	const inline = /!?\[([^\]]*)\]\(([^)\n]+)\)/g;
	const reference = /^[ \t]*\[([^\]]+)\]:[ \t]*(\S.*)$/gm;
	for (const match of source.matchAll(inline)) {
		links.push({ label: match[1], rawDestination: match[2], index: match.index });
	}
	for (const match of source.matchAll(reference)) {
		links.push({ label: match[1], rawDestination: match[2], index: match.index });
	}
	return { source, links };
}

function decodeMarkdownDestination(rawDestination) {
	let destination = rawDestination.trim();
	if (destination.startsWith("<")) {
		const closing = destination.indexOf(">");
		if (closing === -1) throw new Error("has an unclosed angle-bracket destination");
		destination = destination.slice(1, closing);
	} else {
		destination = destination.split(/\s+/)[0];
	}
	try {
		destination = decodeURIComponent(destination);
	} catch {
		throw new Error("has an invalid URL escape");
	}
	const hash = destination.indexOf("#");
	if (hash !== -1) destination = destination.slice(0, hash);
	const query = destination.indexOf("?");
	if (query !== -1) destination = destination.slice(0, query);
	return destination;
}

function isInside(parent, child) {
	const relativePath = path.relative(parent, child);
	return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function validateMarkdownLinks(root, markdownPath, boundaryRoot) {
	const absolutePath = path.join(root, markdownPath);
	const text = readFileSync(absolutePath, "utf8");
	const { source, links } = markdownLinks(text);
	for (const link of links) {
		const line = source.slice(0, link.index).split("\n").length;
		let destination;
		try {
			destination = decodeMarkdownDestination(link.rawDestination);
		} catch (error) {
			fail(`${markdownPath}:${line} ${error.message}`);
			continue;
		}
		if (
			destination === "" ||
			destination.startsWith("#") ||
			/^(?:https?:|mailto:)/i.test(destination)
		) {
			continue;
		}
		if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(destination)) {
			fail(`${markdownPath}:${line} uses unsupported link scheme in ${destination}`);
			continue;
		}
		if (destination.includes("\\")) {
			fail(`${markdownPath}:${line} uses a backslash in ${destination}`);
			continue;
		}
		const resolved = path.resolve(path.dirname(absolutePath), destination);
		if (!isInside(boundaryRoot, resolved)) {
			fail(`${markdownPath}:${line} link escapes its repository boundary: ${destination}`);
			continue;
		}
		if (!existsSync(resolved)) {
			fail(`${markdownPath}:${line} link target is missing: ${destination}`);
			continue;
		}
		let realTarget;
		try {
			realTarget = realpathSync(resolved);
		} catch {
			fail(`${markdownPath}:${line} link target is unreadable: ${destination}`);
			continue;
		}
		if (!isInside(realpathSync(boundaryRoot), realTarget)) {
			fail(`${markdownPath}:${line} link resolves outside its repository boundary: ${destination}`);
		}
	}
}

function validateUpstreamUrlUse(relativePath, text, upstreamRepository) {
	if (relativePath === "upstream.json") return;
	const occurrences = text.split(upstreamRepository).length - 1;
	if (occurrences === 0) return;
	const { links } = markdownLinks(text);
	const explanatoryLinks = links.filter((link) => {
		if (!/upstream/i.test(link.label)) return false;
		try {
			return decodeMarkdownDestination(link.rawDestination).startsWith(upstreamRepository);
		} catch {
			return false;
		}
	}).length;
	if (occurrences !== explanatoryLinks) {
		fail(`${relativePath} uses the upstream repository URL outside an explanatory link`);
	}
}

function validateInstallCommands(root, plugin) {
	const repositoryUrl = new URL(plugin.repository);
	const repositorySlug = repositoryUrl.pathname.replace(/^\/|\/$/g, "").replace(/\.git$/, "");
	const commands = [
		`copilot plugin marketplace add ${repositorySlug}`,
		`copilot plugin install ${plugin.name}@${plugin.name}`,
	].join("\n");
	for (const relativePath of [
		"README.md",
		"pstack/README.md",
		"pstack/docs/guide/01-setup.md",
	]) {
		const text = readFileSync(path.join(root, relativePath), "utf8");
		if (!text.includes(commands)) {
			fail(`${relativePath} does not contain the canonical public install commands`);
		}
	}
	const rootReadme = readFileSync(path.join(root, "README.md"), "utf8");
	for (const command of [
		`copilot plugin update ${plugin.name}@${plugin.name}`,
		`copilot plugin uninstall ${plugin.name}@${plugin.name}`,
	]) {
		if (!rootReadme.includes(command)) {
			fail(`README.md does not contain canonical command ${command}`);
		}
	}
}

function main() {
	if (process.argv.length !== 2) {
		console.error("Usage: node scripts/validate.mjs");
		return 2;
	}

	for (const relativePath of REQUIRED_PATHS) {
		if (!existsSync(path.join(REPOSITORY_ROOT, relativePath))) {
			fail(`${relativePath} is missing`);
		}
	}
	if (failures.length > 0) return reportFailures();

	let plugin;
	let upstream;
	try {
		plugin = parsePluginManifest(
			readFileSync(path.join(REPOSITORY_ROOT, "pstack/plugin.json"), "utf8"),
		);
		upstream = parseUpstreamProvenance(
			readFileSync(path.join(REPOSITORY_ROOT, "upstream.json"), "utf8"),
		);
	} catch (error) {
		fail(error.message);
		return reportFailures();
	}

	const licenseBytes = readFileSync(path.join(REPOSITORY_ROOT, "pstack/LICENSE"));
	const identityProblems = releaseIdentityProblems(plugin, upstream, licenseBytes);
	for (const problem of identityProblems) fail(problem);
	if (identityProblems.length > 0) return reportFailures();
	const upstreamKeys = Object.keys(upstream).sort(compareStrings);
	const expectedUpstreamKeys = [
		"author",
		"commit",
		"licenseSha256",
		"path",
		"repository",
		"version",
	];
	if (!arraysEqual(upstreamKeys, expectedUpstreamKeys)) {
		fail("upstream.json must contain exactly repository, path, version, and commit");
	}

	const files = scanPublicFiles(REPOSITORY_ROOT);
	const inventory = buildInventory(files);
	const expectedFiles = buildExpectedReleaseFiles({
		plugin,
		upstream,
		inventory,
		licenseBytes,
	});
	for (const problem of generatedFileProblems(REPOSITORY_ROOT, expectedFiles)) fail(problem);

	let recordedInventory;
	try {
		recordedInventory = JSON.parse(
			readFileSync(path.join(REPOSITORY_ROOT, "inventory.json"), "utf8"),
		);
	} catch (error) {
		fail(`inventory.json is not valid JSON: ${error.message}`);
		recordedInventory = null;
	}
	if (recordedInventory !== null) {
		const inventoryKeys = Object.keys(recordedInventory).sort(compareStrings);
		if (
			!arraysEqual(inventoryKeys, [
				"agents",
				"executables",
				"modelInvocationDisabled",
				"playbooks",
				"skills",
				"tests",
			])
		) {
			fail("inventory.json has unexpected keys");
		}
		if (stableJson(recordedInventory) !== stableJson(inventory)) {
			fail("inventory.json does not exactly match the public tree");
		}
	}
	if (
		!arraysEqual(
			inventory.modelInvocationDisabled,
			[...EXPLICIT_ONLY_SKILLS].sort(compareStrings),
		)
	) {
		fail(
			`model-invocation-disabled skills must be exactly ${EXPLICIT_ONLY_SKILLS.join(", ")}`,
		);
	}

	const skillDirectory = path.join(REPOSITORY_ROOT, "pstack/skills");
	const skillNames = readdirSync(skillDirectory, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort(compareStrings);
	if (!arraysEqual(skillNames, inventory.skills)) {
		fail("inventory skill names do not exactly match pstack/skills directories");
	}
	for (const skillName of skillNames) {
		const relativePath = `pstack/skills/${skillName}/SKILL.md`;
		const absolutePath = path.join(REPOSITORY_ROOT, relativePath);
		if (!existsSync(absolutePath)) {
			fail(`${relativePath} is missing`);
			continue;
		}
		const frontmatter = skillFrontmatter(readFileSync(absolutePath, "utf8"), relativePath);
		if (frontmatter === null) continue;
		if (frontmatter.name !== skillName) {
			fail(`${relativePath} frontmatter name must be ${skillName}`);
		}
		if (frontmatter.description.trim() === "") {
			fail(`${relativePath} frontmatter description must be nonempty`);
		}
		const expectedDisabled = inventory.modelInvocationDisabled.includes(skillName);
		if (frontmatter.disableModelInvocation !== expectedDisabled) {
			fail(
				`${relativePath} disable-model-invocation does not match inventory.json`,
			);
		}
	}

	const agentDirectory = path.join(REPOSITORY_ROOT, "pstack/agents");
	const agentEntries = readdirSync(agentDirectory, { withFileTypes: true })
		.map((entry) => entry.name)
		.sort(compareStrings);
	if (!arraysEqual(agentEntries, EXPECTED_AGENT_FILES)) {
		fail(`pstack/agents must contain exactly ${EXPECTED_AGENT_FILES.join(" and ")}`);
	}
	if (!arraysEqual(inventory.agents, EXPECTED_AGENT_IDS)) {
		fail(`inventory agents must be exactly ${EXPECTED_AGENT_IDS.join(" and ")}`);
	}

	const gitRoot = gitRepository(REPOSITORY_ROOT);
	const candidatePaths =
		gitRoot === null
			? listPublicEntries(REPOSITORY_ROOT).map((entry) => entry.path)
			: gitCandidatePaths(REPOSITORY_ROOT);
	const publicEntries =
		gitRoot === null
			? listPublicEntries(REPOSITORY_ROOT)
			: candidatePaths.map((relativePath) => {
					const absolutePath = path.join(REPOSITORY_ROOT, relativePath);
					const stat = lstatSync(absolutePath);
					return {
						path: relativePath,
						type: stat.isDirectory()
							? "directory"
							: stat.isFile()
								? "file"
								: stat.isSymbolicLink()
									? "symlink"
									: "other",
					};
				});
	for (const entry of publicEntries) {
		if (!["file", "directory"].includes(entry.type)) {
			fail(`${entry.path} is a ${entry.type}; the public tree allows only files and directories`);
		}
		const reason = forbiddenPathReason(entry.path);
		if (reason) fail(`${entry.path} ${reason}`);
	}
	if (publicEntries.some((entry) => entry.path === "identity.json")) {
		fail("identity.json is not part of the public release model");
	}

	if (gitRoot === null) {
		for (const executablePath of inventory.executables) {
			const fact = files.find((file) => file.path === executablePath);
			if (!fact?.executable) fail(`${executablePath} is a shebang file without execute permission`);
		}
	} else {
		const trackedModes = gitTrackedModes(REPOSITORY_ROOT);
		for (const executablePath of inventory.executables) {
			const mode = trackedModes.get(executablePath);
			if (mode !== "100755") {
				fail(`${executablePath} must have Git mode 100755, found ${mode ?? "untracked"}`);
			}
		}
		const history = runGit(
			REPOSITORY_ROOT,
			["log", "--all", "--pretty=format:", "--name-only", "-z"],
			"buffer",
		);
		if (history.status === 0) {
			for (const historicalPath of history.stdout
				.toString("utf8")
				.split("\0")
				.map((value) => value.replace(/^\n+|\n+$/g, ""))
				.filter(Boolean)) {
				const reason = forbiddenPathReason(historicalPath);
				if (reason) fail(`Git history path ${historicalPath} ${reason}`);
			}
		}
		const remotes = runGit(REPOSITORY_ROOT, [
			"config",
			"--get-regexp",
			"^remote\\..*\\.(url|pushurl)$",
		]);
		if (remotes.status === 0) {
			const upstreamRepositoryPath = new URL(upstream.repository).pathname
				.replace(/^\/|\/$/g, "")
				.replace(/\.git$/, "");
			for (const line of remotes.stdout.split(/\r?\n/).filter(Boolean)) {
				const remoteUrl = line.slice(line.indexOf(" ") + 1);
				if (remoteUrl.replace(/\.git$/, "").includes(upstreamRepositoryPath)) {
					fail(`configured Git remote points at the upstream repository: ${remoteUrl}`);
				}
			}
		}
	}

	for (const markdownPath of files
		.map((file) => file.path)
		.filter((relativePath) => relativePath.endsWith(".md"))) {
		const boundaryRoot = markdownPath.startsWith("pstack/")
			? path.join(REPOSITORY_ROOT, "pstack")
			: REPOSITORY_ROOT;
		validateMarkdownLinks(REPOSITORY_ROOT, markdownPath, boundaryRoot);
	}

	const textPaths =
		gitRoot === null
			? files.map((file) => file.path)
			: candidatePaths;
	const allText = [];
	for (const relativePath of textPaths) {
		const absolutePath = path.join(REPOSITORY_ROOT, relativePath);
		if (!existsSync(absolutePath) || !lstatSync(absolutePath).isFile()) continue;
		const bytes = readFileSync(absolutePath);
		if (bytes.includes(0)) continue;
		const text = bytes.toString("utf8");
		allText.push({ path: relativePath, text });
		for (const forbidden of FORBIDDEN_TEXT) {
			if (text.includes(forbidden)) {
				fail(`${relativePath} contains forbidden text ${JSON.stringify(forbidden)}`);
			}
		}
		if (relativePath.endsWith(".md")) {
			validateUpstreamUrlUse(relativePath, text, upstream.repository);
		}
	}

	const combinedText = allText.map((entry) => entry.text).join("\n");
	const decisionPolicy = readFileSync(
		path.join(REPOSITORY_ROOT, DECISION_POLICY_PATH),
		"utf8",
	);
	for (const required of REQUIRED_DECISION_POLICY) {
		if (!decisionPolicy.includes(required)) {
			fail(`${DECISION_POLICY_PATH} is missing decision policy ${JSON.stringify(required)}`);
		}
	}
	for (const forbidden of FORBIDDEN_DECISION_POLICY) {
		if (combinedText.includes(forbidden)) {
			fail(`public text contains obsolete decision policy ${JSON.stringify(forbidden)}`);
		}
	}
	for (const agentId of EXPECTED_AGENT_IDS) {
		const expectedReference = `${plugin.name}:${agentId}`;
		if (!combinedText.includes(expectedReference)) {
			fail(`public text contains no namespaced reference to ${expectedReference}`);
		}
	}
	const namespacePattern = new RegExp(
		`([A-Za-z0-9-]+):(${EXPECTED_AGENT_IDS.join("|")})\\b`,
		"g",
	);
	for (const entry of allText) {
		for (const match of entry.text.matchAll(namespacePattern)) {
			if (match[1] !== plugin.name) {
				fail(`${entry.path} uses the wrong agent namespace in ${match[0]}`);
			}
		}
	}

	validateInstallCommands(REPOSITORY_ROOT, plugin);

	const rootLicense = readFileSync(path.join(REPOSITORY_ROOT, "LICENSE"));
	if (!rootLicense.equals(licenseBytes)) fail("root LICENSE differs from pstack/LICENSE");
	const rootNotice = readFileSync(path.join(REPOSITORY_ROOT, "NOTICE.md"));
	const pluginNotice = readFileSync(path.join(REPOSITORY_ROOT, "pstack/NOTICE.md"));
	if (!rootNotice.equals(pluginNotice)) fail("root and plugin NOTICE files differ");

	if (failures.length > 0) return reportFailures();
	console.log(`Validated ${plugin.name} ${plugin.version}.`);
	return 0;
}

function reportFailures() {
	for (const failure of failures) console.error(`validate: ${failure}`);
	return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
	try {
		process.exitCode = main();
	} catch (error) {
		console.error(`validate: ${error.message}`);
		process.exitCode = 1;
	}
}
