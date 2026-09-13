"use client";

import React, { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("gongsi-theme", nextTheme);
    setTheme(nextTheme);
  };

  const isDark = theme === "dark";
  return (
    <button
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      aria-pressed={isDark}
      className="theme-toggle"
      onClick={toggleTheme}
      title={isDark ? "라이트 모드" : "다크 모드"}
      type="button"
    >
      <span aria-hidden="true">{isDark ? "☀" : "☾"}</span>
      <strong>{isDark ? "라이트" : "다크"}</strong>
    </button>
  );
}
