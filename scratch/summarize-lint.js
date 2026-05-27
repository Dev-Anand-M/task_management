import fs from 'fs';
import path from 'path';

const reportPath = 'scratch/lint-report.json';

try {
    const rawData = fs.readFileSync(reportPath, 'utf8');
    const files = JSON.parse(rawData);

    let totalErrors = 0;
    let totalWarnings = 0;
    const summary = [];

    for (const file of files) {
        const relativePath = path.relative(process.cwd(), file.filePath);
        // Skip external folders or irrelevant files
        if (relativePath.includes('LN-Reader') || relativePath.includes('node_modules')) {
            continue;
        }

        const errors = file.messages.filter(m => m.severity === 2);
        const warnings = file.messages.filter(m => m.severity === 1);

        if (errors.length > 0 || warnings.length > 0) {
            totalErrors += errors.length;
            totalWarnings += warnings.length;

            summary.push({
                file: relativePath,
                errorsCount: errors.length,
                warningsCount: warnings.length,
                problems: file.messages.map(m => ({
                    line: m.line,
                    column: m.column,
                    ruleId: m.ruleId,
                    message: m.message,
                    severity: m.severity === 2 ? 'ERROR' : 'WARNING'
                }))
            });
        }
    }

    console.log(`=== LINT REPORT SUMMARY ===`);
    console.log(`Total Files with Issues: ${summary.length}`);
    console.log(`Total Errors: ${totalErrors}`);
    console.log(`Total Warnings: ${totalWarnings}\n`);

    // Sort by files with most problems
    summary.sort((a, b) => (b.errorsCount + b.warningsCount) - (a.errorsCount + a.warningsCount));

    for (const item of summary) {
        console.log(`\nFile: ${item.file} (${item.errorsCount} Errors, ${item.warningsCount} Warnings)`);
        console.log('-'.repeat(item.file.length + 20));
        // Group problems by rule ID or just show critical ones
        const undefs = item.problems.filter(p => p.ruleId === 'no-undef');
        const unused = item.problems.filter(p => p.ruleId === 'no-unused-vars');
        const syntax = item.problems.filter(p => p.ruleId === null); // parse errors
        const others = item.problems.filter(p => p.ruleId !== 'no-undef' && p.ruleId !== 'no-unused-vars' && p.ruleId !== null);

        if (syntax.length > 0) {
            console.log(`  [Parsing/Syntax Errors]:`);
            syntax.forEach(p => console.log(`    L${p.line}:${p.column} - ${p.message}`));
        }
        if (undefs.length > 0) {
            console.log(`  [Undefined Variables (CRITICAL)]:`);
            undefs.forEach(p => console.log(`    L${p.line}:${p.column} - ${p.message}`));
        }
        if (others.length > 0) {
            console.log(`  [Other Logic/React Errors]:`);
            others.forEach(p => console.log(`    L${p.line}:${p.column} [${p.ruleId}] - ${p.message}`));
        }
        if (unused.length > 0) {
            console.log(`  [Unused Variables/Imports (Cleanup Candidates)]: ${unused.length} instances`);
            // Show up to 5 examples
            unused.slice(0, 5).forEach(p => console.log(`    L${p.line}:${p.column} - '${p.message}'`));
            if (unused.length > 5) {
                console.log(`    ... and ${unused.length - 5} more`);
            }
        }
    }

} catch (err) {
    console.error('Error reading lint-report.json:', err);
}
