import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = path.join(rootDir, "packages");
const npmCommand = "npm";

const packages = readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
        const packageDir = path.join(packagesDir, entry.name);
        const packageJsonPath = path.join(packageDir, "package.json");

        if (!existsSync(packageJsonPath)) {
            return null;
        }

        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

        if (!packageJson.scripts?.build) {
            return null;
        }

        return {
            dir: packageDir,
            name: packageJson.name,
            packageJson,
        };
    })
    .filter(Boolean);

const localPackageNames = new Set(packages.map((pkg) => pkg.name));
const packageMap = new Map(packages.map((pkg) => [pkg.name, pkg]));
const visited = new Set();
const visiting = new Set();
const sortedPackages = [];

function localDependencies(pkg) {
    const dependencies = {
        ...pkg.packageJson.dependencies,
        ...pkg.packageJson.devDependencies,
        ...pkg.packageJson.peerDependencies,
        ...pkg.packageJson.optionalDependencies,
    };

    return Object.keys(dependencies).filter((name) => localPackageNames.has(name));
}

function visit(pkg) {
    if (visited.has(pkg.name)) {
        return;
    }

    if (visiting.has(pkg.name)) {
        throw new Error(`Circular package dependency detected at ${pkg.name}`);
    }

    visiting.add(pkg.name);

    for (const dependencyName of localDependencies(pkg)) {
        visit(packageMap.get(dependencyName));
    }

    visiting.delete(pkg.name);
    visited.add(pkg.name);
    sortedPackages.push(pkg);
}

for (const pkg of packages) {
    visit(pkg);
}

for (const pkg of sortedPackages) {
    console.log(`\n> Building ${pkg.name}`);

    const result = spawnSync(npmCommand, ["run", "build", "--workspace", pkg.name], {
        cwd: rootDir,
        stdio: "inherit",
        shell: process.platform === "win32",
    });

    if (result.error) {
        console.error(result.error.message);
    }

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}
