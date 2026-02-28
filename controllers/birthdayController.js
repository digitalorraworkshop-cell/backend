const User = require('../models/User');

/**
 * Pure helper: given a Date object (DOB), return how many days until the next birthday.
 * Handles Dec→Jan rollover and Feb 29 → Feb 28 in non-leap years.
 */
const getDaysUntilBirthday = (dob) => {
    const today = new Date();
    const todayMonth = today.getMonth(); // 0-indexed
    const todayDay = today.getDate();
    const todayYear = today.getFullYear();

    let month = dob.getMonth();
    let day = dob.getDate();

    // Handle Feb 29 in non-leap year: shift to Feb 28
    const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    if (month === 1 && day === 29 && !isLeapYear(todayYear)) {
        day = 28;
    }

    // Next birthday this year
    let nextBirthday = new Date(todayYear, month, day);

    // If already passed this year, use next year
    if (
        nextBirthday.getMonth() < todayMonth ||
        (nextBirthday.getMonth() === todayMonth && nextBirthday.getDate() < todayDay)
    ) {
        const nextYear = todayYear + 1;
        if (month === 1 && day === 29 && !isLeapYear(nextYear)) {
            day = 28;
        }
        nextBirthday = new Date(nextYear, month, day);
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const todayMidnight = new Date(todayYear, todayMonth, todayDay);
    return Math.round((nextBirthday - todayMidnight) / msPerDay);
};

const getAge = (dob) => {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
};

// @desc  Get upcoming birthdays (next N days, default 30)
// @route GET /api/birthdays/upcoming
// @access Private (all logged-in)
const getUpcomingBirthdays = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;

        const employees = await User.find(
            { dateOfBirth: { $exists: true, $ne: null }, isActive: true },
            'name email position department profilePicture dateOfBirth'
        );

        console.log(`[BIRTHDAY-DEBUG] Found ${employees.length} active employees with DOB.`);

        const results = employees
            .map((emp) => {
                const daysLeft = getDaysUntilBirthday(emp.dateOfBirth);
                console.log(`[BIRTHDAY-DEBUG] Employee: ${emp.name}, DOB: ${emp.dateOfBirth}, DaysLeft: ${daysLeft}`);
                return {
                    _id: emp._id,
                    name: emp.name,
                    position: emp.position,
                    department: emp.department,
                    profilePicture: emp.profilePicture,
                    dateOfBirth: emp.dateOfBirth,
                    daysLeft,
                    isToday: daysLeft === 0,
                    age: getAge(emp.dateOfBirth),
                };
            })
            .filter((emp) => emp.daysLeft <= days)
            .sort((a, b) => a.daysLeft - b.daysLeft);

        res.json(results);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc  Admin: get birthdays with filters
// @route GET /api/birthdays/admin
// @access Admin only
const getAdminBirthdays = async (req, res) => {
    try {
        const { period, startDate, endDate, search } = req.query;

        const employees = await User.find(
            { dateOfBirth: { $exists: true, $ne: null } },
            'name email position department profilePicture dateOfBirth isActive'
        );

        let results = employees.map((emp) => {
            const daysLeft = getDaysUntilBirthday(emp.dateOfBirth);
            return {
                _id: emp._id,
                name: emp.name,
                email: emp.email,
                position: emp.position,
                department: emp.department,
                profilePicture: emp.profilePicture,
                dateOfBirth: emp.dateOfBirth,
                daysLeft,
                isToday: daysLeft === 0,
                age: getAge(emp.dateOfBirth),
                isActive: emp.isActive,
            };
        });

        // Apply period filter
        if (period === 'week') {
            results = results.filter((e) => e.daysLeft <= 7);
        } else if (period === 'month') {
            results = results.filter((e) => e.daysLeft <= 30);
        } else if (period === 'custom' && startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const today = new Date();
            const msPerDay = 1000 * 60 * 60 * 24;
            const startDays = Math.round((start - today) / msPerDay);
            const endDays = Math.round((end - today) / msPerDay);
            results = results.filter((e) => e.daysLeft >= Math.max(0, startDays) && e.daysLeft <= endDays);
        } else {
            // Default: next 90 days
            results = results.filter((e) => e.daysLeft <= 90);
        }

        // Name search
        if (search) {
            const q = search.toLowerCase();
            results = results.filter((e) => e.name.toLowerCase().includes(q));
        }

        results.sort((a, b) => a.daysLeft - b.daysLeft);
        res.json(results);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getUpcomingBirthdays, getAdminBirthdays };
