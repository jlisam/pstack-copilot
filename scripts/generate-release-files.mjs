import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	renameSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
export const REPOSITORY_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
export const GENERATED_PATHS = Object.freeze([
	".github/plugin/marketplace.json",
	"inventory.json",
	"LICENSE",
	"NOTICE.md",
	"pstack/NOTICE.md",
]);

const PUBLIC_REPOSITORY = "https://github.com/jlisam/pstack-copilot";
const UPSTREAM_REPOSITORY = "https://github.com/cursor/plugins";
const compareStrings = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const sortedUnique = (values) => [...new Set(values)].sort(compareStrings);

function parseObject(text, label) {
	let value;
	try {
		value = JSON.parse(text);
	} catch (error) {
		throw new Error(`${label} is not valid JSON: ${error.message}`);
	}
	if (value === null || Array.isArray(value) || typeof value !== "object") {
		throw new Error(`${label} must contain a JSON object`);
	}
	return value;
}

function requireString(value, key, label) {
	if (typeof value[key] !== "string" || value[key].trim() === "") {
		throw new Error(`${label}.${key} must be a nonempty string`);
	}
}

export function parsePluginManifest(text) {
	const plugin = parseObject(text, "pstack/plugin.json");
	for (const key of [
		"name",
		"description",
		"version",
		"homepage",
		"repository",
		"license",
		"skills",
		"agents",
	]) {
		requireString(plugin, key, "pstack/plugin.json");
	}
	if (
		plugin.author === null ||
		Array.isArray(plugin.author) ||
		typeof plugin.author !== "object"
	) {
		throw new Error("pstack/plugin.json.author must be an object");
	}
	requireString(plugin.author, "name", "pstack/plugin.json.author");
	return plugin;
}

export function parseUpstreamProvenance(text) {
	const upstream = parseObject(text, "upstream.json");
	for (const key of [
		"repository",
		"path",
		"author",
		"version",
		"commit",
		"licenseSha256",
	]) {
		requireString(upstream, key, "upstream.json");
	}
	return upstream;
}

function escapeRegularExpression(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sha256(bytes) {
	return createHash("sha256").update(bytes).digest("hex");
}

export function releaseIdentityProblems(plugin, upstream, licenseBytes) {
	const problems = [];
	const versionPattern = new RegExp(
		`^${escapeRegularExpression(upstream.version)}-copilot\\.\\d+$`,
	);
	const checks = [
		[plugin.name === "pstack-copilot", "plugin name must be pstack-copilot"],
		[
			plugin.author.name === "Lauren Tan; Copilot port by jlisam",
			"plugin author must credit Lauren Tan and the jlisam Copilot port",
		],
		[plugin.license === "MIT", "plugin license must be MIT"],
		[plugin.homepage === PUBLIC_REPOSITORY, `plugin homepage must be ${PUBLIC_REPOSITORY}`],
		[
			plugin.repository === PUBLIC_REPOSITORY,
			`plugin repository must be ${PUBLIC_REPOSITORY}`,
		],
		[plugin.skills === "./skills/", "plugin skills path must be ./skills/"],
		[plugin.agents === "./agents/", "plugin agents path must be ./agents/"],
		[
			versionPattern.test(plugin.version),
			`plugin version must match ${versionPattern.source}`,
		],
		[
			upstream.repository === UPSTREAM_REPOSITORY,
			"upstream repository must identify cursor/plugins",
		],
		[upstream.path === "pstack", "upstream path must be pstack"],
		[upstream.author === "Lauren Tan", "upstream author must be Lauren Tan"],
		[
			/^\d+\.\d+\.\d+$/.test(upstream.version),
			"upstream version must use major.minor.patch",
		],
		[
			/^[0-9a-f]{40}$/.test(upstream.commit),
			"upstream commit must be a lowercase 40-character SHA",
		],
		[
			/^[0-9a-f]{64}$/.test(upstream.licenseSha256),
			"upstream licenseSha256 must be a lowercase SHA-256 digest",
		],
		[
			sha256(licenseBytes) === upstream.licenseSha256,
			"pstack/LICENSE does not match upstream licenseSha256",
		],
	];
	for (const [passes, message] of checks) {
		if (!passes) problems.push(message);
	}
	return problems;
}

export function stableJson(value) {
	return `${JSON.stringify(value, null, 2)}\n`;
}

export function scanPublicFiles(root) {
	const files = [];

	function walk(directory, relativeDirectory) {
		const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
			compareStrings(left.name, right.name),
		);
		for (const entry of entries) {
			const relativePath = relativeDirectory
				? `${relativeDirectory}/${entry.name}`
				: entry.name;
			if (relativePath === ".git" || relativePath.startsWith(".git/")) continue;
			const absolutePath = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				if (entry.name === "node_modules") continue;
				walk(absolutePath, relativePath);
				continue;
			}
			if (!entry.isFile()) continue;
			const bytes = readFileSync(absolutePath);
			files.push({
				path: relativePath,
				shebang: bytes.length >= 2 && bytes[0] === 0x23 && bytes[1] === 0x21,
				executable: (statSync(absolutePath).mode & 0o111) !== 0,
				modelInvocationDisabled:
					/^pstack\/skills\/[^/]+\/SKILL\.md$/.test(relativePath) &&
					/^disable-model-invocation:\s*true\s*$/m.test(bytes.toString("utf8")),
			});
		}
	}

	walk(root, "");
	return files.sort((left, right) => compareStrings(left.path, right.path));
}

