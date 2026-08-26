import { describe, expect, test } from "vite-plus/test";
import { renderToString } from "react-dom/server";
import {
  PageSkeleton,
  FullPageSkeleton,
  PageHeaderSkeleton,
  TableSkeleton,
  CardGridSkeleton,
  DetailSkeleton,
  OverviewSkeleton,
} from "../../app/ui/PageSkeleton";

describe("PageSkeleton components", () => {
  test("renders PageHeaderSkeleton with default and custom props", () => {
    const htmlDefault = renderToString(<PageHeaderSkeleton />);
    expect(htmlDefault).toContain("skeleton-line");

    const htmlCustom = renderToString(
      <PageHeaderSkeleton
        titleWidth="w-64"
        descriptionWidth="w-96"
        hasDescription={false}
        hasActions={false}
      />,
    );
    expect(htmlCustom).toContain("w-64");
  });

  test("renders TableSkeleton with specified rows and columns", () => {
    const html = renderToString(<TableSkeleton rows={3} columns={4} />);
    expect(html).toContain("skeleton-line");
    expect(html).toContain("<table");
    expect(html).toContain("<tbody");
  });

  test("renders CardGridSkeleton with specified count and columns", () => {
    const html = renderToString(<CardGridSkeleton count={4} columns={2} />);
    expect(html).toContain("skeleton-line");
    expect(html).toContain("grid-cols-1 sm:grid-cols-2");
  });

  test("renders DetailSkeleton with tabs and form sections", () => {
    const html = renderToString(<DetailSkeleton sections={3} hasTabs={true} />);
    expect(html).toContain("skeleton-line");
  });

  test("renders OverviewSkeleton with metrics and summary layout", () => {
    const html = renderToString(<OverviewSkeleton metricCount={4} />);
    expect(html).toContain("skeleton-line");
  });

  test("renders PageSkeleton with all variants and accessibility attributes", () => {
    const variants = ["table", "grid", "cards", "detail", "form", "overview", "dashboard"] as const;

    for (const variant of variants) {
      const html = renderToString(<PageSkeleton variant={variant} />);
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Loading page content"');
      expect(html).toContain("skeleton-line");
    }
  });

  test("renders FullPageSkeleton with sidebar and app shell layout", () => {
    const html = renderToString(<FullPageSkeleton variant="table" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Loading application"');
    expect(html).toContain("skeleton-line");
  });

  test("guarantees 100% deterministic SSR output without hydration mismatches", () => {
    const render1 = renderToString(<FullPageSkeleton variant="table" />);
    const render2 = renderToString(<FullPageSkeleton variant="table" />);
    expect(render1).toBe(render2);
  });
});
