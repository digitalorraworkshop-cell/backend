/**
 * Converts minutes (Number) to HH:MM format (String)
 * @param {number} totalMinutes 
 * @returns {string} HH:MM
 */
const formatMinutes = (minutes) => {
    if (!minutes || isNaN(minutes) || minutes < 0) return "0h 0m";
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return `${h}h ${m}m`;
};

const getDurationInMinutes = (start, end) => {
    if (!start || !end) return 0;
    const diffMs = new Date(end) - new Date(start);
    if (diffMs < 0) return 0;
    return Math.floor(diffMs / 60000);
};

module.exports = {
    formatMinutes,
    getDurationInMinutes,
    formatMinutesToHHMM: formatMinutes // Map for old references
};
