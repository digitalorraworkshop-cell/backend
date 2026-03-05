const controller = require('./controllers/attendanceController');
const mongoose = require('mongoose');

console.log('Controller Exports:');
Object.keys(controller).forEach(key => {
    console.log(`- ${key}: ${typeof controller[key]}`);
});

if (typeof controller.getAttendanceHistory !== 'function') {
    console.error('ERROR: getAttendanceHistory is not a function!');
    process.exit(1);
}

if (typeof controller.getEmployeeSummary !== 'function') {
    console.error('ERROR: getEmployeeSummary is not a function!');
    process.exit(1);
}

console.log('SUCCESS: All functions are exported correctly.');
process.exit(0);
