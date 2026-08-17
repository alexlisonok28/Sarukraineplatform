import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "./utils";

type NativeSelectProps = React.ComponentProps<"select"> & {
  wrapperClassName?: string;
};

/**
 * Shared native select with one consistent Lucide ChevronDown.
 * Critical styles are explicit so global CSS cannot bring the browser arrow back
 * or move the Lucide icon outside the field.
 */
function NativeSelect({ className, wrapperClassName, children, style, ...props }: NativeSelectProps) {
  return (
    <div className={cn("w-full", wrapperClassName)} style={{ position: "relative" }}>
      <select
        data-slot="native-select"
        className={cn(
          "h-11 w-full rounded-[10px] border border-gray-300 bg-white px-4 text-base text-gray-900 outline-none transition-[border-color,box-shadow] focus:border-[#007AFF] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        style={{
          ...style,
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          paddingRight: "2.5rem",
        }}
        {...props}
      >
        {children}
      </select>

      <ChevronDown
        aria-hidden="true"
        className="size-5 text-gray-500"
        style={{
          pointerEvents: "none",
          position: "absolute",
          right: "0.75rem",
          top: "50%",
          transform: "translateY(-50%)",
        }}
      />
    </div>
  );
}

export { NativeSelect };
