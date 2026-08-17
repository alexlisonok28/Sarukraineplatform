import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "./utils";

/**
 * Shared wrapper for ordinary HTML <select> controls.
 *
 * Why this exists:
 * Browsers draw their own arrow inside a native <select>, so the icon looks
 * different in Chrome, Firefox, Windows, macOS, etc. We hide that browser arrow
 * with `appearance-none` and render the same Lucide ChevronDown everywhere.
 *
 * The select itself stays a normal HTML control, so keyboard navigation,
 * accessibility and the native options menu keep working as before.
 */
type NativeSelectProps = React.ComponentProps<"select"> & {
  wrapperClassName?: string;
};

function NativeSelect({ className, wrapperClassName, children, ...props }: NativeSelectProps) {
  return (
    <div className={cn("relative w-full", wrapperClassName)}>
      <select
        data-slot="native-select"
        className={cn(
          "h-11 w-full appearance-none rounded-[10px] border border-gray-300 bg-white px-4 pr-10 text-base text-gray-900 outline-none transition-[border-color,box-shadow] focus:border-[#007AFF] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>

      {/* Decorative only: the native select remains the actual interactive element. */}
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-gray-500"
      />
    </div>
  );
}

export { NativeSelect };
