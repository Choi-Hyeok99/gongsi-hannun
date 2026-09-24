"use client";

import React from "react";
import { useEffect, useState } from "react";

type State = "checking" | "unsupported" | "disabled" | "enabled" | "denied";

function decodeApplicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return new Uint8Array(bytes.buffer);
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.register("/push-service-worker.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export function PushNotificationSettings() {
  const [publicKey, setPublicKey] = useState("");
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("이 기기");

  useEffect(() => {
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    setDeviceLabel(mobile ? "이 휴대폰" : "이 PC");
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    fetch("/api/push-subscriptions")
      .then(async (response) => {
        if (!response.ok) throw new Error("configuration_unavailable");
        const result = await response.json() as { publicKey?: string };
        if (!result.publicKey) throw new Error("configuration_unavailable");
        setPublicKey(result.publicKey);
        if (Notification.permission === "denied") {
          setState("denied");
          return;
        }
        const subscription = await currentSubscription();
        setState(subscription ? "enabled" : "disabled");
      })
      .catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "disabled");
        setMessage("브라우저 또는 기기 설정에서 공시한눈 알림을 허용해 주세요.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeApplicationServerKey(publicKey),
      });
      const response = await fetch("/api/push-subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error("subscription_failed");
      setState("enabled");
      setMessage(`${deviceLabel}로 핵심 공시 알림을 보내드립니다.`);
    } catch {
      setState("disabled");
      setMessage("브라우저 알림을 켜지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage("");
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        const response = await fetch("/api/push-subscriptions", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw new Error("unsubscribe_failed");
        await subscription.unsubscribe();
      }
      setState("disabled");
      setMessage(`${deviceLabel}의 브라우저 알림을 껐습니다.`);
    } catch {
      setMessage("브라우저 알림을 해제하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="push-settings" aria-labelledby="push-settings-heading">
      <div>
        <p className="eyebrow">선택 기능</p>
        <h2 id="push-settings-heading">PC·휴대폰 브라우저 알림</h2>
        <p>사이트 탭을 닫아도 85점 이상 핵심 공시를 운영체제 알림창으로 받습니다. 직접 허용한 기기에만 전송됩니다.</p>
      </div>
      {state === "enabled" ? (
        <button className="secondary-button" type="button" disabled={busy} onClick={disable}>
          {busy ? "해제 중…" : `${deviceLabel} 알림 끄기`}
        </button>
      ) : null}
      {state === "disabled" ? (
        <button className="primary-link" type="button" disabled={busy} onClick={enable}>
          {busy ? "설정 중…" : `${deviceLabel} 알림 받기`}
        </button>
      ) : null}
      {state === "checking" ? <span className="push-settings__status">알림 설정 확인 중…</span> : null}
      {state === "denied" ? <span className="push-settings__status">브라우저 설정에서 알림이 차단되어 있습니다.</span> : null}
      {state === "unsupported" ? <span className="push-settings__status">이 브라우저에서는 푸시 알림을 사용할 수 없습니다.</span> : null}
      {message ? <p className="push-settings__message" role="status">{message}</p> : null}
      <small>PC는 Chrome·Edge 등 지원 브라우저에서, iPhone은 공시한눈을 홈 화면에 추가한 뒤 사용할 수 있습니다.</small>
    </section>
  );
}
