import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCalendarIcs,
  calendarSnapshots,
  escapeIcsText,
  foldIcsLine,
  getCalendarDayKind,
  getCalendarEventLabel,
  getCalendarEvents,
  getCalendarFilename,
  getCalendarMonth,
} from '../src/domain/calendar.ts';

test('official calendars cover every day once with correct weekdays and published annual totals', () => {
  assert.deepEqual(
    calendarSnapshots.map((calendar) => calendar.year),
    [2026, 2027],
  );
  for (const calendar of calendarSnapshots) {
    const counts =
      calendar.year === 2026
        ? { off: 120, events: 22, substitutes: 6 }
        : { off: 121, events: 24, substitutes: 8 };
    assert.equal(calendar.days.length, 365);
    assert.equal(new Set(calendar.days.map((day) => day.date)).size, 365);
    calendar.days.forEach((day, index) => {
      const expected = new Date(Date.UTC(calendar.year, 0, index + 1));
      assert.equal(day.date, expected.toISOString().slice(0, 10));
      assert.equal(day.weekday, expected.getUTCDay());
    });
    assert.equal(calendar.days.filter((day) => day.isDayOff).length, counts.off);
    assert.equal(getCalendarEvents(calendar).length, counts.events);
    assert.equal(
      calendar.days.filter((day) => getCalendarDayKind(day) === 'substitute').length,
      counts.substitutes,
    );
    assert.equal(calendar.days.filter((day) => getCalendarDayKind(day) === 'holiday').length, 16);
    assert.equal(
      calendar.days.filter((day) => [0, 6].includes(day.weekday) && !day.isDayOff).length,
      0,
    );
    assert.match(calendar.sourceUrl, /^https:\/\/www\.dgpa\.gov\.tw\/FileConversion\?/);
    assert.match(calendar.sourceSha256, /^[a-f0-9]{64}$/);
  }
});

test('festival dates, substitute holidays and ordinary weekends stay distinct', () => {
  const cases = [
    [2026, '2026-02-15', '小年夜', 'holiday'],
    [2026, '2026-02-20', '補假', 'substitute'],
    [2026, '2026-02-27', '補假', 'substitute'],
    [2026, '2026-04-04', '兒童節', 'holiday'],
    [2026, '2026-06-19', '端午節', 'holiday'],
    [2026, '2026-09-25', '中秋節', 'holiday'],
    [2026, '2026-09-26', '', 'weekend'],
    [2026, '2026-09-28', '孔子誕辰紀念日/教師節', 'holiday'],
    [2026, '2026-12-31', '', 'workday'],
    [2027, '2027-02-04', '小年夜', 'holiday'],
    [2027, '2027-02-09', '補假', 'substitute'],
    [2027, '2027-04-06', '補假', 'substitute'],
    [2027, '2027-06-09', '端午節', 'holiday'],
    [2027, '2027-09-15', '中秋節', 'holiday'],
    [2027, '2027-12-31', '補假', 'substitute'],
  ] as const;
  for (const [year, date, note, kind] of cases) {
    const day = calendarSnapshots
      .find((calendar) => calendar.year === year)
      ?.days.find((item) => item.date === date);
    assert.ok(day, date);
    assert.equal(day.note, note, date);
    assert.equal(getCalendarDayKind(day), kind, date);
    if (date === '2027-12-31') assert.equal(getCalendarEventLabel(day), '2028 年元旦補假');
  }
});

test('all month grids use Sunday-first columns without dropping or duplicating dates', () => {
  for (const calendar of calendarSnapshots) {
    const allDates = [];
    for (let month = 1; month <= 12; month++) {
      const weeks = getCalendarMonth(calendar, month);
      assert.ok(weeks.length >= 4 && weeks.length <= 6);
      for (const week of weeks) {
        assert.equal(week.length, 7);
        week.forEach((day, column) => {
          if (day) {
            assert.equal(day.weekday, column);
            assert.equal(Number(day.date.slice(5, 7)), month);
            allDates.push(day.date);
          }
        });
      }
    }
    assert.deepEqual(
      allDates,
      calendar.days.map((day) => day.date),
    );
    assert.deepEqual(getCalendarMonth(calendar, 13), []);
  }
});

