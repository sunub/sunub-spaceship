export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services = new Map<string, any>();
  
  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }
  
  register<T>(key: string, service: T): void {
    this.services.set(key, service);
  }
  
  get<T>(key: string): T {
    const service = this.services.get(key);
    if (!service) {
      throw new Error(`Service ${key} not found`);
    }
    return service as T;
  }
  
  has(key: string): boolean {
    return this.services.has(key);
  }
  
  clear(): void {
    this.services.clear();
  }
}
