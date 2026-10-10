#!/usr/bin/env bash
# Cut a release: bump the version, pin the marketplace to the new tag, tag, push.
# `/mods update` installs whatever tag the marketplace on main points at.
#
#   scripts/release.sh 0.2.0
set -euo pipefail

version="${1:?usage: scripts/release.sh X.Y.Z}"
[[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "version must be X.Y.Z, got '$version'" >&2; exit 1; }
tag="v$version"

cd "$(dirname "$0")/.."
[[ -z "$(git status --porcelain)" ]] || { echo "working tree is not clean; commit or stash first" >&2; exit 1; }
if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  echo "tag $tag already exists" >&2
  exit 1
fi

claude plugin validate .
claude plugin test .

python3 - "$version" <<'EOF'
import json, sys
version = sys.argv[1]
for path, bump in (
    ('.claude-plugin/plugin.json', lambda d: d.update(version=version)),
    ('.claude-plugin/marketplace.json', lambda d: [
        (p.update(version=version), p['source'].update(ref=f'v{version}'))
        for p in d['plugins'] if p['name'] == 'terminal-polish'
    ]),
):
    with open(path) as f:
        data = json.load(f)
    bump(data)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')
EOF

git add .claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "chore: release $tag"
git tag -a "$tag" -m "$tag"
git push origin HEAD "$tag"
echo "released $tag"
