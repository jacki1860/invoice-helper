import assert from 'node:assert/strict';
import test from 'node:test';
import {
  meetingAgendaResult,
  meetingAgendaText,
  type MeetingAgendaDraft,
  type MeetingAgendaTopic,
} from '../src/features/tools/meetingAgenda.ts';

function draft(overrides: Partial<MeetingAgendaDraft> = {}): MeetingAgendaDraft {
  return {
    name: '每週協作會議',
    startTime: '09:00',
    topics: [
      { id: 'goal', name: '確認目標', durationRaw: '15' },
      { id: 'discussion', name: '討論提案', durationRaw: '40' },
      { id: 'actions', name: '確認下一步', durationRaw: '5' },
    ],
    ...overrides,
  };
}

function topics(durations: string[]): MeetingAgendaTopic[] {
  return durations.map((durationRaw, index) => ({
    id: `topic-${index + 1}`,
    name: `議題 ${index + 1}`,
    durationRaw,
  }));
}

function validAgenda(input: MeetingAgendaDraft) {
  const result = meetingAgendaResult(input);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.deepEqual(result.errors, []);
  assert.ok(result.agenda);
  return result.agenda;
}

function invalidAgenda(input: MeetingAgendaDraft, label = '') {
  const original = structuredClone(input);
  for (const topic of input.topics) Object.freeze(topic);
  Object.freeze(input.topics);
  Object.freeze(input);
  const result = meetingAgendaResult(input);
  assert.equal(result.valid, false, label);
  assert.equal(result.agenda, null, label);
  assert.ok(result.errors.length > 0, label);
  for (const error of result.errors) {
    assert.equal(typeof error.field, 'string', label);
    assert.ok(error.field.length > 0, label);
    assert.equal(typeof error.message, 'string', label);
    assert.ok(error.message.length > 0, label);
    if (error.topicId !== undefined) assert.equal(typeof error.topicId, 'string', label);
    if (error.row !== undefined) {
      assert.ok(Number.isInteger(error.row), label);
      assert.ok(error.row >= 1, label);
    }
  }
  assert.equal(meetingAgendaText(result), '', label);
  assert.deepEqual(input, original, label);
}

test('a complete agenda preserves identity and order while trimming names and resolving minute ranges', () => {
  const input = draft({
    name: '  每週協作會議  ',
    topics: [
      { id: 'z-first', name: '  確認目標  ', durationRaw: '015' },
      { id: 'a-second', name: '討論提案', durationRaw: '40' },
      { id: 'm-last', name: '確認下一步', durationRaw: '5' },
    ],
  });
  const original = structuredClone(input);
  for (const topic of input.topics) Object.freeze(topic);
  Object.freeze(input.topics);
  Object.freeze(input);

  assert.deepEqual(validAgenda(input), {
    name: '每週協作會議',
    startMinute: 540,
    endMinute: 600,
    totalMinutes: 60,
    startLabel: '09:00',
    endLabel: '10:00',
    topics: [
      {
        id: 'z-first',
        order: 1,
        name: '確認目標',
        durationMinutes: 15,
        startMinute: 540,
        endMinute: 555,
        startLabel: '09:00',
        endLabel: '09:15',
      },
      {
        id: 'a-second',
        order: 2,
        name: '討論提案',
        durationMinutes: 40,
        startMinute: 555,
        endMinute: 595,
        startLabel: '09:15',
        endLabel: '09:55',
      },
      {
        id: 'm-last',
        order: 3,
        name: '確認下一步',
        durationMinutes: 5,
        startMinute: 595,
        endMinute: 600,
        startLabel: '09:55',
        endLabel: '10:00',
      },
    ],
  });
  assert.deepEqual(input, original);
});

