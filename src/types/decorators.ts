export type AnyPropertyDecorator =
  | PropertyDecorator
  | (<T extends { constructor: any }>(
      ...args: [T, Parameters<PropertyDecorator>[1]]
    ) => ReturnType<PropertyDecorator>);

export type DecoWithGet<
  D extends ClassDecorator | AnyPropertyDecorator,
  R = any
> = D & {
  get: D extends ClassDecorator
    ? (target: Parameters<D>[0]) => R
    : (target: Parameters<D>[0], propertyKey: Parameters<D>[1]) => R;
};
export type DecoFactoryWithGet<
  D extends ClassDecorator | AnyPropertyDecorator,
  F extends (...args: any) => any = (...args: any) => any,
  E extends object = object // eslint-disable-line @typescript-eslint/ban-types
> = {
  (...args: Parameters<F>): D & E;
  get: DecoWithGet<D, ReturnType<F>>['get'];
};
export type DecoWithClassGet<D extends AnyPropertyDecorator, R = any> = D & {
  get: (target: Parameters<D>[0]) => R;
};
export type DecoFactoryWithClassGet<
  D extends AnyPropertyDecorator,
  F extends (...args: any) => any = (...args: any) => any
> = {
  (...args: Parameters<F>): D;
  get: DecoWithClassGet<D, ReturnType<F>>['get'];
};
