"use client";

import { useEffect } from "react";

export function ListPositionMemory() {
  useEffect(() => {
    const key = `gongsi-scroll:${window.location.pathname}${window.location.search}`;
    const saved = Number(window.sessionStorage.getItem(key));
    const frame = window.requestAnimationFrame(() => {
      if (Number.isFinite(saved) && saved > 0) window.scrollTo({ top: saved, behavior: "instant" });
    });
    const remember = () => window.sessionStorage.setItem(key, String(window.scrollY));
    window.addEventListener("pagehide", remember);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pagehide", remember);
      remember();
    };
  }, []);
  return null;
}
