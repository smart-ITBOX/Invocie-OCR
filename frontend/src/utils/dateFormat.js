/**
 * Format date from DD/MM/YYYY to dd/MMM/yyyy
 * @param {string} dateStr - Date string in DD/MM/YYYY format
 * @returns {string} - Formatted date like "15/Dec/2024"
 */
export const formatInvoiceDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  
  try {
    // Parse DD/MM/YYYY
    const parts = dateStr.split('/');
    if (parts.length !== 3) return dateStr;
    
    const [day, month, year] = parts;
    const date = new Date(year, parseInt(month) - 1, day);
    
    if (isNaN(date.getTime())) return dateStr;
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[date.getMonth()];
    
    return `${day.padStart(2, '0')}/${monthName}/${year}`;
  } catch (error) {
    return dateStr;
  }
};

/**
 * Format ISO date to dd/MMM/yyyy
 */
export const formatISODate = (isoDate) => {
  if (!isoDate) return 'N/A';
  
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return isoDate;
    
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    return isoDate;
  }
};
