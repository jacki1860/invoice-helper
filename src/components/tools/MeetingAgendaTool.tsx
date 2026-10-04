import { useState } from 'react';
import { ArrowDown, ArrowUp, Download, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  emptyMeetingAgenda,
  emptyMeetingAgendaTopic,
  exampleMeetingAgenda,
  MAX_AGENDA_TOPICS,
  meetingAgendaResult,
  meetingAgendaText,
  type MeetingAgendaDraft,
  type MeetingAgendaTopic,
} from '../../features/tools/meetingAgenda';
import { CopyAction } from './CopyAction';
import { SessionNote, ToolPage } from './ToolPage';
import './meeting-agenda.css';

export function MeetingAgendaTool() {
  const [draft, setDraft] = useState(emptyMeetingAgenda);
  const [revision, setRevision] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');
  const result = meetingAgendaResult(draft);
  const text = meetingAgendaText(result);

  const changeDraft = (next: MeetingAgendaDraft) => {
    setDraft(next);
    setRevision((current) => current + 1);
    setDownloadStatus('');
  };
  const patchTopic = (id: string, update: Partial<MeetingAgendaTopic>) => {
    changeDraft({
      ...draft,
      topics: draft.topics.map((topic) => (topic.id === id ? { ...topic, ...update } : topic)),
    });
  };
  const moveTopic = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.topics.length) return;
    const topics = [...draft.topics];
    [topics[index], topics[target]] = [topics[target], topics[index]];
    changeDraft({ ...draft, topics });
  };
  const download = () => {
    if (!result.valid) return;
    setDownloadStatus('');
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      link = document.createElement('a');
      link.href = url;
      link.download = '會議議程.txt';
      document.body.appendChild(link);
      link.click();
      setDownloadStatus('已產生會議議程 TXT，請查看下載項目。');
    } catch {
      setDownloadStatus('無法建立下載檔案，請重試或使用複製議程。');
    } finally {
      link?.remove();
      if (url) {
        const downloadUrl = url;
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
    }
  };

  return (
    <ToolPage title="會議議程時間表" description="排好每一題的時間，開會前就知道幾點結束。">
      <div className="meeting-agenda">
        <div className="tool-columns">
          <section className="tool-form" aria-labelledby="meeting-agenda-editor-heading">
            <div className="meeting-agenda-toolbar">
              <button
                type="button"
                className="button button-quiet"
                onClick={() => {
                  if (window.confirm('載入範例會取代目前全部議程內容。確定取代？')) {
                    changeDraft(exampleMeetingAgenda());
                  }
                }}
              >
                載入範例
              </button>
              <button
                type="button"
                className="button button-quiet"
                onClick={() => {
                  if (window.confirm('重設會清除目前全部議程，並回到空白題目。確定重設？')) {
                    changeDraft(emptyMeetingAgenda());
                  }
                }}
              >
                <RotateCcw size={16} aria-hidden="true" />
                重設
              </button>
            </div>
            <h2 className="numbered-title" id="meeting-agenda-editor-heading">
              <span>01</span>安排議程
            </h2>
            <label className="tool-field" htmlFor="meeting-agenda-name">
              <span>會議名稱（選填）</span>
              <textarea
                id="meeting-agenda-name"
                rows={1}
                value={draft.name}
                placeholder="例如 每週工作會議"
                aria-describedby="meeting-agenda-name-hint"
                aria-invalid={result.errors.some((error) => error.field === 'name')}
                onChange={(event) => changeDraft({ ...draft, name: event.target.value })}
              />
              <small id="meeting-agenda-name-hint">
                單行、最多 80 字；空白時使用「會議議程」。
              </small>
            </label>
            <label className="tool-field" htmlFor="meeting-agenda-start">
              <span>開始時間 *</span>
              <textarea
                id="meeting-agenda-start"
                rows={1}
                value={draft.startTime}
                placeholder="09:00"
                aria-describedby="meeting-agenda-start-hint"
                aria-invalid={result.errors.some((error) => error.field === 'startTime')}
                onChange={(event) => changeDraft({ ...draft, startTime: event.target.value })}
              />
              <small id="meeting-agenda-start-hint">24 小時制 HH:mm，例如 09:00 或 14:30。</small>
            </label>
            <p className="field-hint" id="meeting-agenda-limits">
              最多 20 題，每題 1–480 分鐘，總時長最多 1,440 分鐘（24
              小時）。需要休息時間時，可另加一題。
            </p>
            <div className="meeting-agenda-topics" aria-describedby="meeting-agenda-limits">
              {draft.topics.map((topic, index) => (
                <fieldset className="meeting-agenda-topic" key={topic.id} data-topic-id={topic.id}>
                  <legend>第 {index + 1} 題</legend>
                  <div className="meeting-agenda-topic-actions">
                    <button
                      type="button"
                      className="button button-quiet"
                      aria-label={`上移第 ${index + 1} 題`}
                      disabled={index === 0}
                      onClick={() => moveTopic(index, -1)}
                    >
                      <ArrowUp size={15} aria-hidden="true" />
                      上移
                    </button>
                    <button
                      type="button"
                      className="button button-quiet"
                      aria-label={`下移第 ${index + 1} 題`}
                      disabled={index === draft.topics.length - 1}
                      onClick={() => moveTopic(index, 1)}
                    >
                      <ArrowDown size={15} aria-hidden="true" />
                      下移
                    </button>
                    <button
                      type="button"
                      className="button button-quiet"
                      aria-label={`刪除第 ${index + 1} 題`}
                      disabled={draft.topics.length === 1}
                      onClick={() =>
                        changeDraft({
                          ...draft,
                          topics: draft.topics.filter((entry) => entry.id !== topic.id),
                        })
                      }
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      刪除
                    </button>
                  </div>
                  <label className="tool-field" htmlFor={`meeting-agenda-topic-${topic.id}`}>
                    <span>第 {index + 1} 題議題名稱 *</span>
                    <textarea
                      id={`meeting-agenda-topic-${topic.id}`}
                      rows={2}
                      value={topic.name}
                      placeholder="例如 確認本週分工"
                      aria-describedby={`meeting-agenda-topic-hint-${topic.id}`}
                      aria-invalid={result.errors.some(
                        (error) => error.field === 'topicName' && error.topicId === topic.id,
                      )}
                      onChange={(event) => patchTopic(topic.id, { name: event.target.value })}
                    />
                    <small id={`meeting-agenda-topic-hint-${topic.id}`}>單行、最多 120 字。</small>
                  </label>
                  <label className="tool-field" htmlFor={`meeting-agenda-duration-${topic.id}`}>
                    <span>第 {index + 1} 題時間（分鐘）*</span>
                    <textarea
                      id={`meeting-agenda-duration-${topic.id}`}
                      rows={1}
                      inputMode="numeric"
                      value={topic.durationRaw}
                      aria-invalid={result.errors.some(
                        (error) => error.field === 'durationRaw' && error.topicId === topic.id,
                      )}
                      onChange={(event) =>
                        patchTopic(topic.id, { durationRaw: event.target.value })
                      }
                    />
                  </label>
                </fieldset>
              ))}
            </div>
            <div className="meeting-agenda-add">
              <button
                type="button"
                className="button button-quiet"
                disabled={draft.topics.length >= MAX_AGENDA_TOPICS}
                onClick={() => {
                  if (draft.topics.length < MAX_AGENDA_TOPICS) {
                    changeDraft({ ...draft, topics: [...draft.topics, emptyMeetingAgendaTopic()] });
                  }
                }}
              >
                <Plus size={17} aria-hidden="true" />
                新增議題
              </button>
              <span>{draft.topics.length} / 20 題</span>
            </div>
            {!result.valid && (
              <div className="meeting-agenda-errors" role="alert">
                <p>請修正以下欄位後產生完整議程：</p>
                <ul>
                  {result.errors.map((error, index) => (
                    <li key={`${error.field}-${index}`}>{error.message}</li>
                  ))}
                </ul>
              </div>
            )}
            <SessionNote />
          </section>

          <section
            className="tool-result meeting-agenda-result"
            aria-labelledby="meeting-agenda-result-heading"
          >
            <h2 className="numbered-title" id="meeting-agenda-result-heading">
              <span>02</span>議程時間表
            </h2>
            {result.valid ? (
              <>
                <h3 className="meeting-agenda-title">{result.agenda.name}</h3>
                <dl className="meeting-agenda-summary" aria-label="議程時間統計">
                  <div>
                    <dt>開始時間</dt>
                    <dd>{result.agenda.startLabel}</dd>
                  </div>
                  <div>
                    <dt>結束時間</dt>
                    <dd>{result.agenda.endLabel}</dd>
                  </div>
                  <div>
                    <dt>總時長</dt>
                    <dd>{result.agenda.totalMinutes} 分鐘</dd>
                  </div>
                </dl>
                <ol className="meeting-agenda-schedule">
                  {result.agenda.topics.map((topic) => (
                    <li key={topic.id}>
                      <div className="meeting-agenda-schedule-time">
                        <span>
                          {topic.startLabel}–{topic.endLabel}
                        </span>
                        <small>{topic.durationMinutes} 分鐘</small>
                      </div>
                      <p>
                        <span>{topic.order}.</span> {topic.name}
                      </p>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="meeting-agenda-empty">
                填妥開始時間、所有議題名稱與分鐘後，這裡會顯示完整時間表。
              </p>
            )}
            <p className="meeting-agenda-note">
              跨午夜會標示「次日」。此表只安排時間，不包含日期、時區或行事曆邀請。
            </p>
            <div className="meeting-agenda-output-actions">
              <CopyAction key={revision} text={text} disabled={!result.valid} label="複製議程" />
              <div>
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={!result.valid}
                  onClick={download}
                >
                  <Download size={17} aria-hidden="true" />
                  下載 TXT
                </button>
                <p role="status" className="action-status">
                  {downloadStatus}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </ToolPage>
  );
}
