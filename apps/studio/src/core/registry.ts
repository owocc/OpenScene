import type { AdapterMeta, ComponentMeta, MetaIssue } from "./meta";
import { inspectAdapterMeta } from "./meta";

export class AdapterRegistry {
  private readonly adapters = new Map<string, AdapterMeta>();

  register(adapter: AdapterMeta): this {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Adapter already registered: ${adapter.id}`);
    }
    this.adapters.set(adapter.id, adapter);
    return this;
  }

  list(): AdapterMeta[] {
    return [...this.adapters.values()];
  }

  get(adapterId: string): AdapterMeta | undefined {
    return this.adapters.get(adapterId);
  }

  getComponent(type: string): ComponentMeta | undefined {
    for (const adapter of this.adapters.values()) {
      const component = adapter.components.find((candidate) => candidate.type === type);
      if (component) return component;
    }
    return undefined;
  }

  getAllComponents(): ComponentMeta[] {
    return this.list().flatMap((adapter) => adapter.components);
  }

  diagnostics(): MetaIssue[] {
    return this.list().flatMap((adapter) => inspectAdapterMeta(adapter));
  }
}
