// Минимальные типы React для проверки типов без пакета @types/react
// (в среде сборки нет доступа к npm-реестру). Проверяются сигнатуры хуков
// и пропсы собственных компонентов; атрибуты HTML-элементов не типизируются.

declare module 'react' {
  export type ReactNode = any;
  export type Key = string | number;
  export type FC<P = {}> = (props: P) => ReactNode;
  export type Dispatch<A> = (value: A) => void;
  export type SetStateAction<S> = S | ((prev: S) => S);
  export type MutableRefObject<T> = { current: T };
  export type RefObject<T> = { current: T | null };
  export type CSSProperties = Record<string, string | number | undefined>;
  export interface SVGAttributes<T = any> { [key: string]: any; _t?: T }
  export interface HTMLAttributes<T = any> { [key: string]: any; _t?: T }
  export type ReactElement = any;
  export type JSX = any;

  export function useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
  export function useReducer<S, A>(reducer: (s: S, a: A) => S, initial: S): [S, Dispatch<A>];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useCallback<T extends (...args: any[]) => any>(cb: T, deps: readonly unknown[]): T;
  export function useRef<T>(initial: T): MutableRefObject<T>;
  export function useRef<T>(initial: T | null): RefObject<T>;
  export function useId(): string;
  export function useSyncExternalStore<T>(subscribe: (cb: () => void) => () => void, getSnapshot: () => T): T;

  export interface Context<T> { Provider: any; _v?: T }
  export function createContext<T>(value: T): Context<T>;
  export function useContext<T>(ctx: Context<T>): T;

  export const Fragment: any;
  export const StrictMode: any;
  export function memo<T>(c: T): T;
  export function startTransition(cb: () => void): void;

  const React: {
    Fragment: any;
  };
  export default React;
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
  export namespace JSX {
    interface Element {}
    interface ElementClass {}
    interface ElementAttributesProperty {}
    interface ElementChildrenAttribute { children: {} }
    interface IntrinsicAttributes { key?: string | number | null }
    interface IntrinsicElements { [name: string]: any }
  }
}

declare module 'react-dom/client' {
  export function createRoot(el: Element): { render(node: any): void; unmount(): void };
}

declare const __APP_VERSION__: string;
declare const __BUILD_ID__: string;
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;