export function buildInventory(files) {
	const skills = [];
	const agents = [];
	const executables = [];
	const modelInvocationDisabled = [];
	const playbooks = [];
	const tests = [];

	for (const file of files) {
		const skillMatch = file.path.match(/^pstack\/skills\/([^/]+)\/SKILL\.md$/);
		if (skillMatch) {
			skills.push(skillMatch[1]);
			if (file.modelInvocationDisabled) modelInvocationDisabled.push(skillMatch[1]);
		}

		const agentMatch = file.path.match(/^pstack\/agents\/([^/]+)\.agent\.md$/);
		if (agentMatch) agents.push(agentMatch[1]);

		const playbookMatch = file.path.match(
			/^pstack\/skills\/poteto-mode\/playbooks\/([^/]+)\.md$/,
		);
		if (playbookMatch) playbooks.push(playbookMatch[1]);

		if (file.shebang) executables.push(file.path);
		if (/\.(?:test|spec)\.[^/]+$/.test(file.path)) tests.push(file.path);
	}

	return {
		skills: sortedUnique(skills),
		agents: sortedUnique(agents),
		executables: sortedUnique(executables),
		modelInvocationDisabled: sortedUnique(modelInvocationDisabled),
		playbooks: sortedUnique(playbooks),
		tests: sortedUnique(tests),
	};
}

export function buildMarketplace(plugin) {
	const repositoryOwner = new URL(plugin.repository).pathname.split("/").filter(Boolean)[0];
	return {
		name: plugin.name,
		owner: {
			name: repositoryOwner,
		},
		metadata: {
			description: plugin.description,
			version: plugin.version,
		},
		plugins: [
			{
				name: plugin.name,
				description: plugin.description,
				version: plugin.version,
				author: plugin.author,
				license: plugin.license,
				homepage: plugin.homepage,
				repository: plugin.repository,
				source: "./pstack",
			},
		],
	};
}