test('one-minute meetings accept both clock endpoints and mark midnight as the next day', () => {
  const midnight = validAgenda(draft({ startTime: '00:00', topics: topics(['1']) }));
  assert.equal(midnight.startMinute, 0);
  assert.equal(midnight.endMinute, 1);
  assert.equal(midnight.startLabel, '00:00');
  assert.equal(midnight.endLabel, '00:01');

  const lastMinute = validAgenda(draft({ startTime: '23:59', topics: topics(['1']) }));
  assert.equal(lastMinute.startMinute, 1439);
  assert.equal(lastMinute.endMinute, 1440);
  assert.equal(lastMinute.totalMinutes, 1);
  assert.equal(lastMinute.endLabel, '次日 00:00');
  assert.equal(lastMinute.topics[0].endLabel, '次日 00:00');
});

test('topics after midnight retain absolute minute positions and next-day labels', () => {
  const agenda = validAgenda(draft({ startTime: '23:50', topics: topics(['10', '15', '5']) }));
  assert.equal(agenda.endMinute, 1460);
  assert.equal(agenda.endLabel, '次日 00:20');
  assert.deepEqual(
    agenda.topics.map(({ startMinute, endMinute, startLabel, endLabel }) => ({
      startMinute,
      endMinute,
      startLabel,
      endLabel,
    })),
    [
      { startMinute: 1430, endMinute: 1440, startLabel: '23:50', endLabel: '次日 00:00' },
      { startMinute: 1440, endMinute: 1455, startLabel: '次日 00:00', endLabel: '次日 00:15' },
      { startMinute: 1455, endMinute: 1460, startLabel: '次日 00:15', endLabel: '次日 00:20' },
    ],
  );
});

test('exactly 24 hours is accepted even at 23:59, but one additional minute rejects the whole agenda', () => {
  for (const [startTime, endMinute, endLabel] of [
    ['00:00', 1440, '次日 00:00'],
    ['09:00', 1980, '次日 09:00'],
    ['23:59', 2879, '次日 23:59'],
  ] as const) {
    const agenda = validAgenda(draft({ startTime, topics: topics(['480', '480', '480']) }));
    assert.equal(agenda.totalMinutes, 1440);
    assert.equal(agenda.endMinute, endMinute);
    assert.equal(agenda.endLabel, endLabel);
  }
  invalidAgenda(draft({ topics: topics(['480', '480', '480', '1']) }));
});

test('start time requires exactly HH:mm with real hour and minute values', () => {
  for (const startTime of [
    '',
    '9:00',
    '09:0',
    '009:00',
    '24:00',
    '23:60',
    '00:60',
    '-1:00',
    '09:00:00',
    '09.00',
    '09：00',
    '０９:００',
    ' 09:00',
    '09:00 ',
    '09:00\n',
    '09:00\r',
    '09:00\u2028',
    '09:00\u00a0',
  ]) {
    invalidAgenda(draft({ startTime }), JSON.stringify(startTime));
  }
});

test('durations accept ASCII integers from 1 through 480 with leading zeroes', () => {
  const agenda = validAgenda(draft({ topics: topics(['1', '0001', '480', '00480']) }));
  assert.deepEqual(
    agenda.topics.map((topic) => topic.durationMinutes),
    [1, 1, 480, 480],
  );
  assert.equal(agenda.totalMinutes, 962);
});

test('blank, non-ASCII, fractional, signed, exponential and out-of-range durations are rejected', () => {
  for (const durationRaw of [
    '',
    ' ',
    '0',
    '000',
    '481',
    '1440',
    '-1',
    '+1',
    '1.0',
    '1.5',
    '1e2',
    '0x10',
    'Infinity',
    'NaN',
    '１',
    '١',
    '1 0',
    ' 1',
    '1 ',
    '\t1',
    '1\n',
    '1\r',
    '1\u2028',
    '999999999999999999999999999999999999999999',
  ]) {
    invalidAgenda(draft({ topics: topics(['15', durationRaw, '5']) }), JSON.stringify(durationRaw));
  }
});

