// Quick script to verify VAPID keys are correctly set
// Run with: node verify-vapid-keys.js

console.log('=== VAPID Key Verification ===\n');

// Expected keys from .env
const expectedKeys = {
    VITE_VAPID_PUBLIC_KEY: 'BDh_CLMgIPlfMDObBg2nesGZQ4ObJjfN0rUrPh9-W9iV3RojHkPsmEx6FsV0x_9XqsMU5It-zvGlNTnNxpBzgc0',
    VAPID_PUBLIC_KEY: 'BDh_CLMgIPlfMDObBg2nesGZQ4ObJjfN0rUrPh9-W9iV3RojHkPsmEx6FsV0x_9XqsMU5It-zvGlNTnNxpBzgc0',
    VAPID_PRIVATE_KEY: 'DLgvMH_99zrztgXzuY50i6gVHXZGTUBqAVwxpHLV8Gg',
    VAPID_SUBJECT: 'mailto:dev.klinux@proton.me'
};

// Check local .env
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
    
    console.log('\n⚠️  IMPORTANT: Also verify these EXACT values in Vercel:');
    console.log('   1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables');
    console.log('   2. Check each variable matches exactly (no extra spaces)');
    console.log('   3. Make sure they\'re set for Production environment');
    console.log('   4. Redeploy after any changes');
    
} catch (error) {
    console.error('Error:', error.message);
    console.log('\nNote: Run "npm install dotenv" if you see a module error');
}

console.log('\n=== End Verification ===');
