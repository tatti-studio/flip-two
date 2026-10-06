// AIでお題をまとめて追加: ① プロンプトをコピー → ② AIの答えを貼る → ③ 選んで追加
import { useMemo, useState } from 'react';
import { buildPrompt, checkDrafts, parseOutput, type DraftCheck } from '../lib/aiImport';
import { newId } from '../lib/storage';
import type { Topic } from '../lib/types';
import { Chips, TopBar, TopicCard } from '../ui/common';

const THEMES = ['雨の日', '0円・低予算', '記念日', '冬のデート', 'おうち時間', '遠出・旅行', 'チェーン店'];

export function AiAdd(props: { all: Topic[]; categories: string[]; onAdd: (t: Topic[]) => void; onBack: () => void }) {
  const [theme, setTheme] = useState('');
  const [count, setCount] = useState(20);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'manual'>('idle');
  const [answer, setAnswer] = useState('');
  const [checks, setChecks] = useState<DraftCheck[] | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [added, setAdded] = useState<number | null>(null);

  const prompt = useMemo(
    () => buildPrompt({ existing: props.all, categories: props.categories, count, theme }),
    [props.all, props.categories, count, theme],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied('ok');
    } catch {
      setCopied('manual');
    }
  };

  const read = () => {
    const { drafts, skipped } = parseOutput(answer);
    const result = checkDrafts(
      drafts,
      props.all.map((t) => t.text),
    );
    setChecks(result);
    setSkipped(skipped);
    setPicked(new Set(result.map((c, i) => (c.status === 'new' ? i : -1)).filter((i) => i >= 0)));
    setAdded(null);
  };

  const add = () => {
    if (!checks) return;
    const topics: Topic[] = [...picked].map((i) => ({ ...checks[i].draft, id: newId('c'), source: 'custom' as const }));
    props.onAdd(topics);
    setAdded(topics.length);
    setChecks(null);
    setAnswer('');
  };

  const counts = checks
    ? {
        new: checks.filter((c) => c.status === 'new').length,
        similar: checks.filter((c) => c.status === 'similar').length,
        same: checks.filter((c) => c.status === 'same').length,
      }
    : null;

  return (
    <div className="screen">
      <TopBar title="AIでお題をまとめて追加" onBack={props.onBack} />

      {added !== null && (
        <p className="toast toast--big" role="status">
          {added}個のお題を追加しました。お題一覧の「ふたりのお題」で確認できます
        </p>
      )}

      <section className="panel stack">
        <h2 className="step-title">
          <span className="step-num">1</span>プロンプトをコピー
        </h2>
        <p className="muted">
          今あるお題 {props.all.length}個と重ならないように、AIへのお願い文を作ります。ChatGPT・Claude・Gemini など、好きなAIに貼り付けてください。
        </p>
        <span className="field__label">テーマ（なくてもOK）</span>
        <div className="scroll-x">
          <Chips
            name="テーマの例"
            value={theme}
            onChange={(v) => setTheme(v === theme ? '' : v)}
            options={THEMES.map((t) => ({ value: t, label: t }))}
          />
        </div>
        <input id="ai-theme" value={theme} placeholder="例: 京都でできること、雨の日" onChange={(e) => setTheme(e.target.value)} />
        <span className="field__label">作る数</span>
        <Chips
          name="作る数"
          value={count}
          onChange={setCount}
          options={[10, 20, 30, 50].map((n) => ({ value: n, label: `${n}個` }))}
        />
        <button type="button" className="btn btn--primary" onClick={copy}>
          {copied === 'ok' ? 'コピーしました！ AIに貼り付けてね' : 'プロンプトをコピー'}
        </button>
        {copied === 'manual' && (
          <>
            <p className="muted">自動でコピーできませんでした。下の文を長押しして全部選び、コピーしてください。</p>
            <textarea id="ai-prompt" readOnly rows={6} value={prompt} onFocus={(e) => e.currentTarget.select()} />
          </>
        )}
      </section>

      <section className="panel stack">
        <h2 className="step-title">
          <span className="step-num">2</span>AIの答えを貼り付け
        </h2>
        <textarea
          id="ai-answer"
          rows={6}
          value={answer}
          placeholder={'AIの答えをそのまま貼り付け\n例: カフェ・スイーツ|コメダ珈琲でシロノワールを半分こする|近所|2000|120|いつでも|いつでも'}
          onChange={(e) => setAnswer(e.target.value)}
        />
        <button type="button" className="btn btn--primary" disabled={!answer.trim()} onClick={read}>
          読み込む
        </button>
      </section>

      {checks && counts && (
        <section className="panel stack">
          <h2 className="step-title">
            <span className="step-num">3</span>選んで追加
          </h2>
          <p className="muted">
            新しいお題 {counts.new}個（チェック済み）・似たお題あり {counts.similar}個・同じお題あり {counts.same}個
            {skipped.length > 0 && `・読めなかった行 ${skipped.length}行`}
          </p>
          {checks.length > 3 && (
            <button type="button" className="btn btn--primary" disabled={picked.size === 0} onClick={add}>
              選んだ{picked.size}個を追加
            </button>
          )}
          {checks.length === 0 ? (
            <p className="lead">お題が見つかりませんでした。AIの答えをそのまま貼り付けたか確かめてください。</p>
          ) : (
            <ul className="ai-list">
              {checks.map((c, i) => {
                const on = picked.has(i);
                const disabled = c.status === 'same';
                return (
                  <li key={i}>
                    <TopicCard
                      topic={{ ...c.draft, id: `draft-${i}`, source: 'custom' }}
                      selected={on}
                      dim={disabled}
                      onClick={
                        disabled
                          ? undefined
                          : () => {
                              const next = new Set(picked);
                              if (on) next.delete(i);
                              else next.add(i);
                              setPicked(next);
                            }
                      }
                      footer={
                        <div className="ai-list__status">
                          <span className={`ai-badge ai-badge--${c.status}`}>
                            {c.status === 'new' ? (on ? '追加する' : '追加しない') : c.status === 'similar' ? '似たお題あり' : '同じお題あり'}
                          </span>
                          {c.match && <span className="muted">「{c.match}」</span>}
                        </div>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
          <div className="actions">
            <button type="button" className="btn btn--primary" disabled={picked.size === 0} onClick={add}>
              選んだ{picked.size}個を追加
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
