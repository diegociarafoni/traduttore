// Licenze di un'espressione SPDX semplice: "MIT", "(MIT OR GPL-3.0-or-later)", "Apache-2.0 AND MIT".
export function spdxAlternatives(expression) {
  const clean = expression.replace(/[()]/g, ' ').trim();
  return clean.split(/\s+OR\s+/i).map((alt) =>
    alt
      .split(/\s+AND\s+/i)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

const normalize = (id) => id.replace(/-or-later$|-only$|\+$/, '');

// packages: [{ name, version, license }]; restituisce i problemi.
export function checkLicenses(packages, { allowed, overrides = {} }) {
  const ok = new Set(allowed.map(normalize));
  const problems = [];
  for (const pkg of packages) {
    const override = overrides[pkg.name];
    const license = override ? override.license : pkg.license;
    if (!license) {
      problems.push(`${pkg.name}@${pkg.version}: licenza non dichiarata`);
      continue;
    }
    const accepted = spdxAlternatives(license).some((all) => all.every((id) => ok.has(normalize(id))));
    if (!accepted) problems.push(`${pkg.name}@${pkg.version}: licenza "${license}" non ammessa`);
  }
  return problems;
}
