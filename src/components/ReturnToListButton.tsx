"use client";

import { useRouter } from "next/navigation";
import React from "react";

export function ReturnToListButton({ fallback = "/disclosures" }: Readonly<{ fallback?: string }>) {
  const router = useRouter();
  return (
    <button className="secondary-button return-list-button" onClick={() => window.history.length > 1 ? router.back() : router.push(fallback)} type="button">
      ← 보던 목록으로
    </button>
  );
}
