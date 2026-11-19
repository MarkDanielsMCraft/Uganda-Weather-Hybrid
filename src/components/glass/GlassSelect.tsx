"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface GlassSelectOption<T extends string = string> {
  value: T;
  label: string;
}

/** Translucent glass floating dropdown following the global dropdown standard
    (rounded-[18px] frosted container, 6px padding, 44px touch targets,
    no rim border, soft depth shadow) adapted to Uganda Weather's brand green. */
export function GlassSelect<T extends string>({
  id,
  value,
  options,
  onChange,
  triggerClassName = "",
  ariaLabelledBy,
}: {
  id?: string;
  value: T;
  options: readonly GlassSelectOption<T>[];
  onChange: (value: T) => void;
  triggerClassName?: string;
  ariaLabelledBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  const selectedIndex = Math.max(
    0,
    options.findIndex((opt) => opt.value === value),
  );
  const selectedOption = options[selectedIndex] ?? options[0];

  useEffect(() => {
    if (!open) return;
    setHighlightedIndex(selectedIndex);

    const handleOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (
        containerRef.current &&
        target instanceof Node &&
        !containerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside, { passive: true });
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, selectedIndex]);

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        setHighlightedIndex((prev) => (prev + 1) % options.length);
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        setHighlightedIndex((prev) => (prev - 1 + options.length) % options.length);
      }
    } else if (event.key === "Home" && open) {
      event.preventDefault();
      setHighlightedIndex(0);
    } else if (event.key === "End" && open) {
      event.preventDefault();
      setHighlightedIndex(Math.max(0, options.length - 1));
    } else if (event.key === "Tab" && open) {
      setOpen(false);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        const chosen = options[highlightedIndex];
        if (chosen) {
          onChange(chosen.value);
        }
        setOpen(false);
      }
    }
  };

  const activeOptionId =
    open && options[highlightedIndex] ? `${listboxId}-opt-${highlightedIndex}` : undefined;

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-labelledby={ariaLabelledBy}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        className={`flex w-full items-center justify-between gap-2 text-left ${triggerClassName}`}
      >
        <span className="truncate">{selectedOption?.label}</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-white/60 transition-transform motion-reduce:transition-none ${
            open ? "rotate-180" : ""
          }`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-2 rounded-[18px] border-none bg-[rgba(24,24,27,0.86)] p-[6px] shadow-[0_14px_34px_-6px_rgba(0,0,0,0.55),0_4px_12px_-2px_rgba(0,0,0,0.35)] backdrop-blur-[32px] backdrop-saturate-[200%] backdrop-brightness-105"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isHighlighted = index === highlightedIndex;
            return (
              <button
                key={option.value}
                id={`${listboxId}-opt-${index}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={
                  isSelected
                    ? "my-[2px] flex min-h-[44px] w-full items-center gap-[6px] rounded-full bg-brand-green/65 px-[14px] py-[7px] text-left text-[15px] font-medium leading-[1.35] text-white shadow-[0_8px_24px_rgba(13,144,59,0.28),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl transition-colors motion-reduce:transition-none"
                    : `my-[2px] flex min-h-[44px] w-full items-center gap-[6px] rounded-full px-[14px] py-[7px] text-left text-[15px] font-medium leading-[1.35] text-[#f8fafc] transition-colors motion-reduce:transition-none ${
                        isHighlighted ? "bg-white/10 text-white" : "hover:bg-white/10"
                      }`
                }
              >
                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                  {isSelected && (
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    >
                      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
                    </svg>
                  )}
                </span>
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
