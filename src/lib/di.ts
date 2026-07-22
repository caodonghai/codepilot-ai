export type Factory<T> = () => T;

export interface ContainerConfig {
  allowOverride?: boolean;
  defaultScope?: 'singleton' | 'transient';
}

export class DependencyContainer {
  private services = new Map<string, unknown>();
  private factories = new Map<string, Factory<unknown>>();
  private singletons = new Map<string, unknown>();
  private config: ContainerConfig;

  constructor(config: ContainerConfig = {}) {
    this.config = {
      allowOverride: false,
      defaultScope: 'singleton',
      ...config,
    };
  }

  register<T>(key: string, service: T): this {
    if (!this.config.allowOverride && this.services.has(key)) {
      throw new Error(`Service already registered: ${key}`);
    }
    this.services.set(key, service);
    return this;
  }

  registerFactory<T>(key: string, factory: Factory<T>, scope?: 'singleton' | 'transient'): this {
    const resolvedScope = scope ?? this.config.defaultScope;
    if (!this.config.allowOverride && this.factories.has(key)) {
      throw new Error(`Factory already registered: ${key}`);
    }
    this.factories.set(key, factory);
    if (resolvedScope === 'singleton') {
      this.singletons.set(key, Symbol('lazy'));
    }
    return this;
  }

  resolve<T>(key: string): T {
    if (this.services.has(key)) {
      return this.services.get(key) as T;
    }

    if (this.factories.has(key)) {
      const factory = this.factories.get(key) as Factory<T>;
      const singletonKey = this.singletons.get(key);

      if (singletonKey !== undefined) {
        if (singletonKey !== Symbol('lazy')) {
          return singletonKey as T;
        }
        const instance = factory();
        this.singletons.set(key, instance);
        return instance;
      }

      return factory();
    }

    throw new Error(`Service not found: ${key}`);
  }

  has(key: string): boolean {
    return this.services.has(key) || this.factories.has(key);
  }

  unregister(key: string): void {
    this.services.delete(key);
    this.factories.delete(key);
    this.singletons.delete(key);
  }

  clear(): void {
    this.services.clear();
    this.factories.clear();
    this.singletons.clear();
  }

  keys(): string[] {
    return [...new Set([...this.services.keys(), ...this.factories.keys()])];
  }

  createChild(): DependencyContainer {
    const child = new DependencyContainer(this.config);
    child.services = new Map(this.services);
    child.factories = new Map(this.factories);
    child.singletons = new Map(this.singletons);
    return child;
  }

  bind<T>(key: string, factory: Factory<T>): this {
    return this.registerFactory(key, factory);
  }

  singleton<T>(key: string, service: T): this {
    return this.register(key, service);
  }

  transient<T>(key: string, factory: Factory<T>): this {
    return this.registerFactory(key, factory, 'transient');
  }
}

export const createDefaultContainer = (): DependencyContainer => {
  const container = new DependencyContainer();
  container.register('container', container);
  return container;
};

export let globalContainer = createDefaultContainer();

export const resetGlobalContainer = (): void => {
  globalContainer = createDefaultContainer();
};

export const getGlobalContainer = (): DependencyContainer => {
  return globalContainer;
};

export const setGlobalContainer = (container: DependencyContainer): void => {
  globalContainer = container;
};

export const inject = <T>(key: string): T => {
  return globalContainer.resolve<T>(key);
};

export const register = <T>(key: string, service: T): void => {
  globalContainer.register(key, service);
};

export const bind = <T>(key: string, factory: Factory<T>): void => {
  globalContainer.bind(key, factory);
};

export const singleton = <T>(key: string, service: T): void => {
  globalContainer.singleton(key, service);
};

export const transient = <T>(key: string, factory: Factory<T>): void => {
  globalContainer.transient(key, factory);
};
