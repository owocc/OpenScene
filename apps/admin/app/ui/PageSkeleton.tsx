"use client";

import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Table } from "@cloudflare/kumo/components/table";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export interface SkeletonLineProps extends HTMLAttributes<HTMLDivElement> {
  minWidth?: number;
  maxWidth?: number;
  minDuration?: number;
  maxDuration?: number;
  minDelay?: number;
  maxDelay?: number;
  blockHeight?: number | string;
  className?: string;
}

/**
 * SSR-safe SkeletonLine component that adheres to Kumo UI's .skeleton-line
 * styling and shimmer animation contract without Math.random() hydration mismatches.
 */
export function SkeletonLine({
  minWidth = 100,
  maxWidth = 100,
  minDuration = 1.5,
  maxDuration = 1.5,
  minDelay = 0,
  maxDelay = 0,
  blockHeight,
  className = "",
  style,
  ...props
}: SkeletonLineProps) {
  // Deterministic calculation ensures 100% match between server render and client hydration
  const width = minWidth === maxWidth ? minWidth : Math.round((minWidth + maxWidth) / 2);
  const duration =
    minDuration === maxDuration
      ? minDuration
      : Number(((minDuration + maxDuration) / 2).toFixed(2));
  const delay = minDelay === maxDelay ? minDelay : Number(((minDelay + maxDelay) / 2).toFixed(2));

  const lineStyle: CSSProperties = {
    "--skeleton-width": `${width}%`,
    "--shimmer-duration": `${duration}s`,
    "--shimmer-delay": `${delay}s`,
    ...style,
  } as CSSProperties;

  const line = (
    <div
      className={`skeleton-line ${className}`}
      style={lineStyle}
      suppressHydrationWarning
      {...props}
    />
  );

  if (blockHeight !== undefined) {
    return (
      <div
        className="flex items-center"
        style={{ height: typeof blockHeight === "number" ? `${blockHeight}px` : blockHeight }}
      >
        {line}
      </div>
    );
  }

  return line;
}

const SIDEBAR_LOADING_GROUPS = [
  ["w-24", "w-32", "w-20"],
  ["w-28", "w-20", "w-36", "w-24"],
];

