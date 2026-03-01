const fs = require('fs');
const report = JSON.parse(fs.readFileSync('eslint_report.json', 'utf8'));
let issues = [];
for (const file of report) {
    const fileLevelIssues = file.messages.filter(m => m.severity === 2 || (m.severity === 1 && m.ruleId !== 'no-unused-vars'));
    if (fileLevelIssues.length > 0) {
        issues.push(`${file.filePath}:`);
        for (const msg of fileLevelIssues) {
            issues.push(`  ${msg.line}:${msg.column} - ${msg.severity === 2 ? 'Error' : 'Warning'}: ${msg.message} (${msg.ruleId})`);
        }
    }
}
fs.writeFileSync('clean_errors.txt', issues.join('\n'), 'utf8');
console.log('Found ' + (issues.length) + ' issues to check.');
