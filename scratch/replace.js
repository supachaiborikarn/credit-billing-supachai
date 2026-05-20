const fs = require('fs');
let page = fs.readFileSync('src/app/gas-station/[id]/page.tsx', 'utf8');
const target = fs.readFileSync('scratch/pump_target.txt', 'utf8').trim();
const replacement = fs.readFileSync('scratch/new_pump.tsx', 'utf8');

if (page.includes(target)) {
    page = page.replace(target, replacement);
    fs.writeFileSync('src/app/gas-station/[id]/page.tsx', page, 'utf8');
    console.log('Successfully replaced pump meters section.');
} else {
    console.log('Target not found in page.tsx');
}
