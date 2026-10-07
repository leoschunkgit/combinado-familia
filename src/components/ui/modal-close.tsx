"use client";

import { X } from "lucide-react";

const modalCloseVisualClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md opacity-70 ring-offset-background transition-opacity hover:bg-secondary hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none";

export const modalCloseButtonClass =
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