export function SidebarSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      data-sidebar="loading"
      role="status"
      aria-label="Loading navigation"
      className={`flex min-h-0 w-full flex-1 flex-col gap-4 px-2 py-3 ${className}`}
      suppressHydrationWarning
    >
      {SIDEBAR_LOADING_GROUPS.map((widths, groupIndex) => (
        <div key={groupIndex} className="flex flex-col gap-0.5">
          <SkeletonLine className="mb-1 ml-2 h-2 w-16 rounded-full group-data-[state=collapsed]/sidebar:hidden" />
          {widths.map((width, itemIndex) => (
            <div
              key={itemIndex}
              className="flex min-h-8.5 items-center gap-3 rounded-lg px-3 group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-0"
            >
              <SkeletonLine className="size-4.5 shrink-0 rounded-md" />
              <SkeletonLine
                className={`h-2.5 rounded-full group-data-[state=collapsed]/sidebar:hidden ${width}`}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export interface PageHeaderSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  titleWidth?: string;
  descriptionWidth?: string;
  hasDescription?: boolean;
  hasActions?: boolean;
  actionCount?: number;
}

export function PageHeaderSkeleton({
  titleWidth = "w-48",
  descriptionWidth = "w-80",
  hasDescription = true,
  hasActions = true,
  actionCount = 1,
  className = "",
  ...props
}: PageHeaderSkeletonProps) {
  return (
    <div
      className={`mb-6 flex flex-wrap items-start justify-between gap-4 ${className}`}
      suppressHydrationWarning
      {...props}
    >
      <div className="grid gap-1.5">
        <SkeletonLine className={`h-7 ${titleWidth} rounded`} />
        {hasDescription && (
          <SkeletonLine className={`h-4 ${descriptionWidth} rounded`} minWidth={60} maxWidth={95} />
        )}
      </div>
      {hasActions && (
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: actionCount }).map((_, index) => (
            <SkeletonLine
              key={index}
              className="h-8.5 w-24 rounded-lg"
              minWidth={100}
              maxWidth={100}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export interface TableSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  rows?: number;
  columns?: number;
  hasToolbar?: boolean;
  hasPagination?: boolean;
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  hasToolbar = true,
  hasPagination = true,
  className = "",
  ...props
}: TableSkeletonProps) {
  return (
    <div className={`grid gap-4 ${className}`} suppressHydrationWarning {...props}>
      {hasToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SkeletonLine className="h-8.5 w-60 rounded-lg" minWidth={100} maxWidth={100} />
            <SkeletonLine className="h-8.5 w-24 rounded-lg" minWidth={100} maxWidth={100} />
          </div>
          <SkeletonLine className="h-8.5 w-28 rounded-lg" minWidth={100} maxWidth={100} />
        </div>
      )}

      <LayerCard className="w-full overflow-x-auto p-0">
        <Table layout="fixed">
          <Table.Header>
            <Table.Row>
              <Table.Head className="w-2/5">
                <SkeletonLine className="h-3.5 w-24 rounded" minWidth={60} maxWidth={90} />
              </Table.Head>
              {Array.from({ length: Math.max(1, columns - 2) }).map((_, index) => (
                <Table.Head key={index}>
                  <SkeletonLine className="h-3.5 w-20 rounded" minWidth={50} maxWidth={80} />
                </Table.Head>
              ))}
              <Table.Head sticky="right" className="w-14">
                <span className="sr-only">Actions</span>
              </Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <Table.Row key={rowIndex}>
                <Table.Cell>
                  <div className="flex items-center gap-3">
                    <SkeletonLine
                      className="size-6 shrink-0 rounded-md"
                      minWidth={100}
                      maxWidth={100}
                    />
                    <div className="grid w-full max-w-xs gap-1">
                      <SkeletonLine className="h-4 w-3/4 rounded" minWidth={50} maxWidth={85} />
                      <SkeletonLine className="h-3 w-1/2 rounded" minWidth={35} maxWidth={65} />
                    </div>
                  </div>
                </Table.Cell>
                {Array.from({ length: Math.max(1, columns - 2) }).map((_, colIndex) => (
                  <Table.Cell key={colIndex}>
                    {colIndex % 2 === 0 ? (
                      <SkeletonLine className="h-5 w-20 rounded-full" minWidth={60} maxWidth={90} />
                    ) : (
                      <SkeletonLine className="h-3.5 w-28 rounded" minWidth={45} maxWidth={80} />
                    )}
                  </Table.Cell>
                ))}
                <Table.Cell sticky="right">
                  <SkeletonLine className="size-7 rounded-md" minWidth={100} maxWidth={100} />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        {hasPagination && (
          <div className="flex items-center justify-between border-t border-kumo-line px-4 py-3">
            <SkeletonLine className="h-3.5 w-32 rounded" minWidth={100} maxWidth={100} />
            <div className="flex items-center gap-2">
              <SkeletonLine className="h-7 w-16 rounded-md" minWidth={100} maxWidth={100} />
              <SkeletonLine className="h-7 w-16 rounded-md" minWidth={100} maxWidth={100} />
            </div>
          </div>
        )}
      </LayerCard>
    </div>
  );
}

export interface CardGridSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  count?: number;
  columns?: 2 | 3 | 4;
  hasToolbar?: boolean;
}

export function CardGridSkeleton({
  count = 6,
  columns = 3,
  hasToolbar = true,
  className = "",
  ...props
}: CardGridSkeletonProps) {
  const gridColsClass =
    columns === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : columns === 4
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className={`grid gap-4 ${className}`} suppressHydrationWarning {...props}>
      {hasToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SkeletonLine className="h-8.5 w-60 rounded-lg" minWidth={100} maxWidth={100} />
            <SkeletonLine className="h-8.5 w-24 rounded-lg" minWidth={100} maxWidth={100} />
          </div>
          <SkeletonLine className="h-8.5 w-28 rounded-lg" minWidth={100} maxWidth={100} />
        </div>
      )}

      <div className={`grid gap-4 ${gridColsClass}`}>
        {Array.from({ length: count }).map((_, index) => (
          <LayerCard key={index} className="flex flex-col justify-between p-4">
            <div>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <SkeletonLine
                    className="size-8.5 shrink-0 rounded-lg"
                    minWidth={100}
                    maxWidth={100}
                  />
                  <div className="grid gap-1">
                    <SkeletonLine className="h-4 w-28 rounded" minWidth={60} maxWidth={90} />
                    <SkeletonLine className="h-3 w-16 rounded" minWidth={50} maxWidth={80} />
                  </div>
                </div>
                <SkeletonLine className="h-5 w-14 rounded-full" minWidth={100} maxWidth={100} />
              </div>

              <div className="mb-4 grid gap-1.5">
                <SkeletonLine className="h-3 w-full rounded" minWidth={85} maxWidth={100} />
                <SkeletonLine className="h-3 w-4/5 rounded" minWidth={70} maxWidth={90} />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-kumo-line pt-3">
              <SkeletonLine className="h-3.5 w-24 rounded" minWidth={60} maxWidth={90} />
              <SkeletonLine className="h-7 w-16 rounded-md" minWidth={100} maxWidth={100} />
            </div>
          </LayerCard>
        ))}
      </div>
    </div>
  );
}

export interface DetailSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  sections?: number;
  hasTabs?: boolean;
}

export function DetailSkeleton({
  sections = 2,
  hasTabs = true,
  className = "",
  ...props
}: DetailSkeletonProps) {
  return (
    <div className={`grid gap-6 ${className}`} suppressHydrationWarning {...props}>
      <div className="flex items-center gap-2">
        <SkeletonLine className="h-8 w-24 rounded-lg" minWidth={100} maxWidth={100} />
      </div>

      {hasTabs && (
        <div className="flex items-center gap-6 border-b border-kumo-line pb-2">
          <SkeletonLine className="h-4.5 w-20 rounded" minWidth={100} maxWidth={100} />
          <SkeletonLine className="h-4.5 w-24 rounded" minWidth={100} maxWidth={100} />
          <SkeletonLine className="h-4.5 w-16 rounded" minWidth={100} maxWidth={100} />
        </div>
      )}

      <div className="grid gap-6">
        {Array.from({ length: sections }).map((_, sectionIndex) => (
          <LayerCard key={sectionIndex} className="grid gap-5 p-5">
            <div className="grid gap-1">
              <SkeletonLine className="h-5 w-40 rounded" minWidth={50} maxWidth={80} />
              <SkeletonLine className="h-3.5 w-72 rounded" minWidth={60} maxWidth={90} />
            </div>

            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <SkeletonLine className="h-3.5 w-24 rounded" minWidth={60} maxWidth={90} />
                <SkeletonLine className="h-9 w-full rounded-lg" minWidth={100} maxWidth={100} />
              </div>
              <div className="grid gap-1.5">
                <SkeletonLine className="h-3.5 w-32 rounded" minWidth={60} maxWidth={90} />
                <SkeletonLine className="h-9 w-full rounded-lg" minWidth={100} maxWidth={100} />
              </div>
              <div className="grid gap-1.5">
                <SkeletonLine className="h-3.5 w-28 rounded" minWidth={60} maxWidth={90} />
                <SkeletonLine className="h-20 w-full rounded-lg" minWidth={100} maxWidth={100} />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-kumo-line pt-4">
              <SkeletonLine className="h-4 w-32 rounded" minWidth={50} maxWidth={80} />
              <SkeletonLine className="h-8.5 w-24 rounded-lg" minWidth={100} maxWidth={100} />
            </div>
          </LayerCard>
        ))}
      </div>
    </div>
  );
}

export interface OverviewSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  metricCount?: number;
}

export function OverviewSkeleton({
  metricCount = 4,
  className = "",
  ...props
}: OverviewSkeletonProps) {
  return (
    <div className={`grid gap-6 ${className}`} suppressHydrationWarning {...props}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: metricCount }).map((_, index) => (
          <LayerCard key={index} className="grid gap-3 p-4">
            <div className="flex items-center justify-between">
              <SkeletonLine className="h-3.5 w-24 rounded" minWidth={60} maxWidth={90} />
              <SkeletonLine className="size-6 rounded-md" minWidth={100} maxWidth={100} />
            </div>
            <SkeletonLine className="h-7 w-20 rounded" minWidth={100} maxWidth={100} />
            <SkeletonLine className="h-3 w-32 rounded" minWidth={50} maxWidth={80} />
          </LayerCard>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TableSkeleton rows={4} hasToolbar={false} hasPagination={false} />
        </div>
        <div className="grid gap-4">
          <LayerCard className="grid gap-4 p-4">
            <SkeletonLine className="h-5 w-32 rounded" minWidth={60} maxWidth={90} />
            <div className="grid gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="grid gap-1">
                    <SkeletonLine className="h-3.5 w-28 rounded" minWidth={60} maxWidth={90} />
                    <SkeletonLine className="h-3 w-20 rounded" minWidth={40} maxWidth={70} />
                  </div>
                  <SkeletonLine className="h-5 w-14 rounded-full" minWidth={100} maxWidth={100} />
                </div>
              ))}
            </div>
          </LayerCard>
        </div>
      </div>
    </div>
  );
}

