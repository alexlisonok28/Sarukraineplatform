import * as React from "react";
import { CalendarDays } from "lucide-react";

import { cn } from "./utils";

type NativeDateInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  wrapperClassName?: string;
};

/**
 * Shared date input used across the application.
 *
 * Browsers render their own calendar button for <input type="date"> and that
 * icon differs between Chrome, Firefox and operating systems. To keep the UI
 * consistent we hide the browser indicator and render Lucide's CalendarDays icon.
 *
 * The field remains a native date input, so we keep the browser's date picker,
 * keyboard support and validation. Clicking the Lucide button calls showPicker()
 * when the browser supports it and falls back to focusing/clicking the input.
 */
function NativeDateInput({ className, wrapperClassName, style, ...props }: NativeDateInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input || input.disabled) return;

    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
        return;
      }
    } catch {
      // Some browsers may reject showPicker() in restricted contexts.
      // Falling back to the normal input interaction keeps the field usable.
    }

    input.focus();
    input.click();
  };

  return (
    <div
      className={cn("w-full", wrapperClassName)}
      style={{ position: "relative", width: "100%" }}
    >
      <input
        ref={inputRef}
        type="date"
        data-slot="native-date-input"
        className={cn(
          "h-11 w-full rounded-[10px] border border-gray-300 bg-white px-4 text-base text-gray-900 outline-none transition-[border-color,box-shadow] focus:border-[#007AFF] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        style={{
          ...style,
          WebkitAppearance: "none",
          appearance: "none",
          width: "100%",
          paddingRight: "52px",
        }}
        {...props}
      />

      <button
        type="button"
        onClick={openPicker}
        disabled={props.disabled}
        aria-label="Відкрити календар"
        className="flex items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          position: "absolute",
          right: "8px",
          top: "50%",
          transform: "translateY(-50%)",
          width: "32px",
          height: "32px",
          padding: 0,
          margin: 0,
          zIndex: 1,
        }}
      >
        <CalendarDays aria-hidden="true" width={20} height={20} />
      </button>

      <style>{`
        [data-slot="native-date-input"]::-webkit-calendar-picker-indicator {
          opacity: 0;
          display: none;
          -webkit-appearance: none;
        }
      `}</style>
    </div>
  );
}

export { NativeDateInput };
