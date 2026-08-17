import * as React from "react";
import { Calendar } from "lucide-react";

import { cn } from "./utils";

type NativeDateInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  wrapperClassName?: string;
};

/**
 * Shared date input used across the application.
 *
 * Browsers render their own calendar button for <input type="date"> and that
 * icon differs between Chrome, Firefox and operating systems. To keep the UI
 * consistent we hide the browser indicator and render Lucide's Calendar icon.
 *
 * The field remains a native date input, so we keep the browser's date picker,
 * keyboard support and validation. Clicking the Lucide button calls showPicker()
 * when the browser supports it and falls back to focusing/clicking the input.
 */
function NativeDateInput({ className, wrapperClassName, ...props }: NativeDateInputProps) {
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
    <div className={cn("relative w-full", wrapperClassName)}>
      <input
        ref={inputRef}
        type="date"
        data-slot="native-date-input"
        className={cn(
          "h-11 w-full rounded-[10px] border border-gray-300 bg-white px-4 pr-11 text-base text-gray-900 outline-none transition-[border-color,box-shadow] focus:border-[#007AFF] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        style={{
          ...props.style,
          WebkitAppearance: "none",
          appearance: "none",
        }}
        {...props}
      />

      <button
        type="button"
        onClick={openPicker}
        disabled={props.disabled}
        aria-label="Відкрити календар"
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Calendar aria-hidden="true" className="size-5" />
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
