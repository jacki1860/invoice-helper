export const MAX_AGENDA_TOPICS = 20;
export const MAX_AGENDA_TOPIC_MINUTES = 480;
export const MAX_AGENDA_TOTAL_MINUTES = 1440;
export const MAX_AGENDA_NAME_LENGTH = 80;
export const MAX_AGENDA_TOPIC_NAME_LENGTH = 120;

export interface MeetingAgendaTopic {
  id: string;
  name: string;
  durationRaw: string;
}

export interface MeetingAgendaDraft {
  name: string;
  startTime: string;
  topics: MeetingAgendaTopic[];
}

export interface MeetingAgendaError {
  field: 'name' | 'startTime' | 'topics' | 'topicName' | 'durationRaw' | 'total';
  topicId?: string;
  row?: number;
  message: string;
}

export interface MeetingAgendaScheduledTopic {
  id: string;
  order: number;
  name: string;
  durationMinutes: number;
  startMinute: number;
  endMinute: number;
  startLabel: string;
  endLabel: string;
}

export interface MeetingAgendaSchedule {
  name: string;
  startMinute: number;
  endMinute: number;
  totalMinutes: number;
  startLabel: string;
  endLabel: string;
  topics: MeetingAgendaScheduledTopic[];
}

export type MeetingAgendaResult =
  | { valid: true; errors: []; agenda: MeetingAgendaSchedule }
  | { valid: false; errors: MeetingAgendaError[]; agenda: null };

export function emptyMeetingAgendaTopic(): MeetingAgendaTopic {
  return { id: crypto.randomUUID(), name: '', durationRaw: '15' };
}

export function emptyMeetingAgenda(): MeetingAgendaDraft {
  return { name: '', startTime: '09:00', topics: [emptyMeetingAgendaTopic()] };
}

export function exampleMeetingAgenda(): MeetingAgendaDraft {
  return {
    name: '每週工作會議',
    startTime: '09:00',
    topics: [
      { ...emptyMeetingAgendaTopic(), name: '確認目標', durationRaw: '15' },
      { ...emptyMeetingAgendaTopic(), name: '討論方案', durationRaw: '30' },
      { ...emptyMeetingAgendaTopic(), name: '確認分工', durationRaw: '15' },
    ],
  };
}

function isSingleLineTitle(value: string, maxLength: number): boolean {
  return Array.from(value).length <= maxLength && !/[\p{Cc}\u2028\u2029]/u.test(value);
}

function minuteLabel(minute: number): string {
  const timeOfDay = minute % 1440;
  const hour = String(Math.floor(timeOfDay / 60)).padStart(2, '0');
  const minutes = String(timeOfDay % 60).padStart(2, '0');
  return `${minute >= 1440 ? '次日 ' : ''}${hour}:${minutes}`;
}

export function meetingAgendaResult(draft: MeetingAgendaDraft): MeetingAgendaResult {
  const errors: MeetingAgendaError[] = [];
  if (!isSingleLineTitle(draft.name, MAX_AGENDA_NAME_LENGTH)) {
    errors.push({ field: 'name', message: '會議名稱最多 80 字，不可包含換行或控制字元。' });
  }
  const startValid = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.startTime);
  if (!startValid) {
    errors.push({ field: 'startTime', message: '請填寫開始時間，格式為 HH:mm（00:00–23:59）。' });
  }
  if (draft.topics.length < 1 || draft.topics.length > MAX_AGENDA_TOPICS) {
    errors.push({ field: 'topics', message: '請保留 1 至 20 題議程。' });
  }

  const ids = new Set<string>();
  const durations: number[] = [];
  draft.topics.forEach((topic, index) => {
    const row = index + 1;
    if (!topic.id.trim() || ids.has(topic.id)) {
      errors.push({
        field: 'topics',
        row,
        message: `第 ${row} 題的識別資料重複或缺漏，請刪除後重新新增。`,
      });
    }
    ids.add(topic.id);
    if (!topic.name.trim() || !isSingleLineTitle(topic.name, MAX_AGENDA_TOPIC_NAME_LENGTH)) {
      errors.push({
        field: 'topicName',
        topicId: topic.id,
        row,
        message: `第 ${row} 題：議題名稱必填，最多 120 字，不可包含換行或控制字元。`,
      });
    }
    const duration = /^\d+$/.test(topic.durationRaw) ? Number(topic.durationRaw) : NaN;
    if (!Number.isInteger(duration) || duration < 1 || duration > MAX_AGENDA_TOPIC_MINUTES) {
      errors.push({
        field: 'durationRaw',
        topicId: topic.id,
        row,
        message: `第 ${row} 題：時間請填寫 1 至 480 的整數分鐘，不含空白、小數或其他符號。`,
      });
    }
    durations.push(duration);
  });
  const totalMinutes = durations.reduce((total, duration) => total + duration, 0);
  if (totalMinutes > MAX_AGENDA_TOTAL_MINUTES) {
    errors.push({
      field: 'total',
      message: '總時長不可超過 1,440 分鐘（24 小時），請調整各題時間。',
    });
  }
  if (errors.length > 0) return { valid: false, errors, agenda: null };

  const [hour, minute] = draft.startTime.split(':').map(Number);
  const startMinute = hour * 60 + minute;
  let cursor = startMinute;
  const topics = draft.topics.map((topic, index): MeetingAgendaScheduledTopic => {
    const end = cursor + durations[index];
    const scheduled = {
      id: topic.id,
      order: index + 1,
      name: topic.name.trim(),
      durationMinutes: durations[index],
      startMinute: cursor,
      endMinute: end,
      startLabel: minuteLabel(cursor),
      endLabel: minuteLabel(end),
    };
    cursor = end;
    return scheduled;
  });
  return {
    valid: true,
    errors: [],
    agenda: {
      name: draft.name.trim() || '會議議程',
      startMinute,
      endMinute: cursor,
      totalMinutes,
      startLabel: minuteLabel(startMinute),
      endLabel: minuteLabel(cursor),
      topics,
    },
  };
}

export function meetingAgendaText(result: MeetingAgendaResult): string {
  if (!result.valid) return '';
  const { agenda } = result;
  return [
    agenda.name,
    `開始：${agenda.startLabel}`,
    `結束：${agenda.endLabel}`,
    `總時長：${agenda.totalMinutes} 分鐘`,
    '',
    ...agenda.topics.map(
      (topic) =>
        `${topic.order}. ${topic.startLabel}–${topic.endLabel}｜${topic.durationMinutes} 分鐘｜${topic.name}`,
    ),
  ].join('\n');
}
