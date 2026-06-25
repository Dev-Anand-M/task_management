const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

function getGitRemote() {
    try {
        const url = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
        // Matches:
        // https://github.com/owner/repo.git
        // git@github.com:owner/repo.git
        const match = url.match(/github\.com[/:]([^/]+)\/([^.]+)/);
        if (match) {
            return { owner: match[1], repo: match[2] };
        }
    } catch (e) {
        // Fallback
    }
    return null;
}

function apiRequest({ method, hostname, path, headers, body }) {
    return new Promise((resolve, reject) => {
        const options = {
            method,
            hostname,
            path,
            headers: {
                'User-Agent': 'node-release-script',
                ...headers
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(data);
                    }
                } else {
                    reject(new Error(`GitHub API Error: ${res.statusCode} ${res.statusMessage}\n${data}`));
                }
            });
        });

        req.on('error', (err) => reject(err));

        if (body) {
            if (Buffer.isBuffer(body)) {
                req.write(body);
            } else {
                req.write(typeof body === 'string' ? body : JSON.stringify(body));
            }
        }
        req.end();
    });
}

async function main() {
    console.log('=== Zenith GitHub Release Automator ===\n');

    // 1. Detect remote info
    const remote = getGitRemote();
    let owner = remote?.owner || '';
    let repo = remote?.repo || '';

    if (owner && repo) {
        console.log(`Detected repository: ${owner}/${repo}`);
    } else {
        owner = await askQuestion('Enter GitHub repository owner (e.g. Dev-Anand-M): ');
        repo = await askQuestion('Enter GitHub repository name (e.g. task_management): ');
    }

    // 2. Ask for Tag and Release details
    const tagName = (await askQuestion('Enter tag name (default: v1.0.0): ')).trim() || 'v1.0.0';
    const releaseTitle = (await askQuestion(`Enter release title (default: Zenith Mobile ${tagName}): `)).trim() || `Zenith Mobile ${tagName}`;
    const releaseBody = (await askQuestion('Enter release notes: ')).trim() || 'Zenith Mobile Android Application release.';
    
    // 3. Ask for PAT
    console.log('\nTo create a release on GitHub, you need a Personal Access Token (PAT).');
    console.log('You can generate one at: https://github.com/settings/tokens');
    console.log('Required scope: "repo"');
    const token = (await askQuestion('Enter your GitHub Personal Access Token (hidden / not saved): ')).trim();

    if (!token) {
        console.error('Error: GitHub Token is required to create a release.');
        rl.close();
        return;
    }

    // Path to zenith.apk
    // Check root and public directory
    let apkPath = path.join(__dirname, '..', 'zenith.apk');
    if (!fs.existsSync(apkPath)) {
        apkPath = path.join(__dirname, '..', 'public', 'zenith.apk');
    }

    if (!fs.existsSync(apkPath)) {
        console.error(`\nError: APK file not found. Checked both root and public/ directories.`);
        rl.close();
        return;
    }

    console.log(`\nFound APK file at: ${apkPath} (${(fs.statSync(apkPath).size / (1024 * 1024)).toFixed(2)} MB)`);

    try {
        // 4. Create and push Git Tag
        console.log(`\nCreating Git tag "${tagName}" locally...`);
        try {
            execSync(`git tag -a ${tagName} -m "Release ${tagName}"`, { stdio: 'inherit' });
            console.log(`Git tag "${tagName}" created.`);
        } catch (tagErr) {
            console.log(`Tag "${tagName}" might already exist locally. Attempting to push...`);
        }

        console.log(`Pushing tag "${tagName}" to GitHub remote origin...`);
        execSync(`git push origin ${tagName}`, { stdio: 'inherit' });
        console.log(`Tag "${tagName}" successfully pushed.`);

        // 5. Create GitHub Release
        console.log('\nCreating release draft on GitHub...');
        const releasePayload = {
            tag_name: tagName,
            name: releaseTitle,
            body: releaseBody,
            draft: false,
            prerelease: false
        };

        const release = await apiRequest({
            method: 'POST',
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repo}/releases`,
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: releasePayload
        });

        console.log(`Release created successfully: ${release.html_url}`);
        const uploadUrlTemplate = release.upload_url; // Format: https://uploads.github.com/repos/owner/repo/releases/id/assets{?name,label}
        const uploadBaseUrl = uploadUrlTemplate.split('{')[0];

        // 6. Upload zenith.apk asset
        console.log(`\nUploading zenith.apk to release...`);
        const fileBuffer = fs.readFileSync(apkPath);
        const fileName = 'zenith.apk';
        
        // Extract host and path from upload url
        // e.g. https://uploads.github.com/repos/Dev-Anand-M/task_management/releases/12345/assets
        const uploadUrl = new URL(`${uploadBaseUrl}?name=${fileName}`);
        
        await apiRequest({
            method: 'POST',
            hostname: uploadUrl.hostname,
            path: `${uploadUrl.pathname}${uploadUrl.search}`,
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/vnd.android.package-archive',
                'Content-Length': fileBuffer.length
            },
            body: fileBuffer
        });

        console.log(`\n🎉 Success! zenith.apk uploaded and release is published.`);
        console.log(`View it here: ${release.html_url}`);

    } catch (error) {
        console.error('\n❌ Release process failed:', error.message);
    } finally {
        rl.close();
    }
}

main();
