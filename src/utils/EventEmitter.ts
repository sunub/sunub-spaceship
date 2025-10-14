type Callback<T = any> = (...args: T[]) => any;

interface ResolvedName {
  original: string;
  value: string;
  namespace: string;
}

interface EventInfo {
  callback: Callback;
  once?: boolean;
}

/**
 * 개선된 Pub/Sub 패턴 구현 클래스.
 * 네임스페이스를 지원하여 이벤트 관리를 용이하게 합니다.
 */
export default class EventEmitter {
  private callbacks: Record<string, Record<string, EventInfo[]>>;

  constructor() {
    this.callbacks = {};
    this.callbacks.base = {}; // 기본 네임스페이스 초기화
  }

  /**
   * 이벤트 리스너를 등록합니다.
   * @param names - 이벤트 이름들 (쉼표, 공백, 슬래시로 구분)
   * @param callback - 실행할 콜백 함수
   * @returns this (체이닝 가능)
   */
  public on<T = any>(names: string, callback: Callback<T>): this {
    return this.addListener(names, callback, false);
  }

  /**
   * 한 번만 실행되는 이벤트 리스너를 등록합니다.
   * @param names - 이벤트 이름들
   * @param callback - 실행할 콜백 함수
   * @returns this (체이닝 가능)
   */
  public once<T = any>(names: string, callback: Callback<T>): this {
    return this.addListener(names, callback, true);
  }

  /**
   * 이벤트 구독을 해제합니다.
   * @param names - 구독 해제할 이벤트 이름
   * @param callback - (선택사항) 특정 콜백만 제거
   * @returns this (체이닝 가능)
   */
  public off(names: string, callback?: Callback): this {
    if (!this.isValidString(names)) {
      console.warn('Wrong name provided');
      return this;
    }
    
    const resolvedNames = this.parseEventNames(names);

    resolvedNames.forEach((name) => {
      this.removeListener(name, callback);
    });

    return this;
  }

  /**
   * 이벤트를 발생시킵니다.
   * @param name - 발생시킬 이벤트 이름 (하나만 지정)
   * @param args - 콜백 함수에 전달할 인자들
   * @returns 마지막으로 실행된 콜백의 반환 값
   */
  public trigger<T = any>(name: string, ...args: T[]): any {
    if (!this.isValidString(name)) {
      console.warn('Wrong name provided');
      return;
    }

    const resolvedName = this.resolveName(name);
    const callbacksToRun = this.getCallbacks(resolvedName);
    
    let finalResult: any;
    const toRemove: { namespace: string; eventName: string; index: number }[] = [];

    callbacksToRun.forEach((eventInfo, index) => {
      const result = eventInfo.callback.apply(this, args);
      
      if (finalResult === undefined) {
        finalResult = result;
      }

      // once 이벤트는 실행 후 제거
      if (eventInfo.once) {
        toRemove.push({
          namespace: resolvedName.namespace,
          eventName: resolvedName.value,
          index
        });
      }
    });

    // once 이벤트들 정리 (역순으로 제거하여 인덱스 오류 방지)
    toRemove.reverse().forEach(({ namespace, eventName, index }) => {
      this.callbacks[namespace]?.[eventName]?.splice(index, 1);
    });
    
    return finalResult;
  }

  /**
   * 모든 이벤트 리스너를 제거합니다.
   */
  public removeAllListeners(): this {
    this.callbacks = { base: {} };
    return this;
  }

  /**
   * 특정 네임스페이스의 모든 리스너를 제거합니다.
   */
  public removeNamespace(namespace: string): this {
    if (namespace !== 'base') {
      delete this.callbacks[namespace];
    }
    return this;
  }

  /**
   * 등록된 리스너 수를 반환합니다.
   */
  public listenerCount(name: string): number {
    const resolvedName = this.resolveName(name);
    
    if (resolvedName.namespace === 'base') {
      return Object.values(this.callbacks)
        .reduce((count, events) => 
          count + (events[resolvedName.value]?.length || 0), 0);
    }
    
    return this.callbacks[resolvedName.namespace]?.[resolvedName.value]?.length || 0;
  }

  // Private Methods

  private addListener(names: string, callback: Callback, once: boolean): this {
    if (!this.isValidString(names)) {
      console.warn('Wrong names provided');
      return this;
    }
    
    if (typeof callback !== 'function') {
      console.warn('Wrong callback provided');
      return this;
    }

    const resolvedNames = this.parseEventNames(names);
    
    resolvedNames.forEach((name) => {
      // 네임스페이스나 이벤트 배열이 없으면 생성
      this.callbacks[name.namespace] ??= {};
      this.callbacks[name.namespace][name.value] ??= [];

      this.callbacks[name.namespace][name.value].push({
        callback,
        once
      });
    });

    return this;
  }

  private removeListener(name: ResolvedName, targetCallback?: Callback): void {
    // 케이스 1: '.ui' -> 'ui' 네임스페이스 전체 삭제
    if (name.namespace !== 'base' && name.value === '') {
      delete this.callbacks[name.namespace];
      return;
    }

    // 케이스 2: 특정 이벤트 삭제
    const namespacesToCheck = name.namespace === 'base' 
      ? Object.keys(this.callbacks)
      : [name.namespace];

    namespacesToCheck.forEach(namespace => {
      const events = this.callbacks[namespace]?.[name.value];
      if (!events) return;

      if (targetCallback) {
        // 특정 콜백만 제거
        const index = events.findIndex(info => info.callback === targetCallback);
        if (index !== -1) {
          events.splice(index, 1);
        }
      } else {
        // 모든 콜백 제거
        delete this.callbacks[namespace][name.value];
      }

      // 빈 네임스페이스 정리 (base 제외)
      if (namespace !== 'base' && 
          Object.keys(this.callbacks[namespace]).length === 0) {
        delete this.callbacks[namespace];
      }
    });
  }

  private getCallbacks(resolvedName: ResolvedName): EventInfo[] {
    const callbacks: EventInfo[] = [];

    if (resolvedName.namespace === 'base') {
      // 모든 네임스페이스에서 이벤트 찾기
      Object.values(this.callbacks).forEach(events => {
        const eventCallbacks = events[resolvedName.value];
        if (eventCallbacks) {
          callbacks.push(...eventCallbacks);
        }
      });
    } else {
      // 특정 네임스페이스의 이벤트만
      const eventCallbacks = this.callbacks[resolvedName.namespace]?.[resolvedName.value];
      if (eventCallbacks) {
        callbacks.push(...eventCallbacks);
      }
    }
    
    return callbacks;
  }

  /**
   * 이벤트 이름 문자열을 한 번에 파싱하여 ResolvedName 배열로 반환
   */
  private parseEventNames(names: string): ResolvedName[] {
    return names
      .replace(/[^a-zA-Z0-9 ,/.]/g, '')
      .replace(/[,/]+/g, ' ')
      .split(' ')
      .filter(name => name !== '')
      .map(name => this.resolveName(name));
  }

  /**
   * 이벤트 이름을 값과 네임스페이스로 분리합니다.
   */
  private resolveName(name: string): ResolvedName {
    const parts = name.split('.');
    return {
      original: name,
      value: parts[0],
      namespace: parts.length > 1 && parts[1] !== '' ? parts[1] : 'base',
    };
  }

  private isValidString(value: any): value is string {
    return value && typeof value === 'string';
  }
}
