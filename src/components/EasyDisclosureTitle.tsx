"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { DISCLOSURE_GLOSSARY, findGlossaryEntry, type GlossaryEntry } from "@/domain/disclosure-glossary";

const STORAGE_KEY = "gongsi-easy-terms";
const HINT_KEY = "gongsi-easy-terms-hint-seen";

export function EasyDisclosureTitle({ text }: Readonly<{ text: string }>) {
  const [enabled, setEnabled] = useState(true);
  const [selected, setSelected] = useState<GlossaryEntry | null>(null);
  const [showHint, setShowHint] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const aliases = useMemo(() => DISCLOSURE_GLOSSARY.flatMap((entry) => entry.aliases).sort((a, b) => b.length - a.length), []);
  const matchingAliases = aliases.filter((alias) => text.includes(alias));

  useEffect(() => {
    setEnabled(window.localStorage.getItem(STORAGE_KEY) !== "off");
    setShowHint(matchingAliases.length > 0 && window.localStorage.getItem(HINT_KEY) !== "yes");
  }, [matchingAliases.length]);

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [selected]);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
  };

  const openTerm = (alias: string) => {
    setSelected(findGlossaryEntry(alias) ?? null);
    setShowHint(false);
    window.localStorage.setItem(HINT_KEY, "yes");
  };

  return (
    <>
      <div className="easy-title-row">
        <h1>{enabled ? renderTerms(text, matchingAliases, openTerm) : text}</h1>
        {matchingAliases.length > 0 && <button aria-pressed={enabled} className="easy-terms-toggle" onClick={toggle} type="button">쉬운 용어 {enabled ? "켜짐" : "꺼짐"}</button>}
      </div>
      {showHint && enabled && <p className="easy-terms-hint">점선이 있는 용어를 누르면 쉬운 설명을 볼 수 있어요.</p>}
      {selected && (
        <div className="term-dialog-backdrop" onClick={() => setSelected(null)} role="presentation">
          <section aria-labelledby="term-dialog-title" aria-modal="true" className="term-dialog" onClick={(event) => event.stopPropagation()} role="dialog">
            <button aria-label="설명 닫기" className="term-dialog__close" onClick={() => setSelected(null)} ref={closeButtonRef} type="button">×</button>
            <p className="eyebrow">쉬운 공시 용어</p>
            <h2 id="term-dialog-title">{selected.term}</h2>
            <p>{selected.meaning}</p>
            <strong>이 공시에서 확인할 점</strong>
            <p>{selected.context}</p>
          </section>
        </div>
      )}
    </>
  );
}

function renderTerms(text: string, aliases: readonly string[], openTerm: (alias: string) => void): React.ReactNode {
  if (aliases.length === 0) return text;
  const escaped = aliases.map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "g"));
  return parts.map((part, index) => aliases.includes(part)
    ? <button className="easy-term" key={`${part}-${index}`} onClick={() => openTerm(part)} type="button">{part}</button>
    : <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>);
}
