"use client";

import { useEffect, useRef, useState } from "react";

const REVEAL_MS = 5000;

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/** Password field with an eye button that reveals the text for 5s, then re-hides. */
export function PasswordInput({ className = "", ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clear() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  useEffect(() => clear, []);

  function toggle() {
    clear();
    if (visible) {
      setVisible(false);
      return;
    }
    setVisible(true);
    timer.current = setTimeout(() => setVisible(false), REVEAL_MS);
  }

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`w-full pr-10 ${className}`}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-text2 hover:text-text0"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {visible ? (
            <>
              <path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" />
              <path d="M16.681 16.673A8.717 8.717 0 0 1 12 18c-3.6 0-6.6-2-9-6 1.272-2.12 2.712-3.678 4.32-4.674m2.86-1.146A9.055 9.055 0 0 1 12 6c3.6 0 6.6 2 9 6-.666 1.11-1.379 2.067-2.138 2.87" />
              <path d="M3 3l18 18" />
            </>
          ) : (
            <>
              <path d="M10 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0" />
              <path d="M21 12c-2.4 4-5.4 6-9 6s-6.6-2-9-6c2.4-4 5.4-6 9-6s6.6 2 9 6" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
