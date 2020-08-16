export const NoValue: PropertyDecorator = (target, propertyKey) => {
  Object.defineProperty(target, propertyKey, {
    value: undefined,
    enumerable: false,
    writable: false,
  });
};
