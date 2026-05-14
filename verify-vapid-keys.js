// Quick script to verify VAPID keys are correctly set
// Run with: node verify-vapid-keys.js
// To check Vercel: node verify-vapid-keys.js --vercel

const https = require('https');

console.log('=== VAPID Key Verification ===\n');

// Expected keys from .env
const expectedKeys = {
    VITE_VAPID_PUBLIC_KEY: 'BDh_CLMgIPlfMDObBg2nesGZQ4ObJjfN0rUrPh9-W9iV3RojHkPsmEx6FsV0x_9XqsMU5It-zvGlNTnNxpBzgc0',
    VAPID_PUBLIC_KEY: 'BDh_CLMgIPlfMDObBg2nesGZQ4ObJjfN0rUrPh9-W9iV3RojHkPsmEx6FsV0x_9XqsMU5It-zvGlNTnNxpBzgc0',
    VAPID_PRIVATE_KEY: 'DLgvMH_99zrztgXzuY50i6gVHXZGTUBqAVwxpHLV8Gg',
    VAPID_SUBJECT: 'mailto:dev.klinux@proton.me'
};

const checkVercel = process.argv.includes('--vercel');

// Function to fetch Vercel env vars
async function getVercelEnvVars(token, projectId) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.vercel.com',
            path: `/v9/projects/${projectId}/env`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Vercel API error: ${res.statusCode} - ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// Check local .env
async function checkLocal() {
    try {
        require('dotenv').config();
        
        console.log('📋 Expected Keys:');
        Object.entries(expectedKeys).forEach(([key, value]) => {
            console.log(`  ${key}: ${value.substring(0, 20)}...`);
        });
        
        console.log('\n🔍 Checking Local .env:');
        let allMatch = true;
        
        Object.entries(expectedKeys).forEach(([key, expectedValue]) => {
            const actualValue = process.env[key];
            const matches = actualValue === expectedValue;
            
            if (!matches) {
                allMatch = false;
                console.log(`  ❌ ${key}: MISMATCH`);
                if (actualValue) {
                    console.log(`     Expected: ${expectedValue}`);
                    console.log(`     Got:      ${actualValue}`);
                } else {
                    console.log(`     Missing from .env`);
                }
            } else {
                console.log(`  ✅ ${key}: OK`);
            }
        });
        
        if (allMatch) {
            console.log('\n✅ All local keys match!');
        } else {
            console.log('\n❌ Some keys don\'t match. Update your .env file.');
        }
        
        return allMatch;
    } catch (error) {
        console.error('Error:', error.message);
        console.log('\nNote: Run "npm install dotenv" if you see a module error');
        return false;
    }
}

// Check Vercel env vars
async function checkVercelEnv() {
    console.log('\n🌐 Checking Vercel Environment Variables:');
    
    const token = process.env.VERCEL_TOKEN;
    const projectId = process.env.VERCEL_PROJECT_ID;
    
    if (!token || !projectId) {
        console.log('  ⚠️  Vercel credentials not found in .env');
        console.log('  Add these to your .env file to check Vercel:');
        console.log('    VERCEL_TOKEN=your_vercel_token');
        console.log('    VERCEL_PROJECT_ID=your_project_id');
        console.log('\n  Get your token: https://vercel.com/account/tokens');
        console.log('  Get project ID: Vercel Dashboard → Project Settings → General');
        return false;
    }
    
    try {
        const response = await getVercelEnvVars(token, projectId);
        const envVars = response.envs || [];
        
        let allMatch = true;
        
        Object.entries(expectedKeys).forEach(([key, expectedValue]) => {
            const vercelVar = envVars.find(v => v.key === key);
            
            if (!vercelVar) {
                console.log(`  ❌ ${key}: NOT SET in Vercel`);
                allMatch = false;
            } else {
                // Check if it's set for production
                const hasProduction = vercelVar.target?.includes('production');
                const actualValue = vercelVar.value;
                
                if (actualValue === expectedValue && hasProduction) {
                    console.log(`  ✅ ${key}: OK (Production)`);
                } else if (actualValue !== expectedValue) {
                    console.log(`  ❌ ${key}: MISMATCH`);
                    console.log(`     Expected: ${expectedValue.substring(0, 30)}...`);
                    console.log(`     Got:      ${actualValue?.substring(0, 30)}...`);
                    allMatch = false;
                } else if (!hasProduction) {
                    console.log(`  ⚠️  ${key}: Value OK but NOT set for Production`);
                    allMatch = false;
                }
            }
        });
        
        if (allMatch) {
            console.log('\n✅ All Vercel keys match and are set for Production!');
        } else {
            console.log('\n❌ Some Vercel keys need fixing. Update in Vercel Dashboard and redeploy.');
        }
        
        return allMatch;
    } catch (error) {
        console.error('  ❌ Error checking Vercel:', error.message);
        return false;
    }
}

// Main execution
(async () => {
    const localOk = await checkLocal();
    
    if (checkVercel) {
        const vercelOk = await checkVercelEnv();
        
        if (localOk && vercelOk) {
            console.log('\n🎉 Everything looks good! Your VAPID keys match everywhere.');
            console.log('\nNext steps:');
            console.log('  1. Make sure Vercel deployment is complete');
            console.log('  2. Go to Settings page');
            console.log('  3. Toggle push OFF → wait 2 sec → toggle ON');
            console.log('  4. Test push notification');
        }
    } else {
        console.log('\n💡 Tip: Run with --vercel flag to also check Vercel environment:');
        console.log('   node verify-vapid-keys.js --vercel');
        console.log('\n   (You\'ll need to add VERCEL_TOKEN and VERCEL_PROJECT_ID to .env first)');
    }
    
    console.log('\n=== End Verification ===');
})();
