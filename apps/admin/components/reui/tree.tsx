"use client";

import {
  createContext,
  useContext,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { ItemInstance } from "@headless-tree/core";
import { CaretDown, CaretRight, Minus, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type ToggleIconType = "chevron" | "plus-minus";

interface TreeContextValue {
  indent: number;
  currentItem?: ItemInstance<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tree?: any;
  toggleIconType?: ToggleIconType;
}

const TreeContext = createContext<TreeContextValue>({
  indent: 20,
  currentItem: undefined,
  tree: undefined,
  toggleIconType: "chevron",
});

export function useTreeContext() {
  return useContext(TreeContext);
}

export interface TreeProps extends HTMLAttributes<HTMLDivElement> {
  indent?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tree?: any;
  toggleIconType?: ToggleIconType;
  children?: ReactNode;
}

export function Tree({
  indent = 20,
  tree,
  className,
  toggleIconType = "chevron",
  children,
  ...props
}: TreeProps) {
  const containerProps =
    tree && typeof tree.getContainerProps === "function" ? tree.getContainerProps() : {};
  const mergedProps = { ...props, ...containerProps };
  const { style: propStyle, ...otherProps } = mergedProps;

  const mergedStyle = {
    ...propStyle,
    "--tree-indent": `${indent}px`,
  } as React.CSSProperties;

  return (
    <TreeContext.Provider value={{ indent, tree, toggleIconType }}>
      <div
        data-slot="tree"
        style={mergedStyle}
        className={cn("flex flex-col", className)}
        {...otherProps}
      >
        {children}
      </div>
    </TreeContext.Provider>
  );
}

export interface TreeItemProps<T = unknown> extends HTMLAttributes<HTMLButtonElement> {
  item: ItemInstance<T>;
  indent?: number;
  children?: ReactNode;
}

export function TreeItem<T = unknown>({
  item,
  className,
  children,
  onClick,
  ...props
}: TreeItemProps<T>) {
  const parentContext = useTreeContext();
  const { indent } = parentContext;

  const itemProps =
    typeof item.getProps === "function" ? (item.getProps() as Record<string, unknown>) : {};
  const itemOnClick =
    typeof itemProps.onClick === "function"
      ? (itemProps.onClick as (e: MouseEvent<HTMLButtonElement>) => void)
      : undefined;
  const mergedProps = { ...props, ...itemProps };
  const { style: propStyle, ...otherProps } = mergedProps;

  const level = typeof item.getItemMeta === "function" ? item.getItemMeta().level : 0;

  const mergedStyle = {
    ...propStyle,
    "--tree-padding": `${level * indent}px`,
  } as React.CSSProperties;

  const isFolder = typeof item.isFolder === "function" ? item.isFolder() : false;
  const isExpanded = typeof item.isExpanded === "function" ? item.isExpanded() : false;
  const isFocused = typeof item.isFocused === "function" ? item.isFocused() : false;
  const isSelected = typeof item.isSelected === "function" ? item.isSelected() : false;
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (typeof itemOnClick === "function") {
      itemOnClick(e);
    } else if (isFolder) {
      if (isExpanded) {
        item.collapse();
      } else {
        item.expand();
      }
    }
    if (typeof onClick === "function") {
      onClick(e);
    }
  };
  return (
    <TreeContext.Provider
      value={{
        ...parentContext,
        currentItem: item as unknown as ItemInstance<unknown>,
      }}
    >
      <button
        type="button"
        data-slot="tree-item"
        style={mergedStyle}
        className={cn(
          "z-10 ps-[var(--tree-padding)] outline-none select-none not-last:pb-0.5 focus:z-20 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-left w-full cursor-pointer",
          className,
        )}
        data-focus={isFocused}
        data-folder={isFolder}
        data-selected={isSelected}
        aria-expanded={isFolder ? isExpanded : undefined}
        onClick={handleClick}
        {...otherProps}
      >
        {children}
      </button>
    </TreeContext.Provider>
  );
}

export interface TreeItemLabelProps<T = unknown> extends HTMLAttributes<HTMLSpanElement> {
  item?: ItemInstance<T>;
  children?: ReactNode;
}

export function TreeItemLabel<T = unknown>({
  item: propItem,
  children,
  className,
  ...props
}: TreeItemLabelProps<T>) {
  const { currentItem, toggleIconType } = useTreeContext();
  const item = (propItem || currentItem) as ItemInstance<T> | undefined;

  if (!item) {
    return null;
  }

  const isFolder = typeof item.isFolder === "function" ? item.isFolder() : false;
  const isExpanded = typeof item.isExpanded === "function" ? item.isExpanded() : false;

  return (
    <span
      data-slot="tree-item-label"
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-none cursor-pointer w-full hover:bg-kumo-hover in-data-[selected=true]:bg-kumo-selected text-kumo-default",
        !isFolder && "ps-6",
        className,
      )}
      {...props}
    >
      {isFolder ? (
        toggleIconType === "plus-minus" ? (
          isExpanded ? (
            <Minus className="size-3.5 shrink-0 text-kumo-secondary" weight="bold" />
          ) : (
            <Plus className="size-3.5 shrink-0 text-kumo-secondary" weight="bold" />
          )
        ) : isExpanded ? (
          <CaretDown className="size-3.5 shrink-0 text-kumo-secondary" weight="bold" />
        ) : (
          <CaretRight className="size-3.5 shrink-0 text-kumo-secondary" weight="bold" />
        )
      ) : null}
      {children || (typeof item.getItemName === "function" ? item.getItemName() : null)}
    </span>
  );
}