export function buildNotice(plugin, upstream) {
	const upstreamUrl = `${upstream.repository}/tree/${upstream.commit}/${upstream.path}`;
	return `# Notice

\`${plugin.name}\` version \`${plugin.version}\` is an unofficial GitHub Copilot CLI port of pstack.

## Upstream authorship

${upstream.author} authored [upstream pstack ${upstream.version}](${upstreamUrl}). The upstream work is available under the [MIT License](./LICENSE).

## Port maintenance

The [jlisam/pstack-copilot](${plugin.repository}) repository maintains the GitHub Copilot CLI adaptations. The adaptations are distributed under the same [MIT License](./LICENSE). This port is maintained independently. No endorsement by ${upstream.author}, Cursor, or other upstream contributors is implied.
`;
}

export function buildExpectedReleaseFiles({ plugin, upstream, inventory, licenseBytes }) {
	const identityProblems = releaseIdentityProblems(plugin, upstream, licenseBytes);
	if (identityProblems.length > 0) {
		throw new Error(identityProblems.join("\n"));
	}
	const notice = Buffer.from(buildNotice(plugin, upstream), "utf8");
	return {
		".github/plugin/marketplace.json": Buffer.from(
			stableJson(buildMarketplace(plugin)),
			"utf8",
		),
		"inventory.json": Buffer.from(stableJson(inventory), "utf8"),
		LICENSE: Buffer.from(licenseBytes),
		"NOTICE.md": notice,
		"pstack/NOTICE.md": notice,
	};
}

export function loadReleaseState(root = REPOSITORY_ROOT) {
	const plugin = parsePluginManifest(
		readFileSync(path.join(root, "pstack/plugin.json"), "utf8"),
	);
	const upstream = parseUpstreamProvenance(
		readFileSync(path.join(root, "upstream.json"), "utf8"),
	);
	const files = scanPublicFiles(root);
	const inventory = buildInventory(files);
	const licenseBytes = readFileSync(path.join(root, "pstack/LICENSE"));
	const expectedFiles = buildExpectedReleaseFiles({
		plugin,
		upstream,
		inventory,
		licenseBytes,
	});
	return { plugin, upstream, files, inventory, licenseBytes, expectedFiles };
}

export function generatedFileProblems(root, expectedFiles) {
	const problems = [];
	for (const relativePath of GENERATED_PATHS) {
		const expected = expectedFiles[relativePath];
		const absolutePath = path.join(root, relativePath);
		if (!existsSync(absolutePath)) {
			problems.push(`${relativePath} is missing`);
			continue;
		}
		const actual = readFileSync(absolutePath);
		if (!actual.equals(expected)) problems.push(`${relativePath} is out of date`);
	}
	return problems;
}

function writeAtomically(targetPath, bytes) {
	if (existsSync(targetPath) && readFileSync(targetPath).equals(bytes)) return false;
	mkdirSync(path.dirname(targetPath), { recursive: true });
	const temporaryPath = `${targetPath}.new-${process.pid}-${Date.now()}`;
	try {
		writeFileSync(temporaryPath, bytes, { flag: "wx", mode: 0o644 });
		renameSync(temporaryPath, targetPath);
	} finally {
		if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
	}
	return true;
}

function usage() {
	return "Usage: node scripts/generate-release-files.mjs --write|--check";
}

export function runCli(args, root = REPOSITORY_ROOT) {
	if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
		console.error(usage());
		return 2;
	}

	const { expectedFiles } = loadReleaseState(root);
	if (args[0] === "--check") {
		const problems = generatedFileProblems(root, expectedFiles);
		if (problems.length > 0) {
			for (const problem of problems) console.error(problem);
			return 1;
		}
		console.log("Release files are current.");
		return 0;
	}

	let changed = 0;
	for (const relativePath of GENERATED_PATHS) {
		if (writeAtomically(path.join(root, relativePath), expectedFiles[relativePath])) {
			changed++;
		}
	}
	console.log(changed === 0 ? "Release files are current." : `Updated ${changed} release files.`);
	return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
	try {
		process.exitCode = runCli(process.argv.slice(2));
	} catch (error) {
		console.error(`generate: ${error.message}`);
		process.exitCode = 1;
	}
}
