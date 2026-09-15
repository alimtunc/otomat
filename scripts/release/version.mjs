const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?$/;

const NUMERIC = /^\d+$/;

export function parseVersion(text) {
  const match = SEMVER.exec(text);
  if (match === null) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] === undefined ? [] : match[4].split("."),
  };
}

export function formatVersion(version) {
  const core = `${version.major}.${version.minor}.${version.patch}`;
  return version.prerelease.length === 0 ? core : `${core}-${version.prerelease.join(".")}`;
}

const compareIdentifiers = (left, right) => {
  const numeric = NUMERIC.test(left) && NUMERIC.test(right);
  if (numeric) return Math.sign(Number(left) - Number(right));
  if (NUMERIC.test(left)) return -1;
  if (NUMERIC.test(right)) return 1;
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

const compareVersions = (a, b) => {
  for (const part of ["major", "minor", "patch"]) {
    if (a[part] !== b[part]) return Math.sign(a[part] - b[part]);
  }
  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    return Math.sign(b.prerelease.length - a.prerelease.length);
  }
  const shared = Math.min(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < shared; index += 1) {
    const order = compareIdentifiers(a.prerelease[index], b.prerelease[index]);
    if (order !== 0) return order;
  }
  return Math.sign(a.prerelease.length - b.prerelease.length);
};

const nextPrerelease = (prerelease) => {
  const last = prerelease.at(-1);
  return NUMERIC.test(last)
    ? [...prerelease.slice(0, -1), String(Number(last) + 1)]
    : [...prerelease, "1"];
};

export function versionChoices(current) {
  const { major, minor, patch, prerelease } = current;
  const stable = { major, minor, patch, prerelease: [] };
  const choices =
    prerelease.length === 0
      ? [{ label: "next patch", version: { ...stable, patch: patch + 1 } }]
      : [
          {
            label: "next prerelease",
            version: { ...stable, prerelease: nextPrerelease(prerelease) },
          },
          { label: "stable", version: stable },
        ];
  choices.push(
    { label: "next minor", version: { major, minor: minor + 1, patch: 0, prerelease: [] } },
    { label: "next major", version: { major: major + 1, minor: 0, patch: 0, prerelease: [] } },
  );
  return choices.map((choice) => ({ label: choice.label, version: formatVersion(choice.version) }));
}

export function nextVersionProblem(current, candidate) {
  const parsed = parseVersion(candidate);
  if (parsed === null) {
    return `"${candidate}" is not a SemVer version (expected MAJOR.MINOR.PATCH[-prerelease]).`;
  }
  if (compareVersions(parsed, current) <= 0) {
    return `${candidate} is not above the current ${formatVersion(current)}; the update feed never announces a downgrade.`;
  }
  return null;
}
