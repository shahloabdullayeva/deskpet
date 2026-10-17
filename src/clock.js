const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function localParts(date, timeZone) {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || undefined,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(format.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hhmm: `${parts.hour}:${parts.minute}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday],
  };
}

function toMinutes(hhmm) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

function isWorkTime(parts, workHours) {
  return (
    workHours.days.includes(parts.weekday) &&
    parts.minutes >= toMinutes(workHours.start) &&
    parts.minutes < toMinutes(workHours.end)
  );
}

function isDue(parts, workHours, time) {
  const late = parts.minutes - toMinutes(time);
  return workHours.days.includes(parts.weekday) && late >= 0 && late < 10;
}

module.exports = { localParts, isWorkTime, isDue, toMinutes };