test('one through twenty topics are accepted, while zero and twenty-one fail without truncation', () => {
  assert.equal(validAgenda(draft({ topics: topics(['1']) })).topics.length, 1);
  const maximum = validAgenda(draft({ topics: topics(Array(20).fill('72')) }));
  assert.equal(maximum.topics.length, 20);
  assert.equal(maximum.totalMinutes, 1440);
  assert.equal(maximum.topics[19].order, 20);
  assert.equal(maximum.topics[19].id, 'topic-20');
  invalidAgenda(draft({ topics: [] }));
  invalidAgenda(draft({ topics: topics(Array(21).fill('1')) }));
});

test('names are limited by original Unicode code points, without trimming away over-limit input', () => {
  const meetingName = '🧭'.repeat(80);
  const topicName = '🧪'.repeat(120);
  const agenda = validAgenda(
    draft({ name: meetingName, topics: [{ id: 'unicode', name: topicName, durationRaw: '1' }] }),
  );
  assert.equal(agenda.name, meetingName);
  assert.equal(agenda.topics[0].name, topicName);
  invalidAgenda(draft({ name: '🧭'.repeat(81) }));
  invalidAgenda(draft({ name: ` ${'會'.repeat(79)} ` }));
  invalidAgenda(draft({ name: ' '.repeat(81) }));
  for (const name of ['🧪'.repeat(121), ` ${'題'.repeat(119)} `]) {
    invalidAgenda(draft({ topics: [{ id: 'too-long', name, durationRaw: '1' }] }));
  }
});

test('blank meeting names use the default text heading, while trimmed blank topic names are invalid', () => {
  for (const name of ['', '   ', '\u3000\u00a0']) {
    const result = meetingAgendaResult(draft({ name }));
    assert.equal(result.valid, true);
    assert.equal(meetingAgendaText(result).split('\n')[0], '會議議程');
  }
  for (const name of ['', '   ', '\u3000\u00a0']) {
    invalidAgenda(draft({ topics: [{ id: 'blank', name, durationRaw: '1' }] }));
  }
});

test('all Cc controls and Unicode line separators invalidate raw titles, including at trim boundaries', () => {
  const controls = [
    ...Array.from({ length: 32 }, (_, index) => String.fromCodePoint(index)),
    ...Array.from({ length: 33 }, (_, index) => String.fromCodePoint(0x7f + index)),
    '\u2028',
    '\u2029',
  ];
  for (const control of controls) {
    const label = `U+${control.codePointAt(0)!.toString(16).padStart(4, '0')}`;
    invalidAgenda(draft({ name: `${control}週會${control}` }), label);
    invalidAgenda(
      draft({ topics: [{ id: 'control', name: `確認${control}目標`, durationRaw: '1' }] }),
      label,
    );
    invalidAgenda(
      draft({
        topics: [{ id: 'control-edge', name: `${control}確認目標${control}`, durationRaw: '1' }],
      }),
      label,
    );
  }
});

test('empty and duplicate topic IDs are rejected but duplicate names keep distinct identities', () => {
  invalidAgenda(draft({ topics: [{ id: '', name: '議題', durationRaw: '1' }] }));
  invalidAgenda(
    draft({
      topics: [
        { id: 'same', name: '議題一', durationRaw: '1' },
        { id: 'same', name: '議題二', durationRaw: '2' },
      ],
    }),
  );
  const agenda = validAgenda(
    draft({
      topics: [
        { id: 'second', name: '討論', durationRaw: '2' },
        { id: 'first', name: '討論', durationRaw: '1' },
      ],
    }),
  );
  assert.deepEqual(
    agenda.topics.map((topic) => topic.id),
    ['second', 'first'],
  );
  assert.deepEqual(
    agenda.topics.map((topic) => topic.order),
    [1, 2],
  );
  assert.deepEqual(
    agenda.topics.map((topic) => topic.startMinute),
    [540, 542],
  );
});

