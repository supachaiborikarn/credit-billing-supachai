const fs = require('fs');
let pageLines = fs.readFileSync('src/app/gas-station/[id]/page.tsx', 'utf8').split('\n');
let start = pageLines.findIndex(l => l.includes('{/* Gauge Readings (3 Tanks) - METERS TAB */}'));
let end = pageLines.findIndex(l => l.includes('{/* Gas Supply Form (Modal) */}'));

if (start !== -1 && end !== -1) {
    let content = pageLines.slice(start, end).join('\n');
    fs.writeFileSync('scratch/gauges_target.txt', content, 'utf8');
    console.log('Extracted gauge section, lines ' + start + ' to ' + end);
} else {
    console.log('Target lines not found');
}
