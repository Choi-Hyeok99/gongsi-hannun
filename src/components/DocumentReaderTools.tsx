"use client";

import React, { FormEvent, useEffect, useRef, useState } from "react";

type ReaderSize = "normal" | "large";
type ReaderSpacing = "normal" | "wide";
type ReaderWidth = "normal" | "narrow";

type Settings = Readonly<{
  size: ReaderSize;
  spacing: ReaderSpacing;
  width: ReaderWidth;
}>;

const DEFAULT_SETTINGS: Settings = { size: "normal", spacing: "normal", width: "normal" };
const SETTINGS_KEY = "gongsi-document-reader-settings";

export function DocumentReaderTools({ storageKey }: Readonly<{ storageKey: string }>) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [outline, setOutline] = useState<readonly string[]>([]);
  const [showTop, setShowTop] = useState(false);
  const [restored, setRestored] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<Settings> | null;
      if (saved) setSettings({
        size: saved.size === "large" ? "large" : "normal",
        spacing: saved.spacing === "wide" ? "wide" : "normal",
        width: saved.width === "narrow" ? "narrow" : "normal",
      });
      const position = Number(localStorage.getItem(positionKey(storageKey)));
      if (Number.isFinite(position) && position > 0.05 && position < 0.98) {
        requestAnimationFrame(() => {
          const maximum = document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo({ top: maximum * position });
          setRestored(true);
        });
      }
    } catch {
      // Reader preferences are optional and must never block the filing.
    }
  }, [storageKey]);

  useEffect(() => {
    const reader = document.getElementById("disclosure-document-reader");
    if (!reader) return;
    reader.dataset.readerSize = settings.size;
    reader.dataset.readerSpacing = settings.spacing;
    reader.dataset.readerWidth = settings.width;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  }, [settings]);

  useEffect(() => {
    const content = document.querySelector<HTMLElement>(".document-reader__content")?.innerText ?? "";
    const headings = content.split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length >= 4 && line.length <= 80 && /^(?:(?:[IVXLC]+|\d+)\.|[가-하]\.)\s+\S/i.test(line));
    setOutline([...new Set(headings)].slice(0, 30));
  }, []);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const savePosition = () => {
      setShowTop(window.scrollY > 700);
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        const maximum = document.documentElement.scrollHeight - window.innerHeight;
        if (maximum <= 0) return;
        try { localStorage.setItem(positionKey(storageKey), String(window.scrollY / maximum)); } catch {}
      }, 250);
    };
    window.addEventListener("scroll", savePosition, { passive: true });
    return () => {
      window.removeEventListener("scroll", savePosition);
      if (timeout) clearTimeout(timeout);
    };
  }, [storageKey]);

  function toggleSearch(): void {
    setSearchOpen((current) => !current);
    requestAnimationFrame(() => searchInput.current?.focus());
  }

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const normalized = query.trim();
    const content = document.querySelector<HTMLElement>(".document-reader__content")?.innerText ?? "";
    const count = normalized ? countMatches(content, normalized) : 0;
    setMatchCount(count);
    setCurrentMatch(count > 0 ? 1 : 0);
    if (count > 0) findInPage(normalized, false);
  }

  function moveMatch(backwards: boolean): void {
    if (matchCount === 0) return;
    findInPage(query.trim(), backwards);
    setCurrentMatch((current) => backwards
      ? (current <= 1 ? matchCount : current - 1)
      : (current >= matchCount ? 1 : current + 1));
  }

  return (
    <div className="document-reader-tools">
      <div className="document-reader-tools__primary">
        <button type="button" onClick={toggleSearch} aria-expanded={searchOpen}>문서 검색</button>
        <details>
          <summary>읽기 설정</summary>
          <div className="reader-settings">
            <fieldset><legend>글자 크기</legend><button type="button" aria-pressed={settings.size === "normal"} onClick={() => setSettings({ ...settings, size: "normal" })}>보통</button><button type="button" aria-pressed={settings.size === "large"} onClick={() => setSettings({ ...settings, size: "large" })}>크게</button></fieldset>
            <fieldset><legend>줄 간격</legend><button type="button" aria-pressed={settings.spacing === "normal"} onClick={() => setSettings({ ...settings, spacing: "normal" })}>보통</button><button type="button" aria-pressed={settings.spacing === "wide"} onClick={() => setSettings({ ...settings, spacing: "wide" })}>넓게</button></fieldset>
            <fieldset><legend>본문 폭</legend><button type="button" aria-pressed={settings.width === "normal"} onClick={() => setSettings({ ...settings, width: "normal" })}>기본</button><button type="button" aria-pressed={settings.width === "narrow"} onClick={() => setSettings({ ...settings, width: "narrow" })}>좁게</button></fieldset>
          </div>
        </details>
        {outline.length > 0 ? (
          <details className="reader-outline">
            <summary>목차</summary>
            <nav aria-label="문서 목차">
              {outline.map((heading) => <button type="button" key={heading} onClick={() => findInPage(heading, false)}>{heading}</button>)}
            </nav>
          </details>
        ) : null}
      </div>
      {searchOpen ? (
        <form className="document-search" onSubmit={submitSearch} role="search">
          <label htmlFor="document-search-input" className="sr-only">문서에서 찾을 내용</label>
          <input ref={searchInput} id="document-search-input" value={query} onChange={(event) => { setQuery(event.target.value); setMatchCount(0); setCurrentMatch(0); }} placeholder="문서에서 찾기" />
          <button type="submit">찾기</button>
          <span aria-live="polite">{matchCount > 0 ? `${currentMatch}/${matchCount}` : query.trim() ? "결과 없음" : ""}</span>
          <button type="button" onClick={() => moveMatch(true)} disabled={matchCount === 0} aria-label="이전 검색 결과">이전</button>
          <button type="button" onClick={() => moveMatch(false)} disabled={matchCount === 0} aria-label="다음 검색 결과">다음</button>
        </form>
      ) : null}
      {restored ? <p className="reader-restored" role="status">마지막으로 읽던 위치에서 이어서 보여드렸습니다.</p> : null}
      {showTop ? <button className="reader-to-top" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>맨 위로</button> : null}
    </div>
  );
}

function countMatches(content: string, query: string): number {
  const normalizedContent = content.toLocaleLowerCase("ko-KR");
  const normalizedQuery = query.toLocaleLowerCase("ko-KR");
  let count = 0;
  let offset = 0;
  while ((offset = normalizedContent.indexOf(normalizedQuery, offset)) >= 0) {
    count += 1;
    offset += Math.max(normalizedQuery.length, 1);
  }
  return count;
}

function findInPage(query: string, backwards: boolean): void {
  const finder = (window as unknown as { find?: (...arguments_: [string, boolean, boolean, boolean, boolean, boolean, boolean]) => boolean }).find;
  finder?.call(window, query, false, backwards, true, false, false, false);
}

function positionKey(storageKey: string): string {
  return `gongsi-document-position:${storageKey}`;
}
