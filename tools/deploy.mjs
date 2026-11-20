// Builds the site and publishes web-dist/ to the public repo "<owner>/life" (branch main),
// using this computer's Git login: no tokens or secrets.
// The owner is taken from the origin remote; override with DEPLOY_REPO=<owner>/<name>.
// The site repo only ever holds the latest build, so it is force-pushed.
import { execSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';

const sh = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });
const out = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();

const origin = out('git remote get-url origin');
const owner = origin.match(/github\.com[/:]([^/]+)\//)?.[1];
const repo = process.env.DEPLOY_REPO ?? (owner ? `${owner}/life` : null);
if (!repo) throw new Error(`Cannot tell the GitHub owner from origin "${origin}"; set DEPLOY_REPO=<owner>/<name>`);
const name = repo.split('/')[1];

if (out('git status --porcelain')) console.warn('! There are uncommitted changes: they will be published but are not in git.');
const sha = out('git rev-parse --short HEAD');

sh('npm run check');
sh('npm test');
sh('npm run build', { env: { ...process.env, BASE_PATH: name.endsWith('.github.io') ? '/' : `/${name}/` } });

writeFileSync('web-dist/.nojekyll', '');
rmSync('web-dist/.git', { recursive: true, force: true });
// autocrlf off: publish the files byte for byte (and no CRLF warnings on Windows)
const git = (args) => sh(`git -c core.autocrlf=false ${args}`, { cwd: 'web-dist' });
git('init -q -b main');
git('add -A');
git(`-c user.name="deploy" -c user.email="deploy@localhost" commit -q -m "deploy ${sha}"`);
git(`push -q --force https://github.com/${repo}.git main`);
rmSync('web-dist/.git', { recursive: true, force: true });

console.log(`\nPublished ${sha} to https://github.com/${repo} → https://${repo.split('/')[0]}.github.io/${name.endsWith('.github.io') ? '' : `${name}/`}`);
