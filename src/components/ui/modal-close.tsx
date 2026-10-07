"use client";

import { X } from "lucide-react";

const modalCloseVisualClass =
  "inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary text-primary opacity-80 cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus-visible:opacity-100 disabled:pointer-events-none";

export const modalCloseButtonClass =
  `absolute right-4 top-4 ${modalCloseVisualClass}`;

export const sheetCloseButtonClass =
  `native-fixed-safe-close absolute right-4 top-4 ${modalCloseVisualClass}`;

export const modalCloseInlineButtonClass = modalCloseVisualClass;

export function ModalCloseIcon() {
  return (
    <>
      <X className="h-4 w-4 stroke-[2.25]" />
      <span className="sr-only">Fechar</span>
    </>
  );
}