test('ICS exports the selected full year as all-day events, excluding ordinary weekends', () => {
  const stamp = new Date('2026-09-30T08:00:00Z');
  for (const calendar of calendarSnapshots) {
    const ics = buildCalendarIcs(calendar, stamp);
    const unfolded = ics.replace(/\r\n[ \t]/g, '');
    const events = [...unfolded.matchAll(/BEGIN:VEVENT\r\n([\s\S]*?)END:VEVENT/g)].map(
      (match) => match[1],
    );
    assert.equal(events.length, calendar.year === 2026 ? 22 : 24);
    assert.equal(new Set(events.map((event) => event.match(/UID:(.*)/)?.[1])).size, events.length);
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
    assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
    assert.equal(ics.replace(/\r\n/g, '').includes('\n'), false);
    assert.equal(ics.includes('TZID'), false);
    assert.equal(ics.includes('RRULE'), false);
    assert.match(unfolded, new RegExp(`X-WR-CALNAME:${calendar.year} 國定假日與政府機關補假`));
    for (const [index, event] of events.entries()) {
      const day = getCalendarEvents(calendar)[index];
      const next = new Date(`${day.date}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      assert.ok(event.includes(`DTSTART;VALUE=DATE:${day.date.replace(/-/g, '')}\r\n`));
      assert.ok(
        event.includes(`DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, '')}\r\n`),
      );
      assert.match(event, /DTSTAMP:20260930T080000Z/);
      assert.match(event, /民間企業補假依勞資協商/);
    }
    assert.match(events[0], new RegExp(`DTSTART;VALUE=DATE:${calendar.year}0101`));
    if (calendar.year === 2027) {
      assert.match(events.at(-1) ?? '', /DTSTART;VALUE=DATE:20271231\r\nDTEND;VALUE=DATE:20280101/);
    }
    for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
    assert.equal(getCalendarFilename(calendar.year), `taiwan-holidays-${calendar.year}.ics`);
  }
});

test('ICS escapes text and folds Chinese and emoji without breaking UTF-8 sequences', () => {
  const value = '中文,分號;反斜線\\\r\n換行\r第二行\n🎉';
  assert.equal(escapeIcsText(value), '中文\\,分號\\;反斜線\\\\\\n換行\\n第二行\\n🎉');
  const line = `DESCRIPTION:${escapeIcsText(value.repeat(8))}`;
  const folded = foldIcsLine(line);
  assert.equal(folded.replace(/\r\n /g, ''), line);
  const physicalLines = folded.split('\r\n');
  assert.ok(physicalLines.length > 1);
  physicalLines.forEach((part, index) => {
    assert.ok(Buffer.byteLength(part, 'utf8') <= 75);
    assert.equal(
      new TextDecoder('utf-8', { fatal: true }).decode(new TextEncoder().encode(part)),
      part,
    );
    if (index > 0) assert.ok(part.startsWith(' '));
  });
  const sample = calendarSnapshots[0];
  const custom = { ...sample, days: [{ ...sample.days[0], note: value }] };
  assert.ok(
    buildCalendarIcs(custom)
      .replace(/\r\n /g, '')
      .includes(`SUMMARY:${escapeIcsText(value)}\r\n`),
  );
});

test('ICS keeps event identities stable when a user downloads again', () => {
  const calendar = calendarSnapshots[1];
  const first = buildCalendarIcs(calendar, new Date('2026-09-30T08:00:00Z'));
  const later = buildCalendarIcs(calendar, new Date('2026-10-01T08:00:00Z'));
  assert.deepEqual(first.match(/^UID:.+$/gm), later.match(/^UID:.+$/gm));
});
