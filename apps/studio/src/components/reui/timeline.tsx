import * as React from "react";
import { cn } from "@/lib/utils";

interface TimelineContextValue {
  orientation?: "vertical" | "horizontal";
  value?: number;
}

const TimelineContext = React.createContext<TimelineContextValue>({
  orientation: "vertical",
  value: 0,
});

function useTimeline() {
  return React.useContext(TimelineContext);
}

interface TimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "vertical" | "horizontal";
  defaultValue?: number;
  value?: number;
}

function Timeline({
  orientation = "vertical",
  defaultValue = 0,
  value,
  className,
  children,
  ...props
}: TimelineProps) {
  const activeValue = value !== undefined ? value : defaultValue;

  return (
    <TimelineContext.Provider value={{ orientation, value: activeValue }}>
      <div
        data-slot="timeline"
        data-orientation={orientation}
        className={cn(
          "group/timeline flex",
          orientation === "vertical" ? "flex-col" : "flex-row",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </TimelineContext.Provider>
  );
}

interface TimelineItemProps extends React.HTMLAttributes<HTMLDivElement> {
  step?: number;
  completed?: boolean;
}

function TimelineItem({ step, completed, className, children, ...props }: TimelineItemProps) {
  const { value = 0, orientation = "vertical" } = useTimeline();
  const isCompleted =
    completed !== undefined ? completed : step !== undefined ? step <= value : false;

  return (
    <div
      data-slot="timeline-item"
      data-completed={isCompleted ? "" : undefined}
      data-orientation={orientation}
      className={cn(
        "group/timeline-item relative flex flex-col",
        orientation === "horizontal" && "flex-1",
        orientation === "vertical" && "not-last:pb-6",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function TimelineHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="timeline-header"
      className={cn("relative flex items-center gap-2.5", className)}
      {...props}
    />
  );
}

function TimelineSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { orientation = "vertical" } = useTimeline();

  if (orientation === "horizontal") {
    return (
      <div
        data-slot="timeline-separator"
        className={cn("h-0.5 w-full bg-border group-last/timeline-item:hidden", className)}
        {...props}
      />
    );
  }

  return (
    <div
      data-slot="timeline-separator"
      className={cn(
        "absolute left-1 top-3 h-[calc(100%+0.75rem)] w-px -translate-x-1/2 bg-border group-last/timeline-item:hidden",
        className,
      )}
      {...props}
    />
  );
}

interface TimelineIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

function TimelineIndicator({ className, children, ...props }: TimelineIndicatorProps) {
  return (
    <div
      data-slot="timeline-indicator"
      className={cn(
        "relative z-10 flex size-2 shrink-0 items-center justify-center rounded-full bg-primary",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function TimelineDate({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="timeline-date"
      className={cn("text-[10px] font-semibold uppercase text-muted-foreground", className)}
      {...props}
    />
  );
}

function TimelineTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h4
      data-slot="timeline-title"
      className={cn("text-xs font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function TimelineDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="timeline-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

function TimelineContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { orientation = "vertical" } = useTimeline();

  return (
    <div
      data-slot="timeline-content"
      className={cn(
        orientation === "vertical" ? "pl-5 pt-1.5" : "pt-2",
        "text-xs text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Timeline,
  TimelineItem,
  TimelineHeader,
  TimelineSeparator,
  TimelineIndicator,
  TimelineDate,
  TimelineTitle,
  TimelineDescription,
  TimelineContent,
};
