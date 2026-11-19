const MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
const WEEKDAYS = "sunday monday tuesday wednesday thursday friday saturday".split(" ");
const MONTH = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const DATE = new RegExp([
  "\\b(?<iso>\\d{4}-\\d{2}-\\d{2})(?![\\d-])",
  "(?<![\\w/.-])(?<dotDay>\\d{1,2})[.-](?<dotMonth>\\d{1,2})[.-](?<dotYear>\\d{4})(?![\\w/.-])",
  "(?<![\\w/])(?<slashDay>\\d{1,2})/(?<slashMonth>\\d{1,2})(?:/(?<slashYear>\\d{4}))?(?![\\w/])",
  `\\b(?<day>\\d{1,2})(?:st|nd|rd|th)?\\s+(?<month>${MONTH})(?:\\s+(?<year>\\d{4}))?\\b`,
  `\\b(?<monthFirst>${MONTH})\\s+(?<daySecond>\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(?<yearSecond>\\d{4}))?\\b`,
  `\\b(?<relative>yesterday|today)\\b|\\b(?:(?<last>last)\\s+)?(?<weekday>${WEEKDAYS.join("|")})\\b`,
].join("|"), "gi");

const isoDay = (value: Date) => value.toISOString().slice(0, 10);

export function pointInTime(question: string, selected: string) {
  const reference = new Date(`${selected.slice(0, 10)}T00:00:00Z`);
  const dates: string[] = [];
  const explicitCutoffs: string[] = [];
  for (const match of question.matchAll(DATE)) {
    const g = match.groups!;
    const prefix = question.slice(0, match.index);
    if ((g.weekday || g.relative) && /\bnext\s+$/i.test(prefix)) continue;
    const candidates = /\b(?:as of|by)\s+$/i.test(prefix) ? explicitCutoffs : dates;
    if (g.relative || g.weekday) {
      const date = new Date(reference);
      const weekday = WEEKDAYS.indexOf(g.weekday?.toLowerCase() ?? "");
      const referenceDay = reference.getUTCDay();
      const dayOffset = g.relative
        ? -Number(g.relative.toLowerCase() === "yesterday")
        : g.last
          ? -((referenceDay - weekday + 7) % 7 || 7)
          : (weekday + 6) % 7 - (referenceDay + 6) % 7;
      date.setUTCDate(date.getUTCDate() + dayOffset);
      candidates.push(isoDay(date));
      continue;
    }
    const month = g.slashMonth ?? g.dotMonth ?? String(MONTHS.indexOf((g.month ?? g.monthFirst ?? "").slice(0, 3).toLowerCase()) + 1);
    const day = g.day ?? g.daySecond ?? g.slashDay ?? g.dotDay ?? "";
    const year = g.year ?? g.yearSecond ?? g.slashYear ?? g.dotYear ?? selected.slice(0, 4);
    const date = g.iso ?? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const instant = new Date(`${date}T00:00:00Z`);
    if (Number.isFinite(+instant) && isoDay(instant) === date) candidates.push(date);
  }
  const requestedDay = (explicitCutoffs.length ? explicitCutoffs : dates).sort()[0];
  const end = requestedDay && `${requestedDay}T23:59:59.999+05:30`;
  const cutoff = end && Date.parse(end) < Date.parse(selected) ? end : selected;
  const asOf = requestedDay ? cutoff.slice(0, 10) : undefined;
  return { cutoff, asOf, historyThrough: asOf && new Date(cutoff).toISOString() };
}