export type PageSkeletonVariant =
  | "table"
  | "grid"
  | "cards"
  | "detail"
  | "form"
  | "overview"
  | "dashboard"
  | "simple";

export interface PageSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: PageSkeletonVariant;
  hasHeader?: boolean;
  titleWidth?: string;
  descriptionWidth?: string;
  hasDescription?: boolean;
  hasActions?: boolean;
  rows?: number;
  columns?: number;
  count?: number;
  sections?: number;
  children?: ReactNode;
}

export function PageSkeleton({
  variant = "table",
  hasHeader = true,
  titleWidth = "w-48",
  descriptionWidth = "w-80",
  hasDescription = true,
  hasActions = true,
  rows = 5,
  columns = 4,
  count = 6,
  sections = 2,
  children,
  className = "",
  ...props
}: PageSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading page content"
      aria-busy="true"
      suppressHydrationWarning
      className={`w-full ${className}`}
      {...props}
    >
      {hasHeader && (
        <PageHeaderSkeleton
          titleWidth={titleWidth}
          descriptionWidth={descriptionWidth}
          hasDescription={hasDescription}
          hasActions={hasActions}
        />
      )}

      {children ? (
        children
      ) : variant === "table" ? (
        <TableSkeleton rows={rows} columns={columns} />
      ) : variant === "grid" || variant === "cards" ? (
        <CardGridSkeleton count={count} />
      ) : variant === "detail" || variant === "form" ? (
        <DetailSkeleton sections={sections} />
      ) : variant === "overview" || variant === "dashboard" ? (
        <OverviewSkeleton />
      ) : (
        <TableSkeleton rows={rows} columns={columns} />
      )}
    </div>
  );
}

