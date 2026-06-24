# Remove console.log statements from all .js and .jsx files in src/
# Skip: CodeReview.jsx line 159 (sample code string, not a debug log)

$srcPath = "c:\Users\Warp Gate\Documents\IDL_SkillEnhancement\src"
$files = Get-ChildItem -Path $srcPath -Recurse -Include *.js, *.jsx

$totalRemoved = 0

foreach ($file in $files) {
    $lines = Get-Content $file.FullName -Raw
    if ($lines -match 'console\.log') {
        $originalLines = Get-Content $file.FullName
        $newLines = @()
        $removed = 0
        
        for ($i = 0; $i -lt $originalLines.Count; $i++) {
            $line = $originalLines[$i]
            
            # Skip the sample code in CodeReview.jsx (it's inside a template literal string)
            if ($file.Name -eq "CodeReview.jsx" -and $line -match 'console\.log\(fibonacci') {
                $newLines += $line
                continue
            }
            
            # Check if this line contains console.log
            if ($line -match '^\s*console\.log\(') {
                # Check if it's a multi-line console.log (ends without closing)
                $fullStatement = $line
                while ($fullStatement -notmatch '\);\s*$' -and $i -lt $originalLines.Count - 1) {
                    $i++
                    $fullStatement += "`n" + $originalLines[$i]
                }
                $removed++
                continue
            }
            
            # Check for inline console.log like: if (condition) console.log(...)
            if ($line -match 'console\.log\(') {
                # It's an inline console.log (e.g., inside .catch or if statement)
                # Remove the entire line
                $removed++
                continue
            }
            
            $newLines += $line
        }
        
        if ($removed -gt 0) {
            $newLines | Set-Content $file.FullName -Encoding UTF8
            Write-Host "Removed $removed console.log(s) from $($file.FullName)"
            $totalRemoved += $removed
        }
    }
}

Write-Host "`nTotal console.log statements removed: $totalRemoved"
