"use client";

import React from 'react';
import clsx from 'clsx';

type Props = {
  onClick?: () => void;
  disabled?: boolean;
  label?: string;
  primary?: boolean;
};

export function ExportButton({ onClick, disabled, label = "Export", primary = false }: Props) {
  return (
    <button className={clsx('btn', primary && 'btn primary')} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
