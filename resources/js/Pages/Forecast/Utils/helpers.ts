export const getNextMonthString = () => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const getCurrentMonthString = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const getPreviousMonthString = (currentMonthStr: string) => {
    const [year, month] = currentMonthStr.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    date.setMonth(date.getMonth() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};