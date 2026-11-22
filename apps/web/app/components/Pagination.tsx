"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="History pages">
      <button
        aria-label="Previous page"
        className="icon-button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        type="button"
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <strong>
        {page} / {totalPages}
      </strong>
      <button
        aria-label="Next page"
        className="icon-button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        type="button"
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </nav>
  );
}