export function FullPageSkeleton({ variant = "table", ...props }: PageSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading application"
      aria-busy="true"
      suppressHydrationWarning
      className="flex h-dvh min-h-dvh w-full overflow-hidden bg-kumo-canvas"
    >
      {/* Sidebar skeleton */}
      <div className="hidden h-full w-64 shrink-0 border-r border-kumo-line bg-kumo-surface md:block">
        <div className="flex h-14 items-center justify-between border-b border-kumo-line px-4">
          <div className="flex items-center gap-2">
            <SkeletonLine className="h-7 w-7 rounded-lg" minWidth={100} maxWidth={100} />
            <SkeletonLine className="h-4.5 w-28 rounded" minWidth={100} maxWidth={100} />
          </div>
        </div>
        <SidebarSkeleton />
      </div>

      {/* Main content skeleton */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 items-center justify-between border-b border-kumo-line px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <SkeletonLine className="size-7 rounded-md md:hidden" minWidth={100} maxWidth={100} />
            <div className="flex items-center gap-2">
              <SkeletonLine className="h-4 w-20 rounded" minWidth={100} maxWidth={100} />
              <span className="text-kumo-subtle">/</span>
              <SkeletonLine className="h-4 w-24 rounded" minWidth={100} maxWidth={100} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SkeletonLine className="h-8 w-36 rounded-lg" minWidth={100} maxWidth={100} />
            <SkeletonLine className="size-8 rounded-full" minWidth={100} maxWidth={100} />
          </div>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <PageSkeleton variant={variant} {...props} />
        </main>
      </div>
    </div>
  );
}
