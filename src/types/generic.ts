type Without1<T, prop> = Pick<T, Exclude<keyof T, prop>>;
type Without2<T, propA, propB> = Without1<Without1<T, propA>, propB>;
export type Without<
  T,
  propA = void,
  propB = void,
  propC = void,
  propD = void
> = Without2<Without2<T, propA, propB>, propC, propD>;

export type Serializable = { toString: () => string };
