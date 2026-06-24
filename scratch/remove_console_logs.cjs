/**
 * Remove all console.log statements from src/ files
 * Preserves: console.error, console.warn, and sample code in CodeReview.jsx
 */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

function getAllFiles(dir, exts) {
    let results = [];
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            results = results.concat(getAllFiles(fullPath, exts));
        } else if (exts.some(ext => fullPath.endsWith(ext))) {
            results.push(fullPath);
        }
    }
    return results;
}

const files = getAllFiles(srcDir, ['.js', '.jsx']);
let totalRemoved = 0;

for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('console.log')) continue;
    
    const lines = content.split('\n');
    const newLines = [];
    let removed = 0;
    let i = 0;
    
    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // Skip sample code string in CodeReview.jsx (it's inside a template literal)
        if (filePath.includes('CodeReview.jsx') && line.includes('console.log(fibonacci')) {
            newLines.push(line);
            i++;
            continue;
        }
        
        // Case 1: Line starts with console.log (possibly with leading whitespace)
        if (trimmed.startsWith('console.log(')) {
            // Check if statement is complete on this line
            let fullStatement = line;
            while (!fullStatement.includes(');') && i < lines.length - 1) {
                i++;
                fullStatement += '\n' + lines[i];
            }
            removed++;
            i++;
            continue;
        }
        
        // Case 2: Line has inline console.log like: if (x) console.log(...)
        // or .catch(err => console.log(...))
        if (trimmed.includes('console.log(')) {
            // Check if it's a standalone expression like: if (hasKeyError) console.log(...)
            if (trimmed.startsWith('if ') && trimmed.includes('console.log(')) {
                // Remove the entire if-console.log line
                let fullStatement = line;
                while (!fullStatement.includes(');') && i < lines.length - 1) {
                    i++;
                    fullStatement += '\n' + lines[i];
                }
                removed++;
                i++;
                continue;
            }
            
            // .catch(err => console.log(...)) - keep catch but replace log with void
            if (trimmed.includes('.catch(')) {
                const replaced = line.replace(/console\.log\([^)]*\)/, '{}');
                newLines.push(replaced);
                i++;
                continue;
            }
            
            // Other inline cases - remove the line
            let fullStatement = line;
            while (!fullStatement.includes(');') && i < lines.length - 1) {
                i++;
                fullStatement += '\n' + lines[i];
            }
            removed++;
            i++;
            continue;
        }
        
        newLines.push(line);
        i++;
    }
    
    if (removed > 0) {
        fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
        const relative = path.relative(path.join(__dirname, '..'), filePath);
        console.log(`Removed ${removed} console.log(s) from ${relative}`);
        totalRemoved += removed;
    }
}

console.log(`\nTotal: ${totalRemoved} console.log statements removed`);
