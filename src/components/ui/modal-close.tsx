"use client";

import { X } from "lucide-react";

const modalCloseVisualClass =
  "rounded-sm opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary";

export const modalCloseButtonClass =
  `absolute right-4 top-4 ${modalCloseVisualClass}`;

export const sheetCloseButtonClass =
  `native-fixed-safe-close absolute right-4 top-4 ${modalCloseVisualClass}`;

export const modalCloseInlineButtonClass = modalCloseVisualClass;

export function ModalCloseIcon() {
  return (
    <>
      <X className="h-4 w-4" />
      <span className="sr-only">Fechar</span>
    </>
  );
}
