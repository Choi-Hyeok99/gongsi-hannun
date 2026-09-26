import React from "react";

type Props = Readonly<{
  error?: string;
  message?: string;
}>;

export function AuthMessage({ error, message }: Props) {
  if (!error && !message) return null;
  return (
    <p className={`auth-message ${error ? "auth-message--error" : "auth-message--success"}`} role={error ? "alert" : "status"}>
      {error ?? message}
    </p>
  );
}
