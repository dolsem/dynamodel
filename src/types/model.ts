export type Attributes<Klass> = Pick<Klass, {
  [K in keyof Klass]: Klass[K] extends (_: any) => any ? never : K
}[Exclude<keyof Klass, 'constructor'>]>;