test('minute totals, contiguous ranges and topic order remain consistent across varied schedules', () => {
  for (const startTime of ['00:00', '08:59', '12:34', '23:59']) {
    for (const durations of [
      ['1'],
      ['480'],
      ['1', '59', '61'],
      ['480', '480', '480'],
      Array(20).fill('7'),
    ]) {
      const input = draft({ startTime, topics: topics(durations) });
      const agenda = validAgenda(input);
      assert.equal(agenda.endMinute - agenda.startMinute, agenda.totalMinutes);
      assert.equal(
        agenda.topics.reduce((sum, topic) => sum + topic.durationMinutes, 0),
        agenda.totalMinutes,
      );
      assert.equal(agenda.topics[0].startMinute, agenda.startMinute);
      assert.equal(agenda.topics.at(-1)!.endMinute, agenda.endMinute);
      assert.deepEqual(
        agenda.topics.map((topic) => topic.id),
        input.topics.map((topic) => topic.id),
      );
      for (const [index, topic] of agenda.topics.entries()) {
        assert.equal(topic.order, index + 1);
        assert.ok(Number.isInteger(topic.startMinute));
        assert.ok(Number.isInteger(topic.endMinute));
        assert.ok(Number.isInteger(topic.durationMinutes));
        assert.equal(topic.endMinute - topic.startMinute, topic.durationMinutes);
        if (index > 0) assert.equal(topic.startMinute, agenda.topics[index - 1].endMinute);
      }
    }
  }
});

test('an invalid edit cannot expose an earlier valid agenda or a partially calculated prefix', () => {
  const input = draft();
  const previous = meetingAgendaResult(input);
  const previousText = meetingAgendaText(previous);
  assert.ok(previousText.includes('確認下一步'));
  input.topics[1].durationRaw = '1.5';
  invalidAgenda(input);
  assert.equal(meetingAgendaText(previous), previousText);
  invalidAgenda(draft({ name: 'bad\nheading', startTime: '24:00', topics: topics(['0', '5']) }));
});

test('plain text includes every resolved field and topic in order with UTF-8 and LF without a BOM', () => {
  const text = meetingAgendaText(meetingAgendaResult(draft()));
  assert.equal(
    text,
    [
      '每週協作會議',
      '開始：09:00',
      '結束：10:00',
      '總時長：60 分鐘',
      '',
      '1. 09:00–09:15｜15 分鐘｜確認目標',
      '2. 09:15–09:55｜40 分鐘｜討論提案',
      '3. 09:55–10:00｜5 分鐘｜確認下一步',
    ].join('\n'),
  );
  const bytes = Buffer.from(text, 'utf8');
  assert.equal(bytes.toString('utf8'), text);
  assert.notDeepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.equal(text.includes('\ufeff'), false);
  assert.equal(text.includes('\r'), false);
  assert.equal(text.split('\n').length, 8);
});

test('plain text keeps all twenty topics and next-day markers at both ends of an overnight topic', () => {
  const input = draft({ name: '', startTime: '23:59', topics: topics(Array(20).fill('1')) });
  const text = meetingAgendaText(meetingAgendaResult(input));
  const lines = text.split('\n');
  assert.deepEqual(lines.slice(0, 5), [
    '會議議程',
    '開始：23:59',
    '結束：次日 00:19',
    '總時長：20 分鐘',
    '',
  ]);
  assert.equal(lines.length, 25);
  assert.equal(lines[5], '1. 23:59–次日 00:00｜1 分鐘｜議題 1');
  assert.equal(lines[6], '2. 次日 00:00–次日 00:01｜1 分鐘｜議題 2');
  assert.equal(lines[24], '20. 次日 00:18–次日 00:19｜1 分鐘｜議題 20');
  for (const [index, topic] of input.topics.entries()) {
    assert.ok(lines[index + 5].startsWith(`${index + 1}. `));
    assert.ok(lines[index + 5].endsWith(`｜1 分鐘｜${topic.name}`));
  }
});
